// app.js (Kode sudah diupdate untuk menggunakan audio duplikasi, perbaikan reset harian, dan fitur Log 3 Hari)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilTitle = document.getElementById('hasil-title');
const hasilNama = document.getElementById('hasil-nama');
const hasilID = document.getElementById('hasil-id');
const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// Log Counters Elements
const logSuksesPagiElement = document.getElementById('log-sukses-pagi');
const logGagalPagiElement = document.getElementById('log-gagal-pagi');
const logSuksesSiangElement = document.getElementById('log-sukses-siang');
const logGagalSiangElement = document.getElementById('log-gagal-siang');
const logSuksesSoreElement = document.getElementById('log-sukses-sore');
const logGagalSoreElement = document.getElementById('log-gagal-sore');
const logSuksesMalamElement = document.getElementById('log-sukses-malam');
const logGagalMalamElement = document.getElementById('log-gagal-malam');

// Audio Elements
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate');

// Modal Elements
const showLogButton = document.getElementById('show-log-btn');
const logModal = document.getElementById('log-modal');
const closeLogModalButton = document.getElementById('close-log-modal');
const logDataContainer = document.getElementById('log-data-container');


// State untuk HID Listener
let currentRFID = ''; // Buffer untuk menampung input ID kartu
let isProcessing = false; // Mencegah double tap saat proses masih berjalan

// State for Log Counters 
let logCounters = {
    // Total harian
    total: { success: 0, fail: 0 },
    // Per periode
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

// State Deduplikasi (Mencegah Hitungan Ganda per Kartu di UI)
const lastTapStatus = new Map(); 
const DEDUPLICATION_WINDOW_MS = 60000; // 60 detik

// State untuk Reset Harian & Log 3 Hari
const LOCAL_STORAGE_KEY = 'rfid_log_counters';
const LOCAL_STORAGE_DATE_KEY = 'rfid_log_date';
const LOCAL_STORAGE_HISTORY_KEY = 'rfid_success_history'; // Key baru untuk log 3 hari
const DAYS_TO_KEEP = 3; // Menjaga data selama 3 hari


// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

function getCurrentMealPeriod() {
    const hour = new Date().getHours();
    
    if (hour >= 4 && hour < 10) { 
        return 'pagi';
    } else if (hour >= 10 && hour < 16) { 
        return 'siang';
    } else if (hour >= 16 && hour < 21) { 
        return 'sore';
    } else if (hour >= 21 && hour < 23) { 
        return 'malam';
    } else {
        // Default ke 'pagi' atau periode yang paling awal jika di luar range
        return 'pagi'; 
    }
}

/**
 * Mengembalikan string tanggal (YYYY-MM-DD) yang digunakan untuk reset harian (01:00 WIT).
 */
function getDailyResetDateString() {
    const now = new Date();
    const resetHour = 1; // 01:00 WIT
    const currentHour = now.getHours();
    
    let dateToUse = new Date(now.getTime());

    // Jika waktu saat ini antara 00:00:00 dan 00:59:59 (sebelum jam reset), 
    if (currentHour < resetHour) {
        // Mundurkan 1 hari untuk mendapatkan tanggal log yang masih berlaku
        dateToUse.setDate(now.getDate() - 1);
    } 
    
    // Format ke YYYY-MM-DD (format lokal)
    return dateToUse.toLocaleDateString('en-CA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
    });
}

function getTodayDateStartForSupabase() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return startOfDay.toISOString(); 
}

function getISOStringNow() {
    return new Date().toISOString();
}

function updateUILogCounters() {
    if(logSuksesPagiElement) logSuksesPagiElement.textContent = logCounters.pagi.success;
    if(logGagalPagiElement) logGagalPagiElement.textContent = logCounters.pagi.fail;
    if(logSuksesSiangElement) logSuksesSiangElement.textContent = logCounters.siang.success;
    if(logGagalSiangElement) logGagalSiangElement.textContent = logCounters.siang.fail;
    if(logSuksesSoreElement) logSuksesSoreElement.textContent = logCounters.sore.success;
    if(logGagalSoreElement) logGagalSoreElement.textContent = logCounters.sore.fail;
    if(logSuksesMalamElement) logSuksesMalamElement.textContent = logCounters.malam.success;
    if(logGagalMalamElement) logGagalMalamElement.textContent = logCounters.malam.fail;
}

