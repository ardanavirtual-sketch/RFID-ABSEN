import { createClient } from "https://esm.sh/@supabase/supabase-js";

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ELEMEN DOM DARI index.html ---
// Menggunakan elemen yang benar dari index.html yang Anda sediakan
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilTitle = document.getElementById('hasil-title');
const hasilNama = document.getElementById('hasil-nama');
const hasilID = document.getElementById('hasil-id');
const hasilWaktu = document.getElementById('hasil-waktu');
const appContainer = document.getElementById('app-container');

// --- PENTING: TAMBAHKAN ELEMEN AUDIO DI index.html ---
// Jika Anda ingin suara, pastikan elemen <audio> ada di index.html (saat ini belum ada)
// const successSound = document.getElementById('success-sound');
// const failSound = document.getElementById('fail-sound');


// =============================
// FUNGSI MEMBACA RFID via OTG (Web Serial API)
// =============================
async function startRFID() {
  statusMessage.textContent = "Menghubungkan ke RFID Reader...";
  updateUIStatus('loading');

  if (!navigator.serial) {
    statusMessage.textContent = "Browser Anda tidak mendukung Web Serial API (OTG). Coba mode HID.";
    updateUIStatus('error');
    console.error("Web Serial API not supported.");
    return;
  }
  
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 }); // Sesuaikan baudRate dengan reader Anda

    statusMessage.textContent = "Reader tersambung. Silakan tap kartu...";
    updateUIStatus('default');

    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let rfidBuffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // Asumsikan data masuk sebagai string
      rfidBuffer += decoder.decode(value, { stream: true });

      // Cek apakah ada karakter Newline/Enter yang menandakan akhir kartu
      const newLineIndex = rfidBuffer.indexOf('\n');
      if (newLineIndex > -1) {
          const card = rfidBuffer.substring(0, newLineIndex).trim();
          rfidBuffer = rfidBuffer.substring(newLineIndex + 1);
          
          if (card.length > 0) {
              await cekCard(card);
          }
      }
    }
  } catch (error) {
    statusMessage.textContent = "Gagal menghubungkan atau membaca reader!";
    updateUIStatus('error');
    console.error("RFID Error:", error);
  }
}

// =============================
// CEK KARTU DI SUPABASE
// =============================
async function cekCard(card) {
  statusMessage.textContent = "Mengecek database...";
  updateUIStatus('processing');
  
  // Ambil data kartu dan departemen
  const { data, error } = await db
    .from("data_master")
    .select("card, nama, departemen, pagi, siang, sore, malam") // <-- departemen DITAMBAHKAN
    .eq("card", card)
    .maybeSingle();

  if (error) {
      statusMessage.textContent = "Kesalahan database saat cek kartu!";
      updateUIStatus('error');
      console.error("Supabase Error:", error);
      // Atur ulang status setelah 5 detik
      setTimeout(() => updateUIStatus('default', 'Reader tersambung. Silakan tap kartu...'), 5000);
      return;
  }

  const result = {
      success: false,
      message: 'Kartu Tidak Terdaftar!',
      rfidId: card,
      nama: 'Pengguna tidak terdaftar',
      departemen: 'N/A',
      status_log: 'Gagal (Unknown Card)'
  };

  if (data) {
    result.nama = data.nama;
    result.departemen = data.departemen || 'N/A';
    
    // CEK JATAH MAKAN
    const dapatMakan =
      data.pagi === "Kantin" ||
      data.siang === "Kantin" ||
      data.sore === "Kantin" ||
      data.malam === "Kantin";

    if (dapatMakan) {
      // TODO: Tambahkan Logika Cek Double Tap di sini jika diperlukan
      result.success = true;
      result.message = `Absen Sukses! Selamat Makan, ${data.nama}!`;
      result.status_log = "Sukses";
    } else {
      result.success = false;
      result.message = `GAGAL: Tidak ada jatah makan hari ini!`;
      result.status_log = "Gagal (No Jatah)";
    }

    // Log absensi ke database (baik sukses maupun gagal)
    await db.from("log_absen").insert({
        card: result.rfidId,
        nama: result.nama,
        departemen: result.departemen, // <-- KOLOM BARU DI LOG
        status: result.status_log
    });
  }

  displayResult(result);
}

// =============================
// FUNGSI UPDATE UI
// =============================

function updateUIStatus(state, message = null) {
  // Logic untuk mengubah statusCard, statusIcon, dan statusMessage
  statusCard.className = 'p-6 rounded-2xl transition-all duration-300 ';
  statusIcon.className = 'w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full shadow-lg text-white ';
  statusIcon.classList.remove('status-icon', 'animate-spin');

  switch (state) {
      case 'loading':
          statusCard.classList.add('bg-yellow-50');
          statusIcon.classList.add('bg-yellow-500', 'animate-spin');
          statusIcon.innerHTML = `<svg class="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
          statusMessage.classList.add('text-yellow-600');
          break;
      case 'error':
          statusCard.classList.add('bg-error-red/20');
          statusIcon.classList.add('bg-error-red');
          statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
          statusMessage.classList.add('text-error-red');
          break;
      case 'default':
      default:
          statusCard.classList.add('bg-blue-50');
          statusIcon.classList.add('bg-primary-blue/80', 'status-icon');
          statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`;
          statusMessage.classList.add('text-primary-blue');
          break;
  }
  if (message) {
      statusMessage.textContent = message;
  }
  hasilContainer.classList.add('hidden');
}

function displayResult(result) {
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Bersihkan kelas transisi sebelumnya
    appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');

    if (result.success) {
        // successSound.play(); // UNCOMMENT jika Anda menambahkan audio
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        updateUIStatus('success', result.message);
        statusCard.classList.replace('bg-blue-50', 'bg-success-green/20');
        statusIcon.classList.replace('bg-primary-blue/80', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.classList.remove('text-primary-blue');
        statusMessage.classList.add('text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

    } else {
        // failSound.play(); // UNCOMMENT jika Anda menambahkan audio
        appContainer.classList.add('scale-105', 'bg-error-red/20');
        updateUIStatus('error', result.message);
        statusCard.classList.replace('bg-blue-50', 'bg-error-red/20');
        statusIcon.classList.replace('bg-primary-blue/80', 'bg-error-red');
        statusMessage.classList.remove('text-primary-blue');
        statusMessage.classList.add('text-error-red');
        hasilTitle.textContent = 'Detail Kegagalan';
    }

    // Tampilkan Detail
    hasilNama.textContent = result.nama;
    hasilID.textContent = `${result.rfidId} (${result.departemen})`; // Tampilkan departemen
    hasilWaktu.textContent = currentTime;
    hasilContainer.classList.remove('hidden');

    // Atur ulang status setelah 5 detik
    setTimeout(() => {
        updateUIStatus('default', 'Reader tersambung. Silakan tap kartu...');
        appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');
    }, 5000); 
}


// Start
window.onload = startRFID;
