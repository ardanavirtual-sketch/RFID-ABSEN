// app.js (Kode sudah dimodifikasi untuk Keyboard Input/HID)

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
const hasilWaktu = document.getElementById('hasil-waktu');
const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// Tambahkan elemen counter baru (Diasumsikan sudah ada di index.html)
const logSuksesElement = document.getElementById('log-sukses');
const logGagalElement = document.getElementById('log-gagal');

// State untuk HID Listener
let currentRFID = ''; // Buffer untuk menampung input ID kartu
let isProcessing = false; // Mencegah double tap saat proses masih berjalan

// State for Log Counters
let logCounters = {
    success: 0,
    fail: 0
};

// State Deduplikasi (Mencegah Hitungan Ganda per Kartu di UI)
const lastTapStatus = new Map(); 
const DEDUPLICATION_WINDOW_MS = 60000; // 60 detik

// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

function getCurrentMealPeriod() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 10) { 
        return 'pagi';
    } else if (hour >= 10 && hour < 14) { 
        return 'siang';
    } else if (hour >= 14 && hour < 18) { 
        return 'sore';
    } else if (hour >= 18 && hour < 23) { 
        return 'malam';
    } else {
        // Default ke 'pagi' atau periode yang paling awal jika di luar range
        return 'pagi'; 
    }
}

function updateLogCounters(rfidId, isSuccess) {
    const statusKey = isSuccess ? 'SUCCESS' : 'FAIL';
    const previousTap = lastTapStatus.get(rfidId);
    
    // Logic Deduplikasi: Hanya hitung jika tap pertama, tap di luar window, atau terjadi perubahan status
    if (!previousTap || (Date.now() - previousTap.timestamp) > DEDUPLICATION_WINDOW_MS || previousTap.status !== statusKey) {
        
        // Sesuaikan counter jika terjadi perubahan status (ex: Gagal -> Sukses)
        if (previousTap && previousTap.status !== statusKey) {
             if (previousTap.status === 'SUCCESS') logCounters.success = Math.max(0, logCounters.success - 1);
             else logCounters.fail = Math.max(0, logCounters.fail - 1);
        }

        // Tambahkan hitungan baru
        if (isSuccess) logCounters.success++;
        else logCounters.fail++;

        // Simpan status tap baru
        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey });

        // Update UI
        if(logSuksesElement) logSuksesElement.textContent = logCounters.success;
        if(logGagalElement) logGagalElement.textContent = logCounters.fail;
        return true; 
    } else if (previousTap.status === statusKey) {
        // Perpanjang window jika duplikat
        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey });
    }
    return false;
}

function showAlreadyTappedStatus(rfidId, nama) {
    appContainer.classList.add('scale-105'); 
    appContainer.classList.remove('bg-success-green/20', 'bg-error-red/20'); 
    appContainer.classList.add('bg-blue-200/50'); // Latar belakang biru muda

    statusCard.classList.replace('bg-warning-yellow/20', 'bg-blue-100'); 
    statusIcon.classList.replace('bg-warning-yellow', 'bg-primary-blue'); 
    statusIcon.classList.remove('status-icon', 'animate-spin'); 
    statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    
    statusMessage.textContent = 'Anda Sudah Melakukan Tap Kartu!';
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-warning-yellow');
    statusMessage.classList.add('text-primary-blue');
    
    hasilTitle.textContent = 'Informasi Absensi';
    hasilNama.textContent = nama || 'Terdaftar';
    hasilID.textContent = rfidId;
    hasilWaktu.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    hasilContainer.classList.remove('hidden');

    // Reset setelah delay
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
    statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`;
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-warning-yellow', 'text-primary-blue'); 
    statusMessage.classList.add('text-primary-blue');

    hasilContainer.classList.add('hidden');
    hasilNama.textContent = '-';
    hasilID.textContent = '-';
    hasilWaktu.textContent = '-';
    
    statusMessage.textContent = 'Reader Siap. Tap Kartu.';
    readerStatusHint.textContent = 'Listener Keyboard (HID) aktif. Tempelkan kartu.';
}

function showProcessingStatus() {
    statusCard.classList.replace('bg-blue-50', 'bg-warning-yellow/20');
    statusIcon.classList.replace('bg-primary-blue/80', 'bg-warning-yellow');
    statusIcon.classList.remove('status-icon'); 
    statusIcon.innerHTML = `<svg class="animate-spin w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    statusMessage.textContent = 'Memproses Data Kartu...';
    statusMessage.classList.replace('text-primary-blue', 'text-warning-yellow');
    hasilContainer.classList.add('hidden');
}

function updateUI({ success, message, rfidId, nama, status_log }) {
    
    updateLogCounters(rfidId, success);

    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    appContainer.classList.remove('bg-blue-200/50');
    statusCard.classList.remove('bg-blue-100');

    if (success) {
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-success-green/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

    } else {
        appContainer.classList.add('scale-105', 'bg-error-red/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-error-red/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-error-red');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-error-red');
        hasilTitle.textContent = 'Detail Kegagalan';
    }

    hasilNama.textContent = nama;
    hasilID.textContent = rfidId;
    hasilWaktu.textContent = currentTime;
    hasilContainer.classList.remove('hidden');

    // Izinkan input baru setelah delay
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
        status_log: "Gagal (Unknown Card)"
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
            const today = new Date().toISOString().split('T')[0];
            
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses")
                .gte("created_at", `${today}T00:00:00+00:00`)
                .lt("created_at", `${today}T23:59:59+00:00`);

            if (logError) throw logError;
            
            // LOGIKA PENCEGAHAN TAP GANDA DARI DATABASE (TAP SUKSES KE-2)
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
        const { error: logError } = await db.from("log_absen").insert({
            card: rfidId,
            nama: result.nama,
            status: result.status_log,
            periode: currentPeriod 
        });

        if (logError) console.error("Gagal log absensi:", logError);

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

window.onload = () => {
    // Pastikan log counter di UI sesuai state awal
    if(logSuksesElement) logSuksesElement.textContent = logCounters.success;
    if(logGagalElement) logGagalElement.textContent = logCounters.fail;
    
    setupHIDListener();
};
