// app.js (KODE LENGKAP - Reset Logis 00:00:00 WIT & Polling Data)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccacplxi.supabase.co";
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

// Elemen counter per periode
const logSuksesPagiElement = document.getElementById('log-sukses-pagi');
const logGagalPagiElement = document.getElementById('log-gagal-pagi');
const logSuksesSiangElement = document.getElementById('log-sukses-siang');
const logGagalSiangElement = document.getElementById('log-gagal-siang');
const logSuksesSoreElement = document.getElementById('log-sukses-sore');
const logGagalSoreElement = document.getElementById('log-gagal-sore');
const logSuksesMalamElement = document.getElementById('log-sukses-malam');
const logGagalMalamElement = document.getElementById('log-gagal-malam');

// Elemen untuk menampilkan tanggal
const logTanggalHariIniElement = document.getElementById('log-tanggal-hari-ini');


// Tambahkan elemen audio
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate'); 

// Elemen untuk Solusi Autoplay Browser
const interactionOverlay = document.getElementById('interaction-overlay');
const startButton = document.getElementById('start-button');

// State untuk HID Listener
let currentRFID = ''; 
let isProcessing = false; 

// State for Log Counters
let logCounters = {
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

// Konstanta untuk zona waktu WIT
const WIT_OFFSET_HOURS = 9; // WIT = UTC+9


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

/**
 * Mendapatkan rentang tanggal logis (24 jam) untuk query Supabase (UTC), 
 * disesuaikan agar hari baru dimulai tepat pada pukul 00:00:00 WIT.
 */
function getLogDateRangeWIT() {
    const now = new Date();
    
    // Hitung waktu saat ini dalam WIT
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000); 
    const witTime = new Date(utcTime + (3600000 * WIT_OFFSET_HOURS)); 

    // Ambil komponen tanggal berdasarkan waktu WIT
    const yyyy = witTime.getUTCFullYear();
    const mm = witTime.getUTCMonth();
    const dd = witTime.getUTCDate();
    
    // 1. Start Time (Awal Hari Logis): YYYY-MM-DD 00:00:00 WIT
    // Buat tanggal UTC yang merepresentasikan 00:00:00 WIT dari tanggal WIT hari ini
    const startLogisDateWIT = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));

    // Konversi WIT Start Time ke UTC (Kurangi 9 jam)
    startLogisDateWIT.setUTCHours(startLogisDateWIT.getUTCHours() - WIT_OFFSET_HOURS);
    
    // 2. End Time (Batas Eksklusif): YYYY-MM-DD+1 00:00:00 WIT (Tepat tengah malam berikutnya)
    // Dibuat dari startLogisDate dan ditambah 1 hari
    const endLogisDateWIT = new Date(startLogisDateWIT);
    endLogisDateWIT.setUTCDate(endLogisDateWIT.getUTCDate() + 1);

    return {
        todayStart: startLogisDateWIT.toISOString(), // Start of today (00:00:00 WIT, converted to UTC)
        todayEnd: endLogisDateWIT.toISOString()     // Start of tomorrow (00:00:00 WIT, converted to UTC)
    };
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


