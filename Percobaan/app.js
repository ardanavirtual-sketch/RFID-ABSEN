// app.js (KODE LENGKAP - Fix Tombol Refresh & Total Hari Ini)

// ===================================
// KONFIGURASI SUPABASE & DOM ELEMENTS
// ===================================

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements - TAMPILAN TAP KARTU
const tapContainer = document.getElementById('tap-container');
const logHarianTapKartu = document.getElementById('log-harian-tap-kartu');
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const hasilContainer = document.getElementById('hasil-container');
const hasilTitle = document.getElementById('hasil-title');
const hasilNama = document.getElementById('hasil-nama');
const hasilID = document.getElementById('hasil-id');
const hasilPeriode = document.getElementById('hasil-periode');
const hasilWaktu = document.getElementById('hasil-waktu');
const appContainer = document.getElementById('app-container');
const readerStatusHint = document.getElementById('reader-status-hint');

// DOM Elements - TAMPILAN LOG ABSEN
const logContainer = document.getElementById('log-container');
const navTapKartu = document.getElementById('nav-tap-kartu');
const navLogAbsen = document.getElementById('nav-log-absen');
const refreshLogBtn = document.getElementById('refresh-log-btn');

// Elemen counter per periode
const logSuksesPagiElement = document.getElementById('log-sukses-pagi-log');
const logGagalPagiElement = document.getElementById('log-gagal-pagi-log');
const logSuksesSiangElement = document.getElementById('log-sukses-siang-log');
const logGagalSiangElement = document.getElementById('log-gagal-siang-log');
const logSuksesSoreElement = document.getElementById('log-sukses-sore-log');
const logGagalSoreElement = document.getElementById('log-gagal-sore-log');
const logSuksesMalamElement = document.getElementById('log-sukses-malam-log');
const logGagalMalamElement = document.getElementById('log-gagal-malam-log');

// Total counters
const totalSuksesElement = document.getElementById('total-sukses-hari-ini');
const totalGagalElement = document.getElementById('total-gagal-hari-ini');

// Elemen untuk menampilkan tanggal
const logTanggalHariIniLogElement = document.getElementById('log-tanggal-hari-ini-log');
const logDetailBody = document.getElementById('log-detail-body');
const logDetailStatus = document.getElementById('log-detail-status');

// Tambahkan elemen audio
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate');

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

const WIT_OFFSET_HOURS = 9; // WIT = UTC+9
const RESET_HOUR = 1; // Waktu reset harian pada pukul 01:00 WIT

// Variabel untuk menyimpan tanggal hari ini (dalam WIT)
let currentLogDate = null;
let dateCheckTimer = null;

// ===================================
// UTILITY FUNCTIONS - WIT (Waktu Indonesia Timur)
// ===================================

/**
 * Mendapatkan waktu saat ini dalam WIT
 */
function getCurrentWITTime() {
    const now = new Date();
    const witOffset = 9 * 60 * 60 * 1000; // 9 jam dalam milidetik
    return new Date(now.getTime() + witOffset);
}

/**
 * Format waktu WIT untuk display
 */
