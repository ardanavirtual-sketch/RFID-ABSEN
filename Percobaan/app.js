// app.js (KODE LENGKAP - Deduplikasi Supabase, Tanggal Logis WIT, & Fix Audio Autoplay)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

// PASTIKAN URL dan KEY Supabase Anda sudah benar
const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// State global untuk melacak tanggal log yang sedang aktif (YYYY-MM-DD)
let currentLogDate = '';

// DOM Elements - TAMPILAN TAP KARTU
const tapContainer = document.getElementById('tap-container');
const logHarianTapKartu = document.getElementById('log-harian-tap-kartu'); // Kontainer Log Harian (disembunyikan di Tap Kartu)
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilNama = document.getElementById('hasil-nama');
const hasilWaktu = document.getElementById('hasil-waktu');
const hasilPeriode = document.getElementById('hasil-periode');

// DOM Elements - LOG HARIAN SUMMARY
const totalTapElement = document.getElementById('total-tap');
const suksesTapElement = document.getElementById('sukses-tap');
const gagalTapElement = document.getElementById('gagal-tap');

// DOM Elements - TAMPILAN LOG ABSEN
const logContainer = document.getElementById('log-container');
const logDetailStatus = document.getElementById('log-detail-status');
const logDetailBody = document.getElementById('log-detail-body');

// DOM Elements - NAVIGASI
const navTapKartu = document.getElementById('nav-tap-kartu');
const navLogAbsen = document.getElementById('nav-log-absen');

// DOM Elements - AUDIO
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');

// DOM Elements - INTERAKSI AWAL
const interactionOverlay = document.getElementById('interaction-overlay');
const startButton = document.getElementById('start-button');

// ===================================
// UTILITY: DATE & TIME HANDLING (WIT: UTC+9)
// ===================================

// Mendapatkan objek Date yang disetel ke waktu di TimeZone WIT (UTC+9)
const getWITDateObject = () => {
    // Menggunakan Intl.DateTimeFormat untuk mendapatkan representasi waktu di WIT
    const now = new Date();
    // Konversi ke string di WIT
    const witString = now.toLocaleString('en-US', { 
        timeZone: 'Asia/Jayapura', 
        year: 'numeric', month: 'numeric', day: 'numeric', 
        hour: 'numeric', minute: 'numeric', second: 'second' 
    });
    // Konversi kembali ke objek Date.
    return new Date(witString);
};

// Mengambil tanggal untuk filter Supabase (YYYY-MM-DD)
const getSupabaseDateFilter = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Mengambil waktu WIT yang diformat untuk UI (HH:MM:SS)
const getWIBTimeFormatted = (dateObj) => {
    return dateObj.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// Mengambil tanggal WIT yang diformat untuk UI
const getWIBDateFormatted = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// ===================================
// UTILITY: JAM OTOMATIS & CEK PERGANTIAN HARI
// ===================================

/**
 * Memperbarui tampilan jam dan melakukan pengecekan pergantian tanggal.
 * Jika tanggal berganti, log harian akan di-reset (di-reload untuk tanggal baru).
 */
const updateClockAndCheckDate = () => {
    const nowWIT = getWITDateObject();
    const dateForSupabase = getSupabaseDateFilter(nowWIT); // YYYY-MM-DD
    const dateForDisplay = getWIBDateFormatted(nowWIT);

    // 1. Update tampilan waktu
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
        timeDisplay.textContent = getWIBTimeFormatted(nowWIT);
    }

    // 2. Cek apakah tanggal telah berganti
    if (dateForSupabase !== currentLogDate) {
        console.log(`[CLOCK] Tanggal berubah! Dari ${currentLogDate || '[Awal]'} ke ${dateForSupabase}. Melakukan reset log...`);

        // 2a. Update tampilan tanggal
        const dateDisplay = document.getElementById('current-date');
        if (dateDisplay) {
            dateDisplay.textContent = dateForDisplay;
        }

        // 2b. Set variabel global untuk tanggal hari ini
        currentLogDate = dateForSupabase;

        // 2c. Muat ulang data untuk tanggal yang baru (Reset log display)
        updateDailyLogSummary();
        
        // Perbarui tampilan detail log (jika sedang dibuka)
        if (logContainer && logContainer.style.display !== 'none') {
             loadLogDetail();
        }
        
        // Tampilkan notifikasi singkat pergantian hari
        updateStatusDisplay('TANGGAL BERGANTI: Log presensi harian di-reset.', 'info');
    }
};

