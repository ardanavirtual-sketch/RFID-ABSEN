// app.js (Kode sudah diupdate untuk: 1. Sinkronisasi Counter Awal dari Supabase, 2. Pencegahan Tap Ganda, 3. Reset Harian pada 01:00 WIT, 4. Sinkronisasi Counter ULANG setelah INSERT log baru)

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

// Elemen Counter Harian
const logSuksesPagiElement = document.getElementById('log-sukses-pagi');
const logGagalPagiElement = document.getElementById('log-gagal-pagi');
const logSuksesSiangElement = document.getElementById('log-sukses-siang');
const logGagalSiangElement = document.getElementById('log-gagal-siang');
const logSuksesSoreElement = document.getElementById('log-sukses-sore');
const logGagalSoreElement = document.getElementById('log-gagal-sore');
const logSuksesMalamElement = document.getElementById('log-sukses-malam');
const logGagalMalamElement = document.getElementById('log-gagal-malam');


// Elemen Audio
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate'); 

// State untuk HID Listener
let currentRFID = ''; 
let isProcessing = false; 

// State for Log Counters 
let logCounters = {
    total: { success: 0, fail: 0 },
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

// Map untuk Deduplikasi di Sisi Klien dan Hitungan Unik per Tap (Disinkronkan dengan Supabase)
// Kunci: rfidId (ex: '12345')
// Nilai: { timestamp: Number, status: 'SUCCESS'|'FAIL', period: 'pagi'|... }
const lastTapStatus = new Map(); 

// State untuk Local Storage & Reset Harian
const LOCAL_STORAGE_KEY = 'rfid_log_counters';
const LOCAL_STORAGE_DATE_KEY = 'rfid_log_date';
const RESET_HOUR = 1; // Waktu reset harian pada pukul 01:00 WIT


// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

function getCurrentMealPeriod() {
    const hour = new Date().getHours();
    
    // Pagi: 04:00 - 09:59
    if (hour >= 4 && hour < 10) { 
        return 'pagi';
    // Siang: 10:00 - 15:59
    } else if (hour >= 10 && hour < 16) { 
        return 'siang';
    // Sore: 16:00 - 20:59
    } else if (hour >= 16 && hour < 21) { 
        return 'sore';
    // Malam: 21:00 - 22:59
    } else if (hour >= 21 && hour < 23) { 
        return 'malam';
    } else {
        // Di luar jam makan, kembalikan periode default (pagi) untuk pencatatan log
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

    // Jika jam saat ini kurang dari 01:00 (RESET_HOUR), mundur ke hari sebelumnya
    if (currentHour < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    
    return now.toISOString().split('T')[0];
}

/**
 * Memperbarui tampilan counter log harian di UI.
 */
function updateUILogCounters() {
    // Pagi
    if(logSuksesPagiElement) logSuksesPagiElement.textContent = logCounters.pagi.success;
    if(logGagalPagiElement) logGagalPagiElement.textContent = logCounters.pagi.fail;
    // Siang
    if(logSuksesSiangElement) logSuksesSiangElement.textContent = logCounters.siang.success;
    if(logGagalSiangElement) logGagalSiangElement.textContent = logCounters.siang.fail;
    // Sore
    if(logSuksesSoreElement) logSuksesSoreElement.textContent = logCounters.sore.success;
    if(logGagalSoreElement) logGagalSoreElement.textContent = logCounters.sore.fail;
    // Malam
    if(logSuksesMalamElement) logSuksesMalamElement.textContent = logCounters.malam.success;
    if(logGagalMalamElement) logGagalMalamElement.textContent = logCounters.malam.fail;
}

/**
 * Menyimpan counter log ke Local Storage.
 */
function saveLogCounters() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logCounters));
}

/**
 * MENGAMBIL SEMUA LOG DARI SUPABASE UNTUK HARI INI DAN MENGHITUNG ULANG COUNTER.
 * Ini adalah fungsi kunci untuk menjamin sinkronisasi counter dari "Ground Truth" (Supabase).
 */
