// app.js (KODE LENGKAP - Deduplikasi Supabase, Tanggal Logis WIT, & Fix Audio Autoplay)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements - TAMPILAN TAP KARTU
const tapContainer = document.getElementById('tap-container');
const logHarianTapKartu = document.getElementById('log-harian-tap-kartu'); // Kontainer Log Harian (disembunyikan di Tap Kartu)
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const interactionOverlay = document.getElementById('interaction-overlay');
const startButton = document.getElementById('start-button');
const jamDigitalElement = document.getElementById('jam-digital');
const tanggalDigitalElement = document.getElementById('tanggal-digital');

// DOM Elements - TAMPILAN LOG ABSEN
const logContainer = document.getElementById('log-container');
const logTanggalElement = document.getElementById('log-tanggal');
const logDetailBody = document.getElementById('log-detail-body');
const logDetailStatus = document.getElementById('log-detail-status');
const totalLogSukses = document.getElementById('total-log-sukses');
const totalLogGagal = document.getElementById('total-log-gagal');

// DOM Elements - NAVIGASI
const navTapKartu = document.getElementById('nav-tap-kartu');
const navLogAbsen = document.getElementById('nav-log-absen');

// Audio Elements
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');

// State
let lastProcessedCardId = null;
let lastLogDate = null; // State untuk melacak tanggal log terakhir dimuat (WIT)

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Mengambil waktu dan tanggal saat ini dalam zona waktu WIT (Waktu Indonesia Timur).
 * @returns {Date} Objek Date yang disesuaikan dengan WIT.
 */
function getWaktuSaatIni() {
    // 1. Dapatkan waktu UTC
    const now = new Date();
    // 2. Tentukan offset WIT (+8 jam)
    const witOffset = 8 * 60; // 480 menit
    // 3. Hitung offset lokal perangkat dalam menit
    const localOffset = now.getTimezoneOffset();
    // 4. Hitung perbedaan total offset yang diperlukan
    const diff = witOffset + localOffset;
    // 5. Tambahkan perbedaan ke waktu saat ini
    return new Date(now.getTime() + diff * 60 * 1000);
}

/**
 * Memformat objek Date menjadi string tanggal (e.g., "Sabtu, 14 Desember 2025").
 * @param {Date} date - Objek Date (sudah WIT).
 * @returns {string} Tanggal yang diformat.
 */