// --- LOGIKA RESET HARIAN COUNTER ---
function setupInitialState() {
    const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);
    const savedDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
    const dailyResetDate = getDailyResetDateString(); 

    // Reset jika tanggal yang tersimpan berbeda dari tanggal reset hari ini (01:00 WIT)
    if (savedDate !== dailyResetDate) {
        logCounters = {
            total: { success: 0, fail: 0 },
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        localStorage.setItem(LOCAL_STORAGE_DATE_KEY, dailyResetDate);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        console.log("Counter presensi harian direset karena sudah melewati jam 01:00 WIT.");
    } else if (savedCounters) {
        try {
            logCounters = JSON.parse(savedCounters);
            if (!logCounters.pagi) { 
                throw new Error("Invalid logCounters structure, resetting.");
            }
        } catch (e) {
            console.error("Gagal memuat state logCounters dari Local Storage:", e);
            logCounters = { total: { success: 0, fail: 0 }, pagi: { success: 0, fail: 0 }, siang: { success: 0, fail: 0 }, sore: { success: 0, fail: 0 }, malam: { success: 0, fail: 0 } };
        }
    }
    updateUILogCounters();
}

function saveLogCounters() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logCounters));
    localStorage.setItem(LOCAL_STORAGE_DATE_KEY, getDailyResetDateString());
}
// ------------------------------------


// --- LOGIKA LOG SUKSES 3 HARI ---

/**
 * Memuat riwayat log sukses dari Local Storage
 * @returns {Array<{time: string, nama: string, card: string, period: string}>}
 */
function loadSuccessHistory() {
    const savedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    try {
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
        console.error("Gagal memuat riwayat log sukses:", e);
        return [];
    }
}

/**
 * Menyimpan log sukses baru ke Local Storage dan membersihkan data yang lebih tua dari 3 hari.
 * @param {string} nama 
 * @param {string} rfidId 
 * @param {string} period 
 */
function logSuccessHistory(nama, rfidId, period) {
    let history = loadSuccessHistory();
    
    const newLogEntry = {
        time: getISOStringNow(), // Waktu dalam format ISO
        nama: nama,
        card: rfidId,
        period: period
    };

    history.push(newLogEntry);
    
    // Simpan dulu, lalu bersihkan (cleanup)
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
    
    // Panggil cleanup
    cleanupSuccessHistory();
}

/**
 * Membersihkan log sukses yang lebih tua dari 3 hari.
 */
function cleanupSuccessHistory() {
    const history = loadSuccessHistory();
    const cutoffDate = new Date();
    // Atur batas waktu menjadi 3 hari yang lalu (3 * 24 jam)
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP); 
    
    // Filter log yang masih baru (time > cutoffDate)
    const filteredHistory = history.filter(log => new Date(log.time) >= cutoffDate);
    
    if (filteredHistory.length !== history.length) {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(filteredHistory));
        console.log(`Log Absensi dibersihkan. Dihapus: ${history.length - filteredHistory.length} entri. Sisa: ${filteredHistory.length} entri.`);
    }
    return filteredHistory;
}


function displaySuccessLogModal() {
    // Pastikan cleanup dijalankan setiap kali modal dibuka
    const history = cleanupSuccessHistory(); 
    
    logDataContainer.innerHTML = '';
    
    if (history.length === 0) {
        logDataContainer.innerHTML = '<p class="text-gray-500 italic">Belum ada absensi sukses dalam 3 hari terakhir.</p>';
        return;
    }

    // Kelompokkan berdasarkan tanggal (lokal)
    const groupedLogs = history.reduce((acc, log) => {
        // Konversi ISO string ke Date object lokal
        const localDate = new Date(log.time).toLocaleDateString('id-ID', {
            weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
        });
        
        if (!acc[localDate]) {
            acc[localDate] = [];
        }
        acc[localDate].push(log);
        return acc;
    }, {});

    // Urutkan tanggal dari yang terbaru
    const sortedDates = Object.keys(groupedLogs).sort().reverse();
    
    sortedDates.forEach(date => {
        const dateHeader = document.createElement('h4');
        dateHeader.className = 'font-bold text-gray-700 mt-4 border-b border-dashed pb-1';
        dateHeader.textContent = date;
        logDataContainer.appendChild(dateHeader);
        
        const ul = document.createElement('ul');
        ul.className = 'list-disc list-inside space-y-1 pl-4';
        
        // Urutkan log per hari berdasarkan waktu (terbaru di atas)
        groupedLogs[date].sort((a, b) => new Date(b.time) - new Date(a.time)).forEach(log => {
            const li = document.createElement('li');
            const localTime = new Date(log.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            li.innerHTML = `
                <span class="font-semibold text-primary-blue">${log.nama}</span> - 
                ${log.period.toUpperCase()} (<span class="text-success-green font-medium">${localTime}</span>)
                <span class="text-gray-400 text-xs ml-2">${log.card}</span>
            `;
            ul.appendChild(li);
        });
        logDataContainer.appendChild(ul);
    });
}

function setupModalListeners() {
    showLogButton.addEventListener('click', () => {
        displaySuccessLogModal();
        logModal.classList.remove('hidden');
        logModal.classList.add('flex');
    });

    closeLogModalButton.addEventListener('click', () => {
        logModal.classList.add('hidden');
        logModal.classList.remove('flex');
    });

    // Close modal saat klik di luar area modal
    logModal.addEventListener('click', (e) => {
        if (e.target === logModal) {
            logModal.classList.add('hidden');
            logModal.classList.remove('flex');
        }
    });
}

// ------------------------------------


function updateLogCounters(rfidId, isSuccess, period) {
    const statusKey = isSuccess ? 'SUCCESS' : 'FAIL';
    const counterKey = isSuccess ? 'success' : 'fail';
    const previousTap = lastTapStatus.get(rfidId);
    
    // Logic Deduplikasi
    if (!previousTap || (Date.now() - previousTap.timestamp) > DEDUPLICATION_WINDOW_MS || previousTap.status !== statusKey) {
        
        // Sesuaikan counter jika terjadi perubahan status
        if (previousTap && previousTap.status !== statusKey) {
             const prevPeriod = previousTap.period;
             const prevCounterKey = previousTap.status === 'SUCCESS' ? 'success' : 'fail';

             if (logCounters[prevPeriod] && logCounters[prevPeriod][prevCounterKey] > 0) {
                 logCounters[prevPeriod][prevCounterKey]--;
             }
        }

        // Tambahkan hitungan baru
        if (logCounters[period]) {
            logCounters[period][counterKey]++;
        } else {
            logCounters.total[counterKey]++;
        }

        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });

        updateUILogCounters();
        saveLogCounters();
        return true; 
    } else if (previousTap.status === statusKey) {
        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });
    }
    return false;
}


