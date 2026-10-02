const $ = id => document.getElementById(id);
const key = "turni-pwa-v2";
const defaults = [
  { name: "Giorno", start: "07:00", end: "19:50", credited: 740 },
  { name: "Notte", start: "19:15", end: "07:15", credited: 720 },
  { name: "Smonto", start: "", end: "", credited: 0 },
  { name: "Riposo", start: "", end: "", credited: 0 },
  { name: "Riposo", start: "", end: "", credited: 0 }
];

let data = JSON.parse(localStorage.getItem(key) || "null") || { commitments: [], breaks: [], pattern: defaults, overrides: [] };
if (!data.pattern) data.pattern = defaults;
if (!data.overrides) data.overrides = [];

let selected = new Date(2026, 9, 16);
let editingShift = -1;

// Genera la data in formato YYYY-MM-DD usando il fuso orario locale (evita lo slittamento UTC)
function iso(d) {
  let y = d.getFullYear();
  let m = String(d.getMonth() + 1).padStart(2, "0");
  let day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDate(s) {
  let [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function save() {
  localStorage.setItem(key, JSON.stringify(data));
}

function start() {
  return localStorage.getItem("cycleStart") || "2026-10-16";
}

function paused(d) {
  let x = iso(d);
  return data.breaks.some(b => x >= b.start && x <= b.end);
}

function baseIndex(d) {
  let s = localDate(start()), t = localDate(iso(d)), cur = new Date(s), dir = t >= s ? 1 : -1, count = 0;
  while (iso(cur) !== iso(t)) {
    cur.setDate(cur.getDate() + dir);
    if (!paused(cur)) count += dir;
  }
  return ((count % data.pattern.length) + data.pattern.length) % data.pattern.length;
}

function shiftIndex(d) {
  let o = data.overrides.find(x => x.date === iso(d));
  return o ? o.index : (paused(d) ? null : baseIndex(d));
}

function fmtDate(d) {
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

function fmtMin(m) {
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function renderDay() {
  if ($("selectedDate")) $("selectedDate").value = iso(selected);
  if ($("pageTitle")) $("pageTitle").textContent = iso(selected) === iso(new Date()) ? "Oggi" : fmtDate(selected);
  
  let i = shiftIndex(selected), c = $("shiftCard");
  if (c) {
    if (i === null) c.innerHTML = '<div class="shift-name">Ferie / pausa</div><div class="shift-time">Il ciclo è sospeso in questa data.</div>';
    else {
      let s = data.pattern[i];
      c.innerHTML = `<div class="shift-name">${esc(s.name)}</div><div class="shift-time">${s.start && s.end ? s.start + "–" + s.end : "Nessun orario"}</div><div class="credited">Ore conteggiate: ${fmtMin(s.credited)}</div>${data.overrides.some(x => x.date === iso(selected)) ? '<div class="muted">Modifica manuale per questa giornata</div>' : ""}`;
    }
  }

  if ($("commitments")) {
    let arr = data.commitments.filter(x => x.date === iso(selected)).sort((a, b) => a.start.localeCompare(b.start));
    $("commitments").innerHTML = arr.length ? arr.map((x, n) => `<div class="commitment"><b>${esc(x.title)}</b><div>${x.start}–${x.end} · ${esc(x.type)}</div>${x.location ? `<div class="muted">📍 ${esc(x.location)}</div>` : ""}${x.notes ? `<div class="muted">${esc(x.notes)}</div>` : ""}<button onclick="delCommit(${n})" style="float:right;color:#b91c1c">Elimina</button></div>`).join("") : '<div class="card muted">Nessun impegno.</div>';
  }
}

function delCommit(n) {
  let a = data.commitments.filter(x => x.date === iso(selected)).sort((a, b) => a.start.localeCompare(b.start));
  data.commitments.splice(data.commitments.indexOf(a[n]), 1);
  save();
  renderDay();
}

function openModal() {
  if ($("cDate")) $("cDate").value = iso(selected);
  if ($("modal")) $("modal").classList.remove("hidden");
}

function closeModal() {
  if ($("modal")) $("modal").classList.add("hidden");
}

function renderMonth() {
  let monthPicker = $("monthPicker");
  if (!monthPicker) return;
  let v = monthPicker.value || iso(selected).slice(0, 7), [y, m] = v.split("-").map(Number), f = new Date(y, m - 1, 1), l = new Date(y, m, 0), h = "";
  for (let i = 0; i < f.getDay(); i++) h += "<div></div>";
  for (let d = 1; d <= l.getDate(); d++) {
    let dt = new Date(y, m - 1, d), i = shiftIndex(dt), s = i === null ? null : data.pattern[i];
    h += `<button class="day ${s ? "shift" : ""} ${iso(dt) === iso(selected) ? "selected" : ""}" onclick="selectMonthDay('${iso(dt)}')">${d}${s ? `<small>${esc(s.name)}</small>` : ""}</button>`;
  }
  if ($("monthGrid")) $("monthGrid").innerHTML = h;
}

function selectMonthDay(s) {
  selected = localDate(s);
  if ($("monthPicker")) $("monthPicker").value = s.slice(0, 7);
  show("home");
  renderDay();
}

function monthMinutes(v) {
  let [y, m] = v.split("-").map(Number), days = new Date(y, m, 0).getDate(), total = 0, c = Array(data.pattern.length).fill(0);
  for (let d = 1; d <= days; d++) {
    let dt = new Date(y, m - 1, d), i = shiftIndex(dt);
    if (i !== null) {
      total += data.pattern[i].credited;
      c[i]++;
    }
  }
  return [total, c];
}

function renderHours() {
  let hoursMonth = $("hoursMonth");
  if (!hoursMonth) return;
  let v = hoursMonth.value || "2026-10";
  hoursMonth.value = v;
  let [t, c] = monthMinutes(v);
  if ($("totalHours")) $("totalHours").textContent = fmtMin(t);
  if ($("counts")) $("counts").innerHTML = data.pattern.map((x, i) => `<div class="stat"><span>${esc(x.name)}</span><b>${c[i]}</b><small>${fmtMin(c[i] * x.credited)}</small></div>`).join("");
}

function renderPattern() {
  if ($("shiftEditor")) $("shiftEditor").innerHTML = data.pattern.map((s, i) => `<div class="commitment"><div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center"><b>${i + 1}</b><div><b>${esc(s.name)}</b><div class="muted">${s.start && s.end ? s.start + "–" + s.end : "Nessun orario"} · ${fmtMin(s.credited)}</div></div><div><button onclick="editShift(${i})">✏️</button><button onclick="deleteShift(${i})">🗑️</button></div></div></div>`).join("");
  if ($("overrideShift")) $("overrideShift").innerHTML = data.pattern.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.name)}</option>`).join("");
}

function openShiftModal(i) {
  editingShift = i;
  if ($("shiftModalTitle")) $("shiftModalTitle").textContent = i < 0 ? "Nuovo turno" : "Modifica turno";
  let s = i < 0 ? { name: "", start: "", end: "", credited: 0 } : data.pattern[i];
  if ($("sName")) $("sName").value = s.name;
  if ($("sStart")) $("sStart").value = s.start;
  if ($("sEnd")) $("sEnd").value = s.end;
  if ($("sCredited")) $("sCredited").value = s.credited;
  if ($("shiftModal")) $("shiftModal").classList.remove("hidden");
}

function editShift(i) { openShiftModal(i); }
function deleteShift(i) {
  if (data.pattern.length <= 1) return alert("Deve rimanere almeno un turno.");
  if (!confirm("Eliminare questo turno dal ciclo?")) return;
  data.pattern.splice(i, 1);
  data.overrides = data.overrides.filter(x => x.index !== i).map(x => x.index > i ? { ...x, index: x.index - 1 } : x);
  save();
  renderAll();
}

function renderOverrides() {
  if ($("overrideList")) $("overrideList").innerHTML = data.overrides.sort((a, b) => a.date.localeCompare(b.date)).map(x => `<div class="commitment"><b>${x.date}</b><div>${esc(data.pattern[x.index]?.name || "Turno eliminato")}</div><button onclick="removeOverride('${x.date}')" style="color:#b91c1c">Rimuovi modifica</button></div>`).join("");
}

function removeOverride(date) {
  data.overrides = data.overrides.filter(x => x.date !== date);
  save();
  renderAll();
}

function renderBreaks() {
  if ($("breakList")) $("breakList").innerHTML = data.breaks.map((b, i) => `<div class="commitment"><b>${b.start} → ${b.end}</b><div class="muted">${esc(b.reason || "Pausa ciclo")}</div><button onclick="removeBreak(${i})" style="color:#b91c1c">Elimina</button></div>`).join("");
}

function removeBreak(i) {
  data.breaks.splice(i, 1);
  save();
  renderAll();
}

function show(id) {
  document.querySelectorAll(".page").forEach(x => x.classList.toggle("active", x.id === id));
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.page === id));
  if (id === "calendar") renderMonth();
  if (id === "hours") renderHours();
  if (id === "settings") { renderPattern(); renderOverrides(); renderBreaks(); }
}

function renderAll() {
  renderDay();
  renderMonth();
  renderHours();
  renderPattern();
  renderOverrides();
  renderBreaks();
}

document.addEventListener("DOMContentLoaded", () => {
  if ($("addBtn")) $("addBtn").onclick = openModal;
  if ($("addCommitment2")) $("addCommitment2").onclick = openModal;
  if ($("closeModal")) $("closeModal").onclick = closeModal;

  if ($("saveCommitment")) {
    $("saveCommitment").onclick = () => {
      if (!$("cTitle").value.trim()) return alert("Inserisci un titolo.");
      data.commitments.push({
        title: $("cTitle").value,
        date: $("cDate").value,
        type: $("cType").value,
        start: $("cStart").value,
        end: $("cEnd").value,
        location: $("cLocation").value,
        notes: $("cNotes").value
      });
      save();
      closeModal();
      renderDay();
    };
  }

  if ($("prevDay")) $("prevDay").onclick = () => { selected.setDate(selected.getDate() - 1); renderDay(); };
  if ($("nextDay")) $("nextDay").onclick = () => { selected.setDate(selected.getDate() + 1); renderDay(); };
  if ($("selectedDate")) $("selectedDate").onchange = e => { selected = localDate(e.target.value); renderDay(); };
  if ($("monthPicker")) $("monthPicker").onchange = renderMonth;
  if ($("hoursMonth")) $("hoursMonth").onchange = renderHours;

  if ($("cycleStart")) {
    $("cycleStart").value = localStorage.getItem("cycleStart") || "2026-10-16";
    $("cycleStart").onchange = () => {
      localStorage.setItem("cycleStart", $("cycleStart").value);
      renderAll();
    };
  }

  if ($("addShiftBtn")) $("addShiftBtn").onclick = () => openShiftModal(-1);
  if ($("closeShiftModal")) $("closeShiftModal").onclick = () => $("shiftModal").classList.add("hidden");

  if ($("saveShift")) {
    $("saveShift").onclick = () => {
      let name = $("sName").value.trim();
      if (!name) return alert("Inserisci il nome del turno.");
      let s = { name, start: $("sStart").value, end: $("sEnd").value, credited: Number($("sCredited").value) || 0 };
      if (editingShift < 0) data.pattern.push(s);
      else data.pattern[editingShift] = s;
      save();
      $("shiftModal").classList.add("hidden");
      renderAll();
    };
  }

  if ($("resetPattern")) {
    $("resetPattern").onclick = () => {
      if (confirm("Ripristinare i 5 turni originali?")) {
        data.pattern = JSON.parse(JSON.stringify(defaults));
        data.overrides = [];
        save();
        renderAll();
      }
    };
  }

  if ($("saveOverride")) {
    $("saveOverride").onclick = () => {
      let date = $("overrideDate").value, index = Number($("overrideShift").value);
      if (!date) return alert("Scegli una data.");
      data.overrides = data.overrides.filter(x => x.date !== date);
      data.overrides.push({ date, index });
      save();
      selected = localDate(date);
      renderAll();
    };
  }

  if ($("saveBreak")) {
    $("saveBreak").onclick = () => {
      let a = $("breakStart").value, b = $("breakEnd").value;
      if (!a || !b || a > b) return alert("Controlla le date.");
      data.breaks.push({ start: a, end: b, reason: "Ferie" });
      save();
      renderAll();
    };
  }

  document.querySelectorAll(".tab").forEach(b => b.onclick = () => show(b.dataset.page));

  if ($("overrideDate")) $("overrideDate").value = iso(selected);

  renderAll();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
});