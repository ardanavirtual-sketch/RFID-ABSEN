// admin/admin.js

import { createClient } from "https://esm.sh/@supabase/supabase-js";

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ELEMEN DOM ---
const navLinks = document.querySelectorAll('.nav-link');
const viewContents = document.querySelectorAll('.view-content');
const viewTitle = document.getElementById('view-title');

// Log Absen Elements
const logTableBody = document.getElementById('log-table-body');
const logTable = document.getElementById('log-table');
const logStatus = document.getElementById('log-status');
const refreshLogButton = document.getElementById('refresh-log');

// Update Data Elements
const excelFileInput = document.getElementById('excel-file-input');
const previewDataButton = document.getElementById('preview-data');
const importDataButton = document.getElementById('import-data-button');
const importStatus = document.getElementById('import-status');
const previewSection = document.getElementById('preview-section');
const previewCount = document.getElementById('preview-count');
const previewTableBody = document.getElementById('preview-table-body');
const previewTable = document.getElementById('preview-table');

let importedJsonData = []; 
const requiredHeaders = ['card', 'nama', 'departemen', 'pagi', 'siang', 'sore', 'malam']; 

// ===================================
// UTILITY FUNCTIONS
// ===================================

function switchView(targetView) {
    viewContents.forEach(section => {
        section.classList.add('hidden');
        if (section.id === targetView) {
            section.classList.remove('hidden');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active-link');
        if (link.getAttribute('data-view') === targetView) {
            link.classList.add('active-link');
        }
    });

    viewTitle.textContent = targetView === 'log-absen' ? 'Log Absen' : 'Update Data Jatah Makan';

    if (targetView === 'log-absen') {
        fetchLogAbsen();
    }
}


// ===================================
// 1. LOG ABSEN FUNCTIONALITY
// ===================================

async function fetchLogAbsen() {
    logStatus.textContent = 'Memuat data...';
    logTable.classList.add('hidden');
    logTableBody.innerHTML = '';

    const today = new Date().toISOString().split('T')[0]; 
    const startOfDay = `${today}T00:00:00.000Z`;

    try {
        const { data: logData, error } = await db
            .from('log_absen')
            .select('*')
            .gte('created_at', startOfDay) 
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (logData.length === 0) {
            logStatus.textContent = 'Tidak ada data absen hari ini.';
            return;
        }

        logData.forEach(log => {
            const row = logTableBody.insertRow();
            const time = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            row.insertCell().textContent = time;
            row.insertCell().textContent = log.nama;
            row.insertCell().textContent = log.departemen || 'N/A';
            row.insertCell().textContent = log.card;
            
            const statusCell = row.insertCell();
            statusCell.textContent = log.status;
            statusCell.className = log.status === 'Sukses' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
        });

        logTable.classList.remove('hidden');
        logStatus.textContent = `Total ${logData.length} entri hari ini.`;

    } catch (e) {
        logStatus.textContent = `Gagal memuat log: ${e.message}`;
        console.error('Error fetching log absen:', e);
    }
}


// ===================================
// 2. UPDATE DATA FUNCTIONALITY (IMPORT EXCEL)
// ===================================

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Konversi data ke format yang stabil
        importedJsonData = XLSX.utils.sheet_to_json(sheet, {
            raw: false, 
            header: requiredHeaders 
        }).map(row => {
            const newRow = {};
            requiredHeaders.forEach(header => {
                // Pastikan nilai terambil, gunakan string kosong jika undefined
                newRow[header] = row[header] !== undefined ? row[header] : ''; 
            });
            return newRow;
        });

        if (importedJsonData.length === 0) {
            importStatus.className = 'mt-4 text-sm font-medium text-red-600';
            importStatus.textContent = `❌ Gagal: File kosong atau tidak terbaca.`;
            previewDataButton.disabled = true;
            importDataButton.disabled = true;
            return;
        }

        importStatus.className = 'mt-4 text-sm font-medium text-blue-600';
        importStatus.textContent = `✅ File dimuat. ${importedJsonData.length} baris siap dipratinjau.`;
        previewDataButton.disabled = false;
        importDataButton.disabled = true; 

    };
    reader.readAsArrayBuffer(file);
}

function showPreview() {
    previewTableBody.innerHTML = '';
    
    const tableHead = previewTable.querySelector('thead');
    tableHead.innerHTML = '';
    if (importedJsonData.length > 0) {
        const headerRow = tableHead.insertRow();
        requiredHeaders.forEach(key => { 
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = key;
            headerRow.appendChild(th);
        });

        importedJsonData.slice(0, 10).forEach(rowObject => {
            const row = previewTableBody.insertRow();
            requiredHeaders.forEach(key => {
                row.insertCell().textContent = rowObject[key] || '';
            });
        });
    }

    previewCount.textContent = importedJsonData.length;
    previewSection.classList.remove('hidden');
    importDataButton.disabled = importedJsonData.length === 0;
    importStatus.className = 'mt-4 text-sm font-medium text-yellow-600';
    importStatus.textContent = `⚠️ Pratinjau ditampilkan. Klik "Import & Arsipkan" untuk memproses ${importedJsonData.length} baris.`;
}

async function processImport() {
    if (importedJsonData.length === 0) {
        alert("Tidak ada data untuk di-import.");
        return;
    }

    importDataButton.disabled = true;
    previewDataButton.disabled = true;
    importStatus.className = 'mt-4 text-sm font-medium text-blue-600 animate-pulse';
    importStatus.textContent = 'Memulai proses import... (1/3: Mengarsipkan Data Lama)';
    
    try {
        // 1. ARSIP DATA LAMA
        const { data: oldData, error: selectError } = await db
            .from('data_master')
            .select('*');

        if (selectError) throw selectError;

        if (oldData.length > 0) {
            const dataToArchive = oldData.map(item => ({
                ...item,
                tanggal_arsip: new Date().toISOString(),
                id: undefined 
            }));
            
            const { error: archiveError } = await db
                .from('data_master_arsip')
                .insert(dataToArchive);

            if (archiveError) throw archiveError;
        }
        
        // 2. HAPUS DATA LAMA (Truncate data_master)
        importStatus.textContent = 'Memulai proses import... (2/3: Menghapus Data Lama)';
        
        const { error: deleteError } = await db
            .from('data_master')
            .delete()
            .neq('id', 0); 

        if (deleteError) throw deleteError;

        // 3. INSERT DATA BARU
        importStatus.textContent = `Memulai proses import... (3/3: Memasukkan ${importedJsonData.length} Data Baru)`;

        const { error: insertError } = await db
            .from('data_master')
            .insert(importedJsonData);

        if (insertError) throw insertError;
        
        importStatus.className = 'mt-4 text-sm font-medium text-green-600';
        importStatus.textContent = `✅ SUKSES! ${importedJsonData.length} data baru telah di-import dan data lama telah diarsipkan.`;

    } catch (e) {
        importStatus.className = 'mt-4 text-sm font-medium text-red-600';
        importStatus.textContent = `❌ Gagal total import! Cek konsol. Pesan: ${e.message}`;
        console.error('Proses Import Gagal:', e);
    }
    
    importDataButton.disabled = false;
    previewDataButton.disabled = false;
}


// ===================================
// EVENT LISTENERS & INIT
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(e.target.getAttribute('data-view'));
        });
    });

    refreshLogButton.addEventListener('click', fetchLogAbsen);
    excelFileInput.addEventListener('change', handleFileUpload);
    previewDataButton.addEventListener('click', showPreview);
    importDataButton.addEventListener('click', processImport);

    switchView('log-absen');
});