function showAlreadyTappedStatus(rfidId, nama) {
    appContainer.classList.add('scale-105'); 
    appContainer.classList.remove('bg-success-green/20', 'bg-error-red/20'); 
    appContainer.classList.add('bg-blue-200/50'); 

    statusCard.classList.replace('bg-warning-yellow/20', 'bg-blue-100'); 
    statusIcon.classList.replace('bg-warning-yellow', 'bg-primary-blue'); 
    statusIcon.classList.remove('status-icon', 'animate-spin'); 
    statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    
    statusMessage.textContent = 'Anda Sudah Melakukan Tap Kartu!';
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-warning-yellow');
    statusMessage.classList.add('text-primary-blue');
    
    hasilTitle.textContent = 'Informasi Absensi';
    hasilNama.textContent = nama || 'Terdaftar';
    hasilID.textContent = rfidId;
    
    if (audioDuplicate) {
        audioDuplicate.currentTime = 0; 
        audioDuplicate.play().catch(e => console.error("Gagal memutar audio duplikasi:", e));
    }

    hasilContainer.classList.remove('hidden');

    setTimeout(() => {
        isProcessing = false;
        appContainer.classList.remove('bg-blue-200/50'); 
        resetStatus();
    }, 5000); 
}


function resetStatus() {
    appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20', 'bg-blue-200/50'); 
    statusCard.classList.remove('bg-success-green/20', 'bg-error-red/20', 'bg-warning-yellow/20', 'bg-blue-100'); 
    statusIcon.classList.remove('bg-success-green', 'bg-error-red', 'bg-warning-yellow', 'animate-none');

    statusCard.classList.add('bg-blue-50');
    statusIcon.classList.add('bg-primary-blue/80', 'status-icon');
    statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`;
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-warning-yellow', 'text-primary-blue'); 
    statusMessage.classList.add('text-primary-blue');

    hasilContainer.classList.add('hidden');
    hasilNama.textContent = '-';
    hasilID.textContent = '-';
    
    statusMessage.textContent = 'Reader Siap. Tap Kartu.';
    readerStatusHint.textContent = 'Listener Keyboard (HID) aktif. Tempelkan kartu.';
}

function showProcessingStatus() {
    statusCard.classList.replace('bg-blue-50', 'bg-warning-yellow/20');
    statusIcon.classList.replace('bg-primary-blue/80', 'bg-warning-yellow');
    statusIcon.classList.remove('status-icon'); 
    statusIcon.innerHTML = `<svg class="animate-spin w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    statusMessage.textContent = 'Memproses Data Kartu...';
    statusMessage.classList.replace('text-primary-blue', 'text-warning-yellow');
    hasilContainer.classList.add('hidden');
}

