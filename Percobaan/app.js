// app.js (Kode sudah diupdate untuk: 1. Pencegahan Tap Ganda di Supabase, 2. Reset Harian pada 01:00 WIT, 3. Memuat Counter Awal dari Supabase)

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
// hasilWaktu dihapus di versi sebelumnya dan tidak digunakan, jadi saya hapus juga dari daftar DOM Elements

const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// Tambahkan elemen counter baru untuk setiap periode
const logSuksesPagiElement = document.getElementById('log-sukses-pagi');
const logGagalPagiElement = document.getElementById('log-gagal-pagi');
const logSuksesSiangElement = document.getElementById('log-sukses-siang');
const logGagalSiangElement = document.getElementById('log-gagal-siang');
const logSuksesSoreElement = document.getElementById('log-sukses-sore');
const logGagalSoreElement = document.getElementById('log-gagal-sore');
const logSuksesMalamElement = document.getElementById('log-sukses-malam');
const logGagalMalamElement = document.getElementById('log-gagal-malam');


// Tambahkan elemen audio
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate'); 

// State untuk HID Listener
let currentRFID = ''; // Buffer untuk menampung input ID kartu
let isProcessing = false; // Mencegah double tap saat proses masih berjalan

// State for Log Counters 
let logCounters = {
    // Total harian
    total: {
        success: 0,
        fail: 0
    },
    // Per periode
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

// State Deduplikasi UI (Mencegah Hitungan Ganda per Kartu di UI)
const lastTapStatus = new Map(); 
const DEDUPLICATION_WINDOW_MS = 60000; // 60 detik

// State untuk Reset Harian
const LOCAL_STORAGE_KEY = 'rfid_log_counters';
const LOCAL_STORAGE_DATE_KEY = 'rfid_log_date';
const RESET_HOUR = 1; // Waktu reset harian pada pukul 01:00 WIT


// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

function getCurrentMealPeriod() {
    const hour = new Date().getHours();
    
    // Asumsi: WIT = UTC+9. Kode ini bekerja berdasarkan jam lokal browser.
    if (hour >= 4 && hour < 10) { 
        return 'pagi';
    } else if (hour >= 10 && hour < 16) { 
        return 'siang';
    } else if (hour >= 16 && hour < 21) { 
        return 'sore';
    } else if (hour >= 21 && hour < 23) { 
        return 'malam';
    } else {
        // Di luar jam makan (01:00-03:59 atau 23:00-00:59)
        return 'pagi'; 
    }
}

/**
 * Mendapatkan string tanggal hari ini (YYYY-MM-DD), 
 * disesuaikan agar hari baru (untuk tujuan presensi) dimulai pada pukul 01:00.
 */
function getTodayDateString() {
    const now = new Date();
    const currentHour = now.getHours();

    // Jika jam saat ini kurang dari 01:00 (RESET_HOUR), 
    // secara logis presensi kita masih berada di hari sebelumnya.
    if (currentHour < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    
    // Format tanggal menjadi YYYY-MM-DD (contoh: 2025-12-09)
    return now.toISOString().split('T')[0];
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

/**
 * Mengambil semua log presensi untuk hari ini (logis) dari Supabase 
 * dan memperbarui counter di UI/Local Storage.
 */
async function fetchAndSetupCountersFromSupabase() {
    const today = getTodayDateString(); 
    // Rentang waktu untuk pengecekan log Supabase (dari 00:00:00 hingga 23:59:59 hari logis)
    const todayStart = `${today}T00:00:00+00:00`;
    const todayEnd = `${today}T23:59:59+00:00`;

    // Reset counter UI sebelum diisi dari data Supabase
    logCounters = {
        total: { success: 0, fail: 0 },
        pagi: { success: 0, fail: 0 },
        siang: { success: 0, fail: 0 },
        sore: { success: 0, fail: 0 },
        malam: { success: 0, fail: 0 }
    };

    try {
        const { data: logs, error } = await db
            .from("log_absen")
            .select("card, status, periode")
            .gte("created_at", todayStart)
            .lt("created_at", todayEnd);

        if (error) throw error;

        // Map untuk deduplikasi per kartu/periode/status berdasarkan data Supabase
        const uniqueTaps = new Map();

        // 1. Proses log dari Supabase
        logs.forEach(log => {
            const period = log.periode.toLowerCase();
            const status = log.status.includes('Sukses') ? 'SUCCESS' : 'FAIL';
            const key = `${log.card}-${period}-${status}`; // Kunci unik (kartu-periode-status)
            
            // Simpan log, jika ada duplikat, hanya log pertama yang dihitung (berdasarkan Supabase)
            if (!uniqueTaps.has(key)) {
                uniqueTaps.set(key, true);
                
                // 2. Update counter
                if (logCounters[period]) {
                    if (status === 'SUCCESS') {
                        logCounters[period].success++;
                    } else {
                        logCounters[period].fail++;
                    }
                    logCounters.total[status === 'SUCCESS' ? 'success' : 'fail']++;
                }
            }
        });
        
        // 3. Update UI dan Local Storage
        updateUILogCounters();
        saveLogCounters();
        console.log(`Counter presensi dimuat dari Supabase untuk tanggal logis ${today}: Pagi Sukses ${logCounters.pagi.success}, Gagal ${logCounters.pagi.fail}.`);

    } catch (e) {
        console.error("Gagal memuat counter dari Supabase, menggunakan Local Storage terakhir:", e);
        // Jika gagal, gunakan logika Local Storage yang sudah ada
        const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedCounters) {
             try {
                logCounters = JSON.parse(savedCounters);
            } catch (error) {
                 console.error("Gagal parse Local Storage.");
            }
        }
    }
}


async function setupInitialState() {
    const savedDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
    const today = getTodayDateString(); 

    // Reset jika tanggal logis berbeda
    if (savedDate !== today) {
        console.log("Counter presensi direset karena pergantian hari logis (01:00 WIT).");
        localStorage.setItem(LOCAL_STORAGE_DATE_KEY, today);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        lastTapStatus.clear(); // Hapus status deduplikasi UI
        
        // Karena ada reset, panggil fungsi untuk memuat ulang dari Supabase
        await fetchAndSetupCountersFromSupabase(); 

    } else {
        // Jika tanggal sama, coba muat dari Local Storage
        const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (savedCounters) {
            try {
                logCounters = JSON.parse(savedCounters);
                if (!logCounters.pagi) { 
                    throw new Error("Invalid logCounters structure, resetting.");
                }
            } catch (e) {
                console.error("Gagal memuat state logCounters dari Local Storage:", e);
                // Jika Local Storage rusak, muat dari Supabase
                await fetchAndSetupCountersFromSupabase(); 
            }
        } else {
             // Jika tidak ada di Local Storage (misal: browser baru), muat dari Supabase
             await fetchAndSetupCountersFromSupabase(); 
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
    
    // Logic Deduplikasi UI: Hanya hitung jika tap pertama, tap di luar window, atau terjadi perubahan status
    if (!previousTap || (Date.now() - previousTap.timestamp) > DEDUPLICATION_WINDOW_MS || previousTap.status !== statusKey) {
        
        // Sesuaikan counter jika terjadi perubahan status (ex: Gagal -> Sukses)
        if (previousTap && previousTap.status !== statusKey && previousTap.period === period) {
             const prevCounterKey = previousTap.status === 'SUCCESS' ? 'success' : 'fail';

             // Kurangi hitungan lama
             if (logCounters[period] && logCounters[period][prevCounterKey] > 0) {
                 logCounters[period][prevCounterKey]--;
             }
        }

        // Tambahkan hitungan baru
        if (logCounters[period]) {
            logCounters[period][counterKey]++;
        } else {
            // Fallback ke total jika period tidak dikenali
            logCounters.total[counterKey]++; 
        }

        // Simpan status tap baru
        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });

        // Update UI & Local Storage
        updateUILogCounters();
        saveLogCounters();
        return true; 
    } else if (previousTap.status === statusKey) {
        // Perpanjang window jika duplikat
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
    // Pastikan semua class warna dihilangkan
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
    
    // Panggil updateLogCounters untuk mencatat tap baru
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
// PRESENSI LOGIC (SUPABASE)
// ===================================

async function checkCardSupabase(rfidId) {
    // 0. Cek kembali state harian (untuk reset counter UI pada 01:00)
    await setupInitialState(); // Pastikan state awal sudah dimuat/direset
    
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
        // 1. Cek apakah kartu sudah terdaftar di data_master
        const { data: userData, error: userError } = await db
            .from("data_master")
            .select("nama, pagi, siang, sore, malam")
            .eq("card", rfidId)
            .maybeSingle();

        if (userError) throw userError;

        if (userData) {
            result.nama = userData.nama;
            
            // Tentukan rentang waktu untuk pengecekan log Supabase (dari 00:00:00 hingga 23:59:59 hari logis)
            const todayStart = `${today}T00:00:00+00:00`;
            const todayEnd = `${today}T23:59:59+00:00`;
            
            // 2. Cek apakah kartu sudah melakukan presensi SUKSES hari ini (logis) untuk periode ini
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses") // KUNCI: Hanya cek status "Sukses"
                .gte("created_at", todayStart)
                .lt("created_at", todayEnd);

            if (logError) throw logError;
            
            // === LOGIKA PENCEGAHAN TAP GANDA (FIX) ===
            if (logData && logData.length > 0) {
                // Jika sudah ada log 'Sukses' untuk kartu ini pada periode ini hari ini
                result.success = false; // Tetap false karena ini tap kedua
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                // --- KUNCI PERBAIKAN: Tampilkan Status Sudah Tap ---
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return; // KELUAR dari fungsi agar tidak dilanjutkan ke langkah 3 dan log Supabase di langkah 4 tidak dibuat 'Sukses'
            }
            // =======================================


            // 3. Jika belum tap SUKSES, cek jatah makannya
            const statusMakanSaatIni = userData[currentPeriod];

            if (statusMakanSaatIni && statusMakanSaatIni.toLowerCase() === "kantin") {
                result.success = true;
                result.message = `Absensi ${currentPeriod.toUpperCase()} Berhasil! Selamat Makan!`;
                result.status_log = `Sukses`;
            } else {
                result.message = `Absensi ${currentPeriod.toUpperCase()} Gagal: Status **${statusMakanSaatIni || 'KOSONG'}**!`;
                result.status_log = `Gagal (Not Kantin for ${currentPeriod.toUpperCase()})`;
            }
        }
        
        // 4. Log absensi ke Supabase (akan mencatat Sukses atau Gagal, kecuali jika dicegah di langkah 2)
        const { error: logErrorInsert } = await db.from("log_absen").insert({
            card: rfidId,
            nama: result.nama,
            status: result.status_log,
            periode: currentPeriod 
        });

        if (logErrorInsert) console.error("Gagal log absensi:", logErrorInsert);

    } catch (e) {
        // Jika terjadi error (seperti yang terlihat pada gambar)
        console.error("Kesalahan Supabase/Jaringan:", e);
        result.message = 'Kesalahan Server/Jaringan!';
        result.nama = 'Kesalahan Koneksi';
        result.status_log = "Gagal (Error)";
    }
    
    // PENTING: Update counter dan UI
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

window.onload = async () => {
    // 1. Setup state awal (memuat dari Local Storage atau mereset harian)
    // Fungsi ini sekarang akan memprioritaskan pengambilan data dari Supabase 
    // jika data di Local Storage kosong atau sudah kadaluarsa (ganti hari).
    await setupInitialState(); 
    
    // 2. Setup listener
    setupHIDListener();
};
