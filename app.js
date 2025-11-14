import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

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

// Referensi Audio dan Overlay
const successSound = document.getElementById('success-sound');
const failSound = document.getElementById('fail-sound');
const audioOverlay = document.getElementById('audio-overlay');
const startButton = document.getElementById('start-button');

// State untuk HID Listener
let currentRFID = ''; 
let isProcessing = false; 


// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

function resetStatus() {
    appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');
    statusCard.classList.remove('bg-success-green/20', 'bg-error-red/20', 'bg-yellow-50');
    statusIcon.classList.remove('bg-success-green', 'bg-error-red', 'bg-yellow-500', 'animate-none');

    statusCard.classList.add('bg-blue-50');
    statusIcon.classList.add('bg-primary-blue/80', 'status-icon');
    statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`;
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-yellow-600');
    statusMessage.classList.add('text-primary-blue');

    hasilContainer.classList.add('hidden');
    hasilNama.textContent = '-';
    hasilID.textContent = '-';
    hasilWaktu.textContent = '-';
    
    statusMessage.textContent = 'Reader Siap. Tap Kartu.';
    readerStatusHint.textContent = 'Listener Keyboard (HID) aktif. Tempelkan kartu.';
}

function showProcessingStatus() {
    statusCard.classList.replace('bg-blue-50', 'bg-yellow-50');
    statusIcon.classList.replace('bg-primary-blue/80', 'bg-yellow-500');
    statusIcon.classList.remove('status-icon'); 
    statusIcon.innerHTML = `<svg class="animate-spin w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    statusMessage.textContent = 'Memproses Data Kartu...';
    statusMessage.classList.replace('text-primary-blue', 'text-yellow-600');
    hasilContainer.classList.add('hidden');
}


function updateUI({ success, message, rfidId, nama, status_log }) {
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Cek apakah suara sudah dimuat, lalu coba putar
    const playSound = (audioElement) => {
        audioElement.currentTime = 0; // Reset ke awal
        audioElement.play().catch(e => console.error("Gagal memutar audio:", e));
    };

    if (success) {
        // --- LOGIKA AUDIO SUKSES ---
        playSound(successSound);
        
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-yellow-50', 'bg-success-green/20');
        statusIcon.classList.replace('bg-yellow-500', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-yellow-600', 'text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

    } else {
        // --- LOGIKA AUDIO GAGAL ---
        playSound(failSound);
        
        appContainer.classList.add('scale-105', 'bg-error-red/20');
        statusCard.classList.replace('bg-yellow-50', 'bg-error-red/20');
        statusIcon.classList.replace('bg-yellow-500', 'bg-error-red');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-yellow-600', 'text-error-red');
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
    
    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)"
    };

    try {
        const { data, error } = await db
            .from("data_master")
            .select("*")
            .eq("card", rfidId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            result.nama = data.nama;
            
            // Logika Cek Jatah Makan
            const dapatMakan =
                data.pagi === "Kantin" ||
                data.siang === "Kantin" ||
                data.sore === "Kantin" ||
                data.malam === "Kantin";

            if (dapatMakan) {
                // Tambahkan logika double tap (misal, cek log absen 5 menit terakhir)
                const { data: recentLog, error: logError } = await db
                    .from("log_absen")
                    .select("created_at")
                    .eq("card", rfidId)
                    .order("created_at", { ascending: false })
                    .limit(1);
                
                if (logError) console.error("Gagal cek log terbaru:", logError);

                const now = new Date();
                let isDoubleTap = false;
                if (recentLog && recentLog.length > 0) {
                    const lastTap = new Date(recentLog[0].created_at);
                    const diffMinutes = (now - lastTap) / (1000 * 60);

                    if (diffMinutes < 5) { // Batas Double Tap 5 menit
                        isDoubleTap = true;
                    }
                }
                
                if (isDoubleTap) {
                    result.success = false;
                    result.message = `Absen GAGAL: Terlalu cepat (Absen Ganda)!`;
                    result.status_log = "Gagal (Double Tap)";
                } else {
                    result.success = true;
                    result.message = 'Absensi Berhasil!';
                    result.status_log = "Sukses";
                }

            } else {
                result.message = `Absen GAGAL: Tidak ada jatah makan!`;
                result.status_log = "Gagal (No Jatah)";
            }
        }
        
        // Log absensi ke database (baik sukses maupun gagal)
        const { error: logError } = await db.from("log_absen").insert({
            card: rfidId,
            nama: result.nama,
            status: result.status_log
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
    // Pastikan listener hanya ditambahkan sekali
    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);

    resetStatus();
}

function handleKeydown(e) {
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

    // Hanya tangkap karakter yang mungkin menjadi bagian dari ID kartu (angka/huruf)
    if (e.key.length === 1 && /[\w\d]/.test(e.key) && currentRFID.length < 20) {
        currentRFID += e.key;
        
        readerStatusHint.textContent = `ID Diterima: ${currentRFID} | Menunggu Enter...`;
        return;
    }

    if (e.key === 'Backspace') {
        currentRFID = currentRFID.slice(0, -1);
        readerStatusHint.textContent = `ID Diterima: ${currentRFID} | Menunggu Enter...`;
    }
}


// ===================================
// FUNGSI AKTIVASI AUDIO (AUTOPLAY FIX)
// ===================================

function activateAudio() {
    // Putar dummy audio (volume 0) untuk membuka batasan Autoplay
    failSound.volume = 0; 
    failSound.play().then(() => {
        failSound.pause(); 
        failSound.volume = 1; 

        // Sembunyikan overlay dengan transisi
        audioOverlay.style.opacity = 0;
        setTimeout(() => {
            audioOverlay.style.display = 'none';
        }, 300);
        
        resetStatus(); // Atur ulang status ke 'Menunggu Kartu'

    }).catch(e => {
        console.error("Gagal putar dummy audio (Cek nama file/path audio di folder assets):", e);
        // Tetap sembunyikan overlay jika gagal, tapi biarkan audio volume 1
        failSound.volume = 1; 
        audioOverlay.style.opacity = 0;
        setTimeout(() => {
            audioOverlay.style.display = 'none';
        }, 300);
        resetStatus();
    });
}


// ===================================
// INISIALISASI
// ===================================

window.onload = () => {
    // Tambahkan listener ke tombol START
    startButton.addEventListener('click', activateAudio);
    
    // Setup listener HID (namun audio baru aktif setelah tombol diklik)
    setupHIDListener();

    // Tampilkan pesan awal sebelum aktivasi
    statusMessage.textContent = 'Klik "Mulai Presensi" untuk mengaktifkan audio.';
    readerStatusHint.textContent = 'Audio non-aktif sampai interaksi pertama.';
};
