import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById("status");
const hasilDiv = document.getElementById("hasil");

// =============================
// FUNGSI MEMBACA RFID via OTG
// =============================
async function startRFID() {
  statusDiv.innerText = "Menghubungkan ke RFID Reader...";

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    statusDiv.innerText = "Reader tersambung. Silakan tap kartu...";

    const reader = port.readable.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const card = new TextDecoder().decode(value).trim();

      if (card.length > 0) {
        cekCard(card);
      }
    }
  } catch (error) {
    statusDiv.innerText = "Gagal menghubungkan ke reader!";
    console.error(error);
  }
}

// =============================
// CEK KARTU DI SUPABASE
// =============================
async function cekCard(card) {
  statusDiv.innerText = "Mengecek database...";
  
  const { data, error } = await db
    .from("data_master")
    .select("*")
    .eq("card", card)
    .maybeSingle();

  if (!data) {
    hasilDiv.style.color = "red";
    hasilDiv.innerText = "❌ Kartu tidak terdaftar!";
    return;
  }

  // CEK JATAH MAKAN
  const dapatMakan =
    data.pagi === "Kantin" ||
    data.siang === "Kantin" ||
    data.sore === "Kantin" ||
    data.malam === "Kantin";

  if (dapatMakan) {
    hasilDiv.style.color = "green";
    hasilDiv.innerText = `✔ Absen Sukses\n${data.nama}`;

    await db.from("log_absen").insert({
      card: data.card,
      nama: data.nama,
      status: "Sukses"
    });

  } else {
    hasilDiv.style.color = "red";
    hasilDiv.innerText = `❌ Tidak ada jatah makan!\n${data.nama}`;

    await db.from("log_absen").insert({
      card: data.card,
      nama: data.nama,
      status: "Gagal"
    });
  }
}

// Start
startRFID();
