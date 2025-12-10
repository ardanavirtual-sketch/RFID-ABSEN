// app.js (KODE LENGKAP - MEMASTIKAN TOMBOL LOG DETAIL BERFUNGSI)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements (Utama)
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilTitle = document.getElementById('hasil-title');
const hasilNama = document.getElementById('hasil-nama');
const hasilID = document.getElementById('hasil-id');
const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// Audio Elements
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate'); 

// State
let currentRFID = ''; 
let isProcessing = false; 
let logCounters = {
    // Logika ini dipertahankan untuk pencegahan double-tap harian
    total: { success: 0, fail: 0 },
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

const lastTapStatus = new Map(); 
const DEDUPLICATION_WINDOW_MS = 60000; 

const LOCAL_STORAGE_KEY = 'rfid_log_counters';
const LOCAL_STORAGE_DATE_KEY = 'rfid_log_date';
const RESET_HOUR = 1; // Waktu reset harian pada pukul 01:00 WIT


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
        return 'pagi'; 
    }
}

function getTodayDateString() {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    
    return now.toISOString().split('T')[0];
}

function updateUILogCounters() {
    // Dikosongkan karena tampilan counter harian telah dihapus.
}

function setupInitialState() {
    const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);
    const savedDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
    
    const today = getTodayDateString(); 

    if (savedDate !== today) {
        logCounters = {
            total: { success: 0, fail: 0 },
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        localStorage.setItem(LOCAL_STORAGE_DATE_KEY, today);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        lastTapStatus.clear(); 
        console.log("Counter presensi direset karena pergantian hari logis (01:00 WIT). Tanggal logis baru:", today);
    } else if (savedCounters) {
        try {
            logCounters = JSON.parse(savedCounters);
            if (!logCounters.pagi) { 
                throw new Error("Invalid logCounters structure, resetting.");
            }
        } catch (e) {
            console.error("Gagal memuat state logCounters dari Local Storage:", e);
            logCounters = {
                total: { success: 0, fail: 0 },
                pagi: { success: 0, fail: 0 },
                siang: { success: 0, fail: 0 },
                sore: { success: 0, fail: 0 },
                malam: { success: 0, fail: 0 }
            };
        }
    }
    updateUILogCounters();
}

function saveLogCounters() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logCounters));
}

function updateLogCounters(rfidId, isSuccess, period) {
    const statusKey = isSuccess ? 'SUCCESS' : 'FAIL';
    const counterKey = isSuccess ? 'success' : 'fail';
    const previousTap = lastTapStatus.get(rfidId);
    
    if (!previousTap || (Date.now() - previousTap.timestamp) > DEDUPLICATION_WINDOW_MS || previousTap.status !== statusKey) {
        
        if (previousTap && previousTap.status !== statusKey) {
             const prevPeriod = previousTap.period;
             const prevCounterKey = previousTap.status === 'SUCCESS' ? 'success' : 'fail';

             if (logCounters[prevPeriod] && logCounters[prevPeriod][prevCounterKey] > 0) {
                 logCounters[prevPeriod][prevCounterKey]--;
             }
        }

        if (logCounters[period]) {
            logCounters[period][counterKey]++;
        } else {
            logCounters.total[counterKey]++;
        }

        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });

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