// FUNGSI UTAMA: Mengambil dan Menghitung Log dari Supabase
async function fetchAndDisplayLogs() {
    const { todayStart, todayEnd } = getLogDateRangeWIT(); 
    
    // Menampilkan Tanggal Hari Ini (Logis WIT)
    if (logTanggalHariIniElement) {
        // Gunakan todayStart untuk mendapatkan tanggal WIT yang benar
        const logicalDateUTC = new Date(todayStart); 
        
        const dateFormatter = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            timeZone: 'Asia/Jayapura' // TimeZone untuk WIT (Waktu Indonesia Timur)
        });

        // Tanggal yang ditampilkan adalah tanggal kalender saat ini di WIT
        logTanggalHariIniElement.textContent = `Tanggal: ${dateFormatter.format(logicalDateUTC)}`;
    }

    try {
        // Ambil semua log dalam rentang 24 jam hari ini (00:00:00 WIT sampai 23:59:59 WIT)
        const { data: logData, error } = await db
            .from("log_absen")
            .select("card, periode, status")
            .gte("created_at", todayStart) // Termasuk 00:00:00 WIT hari ini
            .lt("created_at", todayEnd); // Hingga sebelum 00:00:00 WIT hari berikutnya

        if (error) throw error;
        
        // Reset counter
        logCounters = {
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        
        const uniqueTaps = new Map(); 

        // Proses Deduplikasi Log
        for (const log of logData) {
            const key = `${log.periode}-${log.card}`;
            
            if (!uniqueTaps.has(key)) {
                 uniqueTaps.set(key, log.status);
            } else if (uniqueTaps.get(key) !== 'Sukses' && log.status === 'Sukses') {
                 uniqueTaps.set(key, log.status);
            }
        }
        
        // Isi Log Counters
        for (const [key, status] of uniqueTaps) {
            const [periode] = key.split('-');
            
            if (logCounters[periode]) {
                if (status === 'Sukses') {
                    logCounters[periode].success++;
                } else if (status.startsWith('Gagal')) { 
                    logCounters[periode].fail++;
                }
            }
        }

        updateUILogCounters();

    } catch (e) {
        console.error("Gagal memuat log dari Supabase:", e);
        if (logTanggalHariIniElement) {
            logTanggalHariIniElement.textContent = `Tanggal: Gagal Memuat Data`; 
        }
    }
}


function setupInitialState() {
    // 1. Panggil fetchAndDisplayLogs untuk memuat data dari Supabase saat start
    fetchAndDisplayLogs();
    
    // 2. Set interval untuk refresh data log setiap 1 menit (polling)
    // Ini memastikan log kereset otomatis segera setelah 00:00:00 WIT.
    setInterval(fetchAndDisplayLogs, 60 * 1000); // Setiap 60.000 ms (1 menit)
    console.log("Auto-refresh log aktif setiap 1 menit.");
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
    
    // PENTING: Refresh log dari Supabase setiap kali reset
    fetchAndDisplayLogs();
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
    const { todayStart, todayEnd } = getLogDateRangeWIT(); 

    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)",
        currentPeriod: currentPeriod 
    };
    
    try {
        // 1. Cek apakah kartu terdaftar di data_master
        const { data: userData, error: userError } = await db
            .from("data_master")
            .select("nama, pagi, siang, sore, malam")
            .eq("card", rfidId)
            .maybeSingle();

        if (userError) throw userError;

        if (userData) {
            result.nama = userData.nama;
            
            // 2. CEK DEDUPLIKASI: Cek apakah kartu sudah memiliki log 'Sukses' hari ini (logis) untuk periode ini
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses") 
                .gte("created_at", todayStart)
                .lt("created_at", todayEnd);

            if (logError) throw logError;
            
            // LOGIKA PENCEGAHAN TAP GANDA (SUKSES)
            if (logData && logData.length > 0) {
                result.success = false; 
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return; 
            }

            // 3. Jika belum tap SUKSES, cek jatah makannya (VALIDASI KANTIN)
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
    // 1. Setup state awal (memuat log dari Supabase dan set interval refresh 1 menit)
    setupInitialState(); 
    
    // 2. Setup listener HANYA SETELAH TOMBOL DIKLIK (Solusi Autoplay)
    if (startButton) {
        startButton.addEventListener('click', () => {
            if (interactionOverlay) {
                interactionOverlay.classList.add('opacity-0');
                setTimeout(() => {
                    interactionOverlay.style.display = 'none';
                }, 300);
            }
            setupHIDListener();
            
            // Unlock audio API
            audioSuccess.play().catch(e => { 
                console.warn("Gagal memutar audio dummy, tapi interaksi sudah dilakukan:", e); 
            });
            audioSuccess.pause();
            audioSuccess.currentTime = 0;
            
            console.log("Audio dan HID Listener diaktifkan.");
        });
    } else {
        setupHIDListener();
    }
};