async function fetchAndSetupCountersFromSupabase(today) {
    // Rentang waktu untuk pengecekan log Supabase (dari 00:00:00 hingga 23:59:59 hari logis)
    const todayStart = `${today}T00:00:00+00:00`;
    const todayEnd = `${today}T23:59:59+00:00`;

    // 1. Reset counter state dan deduplikasi UI sebelum diisi dari data Supabase
    logCounters = {
        total: { success: 0, fail: 0 },
        pagi: { success: 0, fail: 0 },
        siang: { success: 0, fail: 0 },
        sore: { success: 0, fail: 0 },
        malam: { success: 0, fail: 0 }
    };
    lastTapStatus.clear(); // Hapus status deduplikasi UI saat sinkronisasi penuh

    try {
        // Ambil data log presensi untuk tanggal logis hari ini
        const { data: logs, error } = await db
            .from("log_absen")
            .select("card, status, periode, created_at")
            .gte("created_at", todayStart)
            .lt("created_at", todayEnd);

        if (error) throw error;

        // Map untuk Deduplikasi Berbasis Data Supabase (Kunci: kartu + periode + status)
        const uniqueTaps = new Map(); 

        // 2. Proses log dari Supabase dan hitung yang unik
        logs.forEach(log => {
            const period = log.periode ? log.periode.toLowerCase() : 'pagi';
            const status = log.status.includes('Sukses') ? 'Sukses' : 'Gagal';
            
            // Kunci unik: Kartu + Periode + Status
            const key = `${log.card}-${period}-${status}`; 
            
            // Hanya hitung log yang unik
            if (!uniqueTaps.has(key)) {
                uniqueTaps.set(key, true);
                
                // 3. Update counter berdasarkan status unik
                if (logCounters[period]) {
                    if (status === 'Sukses') {
                        logCounters[period].success++;
                    } else {
                        logCounters[period].fail++;
                    }
                }

                // 4. Update lastTapStatus untuk UI deduplikasi
                const tapStatus = status === 'Sukses' ? 'SUCCESS' : 'FAIL';
                lastTapStatus.set(log.card, { 
                    timestamp: new Date(log.created_at).getTime(), 
                    status: tapStatus, 
                    period: period 
                });
            }
        });
        
        // 5. Update UI dan Local Storage
        updateUILogCounters();
        saveLogCounters();
        console.log(`[INFO] Counter dimuat dan dihitung ulang dari Supabase untuk tanggal logis ${today}. Jumlah Log unik: ${uniqueTaps.size}`);

    } catch (e) {
        console.error("[ERROR] Gagal memuat counter dari Supabase:", e);
        // Jika gagal koneksi, tampilkan 0 dan simpan 0 ke Local Storage
        updateUILogCounters();
        saveLogCounters();
    }
}


/**
 * Mengatur state awal aplikasi (reset harian dan sinkronisasi data).
 */
async function setupInitialState() {
    const today = getTodayDateString(); 
    const savedDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
    const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);
    
    let shouldFetchFromSupabase = false;

    // A. Cek Reset Harian
    if (savedDate !== today) {
        console.log("[INFO] Counter presensi direset karena pergantian hari logis. Memuat dari Supabase...");
        localStorage.setItem(LOCAL_STORAGE_DATE_KEY, today);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        shouldFetchFromSupabase = true;
    } 
    
    // B. Cek Local Storage (Hanya jika belum di-reset)
    else if (!savedCounters) {
        console.log("[INFO] Local Storage kosong/tidak valid. Memuat dari Supabase...");
        shouldFetchFromSupabase = true;
    } else {
        // Muat dari Local Storage
        try {
            logCounters = JSON.parse(savedCounters);
            // Validasi struktur
            if (!logCounters.pagi) throw new Error("Invalid logCounters structure.");
        } catch (e) {
            console.error("[ERROR] Gagal parse Local Storage. Memuat dari Supabase.", e);
            shouldFetchFromSupabase = true; // Local storage corrupt
        }
    }
    
    // C. Ambil data dari Supabase jika ada reset/LS kosong/LS corrupt/pertama kali load
    // PENTING: Menunggu data Supabase selesai dimuat untuk mendapatkan ground truth.
    await fetchAndSetupCountersFromSupabase(today); 
    
    // Jika data berhasil dimuat/direset, tampilkan di UI
    updateUILogCounters();
}

