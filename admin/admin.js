import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_KEY = "public-anon-key";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const tableBody = document.querySelector("#logTable tbody");

async function loadLog() {
  const { data, error } = await db
    .from("log_absen")
    .select("*")
    .order("id", { ascending: false });

  tableBody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.waktu}</td>
      <td>${row.card}</td>
      <td>${row.nama}</td>
      <td>${row.status}</td>
    `;

    tableBody.appendChild(tr);
  });
}

loadLog();