function formatWITTimeForDisplay(date) {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}.${minutes}.${seconds}`;
}

/**
 * Format tanggal WIT untuk display
 */
function formatWITDateForDisplay(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getUTCDay()];
    const day = date.getUTCDate();
    const monthName = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    
    return `${dayName}, ${day} ${monthName} ${year}`;
}

function getCurrentMealPeriod() {
    const witTime = getCurrentWITTime();
    const hour = witTime.getUTCHours();
    
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
 * Mendapatkan tanggal logis hari ini dalam WIT (dengan reset jam 01:00)
 */
function getCurrentLogicalDateWIT() {
    const witTime = getCurrentWITTime();
    const witHour = witTime.getUTCHours();
    
    let logicalDate = new Date(witTime);
    
    // Geser hari jika jam WIT kurang dari jam reset
    if (witHour < RESET_HOUR) {
        logicalDate.setUTCDate(logicalDate.getUTCDate() - 1);
    }
    
    return logicalDate;
}

/**
 * Mendapatkan string tanggal hari ini (YYYY-MM-DD), 
 * disesuaikan agar hari baru (untuk tujuan presensi) dimulai pada pukul 01:00 WIT.
 */
function getLogDateRangeWIT() {
    const logicalDate = getCurrentLogicalDateWIT();
    
    const yyyy = logicalDate.getUTCFullYear();
    const mm = logicalDate.getUTCMonth();
    const dd = logicalDate.getUTCDate();
    
    // Start: YYYY-MM-DD 01:00:00 WIT (waktu reset), dikonversi ke UTC
    const startLogisDate = new Date(Date.UTC(yyyy, mm, dd, RESET_HOUR, 0, 0));
    // Konversi ke UTC (kurangi 9 jam)
    const startUTC = new Date(startLogisDate.getTime() - (WIT_OFFSET_HOURS * 3600000));
    
    // End: YYYY-MM-DD 00:59:59 WIT hari berikutnya, dikonversi ke UTC
    const endLogisDate = new Date(Date.UTC(yyyy, mm, dd + 1, RESET_HOUR - 1, 59, 59));
    // Konversi ke UTC (kurangi 9 jam)
    const endUTC = new Date(endLogisDate.getTime() - (WIT_OFFSET_HOURS * 3600000));

    return {
        todayStart: startUTC.toISOString(),
        todayEnd: endUTC.toISOString(),
        logicalDate: logicalDate
    };
}

/**
 * Memperbarui UI dengan data log counters
 */
function updateUILogCounters() {
    // Update elemen counter di tampilan Log Absen
    if (logSuksesPagiElement) logSuksesPagiElement.textContent = logCounters.pagi.success;
    if (logGagalPagiElement) logGagalPagiElement.textContent = logCounters.pagi.fail;
    if (logSuksesSiangElement) logSuksesSiangElement.textContent = logCounters.siang.success;
    if (logGagalSiangElement) logGagalSiangElement.textContent = logCounters.siang.fail;
    if (logSuksesSoreElement) logSuksesSoreElement.textContent = logCounters.sore.success;
    if (logGagalSoreElement) logGagalSoreElement.textContent = logCounters.sore.fail;
    if (logSuksesMalamElement) logSuksesMalamElement.textContent = logCounters.malam.success;
    if (logGagalMalamElement) logGagalMalamElement.textContent = logCounters.malam.fail;
    
    // Hitung dan update total counters
    if (totalSuksesElement && totalGagalElement) {
        const totalSukses = logCounters.pagi.success + logCounters.siang.success + 
                           logCounters.sore.success + logCounters.malam.success;
        const totalGagal = logCounters.pagi.fail + logCounters.siang.fail + 
                          logCounters.sore.fail + logCounters.malam.fail;
        
        totalSuksesElement.textContent = totalSukses;
        totalGagalElement.textContent = totalGagal;
        
        console.log(`Total Sukses: ${totalSukses}, Total Gagal: ${totalGagal}`);
        console.log(`Detail: Pagi: ${logCounters.pagi.success}/${logCounters.pagi.fail}, Siang: ${logCounters.siang.success}/${logCounters.siang.fail}, Sore: ${logCounters.sore.success}/${logCounters.sore.fail}, Malam: ${logCounters.malam.success}/${logCounters.malam.fail}`);
    }
}

/**
 * Fungsi untuk mengubah timestamp UTC menjadi string waktu WIT
 */
function convertUTCToWITTime(utcTimestamp) {
    const date = new Date(utcTimestamp);
    // Tambah 9 jam untuk konversi ke WIT
    const witTime = new Date(date.getTime() + (WIT_OFFSET_HOURS * 3600000));
    
    const hours = witTime.getUTCHours().toString().padStart(2, '0');
    const minutes = witTime.getUTCMinutes().toString().padStart(2, '0');
    const seconds = witTime.getUTCSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Merender daftar log presensi ke dalam tabel log.
 */
function renderLogDetails(logEntries) {
    if (!logDetailBody) return;

    logDetailBody.innerHTML = ''; // Kosongkan tabel
    
    if (!logEntries || logEntries.length === 0) {
        logDetailBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-gray-500">
                    Tidak ada log presensi hari ini.
                </td>
            </tr>
        `;
        logDetailStatus.textContent = 'Tidak ada data log untuk hari ini.';
        return;
    }
    
    logDetailStatus.textContent = `Data log berhasil dimuat (${logEntries.length} entri)`;

    // Sortir log berdasarkan waktu terbaru (created_at)
    const sortedLogs = logEntries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sortedLogs.forEach(log => {
        const timeWIT = convertUTCToWITTime(log.created_at);
        
        let statusClass = 'text-gray-900';
        let statusText = log.status;
        
        if (log.status && log.status.startsWith('Sukses')) {
            statusClass = 'text-success-green font-bold';
            statusText = '✓ ' + log.status;
        } else if (log.status && log.status.startsWith('Gagal')) {
            statusClass = 'text-error-red font-bold';
            statusText = '✗ ' + log.status;
        }
        
        // Tambahkan warna berdasarkan periode
        let periodeClass = 'text-gray-700';
        let periodeText = log.periode ? log.periode.toUpperCase() : '-';
        
        if (log.periode === 'pagi') {
            periodeClass = 'text-blue-600 font-medium';
        } else if (log.periode === 'siang') {
            periodeClass = 'text-yellow-600 font-medium';
        } else if (log.periode === 'sore') {
            periodeClass = 'text-orange-600 font-medium';
        } else if (log.periode === 'malam') {
            periodeClass = 'text-purple-600 font-medium';
        }

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="px-4 py-2 font-mono text-sm">${timeWIT}</td>
            <td class="px-4 py-2">${log.nama || 'Tidak Terdaftar'}</td>
            <td class="px-4 py-2 ${periodeClass}">${periodeText}</td>
            <td class="px-4 py-2 ${statusClass}">${statusText}</td>
        `;
        logDetailBody.appendChild(row);
    });
}

/**
 * Fungsi untuk memeriksa apakah sudah terjadi pergantian tanggal
 */
function checkDateChange() {
    const newLogicalDate = getCurrentLogicalDateWIT();
    
    // Bandingkan tanggal (tanpa waktu)
    const currentDateStr = currentLogDate ? 
        `${currentLogDate.getUTCFullYear()}-${currentLogDate.getUTCMonth()}-${currentLogDate.getUTCDate()}` : '';
    
    const newDateStr = `${newLogicalDate.getUTCFullYear()}-${newLogicalDate.getUTCMonth()}-${newLogicalDate.getUTCDate()}`;
    
    if (currentDateStr !== newDateStr) {
        console.log(`Pergantian tanggal terdeteksi! Tanggal baru: ${formatWITDateForDisplay(newLogicalDate)}`);
        currentLogDate = newLogicalDate;
        
        // Reset log counters
        logCounters = {
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        
        // Update UI
        updateUILogCounters();
        
        // Refresh data log jika sedang di tampilan Log Absen
        if (logContainer && !logContainer.classList.contains('hidden')) {
            fetchAndDisplayLogs();
        }
        
        // Tampilkan notifikasi
        showDateChangeNotification();
    }
}

/**
 * Menampilkan notifikasi pergantian tanggal
 */
function showDateChangeNotification() {
    // Hapus notifikasi sebelumnya jika ada
    const existingNotification = document.querySelector('.date-change-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Buat elemen notifikasi
    const notification = document.createElement('div');
    notification.className = 'date-change-notification fixed top-4 right-4 bg-primary-blue text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-pulse';
    notification.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
                <p class="font-semibold">Hari Baru Dimulai!</p>
                <p class="text-sm opacity-90">Log absen telah direset untuk tanggal ${formatWITDateForDisplay(currentLogDate)}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Hapus notifikasi setelah 5 detik
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => notification.remove(), 500);
        }
    }, 5000);
}

/**
 * Setup timer untuk pengecekan pergantian tanggal
 */
function setupDateChangeChecker() {
    // Hapus timer sebelumnya jika ada
    if (dateCheckTimer) clearInterval(dateCheckTimer);
    
    // Cek perubahan tanggal setiap 30 detik
    dateCheckTimer = setInterval(checkDateChange, 30000);
    
    // Juga cek setiap menit apakah sudah jam 01:00 WIT untuk reset
    setInterval(() => {
        const witTime = getCurrentWITTime();
        const witHour = witTime.getUTCHours();
        const witMinute = witTime.getUTCMinutes();
        
        // Jika pukul 01:00 - 01:01 WIT, cek perubahan tanggal
        if (witHour === 1 && witMinute >= 0 && witMinute <= 1) {
            checkDateChange();
        }
    }, 60000); // Cek setiap menit
}

// ===================================
// FUNGSI UTAMA: Mengambil dan Menghitung Log dari Supabase
// ===================================

/**
 * Fungsi utama untuk mengambil dan menampilkan log dari Supabase
 */
async function fetchAndDisplayLogs() {
    try {
        const { todayStart, todayEnd, logicalDate } = getLogDateRangeWIT(); 
        
        // Simpan tanggal saat ini
        currentLogDate = logicalDate;
        
        // Menampilkan Tanggal Hari Ini (Logis WIT)
        const dateString = `Tanggal: ${formatWITDateForDisplay(logicalDate)}`;

        if (logTanggalHariIniLogElement) {
            logTanggalHariIniLogElement.textContent = dateString;
        }

        // Tampilkan status loading
        if (logDetailStatus) {
            logDetailStatus.innerHTML = `
                <div class="flex items-center justify-center">
                    <svg class="animate-spin w-4 h-4 mr-2 text-primary-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Memuat data log dari server...
                </div>
            `;
        }

        // Ambil semua log dalam rentang tanggal logis hari ini (WIT)
        const { data: logData, error } = await db
            .from("log_absen")
            .select("card, nama, periode, status, created_at")
            .gte("created_at", todayStart)
            .lt("created_at", todayEnd)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error dari Supabase:", error);
            throw error;
        }
        
        console.log(`Data log diterima: ${logData ? logData.length : 0} entri`);
        
        // 1. Render Log Rinci (Menggunakan data mentah)
        renderLogDetails(logData || []);

        // 2. Hitung Log Summary (Logika Deduplikasi)
        logCounters = {
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        
        const uniqueTaps = new Map(); 

        // Proses Deduplikasi Log: Hitung hanya 1 Sukses per Kartu per Periode.
        if (logData && logData.length > 0) {
            for (const log of logData) {
                const key = `${log.periode}-${log.card}`;
                
                if (!uniqueTaps.has(key)) {
                    uniqueTaps.set(key, log.status);
                } else if (uniqueTaps.get(key) !== 'Sukses' && log.status && log.status.startsWith('Sukses')) {
                    // Jika sebelumnya Gagal, dan ada log Sukses, timpa menjadi Sukses
                    uniqueTaps.set(key, log.status);
                }
            }
            
            // Isi Log Counters
            for (const [key, status] of uniqueTaps) {
                const [periode] = key.split('-');
                
                if (logCounters[periode]) {
                    if (status && status.startsWith('Sukses')) {
                        logCounters[periode].success++;
                    } else if (status && status.startsWith('Gagal')) { 
                        logCounters[periode].fail++;
                    }
                }
            }
        }

        // Update UI dengan counters baru
        updateUILogCounters();

        // Tampilkan status sukses
        if (logDetailStatus && logData) {
            logDetailStatus.textContent = `Data log berhasil dimuat (${logData.length} entri)`;
        }

    } catch (e) {
        console.error("Gagal memuat log dari Supabase:", e);
        
        if (logTanggalHariIniLogElement) {
            const logicalDate = getCurrentLogicalDateWIT();
            logTanggalHariIniLogElement.textContent = `Tanggal: ${formatWITDateForDisplay(logicalDate)} | Error memuat data`; 
        }
        
        if (logDetailStatus) {
            logDetailStatus.textContent = 'Gagal memuat data log dari server.';
        }
        
        if (logDetailBody) {
            logDetailBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-red-500">
                        Error: Gagal memuat data dari server. Silakan coba refresh.
                    </td>
                </tr>
            `;
        }
        
        // Reset counters ke 0 jika error
        logCounters = {
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        updateUILogCounters();
    }
}

