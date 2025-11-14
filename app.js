// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

// Pastikan Supabase client sudah dimuat di index.html via CDN
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
const simulateButton = document.getElementById('simulate-tap');
const connectButton = document.getElementById('connect-reader');
const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// Data simulasi untuk generate ID acak
const knownCardsSim = [
    { id: '1A2B3C4D', nama: 'Budi Santoso' }, 
    { id: '5E6F7G8H', nama: 'Siti Rahmawati' }
];

// Status Koneksi Serial
let portConnection = null;

// ===================================
// UTILITY/UI FUNCTIONS
// ===================================

/**
 * Mengatur ulang tampilan ke kondisi 'Menunggu Kartu'.
 */
function resetStatus() {
    // Hapus kelas status sebelumnya
    appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');
    statusCard.classList.remove('bg-success-green/20', 'bg-error-red/20', 'bg-warning-yellow/20');
    statusIcon.classList.remove('bg-success-green', 'bg-error-red', 'bg-warning-yellow', 'animate-none');

    // Terapkan kelas 'Menunggu'
    statusCard.classList.add('bg-blue-50');
    statusIcon.classList.add('bg-primary-blue/80', 'status-icon');
    statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`;
    statusMessage.textContent = portConnection ? 'Reader Siap. Tap Kartu.' : 'Menunggu Kartu...';
    statusMessage.classList.remove('text-success-green', 'text-error-red', 'text-warning-yellow');
    statusMessage.classList.add('text-primary-blue');

    hasilContainer.classList.add('hidden');
    hasilNama.textContent = '-';
    hasilID.textContent = '-';
    hasilWaktu.textContent = '-';
    simulateButton.disabled = false;
    simulateButton.textContent = 'Simulasi Tempel Kartu RFID (Klik)';
    
    if (portConnection) {
        connectButton.textContent = 'Reader Tersambung';
        connectButton.classList.replace('bg-gray-600', 'bg-success-green');
        readerStatusHint.textContent = 'Reader Serial Aktif. Tunggu tap fisik.';
    } else {
        connectButton.textContent = 'Hubungkan Reader RFID Serial (OTG)';
        connectButton.classList.replace('bg-success-green', 'bg-gray-600');
        readerStatusHint.textContent = 'Sentuh Kartu RFID Anda ke Reader';
    }
}

/**
 * Menampilkan fase 'Memproses Data'.
 */
function showProcessingStatus() {
    statusCard.classList.replace('bg-blue-50', 'bg-warning-yellow/20');
    statusIcon.classList.replace('bg-primary-blue/80', 'bg-warning-yellow');
    statusIcon.classList.remove('status-icon'); 
    statusIcon.innerHTML = `<svg class="animate-spin w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    statusMessage.textContent = 'Memproses Data Kartu...';
    statusMessage.classList.replace('text-primary-blue', 'text-warning-yellow');
    hasilContainer.classList.add('hidden');
}


/**
 * Mengupdate UI berdasarkan hasil presensi.
 */
function updateUI({ success, message, rfidId, nama, status_log }) {
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (success) {
        // SUKSES
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-success-green/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

    } else {
        // GAGAL
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

    // Atur ulang ke kondisi 'Menunggu' setelah 5 detik
    setTimeout(resetStatus, 5000);
}


// ===================================
// PRESENSI LOGIC (SUPABASE)
// ===================================

/**
 * Memproses kartu RFID dengan mengecek di Supabase.
 * @param {string} rfidId - ID kartu yang diterima dari reader atau simulasi.
 */
async function checkCardSupabase(rfidId) {
    if (!rfidId) return;

    // Tampilkan status memproses
    showProcessingStatus();
    
    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)"
    };

    try {
        // 1. Cek kartu di tabel data_master
        const { data, error } = await db
            .from("data_master")
            .select("*")
            .eq("card", rfidId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            result.nama = data.nama;
            
            // 2. Logika Cek Jatah Makan (dari app.js lama)
            const dapatMakan =
                data.pagi === "Kantin" ||
                data.siang === "Kantin" ||
                data.sore === "Kantin" ||
                data.malam === "Kantin";

            if (dapatMakan) {
                // SUKSES PRESENSI
                result.success = true;
                result.message = 'Absensi Berhasil!';
                result.status_log = "Sukses";
            } else {
                // GAGAL PRESENSI (No Jatah)
                result.message = `Tidak ada jatah makan!`;
                result.status_log = "Gagal (No Jatah)";
            }
        }
        
        // 3. Log data ke tabel log_absen
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

    // 4. Update UI
    updateUI(result);
}

// ===================================
// SERIAL READER LOGIC (Web Serial API)
// ===================================

/**
 * Meminta port serial dan mulai membaca data RFID.
 */
async function startRFID() {
    connectButton.disabled = true;
    connectButton.textContent = "Menghubungkan...";
    readerStatusHint.textContent = "Meminta izin koneksi serial...";

    try {
        portConnection = await navigator.serial.requestPort();
        await portConnection.open({ baudRate: 9600 });
        
        connectButton.textContent = "Reader Tersambung";
        connectButton.classList.replace('bg-gray-600', 'bg-success-green');
        readerStatusHint.textContent = "Reader Serial Aktif. Tunggu tap fisik.";
        statusMessage.textContent = 'Reader Siap. Tap Kartu.';

        const reader = portConnection.readable.getReader();

        // Loop untuk terus membaca data
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const card = new TextDecoder().decode(value).trim();
            
            if (card.length > 0) {
                // Panggil logika Supabase setiap kali kartu baru terbaca
                await checkCardSupabase(card);
            }
        }

    } catch (error) {
        console.error("Gagal menghubungkan atau membaca dari reader:", error);
        portConnection = null; // Reset status koneksi
        connectButton.textContent = "Koneksi Gagal! Coba Lagi.";
        connectButton.classList.replace('bg-success-green', 'bg-error-red');
        readerStatusHint.textContent = "Gagal menghubungkan reader. Cek perangkat dan izin.";
        statusMessage.textContent = 'Gagal Sambungan Serial.';
        
    } finally {
        connectButton.disabled = false;
        if (!portConnection) resetStatus(); // Hanya reset tampilan jika koneksi gagal
    }
}


// ===================================
// SIMULASI LOGIC
// ===================================

/**
 * Fungsi untuk mensimulasikan tempelan kartu (dipicu oleh tombol).
 */
function simulateTapHandler() {
    simulateButton.disabled = true;
    // 80% kemungkinan kartu terdaftar (simulasi sukses atau gagal jatah), 20% tidak dikenal
    const randomChance = Math.random();
    let simulatedId;

    if (randomChance < 0.8) { 
        const randomIndex = Math.floor(Math.random() * knownCardsSim.length);
        simulatedId = knownCardsSim[randomIndex].id;
    } else {
        simulatedId = '9X0Y1Z2A'; // ID yang tidak dikenal (pastikan tidak ada di Supabase)
    }

    // Panggil logika Supabase dengan ID simulasi
    checkCardSupabase(simulatedId);
}


// ===================================
// LISTENERS & INISIALISASI
// ===================================

// Listener untuk tombol simulasi
simulateButton.addEventListener('click', simulateTapHandler);

// Listener untuk tombol koneksi serial
connectButton.addEventListener('click', startRFID);

// Inisialisasi status saat memuat
window.onload = resetStatus;