/**
 * Fungsi ini tidak lagi digunakan untuk menambah counter, 
 * karena kita memanggil ulang fetchAndSetupCountersFromSupabase setelah insert log.
 * Namun, lastTapStatus masih digunakan untuk showAlreadyTappedStatus di UI.
 * * @param {string} rfidId ID kartu yang di-tap
 * @param {boolean} isSuccess Status presensi sukses/gagal
 * @param {string} period Periode waktu (pagi, siang, sore, malam)
 */
function updateLastTapStatus(rfidId, isSuccess, period) {
    const statusKey = isSuccess ? 'SUCCESS' : 'FAIL';
    
    // Simpan status tap baru
    lastTapStatus.set(rfidId, { 
        timestamp: Date.now(), 
        status: statusKey, 
        period: period 
    });
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

/**
 * Menampilkan hasil presensi di UI dan memicu sinkronisasi ulang counter.
 * @param {object} result Objek hasil presensi
 */
async function updateUI(result) {
    
    // Panggil updateLastTapStatus untuk memperbarui status tap terakhir
    updateLastTapStatus(result.rfidId, result.success, result.currentPeriod);
    
    // PENTING: Sinkronkan counter dari Supabase setelah log baru di-insert
    await fetchAndSetupCountersFromSupabase(getTodayDateString());

    appContainer.classList.remove('bg-blue-200/50');
    statusCard.classList.remove('bg-blue-100');

    if (result.success) {
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-success-green/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = result.message;
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
        statusMessage.textContent = result.message;
        statusMessage.classList.replace('text-warning-yellow', 'text-error-red');
        hasilTitle.textContent = 'Detail Kegagalan';

        if (audioFail) {
            audioFail.currentTime = 0; 
            audioFail.play().catch(e => console.error("Gagal memutar audio gagal:", e));
        }
    }

    hasilNama.textContent = result.nama;
    hasilID.textContent = result.rfidId;
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
    await setupInitialState(); 
    
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
            
            // Tentukan rentang waktu untuk pengecekan log Supabase
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
            
            // === LOGIKA PENCEGAHAN TAP GANDA (Ground Truth Supabase) ===
            if (logData && logData.length > 0) {
                // Jika sudah ada log 'Sukses' untuk kartu ini pada periode ini hari ini
                result.success = false; 
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                // Update status tap terakhir (untuk UI)
                updateLastTapStatus(rfidId, false, currentPeriod); 
                
                // Log tap ganda ke Supabase
                const { error: logErrorInsert } = await db.from("log_absen").insert({
                    card: rfidId,
                    nama: result.nama,
                    status: result.status_log,
                    periode: currentPeriod 
                });
                if (logErrorInsert) console.error("Gagal log absensi:", logErrorInsert);

                // Sinkronkan ulang counter untuk memastikan log 'Gagal' terbaru terhitung
                await fetchAndSetupCountersFromSupabase(today); 

                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return; 
            }
            // =======================================


            // 3. Jika belum tap SUKSES, cek jatah makannya
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
    
    // PENTING: Update counter dan UI
    // updateUI akan memicu fetchAndSetupCountersFromSupabase ulang
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
    // 1. Setup state awal (Mendapatkan ground truth dari Supabase)
    // Menggunakan AWAIT untuk memastikan counter Supabase dimuat sebelum input diterima
    await setupInitialState(); 
    
    // 2. Setup listener
    setupHIDListener();
};