function formatTanggal(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

/**
 * Memformat objek Date menjadi string waktu (e.g., "12:08:30").
 * @param {Date} date - Objek Date (sudah WIT).
 * @returns {string} Waktu yang diformat.
 */
function formatWaktu(date) {
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return date.toLocaleTimeString('id-ID', options);
}

/**
 * Memperbarui jam digital di UI setiap detik.
 */
function updateJamDigital() {
    const now = getWaktuSaatIni();
    jamDigitalElement.textContent = formatWaktu(now);
    tanggalDigitalElement.textContent = formatTanggal(now);
}

/**
 * Menentukan periode presensi (MASUK atau PULANG) berdasarkan waktu WIT.
 * @param {Date} waktuWIT - Objek Date yang sudah disesuaikan ke WIT.
 * @returns {'MASUK' | 'PULANG'} Periode presensi.
 */
function determinePresensiPeriod(waktuWIT) {
    const hours = waktuWIT.getHours();
    // Asumsi: MASUK sebelum jam 12:00 WIT, PULANG setelah atau pada jam 12:00 WIT
    return hours < 12 ? 'MASUK' : 'PULANG';
}

/**
 * Mencari data pengguna berdasarkan ID kartu.
 * @param {string} cardId - ID kartu RFID.
 * @returns {Promise<object | null>} Data pengguna atau null jika tidak ditemukan.
 */
async function findUserByCardId(cardId) {
    try {
        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('card_id', cardId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
            throw error;
        }

        return data;
    } catch (error) {
        console.error("Error finding user:", error.message);
        return null;
    }
}

/**
 * Mencatat log presensi ke database.
 * @param {object} logData - Data log presensi.
 * @returns {Promise<boolean>} Status keberhasilan pencatatan.
 */
async function recordLog(logData) {
    try {
        const { error } = await db
            .from('logs')
            .insert([logData]);

        if (error) {
            throw error;
        }
        return true;
    } catch (error) {
        console.error("Error recording log:", error.message);
        return false;
    }
}

/**
 * Menghindari duplikasi presensi. Memeriksa apakah pengguna sudah presensi
 * untuk periode (MASUK/PULANG) yang sama hari ini.
 * @param {string} userId - ID pengguna.
 * @param {'MASUK' | 'PULANG'} period - Periode presensi.
 * @returns {Promise<boolean>} True jika duplikasi (sudah ada log), False jika belum.
 */
async function isDuplicateLog(userId, period) {
    try {
        const todayWIT = getWaktuSaatIni();
        // Ambil tanggal WIT dalam format ISO-8601 (hanya tanggal)
        const todayDateISO = todayWIT.toISOString().split('T')[0];

        const { data, error } = await db
            .from('logs')
            .select('id')
            .eq('user_id', userId)
            .eq('period', period)
            .gte('timestamp', `${todayDateISO}T00:00:00+08:00`) // Mulai hari ini 00:00 WIT
            .lt('timestamp', `${todayDateISO}T23:59:59+08:00`)   // Akhir hari ini 23:59 WIT
            .single();

        if (error && error.code === 'PGRST116') {
            return false; // Tidak ada log ditemukan, bukan duplikasi
        } else if (error) {
            throw error;
        }

        return data !== null; // Jika ada data, berarti duplikasi
    } catch (error) {
        console.error("Error checking duplicate log:", error.message);
        return false;
    }
}


// ===================================
// HANDLER PRESENSI
// ===================================

/**
 * Memproses input ID kartu dari keyboard HID.
 * @param {string} cardId - ID kartu yang di-scan.
 */
async function processCardScan(cardId) {
    // Abaikan scan yang beruntun dalam waktu singkat (debounce)
    if (cardId === lastProcessedCardId) {
        return;
    }
    lastProcessedCardId = cardId;
    
    // Reset status UI
    setStatus('Memproses...', 'loading');
    
    const nowWIT = getWaktuSaatIni();
    const period = determinePresensiPeriod(nowWIT);
    
    const user = await findUserByCardId(cardId);
    
    if (!user) {
        // GAGAL: Kartu tidak terdaftar
        playAudio(audioFail);
        setStatus(`Kartu ID ${cardId} tidak terdaftar.`, 'fail', 'Pengguna Tidak Ditemukan');
        setTimeout(() => setStatus('Siap untuk Tap Kartu', 'ready'), 3000);
        return;
    }
    
    const isDuplicated = await isDuplicateLog(user.id, period);

    if (isDuplicated) {
        // GAGAL: Sudah presensi di periode ini
        playAudio(audioFail);
        setStatus(`Gagal! ${user.name} sudah absen ${period} hari ini.`, 'fail', `Duplikasi ${period}`);
    } else {
        // SUKSES: Catat presensi
        const logData = {
            user_id: user.id,
            user_name: user.name,
            timestamp: nowWIT.toISOString(), // Simpan waktu WIT dalam format ISO di database
            period: period,
            status: 'SUKSES'
        };
        
        const success = await recordLog(logData);
        
        if (success) {
            playAudio(audioSuccess);
            setStatus(`SUKSES! Selamat ${user.name}, Anda presensi ${period}.`, 'success', `Presensi ${period} Sukses`);
            
            // PENTING: Muat ulang log harian setelah presensi sukses
            await loadLogDetail(nowWIT);
        } else {
            // GAGAL: Kesalahan server
            playAudio(audioFail);
            setStatus(`Gagal mencatat presensi untuk ${user.name}. Cek koneksi server.`, 'fail', 'Kesalahan Server');
        }
    }
    
    // Set timeout untuk reset debounce
    setTimeout(() => {
        lastProcessedCardId = null;
        if (statusCard.classList.contains('bg-green-500') || statusCard.classList.contains('bg-red-500')) {
            // Jika status masih sukses/gagal, reset ke ready setelah 3 detik
            setTimeout(() => setStatus('Siap untuk Tap Kartu', 'ready'), 3000);
        }
    }, 100); // Debounce 100ms
}


// ===================================
// UI/VIEW FUNCTIONS
// ===================================

/**
 * Mengatur tampilan UI status presensi.
 * @param {string} message - Pesan status.
 * @param {'ready' | 'loading' | 'success' | 'fail'} type - Jenis status.
 * @param {string | null} resultMessage - Pesan hasil di hasilContainer.
 */
function setStatus(message, type, resultMessage = null) {
    statusCard.className = 'w-full p-6 text-center rounded-2xl shadow-xl transition-all duration-300 transform';
    statusIcon.className = 'w-16 h-16 mx-auto mb-4 transition-transform duration-300';
    hasilContainer.innerHTML = '';
    
    switch (type) {
        case 'ready':
            statusCard.classList.add('bg-white', 'border-4', 'border-blue-400');
            statusIcon.classList.add('text-blue-500', 'status-icon');
            statusIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9.75h19.5M2.25 12h19.5m-6.75 3h6.75m-6.75 3h6.75M2.25 15h19.5M2.25 18h19.5" />
                </svg>
            `;
            hasilContainer.classList.add('hidden');
            break;
        case 'loading':
            statusCard.classList.add('bg-blue-100', 'border-4', 'border-blue-500');
            statusIcon.classList.add('text-blue-600', 'animate-spin');
            statusIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.84-2.828c-1.392-.924-2.735-1.745-3.36-1.12A3.99 3.99 0 0112 12h8.25" />
                </svg>
            `;
            hasilContainer.classList.add('hidden');
            break;
        case 'success':
            statusCard.classList.add('bg-green-500', 'text-white');
            statusIcon.classList.add('text-white', 'animate-bounce');
            statusIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;
            hasilContainer.classList.remove('hidden');
            hasilContainer.innerHTML = `<p class="text-2xl font-bold text-white">${resultMessage}</p>`;
            break;
        case 'fail':
            statusCard.classList.add('bg-red-500', 'text-white');
            statusIcon.classList.add('text-white', 'animate-shake');
            statusIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M21.75 12a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z" />
                </svg>
            `;
            hasilContainer.classList.remove('hidden');
            hasilContainer.innerHTML = `<p class="text-2xl font-bold text-white">${resultMessage}</p>`;
            break;
    }
    
    statusMessage.textContent = message;
    
    // Hapus class animasi setelah selesai (kecuali 'ready')
    if (type !== 'ready' && type !== 'loading') {
        setTimeout(() => {
            statusIcon.classList.remove('animate-bounce', 'animate-shake');
        }, 1000);
    }
}

/**
 * Memutar audio yang diberikan.
 * @param {HTMLAudioElement} audioElement - Elemen audio yang akan diputar.
 */
function playAudio(audioElement) {
    audioElement.currentTime = 0; // Reset ke awal
    audioElement.play().catch(e => {
        console.error("Gagal memutar audio:", e);
    });
}

/**
 * Memuat detail log presensi untuk hari ini (berdasarkan waktu WIT).
 * @param {Date} date - Objek Date (sudah WIT) untuk tanggal yang akan dimuat.
 */
async function loadLogDetail(date) {
    logDetailBody.innerHTML = '';
    logDetailStatus.textContent = 'Memuat data log...';
    
    const dateISO = date.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

    // Update tanggal yang ditampilkan di UI Log Absen
    logTanggalElement.textContent = formatTanggal(date);
    
    try {
        // Query log untuk hari ini (00:00:00 WIT hingga 23:59:59 WIT)
        const { data: logs, error } = await db
            .from('logs')
            .select('*')
            .gte('timestamp', `${dateISO}T00:00:00+08:00`)
            .lte('timestamp', `${dateISO}T23:59:59+08:00`)
            .order('timestamp', { ascending: false });

        if (error) throw error;
        
        let successCount = 0;
        let failCount = 0;

        if (logs.length === 0) {
            logDetailStatus.textContent = `Tidak ada catatan presensi untuk hari ini (${formatTanggal(date)}).`;
        } else {
            logDetailStatus.textContent = `Menampilkan ${logs.length} catatan presensi untuk hari ini.`;
            
            logs.forEach(log => {
                // Konversi timestamp (yang sudah WIT) ke objek Date
                const logTime = new Date(log.timestamp);
                
                if (log.status === 'SUKSES') {
                    successCount++;
                } else {
                    failCount++;
                }

                const row = logDetailBody.insertRow();
                row.classList.add(log.status === 'SUKSES' ? 'bg-white hover:bg-green-50' : 'bg-red-50 hover:bg-red-100');

                // Kolom Waktu
                let cell = row.insertCell();
                cell.textContent = formatWaktu(logTime);
                cell.classList.add('px-6', 'py-3', 'whitespace-nowrap', 'text-sm', 'font-medium', 'text-gray-900');

                // Kolom Nama
                cell = row.insertCell();
                cell.textContent = log.user_name || 'N/A';
                cell.classList.add('px-6', 'py-3', 'whitespace-nowrap', 'text-sm', 'text-gray-500');

                // Kolom Periode
                cell = row.insertCell();
                cell.textContent = log.period;
                cell.classList.add('px-6', 'py-3', 'whitespace-nowrap', 'text-sm', 'font-semibold', log.period === 'MASUK' ? 'text-blue-600' : 'text-orange-600');

                // Kolom Status
                cell = row.insertCell();
                cell.textContent = log.status;
                cell.classList.add('px-6', 'py-3', 'whitespace-nowrap', 'text-sm', 'font-bold', log.status === 'SUKSES' ? 'text-green-600' : 'text-red-600');
            });
        }
        
        // Update summary counts
        totalLogSukses.textContent = successCount;
        totalLogGagal.textContent = failCount;
        
    } catch (error) {
        console.error("Error loading log detail:", error.message);
        logDetailStatus.textContent = 'Gagal memuat log presensi. Cek koneksi atau konfigurasi database.';
    }
    
    // Update state tanggal log terakhir dimuat
    lastLogDate = dateISO;
}


// ===================================
// SISTEM DETEKSI PERGANTIAN HARI (FITUR UTAMA BARU)
// ===================================

/**
 * Membandingkan tanggal log terakhir yang dimuat dengan tanggal hari ini (WIT).
 * Jika berbeda, log akan dimuat ulang.
 */
async function checkDayChangeAndReloadLog() {
    const nowWIT = getWaktuSaatIni();
    const todayDateISO = nowWIT.toISOString().split('T')[0];

    // Jika belum ada log yang dimuat atau hari sudah berganti
    if (lastLogDate === null || lastLogDate !== todayDateISO) {
        console.log(`[Auto-Reload] Deteksi pergantian hari atau inisialisasi. Memuat ulang log untuk ${todayDateISO}.`);
        await loadLogDetail(nowWIT);
    } else {
        // console.log(`[Auto-Reload] Hari belum berganti (${todayDateISO}). Log tetap.`)
    }
}


// ===================================
// LISTENER & INISIALISASI
// ===================================

/**
 * Menyiapkan listener keyboard untuk scan kartu HID.
 */
function setupHIDListener() {
    let cardIdBuffer = '';
    let lastKeyTime = Date.now();
    
    document.addEventListener('keydown', (e) => {
        const now = Date.now();
        
        // Jika jeda antar karakter lebih dari 50ms, reset buffer (asumsi ini adalah scan baru)
        if (now - lastKeyTime > 50) {
            cardIdBuffer = '';
        }
        
        // Hanya proses jika di container Tap Kartu
        if (tapContainer.classList.contains('hidden')) {
             return;
        }

        // Karakter yang diizinkan (angka, biasanya dari scanner)
        if (e.key >= '0' && e.key <= '9') {
            cardIdBuffer += e.key;
            e.preventDefault(); // Mencegah input muncul di field lain jika ada
        } else if (e.key === 'Enter' && cardIdBuffer.length > 0) {
            // Enter menandakan akhir dari scan
            e.preventDefault();
            const finalCardId = cardIdBuffer;
            cardIdBuffer = '';
            
            console.log("Card ID Scanned:", finalCardId);
            processCardScan(finalCardId);
        }
        
        lastKeyTime = now;
    });
}

/**
 * Menyiapkan navigasi antar container.
 */
function setupNavigation() {
    const showTapContainer = () => {
        tapContainer.classList.remove('hidden');
        logContainer.classList.add('hidden');
        navTapKartu.classList.add('bg-blue-600', 'text-white');
        navLogAbsen.classList.remove('bg-blue-600', 'text-white');
    };
    
    const showLogContainer = async () => {
        logContainer.classList.remove('hidden');
        tapContainer.classList.add('hidden');
        navLogAbsen.classList.add('bg-blue-600', 'text-white');
        navTapKartu.classList.remove('bg-blue-600', 'text-white');

        // Muat ulang data log saat pindah ke tampilan Log
        await checkDayChangeAndReloadLog(); 
    };

    navTapKartu.addEventListener('click', showTapContainer);
    navLogAbsen.addEventListener('click', showLogContainer);
}

/**
 * Menyiapkan state awal aplikasi.
 */
async function setupInitialState() {
    // 1. Mulai update jam digital
    updateJamDigital();
    setInterval(updateJamDigital, 1000);
    
    // 2. Set status awal
    setStatus('Siap untuk Tap Kartu', 'ready');
    
    // 3. Muat log untuk hari ini (pertama kali)
    await loadLogDetail(getWaktuSaatIni());
    
    // 4. JALANKAN SISTEM DETEKSI PERGANTIAN HARI
    // Cek setiap 5 menit (300000 ms)
    setInterval(checkDayChangeAndReloadLog, 300000); 
    
    // 5. Tampilkan container Tap Kartu secara default
    tapContainer.classList.remove('hidden');
    logContainer.classList.add('hidden');
    navTapKartu.classList.add('bg-blue-600', 'text-white');
}


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
    }
};