// Export fungsi untuk akses dari HTML
window.fetchAndDisplayLogs = fetchAndDisplayLogs;

// ===================================
// UI FUNCTIONS
// ===================================

function setupInitialState() {
    // Inisialisasi tanggal saat ini
    currentLogDate = getCurrentLogicalDateWIT();
    
    // Setup pengecekan pergantian tanggal
    setupDateChangeChecker();
    
    // Panggil fetchAndDisplayLogs untuk memuat data dari Supabase saat start
    fetchAndDisplayLogs();
    
    // Default: Tampilkan halaman Tap Kartu
    showTapContainer();
}

/**
 * Menampilkan Tampilan Tap Kartu
 */
function showTapContainer() {
    // Update navigasi
    navTapKartu.classList.replace('bg-gray-200', 'bg-primary-blue');
    navTapKartu.classList.replace('text-gray-700', 'text-white');
    navLogAbsen.classList.replace('bg-primary-blue', 'bg-gray-200');
    navLogAbsen.classList.replace('text-white', 'text-gray-700');
    
    // Tampilkan/Sembunyikan Kontainer
    tapContainer.classList.remove('hidden');
    logContainer.classList.add('hidden');
    
    // Pastikan log harian tidak terlihat di sini
    if (logHarianTapKartu) {
        logHarianTapKartu.classList.add('hidden');
    }
    
    // Reset status reader ke kondisi siap
    resetStatus();
}

