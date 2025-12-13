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
const namaDisplay = document.getElementById('nama-display');
const periodeDisplay = document.getElementById('periode-display');
const jamTapDisplay = document.getElementById('jam-tap-display');
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const messageCloseButton = document.getElementById('message-close-button');
const interactionOverlay = document.getElementById('interaction-overlay');
const startButton = document.getElementById('start-button');

// DOM Elements - TAMPILAN LOG ABSEN
const logContainer = document.getElementById('log-container');
const logTanggalDisplay = document.getElementById('log-tanggal-display');
const logDetailStatus = document.getElementById('log-detail-status');
const logDetailBody = document.getElementById('log-detail-body');
const summaryTotal = document.getElementById('summary-total');
const summaryMasuk = document.getElementById('summary-masuk');
const summaryPulang = document.getElementById('summary-pulang');
const summaryGagal = document.getElementById('summary-gagal');

// Navigasi
const navTapKartu = document.getElementById('nav-tap-kartu');
const navLogAbsen = document.getElementById('nav-log-absen');

// Audio
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');

// ===================================
// STATE DAN KONSTANTA LOGIKA HARIAN
// ===================================

/** @type {string | null} State untuk menyimpan tanggal log terakhir dimuat (YYYY-MM-DD WIT) */
let lastLoadedDate = null;
const DAY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Cek pergantian hari setiap 5 menit (300000 ms)

// ===================================
// FUNGSI UTILITY WAKTU WIT (UTC+8)
// ===================================

/**
 * Mendapatkan tanggal WIT (Waktu Indonesia Timur, UTC+8) dari objek Date.
 * @param {Date} date Objek Date yang akan dikonversi.
 * @returns {string} Tanggal dalam format YYYY-MM-DD.
 */
const getWITEDate = (date) => {
    // WIT = UTC+8 jam
    const offset = 8 * 60; // 480 minutes
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const wit = new Date(utc + (offset * 60000));
    return wit.toISOString().split('T')[0]; // Format YYYY-MM-DD
};

/**
 * Mendapatkan waktu WIT (HH:MM:SS) dari objek Date.
 * @param {Date} date Objek Date yang akan dikonversi.
 * @returns {string} Waktu dalam format HH:MM:SS.
 */
const getWITTime = (date) => {
    const offset = 8 * 60;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const wit = new Date(utc + (offset * 60000));
    return wit.toTimeString().split(' ')[0]; // Format HH:MM:SS
};

/**
 * Mendapatkan rentang epoch (milidetik) untuk hari logis WIT saat ini (00:00:00 - 23:59:59).
 * @returns {{startISO: string, endISO: string, dateString: string}}
 */
const getWITEpochRangeForToday = () => {
    const now = new Date();
    const todayString = getWITEDate(now); // Format YYYY-MM-DD

    // Buat objek Date untuk awal hari (00:00:00 WIT)
    // Kita harus membuat tanggal UTC yang setara dengan 00:00:00 WIT
    // YYYY-MM-DDT00:00:00+08:00
    const startOfDayWIT = new Date(todayString + 'T00:00:00+08:00');
    const startEpoch = startOfDayWIT.getTime(); // epoch ms

    // Akhir hari adalah 24 jam setelah startEpoch
    const endEpoch = startEpoch + (24 * 60 * 60 * 1000);

    return {
        // Konversi epoch ms ke ISO string untuk filtering Supabase
        startISO: new Date(startEpoch).toISOString(),
        // Gunakan < dari waktu ini
        endISO: new Date(endEpoch).toISOString(),
        dateString: todayString
    };
};


// ===================================
// FUNGSI TAMPILAN
// ===================================

/**
 * Menampilkan pesan status di area Tap Kartu.
 * @param {'success'|'fail'|'default'} type Jenis pesan.
 * @param {string} message Pesan yang ditampilkan.
 * @param {string} name Nama yang terdeteksi (opsional).
 * @param {string} period Periode presensi (opsional).
 * @param {string} time Waktu tap (opsional).
 */
