// app.js (KODE PERBAIKAN)

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

// Log Counter Elements (Sudah ada, tidak perlu diulang)
const logSuksesPagiElement = document.getElementById('log-sukses-pagi');
const logGagalPagiElement = document.getElementById('log-gagal-pagi');
const logSuksesSiangElement = document.getElementById('log-sukses-siang');
const logGagalSiangElement = document.getElementById('log-gagal-siang');
const logSuksesSoreElement = document.getElementById('log-sukses-sore');
const logGagalSoreElement = document.getElementById('log-gagal-sore');
const logSuksesMalamElement = document.getElementById('log-sukses-malam');
const logGagalMalamElement = document.getElementById('log-gagal-malam');

// Audio Elements (Sudah ada, tidak perlu diulang)
const audioSuccess = document.getElementById('audio-success');
const audioFail = document.getElementById('audio-fail');
const audioDuplicate = document.getElementById('audio-duplicate'); 

// === ELEMEN MODAL BARU ===
const openLogModalButton = document.getElementById('open-log-modal');
const logModal = document.getElementById('log-modal');
const closeLogModalButton = document.getElementById('close-log-modal');
const logListContainer = document.getElementById('log-list-container');
const logStatusElement = document.getElementById('log-status');
// =========================

// State (Tidak ada perubahan pada state yang sudah ada)
let currentRFID = ''; 
let isProcessing = false; 
let logCounters = {
    // ... (Logika sama)
    total: { success: 0, fail: 0 },
    pagi: { success: 0, fail: 0 },
    siang: { success: 0, fail: 0 },
    sore: { success: 0, fail: 0 },
    malam: { success: 0, fail: 0 }
};

const lastTapStatus = new Map(); 
const DEDUPLICATION_WINDOW_MS = 60000; // 60 detik

const LOCAL_STORAGE_KEY = 'rfid_log_counters';
const LOCAL_STORAGE_DATE_KEY = 'rfid_log_date';
const RESET_HOUR = 1; // Waktu reset harian pada pukul 01:00 WIT


// ===================================
// UTILITY/UI FUNCTIONS (Tidak ada perubahan signifikan pada fungsi ini)
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

function getTodayDateString() {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < RESET_HOUR) {
        now.setDate(now.getDate() - 1);
    }
    
    return now.toISOString().split('T')[0];
}

function updateUILogCounters() {
    // ... (Logika sama)
    if(logSuksesPagiElement) logSuksesPagiElement.textContent = logCounters.pagi.success;
    if(logGagalPagiElement) logGagalPagiElement.textContent = logCounters.pagi.fail;
    if(logSuksesSiangElement) logSuksesSiangElement.textContent = logCounters.siang.success;
    if(logGagalSiangElement) logGagalSiangElement.textContent = logCounters.siang.fail;
    if(logSuksesSoreElement) logSuksesSoreElement.textContent = logCounters.sore.success;
    if(logGagalSoreElement) logGagalSoreElement.textContent = logCounters.sore.fail;
    if(logSuksesMalamElement) logSuksesMalamElement.textContent = logCounters.malam.success;
    if(logGagalMalamElement) logGagalMalamElement.textContent = logCounters.malam.fail;
}

function setupInitialState() {
    // ... (Logika sama)
    const savedCounters = localStorage.getItem(LOCAL_STORAGE_KEY);
    const savedDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
    
    const today = getTodayDateString(); 

    if (savedDate !== today) {
        logCounters = {
            total: { success: 0, fail: 0 },
            pagi: { success: 0, fail: 0 },
            siang: { success: 0, fail: 0 },
            sore: { success: 0, fail: 0 },
            malam: { success: 0, fail: 0 }
        };
        localStorage.setItem(LOCAL_STORAGE_DATE_KEY, today);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
        lastTapStatus.clear(); 
        console.log("Counter presensi direset karena pergantian hari logis (01:00 WIT). Tanggal logis baru:", today);
    } else if (savedCounters) {
        try {
            logCounters = JSON.parse(savedCounters);
            if (!logCounters.pagi) { 
                throw new Error("Invalid logCounters structure, resetting.");
            }
        } catch (e) {
            console.error("Gagal memuat state logCounters dari Local Storage:", e);
            logCounters = {
                total: { success: 0, fail: 0 },
                pagi: { success: 0, fail: 0 },
                siang: { success: 0, fail: 0 },
                sore: { success: 0, fail: 0 },
                malam: { success: 0, fail: 0 }
            };
        }
    }
    updateUILogCounters();
}