/**
 * Menampilkan Tampilan Log Absen
 */
function showLogContainer() {
    // Update navigasi
    navLogAbsen.classList.replace('bg-gray-200', 'bg-primary-blue');
    navLogAbsen.classList.replace('text-gray-700', 'text-white');
    navTapKartu.classList.replace('bg-primary-blue', 'bg-gray-200');
    navTapKartu.classList.replace('text-white', 'text-gray-700');
    
    // Tampilkan/Sembunyikan Kontainer
    logContainer.classList.remove('hidden');
    tapContainer.classList.add('hidden');
    
    // Refresh dan tampilkan log terbaru
    fetchAndDisplayLogs();
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
    hasilPeriode.textContent = getCurrentMealPeriod().toUpperCase();
    hasilWaktu.textContent = formatWITTimeForDisplay(getCurrentWITTime()) + ' WIT';
    
    // PEMUTARAN AUDIO DUPLIKASI
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
    hasilPeriode.textContent = '-';
    hasilWaktu.textContent = '-';
    
    statusMessage.textContent = 'Reader Siap. Tap Kartu.';
    readerStatusHint.textContent = 'Listener Keyboard (HID) aktif. Tempelkan kartu.';
    
    // Refresh log HANYA JIKA sedang di tampilan Log Absen
    if (logContainer && !logContainer.classList.contains('hidden')) {
        fetchAndDisplayLogs();
    }
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

function updateUI({ success, message, rfidId, nama }) {
    
    appContainer.classList.remove('bg-blue-200/50');
    statusCard.classList.remove('bg-blue-100');

    const currentPeriod = getCurrentMealPeriod();
    const currentTime = formatWITTimeForDisplay(getCurrentWITTime());

    if (success) {
        appContainer.classList.add('scale-105', 'bg-success-green/20');
        statusCard.classList.replace('bg-warning-yellow/20', 'bg-success-green/20');
        statusIcon.classList.replace('bg-warning-yellow', 'bg-success-green');
        statusIcon.innerHTML = `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        statusMessage.textContent = message;
        statusMessage.classList.replace('text-warning-yellow', 'text-success-green');
        hasilTitle.textContent = 'Detail Presensi Sukses';

        // PEMUTARAN AUDIO SUKSES
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

        // PEMUTARAN AUDIO GAGAL
        if (audioFail) {
            audioFail.currentTime = 0; 
            audioFail.play().catch(e => console.error("Gagal memutar audio gagal:", e));
        }
    }

    hasilNama.textContent = nama;
    hasilID.textContent = rfidId;
    hasilPeriode.textContent = currentPeriod.toUpperCase();
    hasilWaktu.textContent = currentTime + ' WIT';
    hasilContainer.classList.remove('hidden');

    // Setelah update UI, refresh log counters
    fetchAndDisplayLogs();

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
                // Jika sudah ada log 'Sukses', LANGSUNG tampilkan status duplikasi
                result.success = false; 
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return; // Berhenti di sini, tidak membuat log baru di Supabase
            }

            // 3. Jika belum tap SUKSES, cek jatah makannya (VALIDASI KANTIN)
            const statusMakanSaatIni = userData[currentPeriod];

            if (statusMakanSaatIni === "Kantin") {
                result.success = true;
                result.message = `Absensi ${currentPeriod.toUpperCase()} Berhasil! Selamat Makan!`;
                result.status_log = `Sukses`;
            } else {
                // Gagal karena status bukan 'Kantin'
                result.message = `Absensi ${currentPeriod.toUpperCase()} Gagal: Status **${statusMakanSaatIni || 'KOSONG'}**!`;
                result.status_log = `Gagal (Not Kantin for ${currentPeriod.toUpperCase()})`;
            }
        }
        
        // 4. Log absensi ke Supabase (mencatat hasil dari langkah 3 atau kegagalan 'Unknown Card')
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
    
    // PENTING: Update UI (Termasuk memutar audio sukses/gagal)
    updateUI(result);
}

// ===================================
// HID KEYBOARD LISTENER LOGIC
// ===================================

function setupHIDListener() {
    document.addEventListener('keydown', (e) => {
        // Abaikan input jika sedang tidak di tampilan Tap Kartu
        if (tapContainer.classList.contains('hidden')) {
            return;
        }

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
// NAVIGATION SETUP
// ===================================

function setupNavigation() {
    navTapKartu.addEventListener('click', showTapContainer);
    navLogAbsen.addEventListener('click', showLogContainer);
}

// ===================================
// SETUP REFRESH BUTTON
// ===================================

function setupRefreshButton() {
    if (refreshLogBtn) {
        refreshLogBtn.addEventListener('click', async function() {
            // Tampilkan animasi loading
            refreshLogBtn.disabled = true;
            refreshLogBtn.innerHTML = `
                <svg class="animate-spin w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Memuat...
            `;
            
            // Panggil fungsi refresh
            await fetchAndDisplayLogs();
            
            // Reset tombol setelah 1 detik
            setTimeout(() => {
                refreshLogBtn.disabled = false;
                refreshLogBtn.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh
                `;
            }, 1000);
        });
    }
}

// ===================================
// INISIALISASI
// ===================================

window.onload = () => {
    // 1. Setup navigasi
    setupNavigation();
    
    // 2. Setup refresh button
    setupRefreshButton();
    
    // 3. Setup state awal (memuat log dari Supabase & tampilkan Tap Kartu)
    setupInitialState(); 
    
    // 4. Setup listener HANYA SETELAH TOMBOL DIKLIK
    const startButton = document.getElementById('start-button');
    const interactionOverlay = document.getElementById('interaction-overlay');
    
    if (startButton && interactionOverlay) {
        startButton.addEventListener('click', () => {
            // Hilangkan overlay secara bertahap
            interactionOverlay.classList.add('opacity-0');
            setTimeout(() => {
                interactionOverlay.style.display = 'none';
            }, 300);
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
        // Fallback jika elemen tombol tidak ditemukan
        setupHIDListener();
    }
};