const showStatusMessage = (type, message, name = '', period = '', time = '') => {
    // Reset tampilan
    statusCard.className = 'p-6 rounded-xl shadow-lg transition-all duration-300 w-full md:w-96';
    statusIcon.className = 'status-icon w-20 h-20 mx-auto mb-4';
    hasilContainer.style.display = 'none';

    if (type === 'success') {
        statusCard.classList.add('bg-green-100', 'border-4', 'border-green-400');
        statusIcon.innerHTML = `<svg class="text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.303 7.297a.75.75 0 00-1.06 0L10.5 14.04l-2.743-2.743a.75.75 0 00-1.06 1.06l3.25 3.25a.75.75 0 001.06 0l5.25-5.25a.75.75 0 000-1.06z"/></svg>`;
        statusMessage.textContent = message;
        namaDisplay.textContent = name;
        periodeDisplay.textContent = period;
        jamTapDisplay.textContent = time + ' WIT';
        hasilContainer.style.display = 'block';
        playSound(audioSuccess);
    } else if (type === 'fail') {
        statusCard.classList.add('bg-red-100', 'border-4', 'border-red-400');
        statusIcon.innerHTML = `<svg class="text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.75 5.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm1.5 8h-3v-5h3v5z"/></svg>`;
        statusMessage.textContent = message;
        playSound(audioFail);
    } else { // default (menunggu)
        statusCard.classList.add('bg-blue-50', 'border-4', 'border-blue-400', 'status-icon-pulse-container');
        statusIcon.innerHTML = `<svg class="text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2zm-1 8H6a.5.5 0 010-1h12a.5.5 0 010 1zm0-3H6a.5.5 0 010-1h12a.5.5 0 010 1z"/></svg>`;
        statusMessage.textContent = 'Siap menerima tap kartu...';
        statusIcon.classList.add('status-icon'); // Aktifkan animasi pulse
    }

    // Periksa dan muat ulang log ringkasan di container tap kartu
    // Karena ini dipanggil setelah presensi, kita bisa memuat ulang ringkasan
    const todayRange = getWITEpochRangeForToday();
    loadLogSummary(todayRange);
};

/**
 * Menampilkan pesan modal kustom (bukan alert()).
 * @param {string} text
 */
const showMessageBox = (text) => {
    messageText.textContent = text;
    messageBox.classList.remove('opacity-0', 'pointer-events-none');
    messageBox.classList.add('opacity-100', 'pointer-events-auto');
};

const hideMessageBox = () => {
    messageBox.classList.remove('opacity-100', 'pointer-events-auto');
    messageBox.classList.add('opacity-0', 'pointer-events-none');
};


// ===================================
// FUNGSI UTAMA LOGIKA PRESENSI
// ===================================

/**
 * Memuat dan menampilkan ringkasan log presensi harian (Total, Masuk, Pulang, Gagal).
 * @param {{startISO: string, endISO: string, dateString: string}} todayRange Rentang waktu hari ini.
 */
const loadLogSummary = async (todayRange) => {
    try {
        // Query untuk menghitung semua presensi hari ini
        const { data, error } = await db
            .from('presensi')
            .select('periode, status')
            .gte('created_at', todayRange.startISO) // Greater than or equal to start of day
            .lt('created_at', todayRange.endISO);   // Less than end of day (23:59:59.999)

        if (error) throw error;

        let total = 0;
        let masuk = 0;
        let pulang = 0;
        let gagal = 0;

        data.forEach(log => {
            total++;
            if (log.status === 'SUKSES') {
                if (log.periode === 'MASUK') {
                    masuk++;
                } else if (log.periode === 'PULANG') {
                    pulang++;
                }
            } else {
                gagal++;
            }
        });

        // Update DOM elements untuk Summary
        summaryTotal.textContent = total;
        summaryMasuk.textContent = masuk;
        summaryPulang.textContent = pulang;
        summaryGagal.textContent = gagal;

    } catch (e) {
        console.error("Gagal memuat ringkasan log:", e.message);
        // Tampilkan pesan error jika perlu
    }
};

/**
 * Memuat dan menampilkan detail log presensi harian.
 * @param {{startISO: string, endISO: string, dateString: string}} todayRange Rentang waktu hari ini.
 */