function saveLogCounters() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logCounters));
}

function updateLogCounters(rfidId, isSuccess, period) {
    // ... (Logika sama)
    const statusKey = isSuccess ? 'SUCCESS' : 'FAIL';
    const counterKey = isSuccess ? 'success' : 'fail';
    const previousTap = lastTapStatus.get(rfidId);
    
    if (!previousTap || (Date.now() - previousTap.timestamp) > DEDUPLICATION_WINDOW_MS || previousTap.status !== statusKey) {
        
        if (previousTap && previousTap.status !== statusKey) {
             const prevPeriod = previousTap.period;
             const prevCounterKey = previousTap.status === 'SUCCESS' ? 'success' : 'fail';

             if (logCounters[prevPeriod] && logCounters[prevPeriod][prevCounterKey] > 0) {
                 logCounters[prevPeriod][prevCounterKey]--;
             }
        }

        if (logCounters[period]) {
            logCounters[period][counterKey]++;
        } else {
            logCounters.total[counterKey]++;
        }

        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });

        updateUILogCounters();
        saveLogCounters();
        return true; 
    } else if (previousTap.status === statusKey) {
        lastTapStatus.set(rfidId, { timestamp: Date.now(), status: statusKey, period: period });
    }
    return false;
}

// ... (Fungsi showAlreadyTappedStatus, resetStatus, showProcessingStatus, dan updateUI tetap sama)

// ===================================
// LOG ABSENSI DAN PEMELIHARAAN LOG (BARU)
// ===================================

/**
 * Menghapus log absensi yang lebih lama dari 3 hari dari Supabase.
 */
async function pruneOldLogs() {
    const today = new Date();
    // Hitung tanggal 3 hari yang lalu (misalnya hari ini Rabu, kita hapus log <= Minggu)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    // Format tanggal menjadi ISO string (UTC) untuk Supabase
    const pruneDate = threeDaysAgo.toISOString();

    console.log(`Memeriksa dan menghapus log absensi sebelum: ${pruneDate}`);
    
    try {
        const { error, count } = await db
            .from('log_absen')
            .delete({ count: 'exact' }) // Minta jumlah baris yang dihapus
            .lt('created_at', pruneDate); // Hapus yang "less than" (lebih lama dari) tanggal ini

        if (error) {
            console.error('Gagal membersihkan log lama (Pruning):', error);
            return 0;
        }

        const deletedCount = count || 0;
        console.log(`Berhasil membersihkan ${deletedCount} log absensi lama (lebih dari 3 hari).`);
        return deletedCount;

    } catch (e) {
        console.error('Kesalahan Pruning Log:', e);
        return 0;
    }
}

/**
 * Mengambil log absensi 3 hari terakhir dari Supabase.
 */
async function fetchRecentLogs() {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const fromDate = threeDaysAgo.toISOString();

    try {
        const { data, error } = await db
            .from('log_absen')
            .select('created_at, nama, status, periode')
            .gte('created_at', fromDate)
            .order('created_at', { ascending: false }) // Tampilkan yang terbaru di atas
            .limit(100); // Batasi maksimal 100 log untuk menghindari loading terlalu berat

        if (error) throw error;
        
        return data || [];

    } catch (e) {
        console.error('Gagal mengambil log absensi:', e);
        return null;
    }
}

/**
 * Menampilkan data log ke dalam Modal.
 */