function updateUI({ success, message, rfidId, nama, currentPeriod }) {
    
    // Panggil updateLogCounters untuk log harian
    updateLogCounters(rfidId, success, currentPeriod);
    
    // Jika sukses, log ke riwayat 3 hari
    if (success) {
        logSuccessHistory(nama, rfidId, currentPeriod); // LOG BARU UNTUK 3 HARI
    }

    appContainer.classList.remove('bg-blue-200/50');
    statusCard.classList.remove('bg-blue-100');

    if (success) {
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-success-green/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

        if (audioSuccess) {
            audioSuccess.currentTime = 0; 
            audioSuccess.play().catch(e => console.error("Gagal memutar audio sukses:", e));
        }

    } else {
        appContainer.classList.add('scale-105', 'bg-error-red/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-error-red/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-error-red');
        statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-error-red');
        hasilTitle.textContent = 'Detail Kegagalan';

        if (audioFail) {
            audioFail.currentTime = 0; 
            audioFail.play().catch(e => console.error("Gagal memutar audio gagal:", e));
        }
    }

    hasilNama.textContent = nama;
    hasilID.textContent = rfidId;
    hasilContainer.classList.remove('hidden');

    setTimeout(() => {
        isProcessing = false;
        resetStatus();
    }, 5000); 
}


// ===================================
// PRESENSI LOGIC (SUPABASE)
// ===================================

async function checkCardSupabase(rfidId) {
    if (isProcessing) return; 
    isProcessing = true;

    showProcessingStatus();
    
    const currentPeriod = getCurrentMealPeriod();

    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)",
        currentPeriod: currentPeriod 
    };
    
    try {
        // 1. Cek apakah kartu sudah terdaftar di data_master
        const { data: userData, error: userError } = await db
            .from("data_master")
            .select("nama, pagi, siang, sore, malam")
            .eq("card", rfidId)
            .maybeSingle();

        if (userError) throw userError;

        if (userData) {
            result.nama = userData.nama;
            
            // 2. Cek apakah kartu sudah melakukan presensi sukses hari ini untuk periode ini
            const todayStartISO = getTodayDateStartForSupabase();
            
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses")
                .gte("created_at", todayStartISO); 

            if (logError) throw logError;
            
            // LOGIKA PENCEGAHAN TAP GANDA DARI DATABASE
            if (logData && logData.length > 0) {
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return; 
            }

            // 3. Jika belum tap, cek jatah makannya
            const statusMakanSaatIni = userData[currentPeriod];

            if (statusMakanSaatIni === "Kantin") {
                result.success = true;
                result.message = `Absensi ${currentPeriod.toUpperCase()} Berhasil! Selamat Makan!`;
                result.status_log = `Sukses`;
            } else {
                result.message = `Absensi ${currentPeriod.toUpperCase()} Gagal: Status **${statusMakanSaatIni || 'KOSONG'}**!`;
                result.status_log = `Gagal (Not Kantin for ${currentPeriod.toUpperCase()})`;
            }
        }
        
        // 4. Log absensi ke Supabase 
        // Menggunakan status_log yang sudah di-update
        const { error: logError } = await db.from("log_absen").insert({
            card: rfidId,
            nama: result.nama,
            status: result.status_log,
            periode: currentPeriod 
        });

        if (logError) console.error("Gagal log absensi:", logError);

    } catch (e) {
        console.error("Kesalahan Supabase/Jaringan:", e);
        result.message = 'Kesalahan Server/Jaringan!';
        result.nama = 'Kesalahan Koneksi';
        result.status_log = "Gagal (Error)";
    }
    
    updateUI(result);
}

// ===================================
// HID KEYBOARD LISTENER LOGIC
// ===================================

function setupHIDListener() {
    document.addEventListener('keydown', (e) => {
        if (isProcessing || e.repeat) {
            e.preventDefault(); 
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            
            const rfidId = currentRFID.trim();
            if (rfidId.length > 0) {
                checkCardSupabase(rfidId);
            }
            currentRFID = '';
            
            readerStatusHint.textContent = `Input ID diterima. Menunggu reset...`;
            return;
        }

        if (e.key.length === 1 && /[\w\d]/.test(e.key) && currentRFID.length < 20) {
            currentRFID += e.key;
            
            readerStatusHint.textContent = `ID Diterima: ${currentRFID} | Menunggu Enter...`;
            return;
        }

        if (e.key === 'Backspace') {
            currentRFID = currentRFID.slice(0, -1);
            readerStatusHint.textContent = `ID Diterima: ${currentRFID} | Menunggu Enter...`;
        }
    });

    resetStatus();
}

// ===================================
// INISIALISASI
// ===================================

window.onload = () => {
    // 1. Setup state awal (memuat atau mereset log counters harian)
    setupInitialState(); 
    
    // 2. Setup listener keyboard RFID
    setupHIDListener();
    
    // 3. Setup listener tombol Modal
    setupModalListeners();

    // 4. Jalankan cleanup saat inisialisasi untuk menghapus log lama
    cleanupSuccessHistory();
};