const loadLogData = async (todayRange) => {
    logDetailBody.innerHTML = '';
    logDetailStatus.textContent = 'Memuat data log...';
    logTanggalDisplay.textContent = `Tanggal Log: ${todayRange.dateString}`;
    
    await loadLogSummary(todayRange); // Pastikan summary juga terupdate

    try {
        const { data, error } = await db
            .from('presensi')
            .select(`
                *,
                karyawan:rfid_id (
                    nama
                )
            `)
            .gte('created_at', todayRange.startISO) // Filter by start of logical day
            .lt('created_at', todayRange.endISO)   // Filter by end of logical day (exclusive)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            logDetailStatus.textContent = 'Tidak ada log presensi untuk hari ini.';
            return;
        }

        logDetailStatus.style.display = 'none';

        data.forEach(log => {
            const row = logDetailBody.insertRow();
            const timestamp = new Date(log.created_at);
            const timeWIT = getWITTime(timestamp);
            const namaKaryawan = log.karyawan ? log.karyawan.nama : 'N/A';
            const statusClass = log.status === 'SUKSES' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${timeWIT}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.rfid_id} - ${namaKaryawan}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.periode || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                        ${log.status}
                    </span>
                </td>
            `;
        });

    } catch (e) {
        console.error("Gagal memuat detail log:", e.message);
        logDetailStatus.textContent = 'Gagal memuat data log. Silakan cek konsol untuk detail.';
        logDetailStatus.style.display = 'block';
    }
};

/**
 * Logika utama saat kartu RFID di-tap (input dari keyboard HID).
 * @param {string} rfidId ID RFID yang dibaca.
 */
const handleRfidTap = async (rfidId) => {
    // 1. Tampilkan status 'Processing'
    showStatusMessage('default', 'Memproses kartu...');

    const timestamp = new Date();
    const timeWIT = getWITTime(timestamp);

    try {
        // 2. Cek apakah RFID terdaftar di tabel karyawan
        const { data: userData, error: userError } = await db
            .from('karyawan')
            .select('nama')
            .eq('rfid_id', rfidId)
            .single();

        if (userError || !userData) {
            // Log Gagal - RFID tidak terdaftar
            await db.from('presensi').insert([{
                rfid_id: rfidId,
                status: 'GAGAL',
                keterangan: 'RFID ID tidak terdaftar.',
                created_at: timestamp.toISOString()
            }]);
            showStatusMessage('fail', 'RFID GAGAL! Kartu tidak terdaftar.');
            return;
        }

        const namaKaryawan = userData.nama;

        // 3. Tentukan periode (Masuk/Pulang)
        // Cek log terakhir karyawan hari ini
        const todayRange = getWITEpochRangeForToday();

        const { data: lastLog, error: logError } = await db
            .from('presensi')
            .select('periode')
            .eq('rfid_id', rfidId)
            .gte('created_at', todayRange.startISO)
            .lt('created_at', todayRange.endISO)
            .eq('status', 'SUKSES')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let periode = 'MASUK'; // Default ke MASUK
        if (lastLog && lastLog.periode === 'MASUK') {
            periode = 'PULANG'; // Jika log terakhir adalah MASUK, periode berikutnya adalah PULANG
        }

        // 4. Log Sukses
        await db.from('presensi').insert([{
            rfid_id: rfidId,
            status: 'SUKSES',
            periode: periode,
            keterangan: `Presensi ${periode} berhasil.`,
            created_at: timestamp.toISOString()
        }]);

        // 5. Tampilkan status Sukses
        showStatusMessage('success',
            `Presensi ${periode} Berhasil!`,
            namaKaryawan,
            periode,
            timeWIT
        );

    } catch (e) {
        console.error("Kesalahan Presensi:", e);
        // Log Gagal - Error Sistem
        await db.from('presensi').insert([{
            rfid_id: rfidId,
            status: 'GAGAL',
            keterangan: `Kesalahan sistem: ${e.message}`,
            created_at: timestamp.toISOString()
        }]);
        showStatusMessage('fail', 'Kesalahan Sistem. Cek konsol.');
    } finally {
        // Logika ini akan secara otomatis memuat ulang log ringkasan di showStatusMessage
    }
};


// ===================================
// LISTENER & INISIALISASI
// ===================================

let rfidBuffer = '';
let lastKeyPressTime = 0;
const KEY_PRESS_TIMEOUT = 50; // Waktu maksimum antar tombol (ms)

/**
 * Menyiapkan listener keyboard untuk emulasi Keyboard HID RFID.
 */
const setupHIDListener = () => {
    document.addEventListener('keydown', (e) => {
        const currentTime = Date.now();
        // Cek apakah jeda terlalu lama (mengindikasikan input baru)
        if (currentTime - lastKeyPressTime > KEY_PRESS_TIMEOUT) {
            rfidBuffer = '';
        }

        // Hanya proses jika Tap Kartu sedang ditampilkan
        if (tapContainer.style.display !== 'none' || tapContainer.style.display === '') {
            if (e.key >= '0' && e.key <= '9' || e.key >= 'a' && e.key <= 'z' || e.key >= 'A' && e.key <= 'Z') {
                rfidBuffer += e.key;
                lastKeyPressTime = currentTime;
                e.preventDefault(); // Mencegah pengetikan di tempat lain
            } else if (e.key === 'Enter' && rfidBuffer.length > 0) {
                // Proses tap kartu
                handleRfidTap(rfidBuffer.trim());
                rfidBuffer = ''; // Reset buffer
                lastKeyPressTime = 0;
                e.preventDefault();
            }
        }
    });
    console.log("HID Listener aktif.");
};

/**
 * Memutar suara, memastikan audio dimulai dari awal.
 * @param {HTMLAudioElement} audio
 */
const playSound = (audio) => {
    try {
        audio.pause();
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Gagal memutar audio:", e));
    } catch (e) {
        console.warn("Kesalahan saat memutar audio:", e);
    }
};

/**
 * Fungsi untuk menampilkan container Tap Kartu dan menyembunyikan Log.
 */
const showTapContainer = () => {
    tapContainer.style.display = 'flex';
    logContainer.style.display = 'none';
    navTapKartu.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    navLogAbsen.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    showStatusMessage('default', 'Siap menerima tap kartu...');
};

/**
 * Fungsi untuk menampilkan container Log Absen dan menyembunyikan Tap Kartu.
 */
const showLogContainer = () => {
    tapContainer.style.display = 'none';
    logContainer.style.display = 'block';
    navTapKartu.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    navLogAbsen.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    
    // Pastikan log detail dimuat saat tab diklik
    const todayRange = getWITEpochRangeForToday();
    loadLogData(todayRange);
};

/**
 * Menyiapkan event listener untuk navigasi.
 */
const setupNavigation = () => {
    messageCloseButton.addEventListener('click', hideMessageBox);
    navTapKartu.addEventListener('click', showTapContainer);
    navLogAbsen.addEventListener('click', showLogContainer);
};

/**
 * Mengecek apakah tanggal logis WIT telah berganti. Jika ya, memuat ulang log.
 * FUNGSI UTAMA UNTUK AUTO-UPDATE LOG HARIAN.
 */
const checkDayChangeAndReload = () => {
    const today = new Date();
    const todayDateString = getWITEDate(today);

    if (lastLoadedDate && todayDateString !== lastLoadedDate) {
        console.log(`Pergantian hari terdeteksi: ${lastLoadedDate} -> ${todayDateString}. Memuat ulang log...`);
        // Muat ulang log harian
        setupInitialState();
        // Cek apakah user sedang berada di tab Log Absen, jika ya, muat ulang juga detailnya.
        if (logContainer.style.display !== 'none') {
             const todayRange = getWITEpochRangeForToday();
             loadLogData(todayRange);
        }
    } else {
        console.log(`Log data up-to-date untuk tanggal: ${todayDateString}`);
    }
};

/**
 * Memulai pengecekan pergantian hari secara berkala.
 */
const startDayChangeChecker = () => {
    // Panggil sekali untuk memastikan state awal terisi
    checkDayChangeAndReload(); 
    // Set interval untuk cek harian
    setInterval(checkDayChangeAndReload, DAY_CHECK_INTERVAL_MS);
    console.log(`Pengawasan pergantian hari dimulai, interval: ${DAY_CHECK_INTERVAL_MS / 60000} menit.`);
};

/**
 * Mempersiapkan state awal aplikasi (memuat data log harian).
 */
const setupInitialState = async () => {
    const todayRange = getWITEpochRangeForToday();
    lastLoadedDate = todayRange.dateString; // Set state tanggal terakhir dimuat
    await loadLogSummary(todayRange); // Muat ringkasan untuk tampilan awal
    showTapContainer(); // Default view
};


// ===================================
// INISIALISASI (Perbaikan Autoplay)
// ===================================

window.onload = () => {
    // 1. Setup navigasi
    setupNavigation();
    
    // 2. Setup state awal (memuat log dari Supabase & tampilkan Tap Kartu)
    setupInitialState(); 
    
    // 3. Setup pengawasan pergantian hari
    startDayChangeChecker();

    // 4. Setup listener HANYA SETELAH TOMBOL DIKLIK
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
