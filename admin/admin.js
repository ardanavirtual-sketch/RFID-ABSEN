import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://ymzcvyumplerqccaplxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemN2eXVtcGxlcnFjY2FwbHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjk3ODUsImV4cCI6MjA3ODY0NTc4NX0.XtX9NMHp3gINRP3zSA-PnC73tiI4vPVcB4D2A13c1TI";

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

