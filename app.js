// app.js

import { createClient } from "https://esm.sh/@supabase/supabase-js";

// --- KONFIGURASI SUPABASE ---
// Ganti dengan kredensial Supabase Anda jika berbeda
const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ELEMEN DOM DARI index.html ---
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilTitle = document.getElementById('hasil-title');
const hasilNama = document.getElementById('hasil-nama');
const hasilID = document.getElementById('hasil-id');
const hasilWaktu = document.getElementById('hasil-waktu');
const appContainer = document.getElementById('app-container');

// --- STATE APLIKASI ---
let currentRFID = ''; 
let isProcessing = false; // Kunci input saat proses database berjalan

// =============================
// FUNGSI UTILITY UI
// =============================

function updateUIStatus(state, message = null) {
  statusCard.className = 'p-6 rounded-2xl transition-all duration-300 ';
  statusIcon.className = 'w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full shadow-lg text-white ';
  statusMessage.classList.remove('text-primary-blue', 'text-success-green', 'text-error-red', 'text-yellow-600');
  
  statusIcon.classList.remove('status-icon', 'animate-spin', 'bg-primary-blue/80', 'bg-success-green', 'bg-error-red', 'bg-yellow-500');
  statusCard.classList.remove('bg-blue-50', 'bg-success-green/20', 'bg-error-red/20', 'bg-yellow-50');

  switch (state) {
      case 'processing':
          statusCard.classList.add('bg-yellow-50');
          statusIcon.classList.add('bg-yellow-500', 'animate-spin');
          statusIcon.innerHTML = `<svg class="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
          statusMessage.classList.add('text-yellow-600');
          break;
      case 'success':
          statusCard.classList.add('bg-success-green/20');
          statusIcon.classList.add('bg-success-green');
          statusIcon.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
          statusMessage.classList.add('text-success-green');
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
}

function displayResult(result) {
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');

    if (result.success) {
        updateUIStatus('success', result.message);
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        hasilTitle.textContent = 'Detail Presensi Sukses';
    } else {
        updateUIStatus('error', result.message);
        appContainer.classList.add('scale-105', 'bg-error-red/20');
        hasilTitle.textContent = 'Detail Kegagalan';
    }

    hasilNama.textContent = result.nama;
    hasilID.textContent = `${result.rfidId} (${result.departemen})`;
    hasilWaktu.textContent = currentTime;
    hasilContainer.classList.remove('hidden');

    setTimeout(() => {
        isProcessing = false; // IZINKAN INPUT BARU
        updateUIStatus('default', 'Reader Siap. Silakan tap kartu...');
        appContainer.classList.remove('scale-105', 'bg-success-green/20', 'bg-error-red/20');
        hasilContainer.classList.add('hidden');
    }, 5000); 
}

// =============================
// FUNGSI HID LISTENER 
// =============================
function handleKeydown(e) {
    if (isProcessing) {
        e.preventDefault(); 
        return;
    }
    
    if (e.key === 'Enter') {
        e.preventDefault(); 
        const rfidId = currentRFID.trim();

        if (rfidId.length > 0) {
            isProcessing = true; // Kunci input
            updateUIStatus('processing', 'Memproses Data Kartu...');
            cekCard(rfidId); 
        }
        currentRFID = ''; // Reset buffer input
        return;
    }

    if (e.key.length === 1 && /^[a-zA-Z0-9]+$/.test(e.key) && currentRFID.length < 20) {
        e.preventDefault(); 
        currentRFID += e.key;
    }
    
    if (e.key === 'Backspace') {
        currentRFID = currentRFID.slice(0, -1);
    }
}

// =============================
// FUNGSI PENENTU SLOT WAKTU (BARU)
// =============================

/**
 * Menentukan slot waktu berdasarkan jam saat ini.
 * @returns {string|null} 'pagi', 'siang', 'sore', 'malam', atau null jika di luar jam absen.
 */
function getCurrentSlot() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // Konversi ke format HHMM (e.g., 05:00 -> 500, 14:30 -> 1430)
    const currentTimeHHMM = currentHour * 100 + currentMinute; 

    // Pagi: 05:00 - 09:00 (500 sampai 900)
    if (currentTimeHHMM >= 500 && currentTimeHHMM <= 900) return 'pagi';
    
    // Siang: 11:00 - 14:00 (1100 sampai 1400)
    if (currentTimeHHMM >= 1100 && currentTimeHHMM <= 1400) return 'siang';

    // Sore: 17:00 - 20:00 (1700 sampai 2000)
    if (currentTimeHHMM >= 1700 && currentTimeHHMM <= 2000) return 'sore';

    // Malam: 22:00 - 05:00
    // (2200 sampai 2359) ATAU (0000 sampai 0459)
    if (currentTimeHHMM >= 2200 || currentTimeHHMM < 500) return 'malam';

    // Di luar jam absen yang ditentukan
    return null; 
}


// =============================
// CEK KARTU DI SUPABASE (LOGIKA ABSEN BERDASARKAN JAM)
// =============================
async function cekCard(card) {
  
  const currentSlot = getCurrentSlot();
  
  let result = {
      success: false,
      message: 'Kartu Tidak Terdaftar!',
      rfidId: card,
      nama: 'Pengguna tidak terdaftar',
      departemen: 'N/A',
      status_log: 'Gagal (Unknown Card)'
  };

  try {
    // 1. Cek Kartu di Database
    const { data, error } = await db
      .from("data_master")
      .select("card, nama, departemen, pagi, siang, sore, malam")
      .eq("card", card)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      result.nama = data.nama;
      result.departemen = data.departemen || 'N/A';
      
      // 2. Cek Jam Absen
      if (!currentSlot) {
          result.success = false;
          result.message = `GAGAL: Tap di luar jam absen!`;
          result.status_log = `Gagal (Diluar Jam Absen)`;

      } else {
        // 3. Cek Jatah Makan pada Slot yang Aktif
        const jatahUntukSlotIni = data[currentSlot]; // Ambil nilai dari kolom 'pagi', 'siang', 'sore', atau 'malam'
        
        if (jatahUntukSlotIni === "Kantin") {
          
          // --- LOGIKA CEK DOUBLE TAP (5 menit cooldown) ---
          const { data: recentLog } = await db
              .from("log_absen")
              .select("created_at")
              // Cek tap ganda hanya untuk slot yang sama
              .eq("card", card)
              .like("status", `%(${currentSlot.toUpperCase()})%`) 
              .order("created_at", { ascending: false })
              .limit(1);

          let isDoubleTap = false;
          if (recentLog && recentLog.length > 0) {
              const lastTap = new Date(recentLog[0].created_at).getTime();
              const now = new Date().getTime();
              const diffMinutes = (now - lastTap) / (1000 * 60);

              if (diffMinutes < 5) {
                  isDoubleTap = true;
              }
          }
          
          if (isDoubleTap) {
              result.success = false;
              result.message = `Absen GAGAL: Terlalu cepat (Absen Ganda)!`;
              result.status_log = `Gagal (Double Tap ${currentSlot.toUpperCase()})`;
          } else {
              result.success = true;
              result.message = `Absen Sukses Slot ${currentSlot.toUpperCase()}! Selamat, ${data.nama}!`;
              result.status_log = `Sukses (${currentSlot.toUpperCase()})`;
          }

        } else {
          // Tidak ada jatah ('Tidak Ada' atau null) untuk slot ini
          result.success = false;
          result.message = `GAGAL: Tidak ada jatah makan slot ${currentSlot.toUpperCase()} hari ini!`;
          result.status_log = `Gagal (No Jatah ${currentSlot.toUpperCase()})`;
        }
      }
    }
    
    // --- PENCATATAN LOG UNTUK SEMUA TAP ---
    const { error: logError } = await db.from("log_absen").insert({
        card: result.rfidId,
        nama: result.nama,
        departemen: result.departemen,
        status: result.status_log
    });

    if (logError) throw logError;
    
    displayResult(result);

  } catch (error) {
    console.error("Kesalahan Supabase/Jaringan:", error);
    
    // Log kegagalan saat proses pengecekan database/koneksi
    await db.from("log_absen").insert({
        card: card,
        nama: 'Error Koneksi Database',
        departemen: 'N/A',
        status: "Gagal (Error Koneksi)"
    });
    
    displayResult({
        success: false,
        message: 'Kesalahan Server/Jaringan!',
        rfidId: card,
        nama: 'Kesalahan Koneksi',
        departemen: 'N/A',
        status_log: "Gagal (Error)"
    });
  }
}

// =============================
// INISIALISASI
// =============================
window.onload = () => {
    document.addEventListener('keydown', handleKeydown);
    updateUIStatus('default', 'Reader Siap. Silakan tap kartu...');
};