function updateUI({ success, message, rfidId, nama, status_log, currentPeriod }) {
    
    updateLogCounters(rfidId, success, currentPeriod); 

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
// LOG ABSENSI DAN PEMELIHARAAN LOG
// ===================================

async function pruneOldLogs() {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const pruneDate = threeDaysAgo.toISOString();
    
    try {
        const { error, count } = await db
            .from('log_absen')
            .delete({ count: 'exact' }) 
            .lt('created_at', pruneDate);

        if (error) {
            console.error('Gagal membersihkan log lama (Pruning):', error);
            return 0;
        }

        const deletedCount = count || 0;
        console.log(`Berhasil membersihkan ${deletedCount} log absensi lama.`);
        return deletedCount;

    } catch (e) {
        console.error('Kesalahan Pruning Log:', e);
        return 0;
    }
}

async function fetchRecentLogs() {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const fromDate = threeDaysAgo.toISOString();

    try {
        const { data, error } = await db
            .from('log_absen')
            .select('created_at, nama, status, periode')
            .gte('created_at', fromDate)
            .order('created_at', { ascending: false }) 
            .limit(100);

        if (error) throw error;
        
        return data || [];

    } catch (e) {
        console.error('Gagal mengambil log absensi:', e);
        return null;
    }
}

async function displayLogsInModal() {
    const logListContainer = document.getElementById('log-list-container');
    const logStatusElement = document.getElementById('log-status');
    
    if (!logListContainer || !logStatusElement) return;
    
    logStatusElement.textContent = 'Memuat log absensi...';
    logListContainer.innerHTML = ''; 

    const logs = await fetchRecentLogs();

    if (logs === null) {
        logStatusElement.textContent = 'Gagal memuat log. Periksa koneksi atau Supabase.';
        return;
    }

    if (logs.length === 0) {
        logStatusElement.textContent = 'Tidak ada log absensi dalam 3 hari terakhir.';
        return;
    }

    logStatusElement.textContent = ''; 

    const tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                    <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th class="py-2 px-1 sm:px-3">Waktu</th>
                        <th class="py-2 px-1 sm:px-3">Nama/Kartu</th>
                        <th class="py-2 px-1 sm:px-3">Periode</th>
                        <th class="py-2 px-1 sm:px-3">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${logs.map(log => {
                        const date = new Date(log.created_at);
                        const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                        
                        const statusColor = log.status.startsWith('Sukses') ? 'bg-success-green text-white' : 'bg-error-red text-white';

                        return `
                            <tr>
                                <td class="py-2 px-1 sm:px-3 whitespace-nowrap text-xs">${dateStr}<br/>**${timeStr}**</td>
                                <td class="py-2 px-1 sm:px-3 text-gray-900 font-medium text-sm">${log.nama}</td>
                                <td class="py-2 px-1 sm:px-3 text-gray-600 text-xs">${log.periode}</td>
                                <td class="py-2 px-1 sm:px-3">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                                        ${log.status.startsWith('Sukses') ? 'Sukses' : 'Gagal'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    logListContainer.innerHTML = tableHTML;
}

// ===================================
// PRESENSI LOGIC (checkCardSupabase)
// ===================================

async function checkCardSupabase(rfidId) {
    if (isProcessing) return; 
    isProcessing = true;

    showProcessingStatus();
    
    const currentPeriod = getCurrentMealPeriod();
    const today = getTodayDateString(); 

    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)",
        currentPeriod: currentPeriod 
    };
    
    try {
        const { data: userData, error: userError } = await db
            .from("data_master")
            .select("nama, pagi, siang, sore, malam")
            .eq("card", rfidId)
            .maybeSingle();

        if (userError) throw userError;

        if (userData) {
            result.nama = userData.nama;
            
            const todayStart = `${today}T00:00:00+00:00`;
            const todayEnd = `${today}T23:59:59+00:00`;
            
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses") 
                .gte("created_at", todayStart)
                .lt("created_at", todayEnd);

            if (logError) throw logError;
            
            if (logData && logData.length > 0) {
                result.success = false;
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return;
            }

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
        
        const { error: logErrorInsert } = await db.from("log_absen").insert({
            card: rfidId,
            nama: result.nama,
            status: result.status_log,
            periode: currentPeriod 
        });

        if (logErrorInsert) console.error("Gagal log absensi:", logErrorInsert);

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

function setupDailyReset() {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setDate(resetTime.getDate() + (now.getHours() >= RESET_HOUR ? 1 : 0));
    resetTime.setHours(RESET_HOUR, 0, 0, 0); 
    
    const delay = resetTime.getTime() - now.getTime();
    
    console.log(`Reset harian akan dipicu dalam ${Math.round(delay / 1000 / 60)} menit pada pukul ${RESET_HOUR}:00 WIT.`);

    setTimeout(() => {
        setupInitialState();
        setInterval(setupInitialState, 24 * 60 * 60 * 1000); 
    }, delay);
}

/**
 * Memastikan tombol dan modal ditemukan dan event listener dipasang
 */
function setupModalListeners() {
    const openLogModalButton = document.getElementById('open-log-modal');
    const logModal = document.getElementById('log-modal');
    const closeLogModalButton = document.getElementById('close-log-modal');

    if (!openLogModalButton || !logModal || !closeLogModalButton) {
        // Log ini akan muncul di console jika ada masalah ID di HTML
        console.error("Kesalahan: Elemen modal/tombol log tidak ditemukan. Periksa ID di index.html.");
        return;
    }
    
    // Listener Tombol Buka
    openLogModalButton.addEventListener('click', () => {
        logModal.style.display = 'flex'; // Menampilkan Modal
        displayLogsInModal(); 
    });

    // Listener Tombol Tutup (X)
    closeLogModalButton.addEventListener('click', () => {
        logModal.style.display = 'none'; // Menyembunyikan Modal
    });

    // Listener Overlay (Tutup saat klik di luar konten modal)
    logModal.addEventListener('click', (e) => {
        if (e.target === logModal) {
            logModal.style.display = 'none';
        }
    });
}


window.onload = async () => {
    // 1. Setup state awal (counter harian)
    setupInitialState(); 
    
    // 2. Pruning Log Lama (Menghapus log > 3 hari dari Supabase)
    await pruneOldLogs();
    
    // 3. Setup listener untuk reset harian 
    setupDailyReset();
    
    // 4. Setup Modal Log Absensi (Akan berjalan setelah DOM dimuat)
    setupModalListeners();
    
    // 5. Setup HID listener
    setupHIDListener();
};