/**
 * Memulai loop jam otomatis dan pengecekan pergantian hari.
 */
const startClockLoop = () => {
    updateClockAndCheckDate(); // Panggil sekali untuk inisialisasi awal
    setInterval(updateClockAndCheckDate, 1000); // Atur interval 1 detik
    console.log("Loop Jam Otomatis dan Cek Pergantian Hari diaktifkan.");
};


// ===================================
// UTILITY: TAMPILAN STATUS
// ===================================

const updateStatusDisplay = (message, type, successName = null, successTime = null, successPeriod = null) => {
    statusCard.classList.remove('bg-yellow-100', 'bg-red-100', 'bg-green-100', 'bg-blue-100');
    statusIcon.innerHTML = '';
    
    // Sembunyikan hasil detail tap secara default
    hasilContainer.classList.add('hidden');

    switch (type) {
        case 'info':
            statusCard.classList.add('bg-blue-100');
            statusIcon.innerHTML = '<svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
        case 'success':
            statusCard.classList.add('bg-green-100');
            statusIcon.innerHTML = '<svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            audioSuccess.play().catch(e => console.warn("Gagal memutar audio sukses:", e));
            
            // Tampilkan detail hasil tap
            hasilNama.textContent = successName;
            hasilWaktu.textContent = successTime;
            hasilPeriode.textContent = successPeriod;
            hasilContainer.classList.remove('hidden');
            break;
        case 'fail':
            statusCard.classList.add('bg-red-100');
            statusIcon.innerHTML = '<svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            audioFail.play().catch(e => console.warn("Gagal memutar audio gagal:", e));
            break;
        default:
            statusCard.classList.add('bg-yellow-100');
            statusIcon.innerHTML = '<svg class="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
    statusMessage.textContent = message;
    statusCard.classList.remove('status-icon');
    if (type !== 'success' && type !== 'fail') {
        // Hanya tambahkan pulse jika sedang menunggu input atau menampilkan info
        statusCard.classList.add('status-icon');
    }

    // Hilangkan hasil detail setelah 5 detik
    if (type === 'success' || type === 'fail') {
        setTimeout(() => {
            updateStatusDisplay('Siap menerima tap kartu...', 'wait');
        }, 5000);
    }
};

// ===================================
// LOGIC UTAMA APLIKASI
// ===================================

/**
 * Mendapatkan data ringkasan harian dari Supabase.
 * Menggunakan currentLogDate untuk filter.
 */
const updateDailyLogSummary = async () => {
    if (!currentLogDate) return; // Guard clause jika tanggal belum terinisialisasi
    
    try {
        const dateFilter = currentLogDate; // Menggunakan tanggal yang aktif saat ini

        const { data: logData, error } = await db
            .from('presensi_log')
            .select('status')
            .eq('tanggal_log', dateFilter);

        if (error) {
            console.error("Gagal memuat log harian:", error.message);
            return;
        }

        const total = logData.length;
        const sukses = logData.filter(log => log.status === 'SUKSES').length;
        const gagal = total - sukses;

        totalTapElement.textContent = total;
        suksesTapElement.textContent = sukses;
        gagalTapElement.textContent = gagal;

        console.log(`[LOG HARI INI] Total: ${total}, Sukses: ${sukses}, Tanggal: ${dateFilter}`);

    } catch (e) {
        console.error("Error dalam updateDailyLogSummary:", e);
    }
};


/**
 * Memuat detail log presensi harian ke dalam tabel.
 * Menggunakan currentLogDate untuk filter.
 */
const loadLogDetail = async () => {
    if (!currentLogDate) return; // Guard clause jika tanggal belum terinisialisasi
    
    logDetailBody.innerHTML = '';
    logDetailStatus.textContent = 'Memuat data log...';

    try {
        const dateFilter = currentLogDate; // Menggunakan tanggal yang aktif saat ini

        const { data: logs, error } = await db
            .from('presensi_log')
            .select(`
                id,
                waktu_log,
                tanggal_log,
                status,
                periode,
                karyawan (nama, rfid_id)
            `)
            .eq('tanggal_log', dateFilter)
            .order('waktu_log', { ascending: false });

        if (error) throw error;

        if (logs.length === 0) {
            logDetailStatus.textContent = `Tidak ada log presensi untuk tanggal ${dateFilter}.`;
            return;
        }

        logDetailStatus.classList.add('hidden');

        logs.forEach(log => {
            const row = logDetailBody.insertRow();
            const statusClass = log.status === 'SUKSES' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.waktu_log}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.karyawan.nama || 'Tidak Dikenal'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.periode}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                        ${log.status}
                    </span>
                </td>
            `;
        });

    } catch (e) {
        console.error("Error memuat detail log:", e);
        logDetailStatus.textContent = 'Gagal memuat data detail log.';
        logDetailStatus.classList.remove('hidden');
    }
};

/**
 * Menentukan periode absen (Pagi/Siang) berdasarkan waktu WIT saat ini.
 * Pagi: 00:00:00 - 11:59:59
 * Siang: 12:00:00 - 23:59:59
 */
const determinePeriod = (dateObj) => {
    const hour = dateObj.getHours();
    return hour < 12 ? 'Pagi' : 'Siang';
};

/**
 * Mencari karyawan berdasarkan RFID ID
 */
const getKaryawanByRfidId = async (rfidId) => {
    try {
        const { data, error } = await db
            .from('karyawan')
            .select('*')
            .eq('rfid_id', rfidId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = Data tidak ditemukan (No rows found)
        
        return data; // Akan null jika tidak ditemukan
    } catch (e) {
        console.error("Error mencari karyawan:", e);
        return null;
    }
};

/**
 * Menyimpan log tap kartu ke database
 */
const saveTapLog = async (rfidId, karyawanId, status, periode) => {
    if (!currentLogDate) return; // Guard clause
    
    const nowWIT = getWITDateObject();
    const waktuLog = getWIBTimeFormatted(nowWIT);
    
    try {
        const logEntry = {
            rfid_id: rfidId,
            karyawan_id: karyawanId,
            tanggal_log: currentLogDate, // Menggunakan tanggal yang aktif
            waktu_log: waktuLog,
            status: status,
            periode: periode
        };

        const { error } = await db
            .from('presensi_log')
            .insert([logEntry]);

        if (error) throw error;
        
        updateDailyLogSummary();
        return true;
    } catch (e) {
        console.error("Gagal menyimpan log:", e);
        updateStatusDisplay('Gagal menyimpan log presensi ke database.', 'fail');
        return false;
    }
};

/**
 * Logika memproses tap kartu RFID
 */
const processRfidTap = async (rfidId) => {
    const nowWIT = getWITDateObject();
    const waktuLogFormatted = getWIBTimeFormatted(nowWIT);
    const periode = determinePeriod(nowWIT);
    
    updateStatusDisplay('Memproses tap kartu...', 'info');

    const karyawan = await getKaryawanByRfidId(rfidId);

    if (!karyawan) {
        // Karyawan tidak terdaftar
        await saveTapLog(rfidId, null, 'GAGAL', periode);
        updateStatusDisplay(`Kartu RFID: ${rfidId} tidak terdaftar!`, 'fail');
        return;
    }

    // Cek apakah karyawan sudah presensi di periode yang sama pada hari ini
    const { data: existingLog, error } = await db
        .from('presensi_log')
        .select('*')
        .eq('karyawan_id', karyawan.id)
        .eq('tanggal_log', currentLogDate)
        .eq('periode', periode)
        .eq('status', 'SUKSES')
        .maybeSingle();

    if (error) {
        console.error("Error checking existing log:", error);
        updateStatusDisplay('Gagal mengecek log presensi yang sudah ada.', 'fail');
        await saveTapLog(rfidId, karyawan.id, 'GAGAL', periode);
        return;
    }
    
    if (existingLog) {
        // Sudah presensi di periode ini
        updateStatusDisplay(`${karyawan.nama} sudah presensi pada periode ${periode} hari ini.`, 'fail');
        // Tidak perlu simpan log GAGAL, cukup notifikasi di UI
        return; 
    }

    // Berhasil presensi
    await saveTapLog(rfidId, karyawan.id, 'SUKSES', periode);
    updateStatusDisplay(
        `Presensi SUKSES! Selamat Datang, ${karyawan.nama}!`, 
        'success', 
        karyawan.nama, 
        waktuLogFormatted, 
        periode
    );
};


// ===================================
// EVENT LISTENERS & NAVIGASI
// ===================================

let rfidInput = '';
let lastTapTime = 0;
const TIMEOUT_MS = 100; // Batas waktu antara karakter input (diperlukan untuk HID)

const setupHIDListener = () => {
    document.addEventListener('keydown', (e) => {
        // Hanya proses keydown jika sedang di tampilan Tap Kartu
        if (tapContainer.style.display === 'none') return;
        
        // Cek apakah input berasal dari scanner (enter di akhir)
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            if (rfidInput.length > 0) {
                console.log("RFID Scanned:", rfidInput);
                processRfidTap(rfidInput);
                rfidInput = ''; // Reset input
            }
        } else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
            // Asumsikan input karakter adalah bagian dari RFID ID
            const currentTime = Date.now();
            
            // Cek timeout: jika waktu antara dua ketukan terlalu lama, reset input
            if (currentTime - lastTapTime > TIMEOUT_MS) {
                rfidInput = '';
            }
            
            rfidInput += e.key;
            lastTapTime = currentTime;
        } else if (e.key === 'Shift') {
            // Abaikan shift, karena sering ditekan bersamaan dengan angka/huruf
            return;
        }
    });
    console.log("HID Listener aktif.");
};

const showTapContainer = () => {
    tapContainer.style.display = 'flex';
    logContainer.style.display = 'none';
    navTapKartu.classList.add('bg-blue-600', 'text-white');
    navLogAbsen.classList.remove('bg-blue-600', 'text-white');
    // Tampilkan log harian di tampilan tap kartu
    logHarianTapKartu.classList.remove('hidden');
    updateStatusDisplay('Siap menerima tap kartu...', 'wait');
};

const showLogContainer = () => {
    tapContainer.style.display = 'none';
    logContainer.style.display = 'block';
    navLogAbsen.classList.add('bg-blue-600', 'text-white');
    navTapKartu.classList.remove('bg-blue-600', 'text-white');
    // Sembunyikan log harian di tampilan log detail
    logHarianTapKartu.classList.add('hidden');
    loadLogDetail(); // Muat detail log saat beralih ke halaman ini
};

const setupNavigation = () => {
    navTapKartu.addEventListener('click', showTapContainer);
    navLogAbsen.addEventListener('click', showLogContainer);
};

const setupInitialState = () => {
    // 1. Mulai loop jam otomatis dan pengecekan tanggal
    startClockLoop();
    
    // 2. Tampilkan container default (Tap Kartu)
    showTapContainer(); 
};


// ===================================
// INISIALISASI (Perbaikan Autoplay)
// ===================================

window.onload = () => {
    // 1. Setup navigasi
    setupNavigation();
    
    // 2. Setup state awal (memuat log dari Supabase & tampilkan Tap Kartu)
    setupInitialState(); 
    
    // 3. Setup listener HANYA SETELAH TOMBOL DIKLIK
    if (startButton) {
        startButton.addEventListener('click', () => {
            if (interactionOverlay) {
                // Hilangkan overlay secara bertahap
                interactionOverlay.classList.add('opacity-0');
                setTimeout(() => {
                    interactionOverlay.style.display = 'none';
                }, 300);
            }
            // Setelah interaksi pertama, pasang listener keyboard
            setupHIDListener();
            
            // Coba putar dan hentikan audio sukses sebagai "unlock" audio API
            audioSuccess.play().catch(e => { 
                console.warn("Gagal memutar audio dummy, tapi interaksi sudah dilakukan:", e); 
            });
            audioSuccess.pause();
            audioSuccess.currentTime = 0;
            
            console.log("Audio dan HID Listener diaktifkan.");
        });
    } else {
        // Fallback jika elemen tombol tidak ditemukan (tidak disarankan)
        setupHIDListener();
        console.warn("Tombol Start tidak ditemukan. HID Listener diaktifkan secara langsung.");
    }
};