async function displayLogsInModal() {
    logStatusElement.textContent = 'Memuat log absensi...';
    logListContainer.innerHTML = ''; // Kosongkan container sebelumnya

    const logs = await fetchRecentLogs();

    if (logs === null) {
        logStatusElement.textContent = 'Gagal memuat log. Periksa koneksi atau Supabase.';
        return;
    }

    if (logs.length === 0) {
        logStatusElement.textContent = 'Tidak ada log absensi dalam 3 hari terakhir.';
        return;
    }

    logStatusElement.textContent = ''; // Hapus status loading/empty

    // Buat tabel untuk menampilkan log
    const tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                    <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th class="py-2 px-1 sm:px-3">Waktu</th>
                        <th class="py-2 px-1 sm:px-3">Nama/Kartu</th>
                        <th class="py-2 px-1 sm:px-3">Periode</th>
                        <th class="py-2 px-1 sm:px-3">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${logs.map(log => {
                        const date = new Date(log.created_at);
                        // Format jam lokal (WIT) dan tanggal
                        const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                        
                        const statusColor = log.status.startsWith('Sukses') ? 'bg-success-green text-white' : 'bg-error-red text-white';

                        return `
                            <tr>
                                <td class="py-2 px-1 sm:px-3 whitespace-nowrap text-xs">${dateStr}<br/>**${timeStr}**</td>
                                <td class="py-2 px-1 sm:px-3 text-gray-900 font-medium text-sm">${log.nama}</td>
                                <td class="py-2 px-1 sm:px-3 text-gray-600 text-xs">${log.periode}</td>
                                <td class="py-2 px-1 sm:px-3">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                                        ${log.status.startsWith('Sukses') ? 'Sukses' : 'Gagal'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    logListContainer.innerHTML = tableHTML;
}

// ===================================
// PRESENSI LOGIC (checkCardSupabase - Tidak ada perubahan)
// ===================================

async function checkCardSupabase(rfidId) {
    if (isProcessing) return; 
    isProcessing = true;

    showProcessingStatus();
    
    const currentPeriod = getCurrentMealPeriod();
    const today = getTodayDateString(); 

    let result = {
        success: false,
        message: 'Kartu Tidak Dikenal!',
        rfidId: rfidId,
        nama: 'Pengguna tidak terdaftar',
        status_log: "Gagal (Unknown Card)",
        currentPeriod: currentPeriod 
    };
    
    try {
        const { data: userData, error: userError } = await db
            .from("data_master")
            .select("nama, pagi, siang, sore, malam")
            .eq("card", rfidId)
            .maybeSingle();

        if (userError) throw userError;

        if (userData) {
            result.nama = userData.nama;
            
            const todayStart = `${today}T00:00:00+00:00`;
            const todayEnd = `${today}T23:59:59+00:00`;
            
            const { data: logData, error: logError } = await db
                .from("log_absen")
                .select("id")
                .eq("card", rfidId)
                .eq("periode", currentPeriod)
                .eq("status", "Sukses") 
                .gte("created_at", todayStart)
                .lt("created_at", todayEnd);

            if (logError) throw logError;
            
            if (logData && logData.length > 0) {
                result.success = false;
                result.message = `Gagal Absen! Anda sudah TAP SUKSES untuk periode ${currentPeriod.toUpperCase()} hari ini.`;
                result.status_log = `Gagal (Double Tap Sukses)`;
                
                isProcessing = true; 
                showAlreadyTappedStatus(rfidId, userData.nama);
                return;
            }

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
// HID KEYBOARD LISTENER LOGIC (Tetap sama)
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
// INISIALISASI (Ditambahkan setup modal & pruning log)
// ===================================

function setupDailyReset() {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setDate(resetTime.getDate() + (now.getHours() >= RESET_HOUR ? 1 : 0));
    resetTime.setHours(RESET_HOUR, 0, 0, 0); 
    
    const delay = resetTime.getTime() - now.getTime();
    
    console.log(`Reset harian akan dipicu dalam ${Math.round(delay / 1000 / 60)} menit pada pukul ${RESET_HOUR}:00 WIT.`);

    setTimeout(() => {
        setupInitialState();
        setInterval(setupInitialState, 24 * 60 * 60 * 1000); 
    }, delay);
}

function setupModalListeners() {
    openLogModalButton.addEventListener('click', () => {
        logModal.style.display = 'flex';
        displayLogsInModal(); // Muat dan tampilkan log saat modal dibuka
    });

    closeLogModalButton.addEventListener('click', () => {
        logModal.style.display = 'none';
    });

    // Tutup modal jika klik di luar area konten
    logModal.addEventListener('click', (e) => {
        if (e.target === logModal) {
            logModal.style.display = 'none';
        }
    });
}


window.onload = async () => {
    // 1. Setup state awal (counter harian)
    setupInitialState(); 
    
    // 2. Pruning Log Lama (Dijalankan setiap kali load halaman)
    await pruneOldLogs();
    
    // 3. Setup listener untuk reset harian 
    setupDailyReset();
    
    // 4. Setup Modal Log Absensi
    setupModalListeners();
    
    // 5. Setup HID listener
    setupHIDListener();
};
