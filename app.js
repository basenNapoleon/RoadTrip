import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ---------- Firebase setup ----------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Local state ----------
let tripCode = localStorage.getItem("lofoten_tripcode") || "";
let myName = localStorage.getItem("lofoten_name") || "";
let tripData = null; // live mirror of the firestore doc
let unsub = null;
let map, mapMarkersLayer;
let pendingClickLatLng = null;

const emptyTrip = () => ({
  members: [],
  stops: [],
  stays: [],
  itinerary: [],
  polls: [],
  activities: [],
  packing: [],
  personalPacking: {},
  expenses: []
});

const uid = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

// ---------- DOM refs ----------
const joinScreen = document.getElementById("join-screen");
const appShell = document.getElementById("app-shell");

// ---------- Join flow ----------
document.getElementById("join-btn").addEventListener("click", async () => {
  const codeInput = document.getElementById("join-tripcode").value.trim();
  const nameInput = document.getElementById("join-name").value.trim();
  if (!codeInput || !nameInput) {
    alert("Fyll i både resekod och namn.");
    return;
  }
  tripCode = codeInput.toLowerCase().replace(/\s+/g, "-");
  myName = nameInput;
  localStorage.setItem("lofoten_tripcode", tripCode);
  localStorage.setItem("lofoten_name", myName);
  await enterTrip();
});

async function enterTrip() {
  joinScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  document.getElementById("trip-code-label").textContent = "🏔️ " + tripCode;

  const tripRef = doc(db, "trips", tripCode);
  const snap = await getDoc(tripRef);
  if (!snap.exists()) {
    await setDoc(tripRef, emptyTrip());
  }

  // add myself as a member (dedup)
  const current = (await getDoc(tripRef)).data() || emptyTrip();
  if (!current.members.includes(myName)) {
    await updateDoc(tripRef, { members: [...current.members, myName] });
  }

  if (unsub) unsub();
  unsub = onSnapshot(tripRef, (docSnap) => {
    tripData = docSnap.data() || emptyTrip();
    renderAll();
  });

  initMap();
}

// auto-join on reload if we already have saved credentials
if (tripCode && myName) {
  enterTrip();
}

// ---------- Firestore write helpers ----------
function tripRef() {
  return doc(db, "trips", tripCode);
}
async function saveField(field, value) {
  await updateDoc(tripRef(), { [field]: value });
}

// ---------- Tab navigation ----------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "tab-route" && map) {
      setTimeout(() => map.invalidateSize(), 50);
    }
  });
});

// ============================================================
// RENDER
// ============================================================
function renderAll() {
  if (!tripData) return;
  renderMembers();
  renderStops();
  renderStays();
  renderPolls();
  renderActivities();
  renderPacking();
  renderPersonalPacking();
  renderExpenses();
}

function renderMembers() {
  const el = document.getElementById("members-list");
  el.innerHTML = (tripData.members || []).map((m) => `
    <span class="member-pill">${escapeHtml(m)}<button class="member-remove" data-name="${escapeHtml(m)}" data-action="remove-member" title="Ta bort ${escapeHtml(m)}">✕</button></span>
  `).join("");
}

document.getElementById("members-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='remove-member']");
  if (!btn) return;
  const name = btn.dataset.name;
  if (!confirm(`Ta bort "${name}" från medlemslistan? (Saker de redan lagt till, t.ex. utlägg eller röster, påverkas inte.)`)) return;
  const updated = (tripData.members || []).filter((m) => m !== name);
  await saveField("members", updated);
  // if you removed yourself, forget local join info so you get the join screen again
  if (name === myName) {
    localStorage.removeItem("lofoten_tripcode");
    localStorage.removeItem("lofoten_name");
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- STOPS / MAP ----------
function initMap() {
  if (map) return;
  map = L.map("map").setView([68.2, 14.5], 6); // default center: Lofoten-ish
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap-bidragsgivare"
  }).addTo(map);
  mapMarkersLayer = L.layerGroup().addTo(map);

  map.on("click", (e) => {
    pendingClickLatLng = e.latlng;
    L.popup()
      .setLatLng(e.latlng)
      .setContent("Plats vald – fyll i namn nedan och tryck 'Lägg till stopp'")
      .openOn(map);
  });
}

function renderStops() {
  if (!map) return;
  mapMarkersLayer.clearLayers();
  (tripData.stops || []).forEach((s) => {
    const marker = L.marker([s.lat, s.lng]).addTo(mapMarkersLayer);
    marker.bindPopup(`<b>${escapeHtml(s.name)}</b>${s.note ? "<br>" + escapeHtml(s.note) : ""}`);
  });

  const list = document.getElementById("stop-list");
  list.innerHTML = (tripData.stops || []).map((s) => `
    <li class="list-row">
      <div class="item-row">
        <div>
          <div class="item-card-title">${escapeHtml(s.name)}</div>
          ${s.note ? `<div class="item-card-note">${escapeHtml(s.note)}</div>` : ""}
        </div>
        <button class="delete-btn" data-id="${s.id}" data-action="del-stop">✕</button>
      </div>
    </li>
  `).join("") || `<p class="hint">Inga stopp tillagda än.</p>`;
}

document.getElementById("stop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("stop-name").value.trim();
  const note = document.getElementById("stop-note").value.trim();
  if (!name) return;

  let lat, lng;
  if (pendingClickLatLng) {
    lat = pendingClickLatLng.lat;
    lng = pendingClickLatLng.lng;
    pendingClickLatLng = null;
  } else {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`);
      const results = await res.json();
      if (!results.length) {
        alert("Hittade ingen plats med det namnet. Klicka istället direkt på kartan för att välja plats.");
        return;
      }
      lat = parseFloat(results[0].lat);
      lng = parseFloat(results[0].lon);
    } catch (err) {
      alert("Kunde inte söka just nu. Klicka på kartan istället.");
      return;
    }
  }

  const newStop = { id: uid(), name, note, lat, lng };
  const updated = [...(tripData.stops || []), newStop];
  await saveField("stops", updated);
  map.setView([lat, lng], 10);
  e.target.reset();
});

document.getElementById("stop-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='del-stop']");
  if (!btn) return;
  const updated = (tripData.stops || []).filter((s) => s.id !== btn.dataset.id);
  await saveField("stops", updated);
});

// ---------- STAYS ----------
function renderStays() {
  const list = document.getElementById("stay-list");
  const sorted = [...(tripData.stays || [])].sort((a, b) => a.date.localeCompare(b.date));
  list.innerHTML = sorted.map((s) => `
    <li class="list-row">
      <div class="item-row">
        <div>
          <div class="item-card-meta">${formatDate(s.date)}</div>
          <div class="item-card-title">${escapeHtml(s.place)}</div>
          ${s.note ? `<div class="item-card-note">${escapeHtml(s.note)}</div>` : ""}
        </div>
        <button class="delete-btn" data-id="${s.id}" data-action="del-stay">✕</button>
      </div>
    </li>
  `).join("") || `<p class="hint">Inga nätter inlagda än.</p>`;
}

function formatDate(dstr) {
  if (!dstr) return "";
  const d = new Date(dstr + "T00:00:00");
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}

document.getElementById("stay-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = document.getElementById("stay-date").value;
  const place = document.getElementById("stay-place").value.trim();
  const note = document.getElementById("stay-note").value.trim();
  if (!date || !place) return;
  const updated = [...(tripData.stays || []), { id: uid(), date, place, note }];
  await saveField("stays", updated);
  e.target.reset();
});

document.getElementById("stay-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='del-stay']");
  if (!btn) return;
  const updated = (tripData.stays || []).filter((s) => s.id !== btn.dataset.id);
  await saveField("stays", updated);
});

// ---------- POLLS ----------
function renderPolls() {
  const list = document.getElementById("poll-list");
  list.innerHTML = (tripData.polls || []).map((p) => {
    const totalVotes = p.options.reduce((sum, o) => sum + o.votes.length, 0);
    const optionsHtml = p.options.map((o, idx) => {
      const pct = totalVotes ? Math.round((o.votes.length / totalVotes) * 100) : 0;
      const iVoted = o.votes.includes(myName);
      return `
        <div class="poll-option" data-poll="${p.id}" data-option="${idx}" data-action="vote">
          <div class="poll-bar-wrap">
            <div class="poll-bar-fill" style="width:${pct}%; ${iVoted ? "opacity:1" : "opacity:0.55"}"></div>
            <div class="poll-bar-label">${escapeHtml(o.text)} ${iVoted ? "✓" : ""}</div>
          </div>
          <div class="poll-votes-count">${o.votes.length}</div>
        </div>`;
    }).join("");
    return `
      <li class="list-row">
        <div class="item-row">
          <div class="item-card-title">${escapeHtml(p.question)}</div>
          <button class="delete-btn" data-id="${p.id}" data-action="del-poll">✕</button>
        </div>
        ${optionsHtml}
      </li>`;
  }).join("") || `<p class="hint">Inga omröstningar än.</p>`;
}

document.getElementById("poll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("poll-question").value.trim();
  const optionsRaw = document.getElementById("poll-options").value.trim();
  if (!question || !optionsRaw) return;
  const options = optionsRaw.split(",").map((t) => t.trim()).filter(Boolean).map((text) => ({ text, votes: [] }));
  if (options.length < 2) {
    alert("Ange minst två alternativ, separerade med komma.");
    return;
  }
  const updated = [...(tripData.polls || []), { id: uid(), question, options }];
  await saveField("polls", updated);
  e.target.reset();
});

document.getElementById("poll-list").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-action='del-poll']");
  if (delBtn) {
    const updated = (tripData.polls || []).filter((p) => p.id !== delBtn.dataset.id);
    await saveField("polls", updated);
    return;
  }
  const voteEl = e.target.closest("[data-action='vote']");
  if (voteEl) {
    const pollId = voteEl.dataset.poll;
    const optIdx = parseInt(voteEl.dataset.option, 10);
    const updated = (tripData.polls || []).map((p) => {
      if (p.id !== pollId) return p;
      const newOptions = p.options.map((o, idx) => {
        const votes = o.votes.filter((v) => v !== myName);
        if (idx === optIdx && !o.votes.includes(myName)) votes.push(myName);
        return { ...o, votes };
      });
      return { ...p, options: newOptions };
    });
    await saveField("polls", updated);
  }
});

// ---------- ACTIVITIES ----------
function renderActivities() {
  const list = document.getElementById("activity-list");
  list.innerHTML = (tripData.activities || []).map((a) => {
    const liked = (a.likes || []).includes(myName);
    return `
      <li class="list-row">
        <div class="item-row">
          <div>
            <div class="item-card-title">${escapeHtml(a.name)}</div>
            <div class="item-card-meta">${escapeHtml(a.difficulty || "")} ${a.duration ? "· " + escapeHtml(a.duration) : ""}</div>
            ${a.note ? `<div class="item-card-note">${escapeHtml(a.note)}</div>` : ""}
          </div>
          <button class="delete-btn" data-id="${a.id}" data-action="del-activity">✕</button>
        </div>
        <button class="like-btn ${liked ? "liked" : ""}" data-id="${a.id}" data-action="like-activity">
          <svg class="like-icon" viewBox="0 0 24 24" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.6-9.4C1.2 7.7 3 4.8 6.1 4.5c1.9-.2 3.6.8 5.9 3 2.3-2.2 4-3.2 5.9-3 3.1.3 4.9 3.2 3.7 6.1C19.5 15.4 12 20 12 20z"/></svg>
          ${(a.likes || []).length}
        </button>
      </li>`;
  }).join("") || `<p class="hint">Inga förslag än.</p>`;
}

document.getElementById("activity-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("activity-name").value.trim();
  const difficulty = document.getElementById("activity-difficulty").value.trim();
  const duration = document.getElementById("activity-duration").value.trim();
  const note = document.getElementById("activity-note").value.trim();
  if (!name) return;
  const updated = [...(tripData.activities || []), { id: uid(), name, difficulty, duration, note, likes: [] }];
  await saveField("activities", updated);
  e.target.reset();
});

document.getElementById("activity-list").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-action='del-activity']");
  if (delBtn) {
    const updated = (tripData.activities || []).filter((a) => a.id !== delBtn.dataset.id);
    await saveField("activities", updated);
    return;
  }
  const likeBtn = e.target.closest("[data-action='like-activity']");
  if (likeBtn) {
    const updated = (tripData.activities || []).map((a) => {
      if (a.id !== likeBtn.dataset.id) return a;
      const likes = a.likes || [];
      const newLikes = likes.includes(myName) ? likes.filter((n) => n !== myName) : [...likes, myName];
      return { ...a, likes: newLikes };
    });
    await saveField("activities", updated);
  }
});

// ---------- PACKING: SHARED ----------
function renderPacking() {
  const list = document.getElementById("packing-list");
  list.innerHTML = (tripData.packing || []).map((p) => `
    <li class="list-row">
      <div class="item-row">
        <label class="checkbox-row">
          <input type="checkbox" ${p.checked ? "checked" : ""} data-id="${p.id}" data-action="toggle-packing">
          <span class="${p.checked ? "checked-text" : ""}">${escapeHtml(p.text)}</span>
          ${p.assignee ? `<span class="item-card-meta">· ${escapeHtml(p.assignee)}</span>` : ""}
        </label>
        <button class="delete-btn" data-id="${p.id}" data-action="del-packing">✕</button>
      </div>
    </li>
  `).join("") || `<p class="hint">Packlistan är tom.</p>`;
}

document.getElementById("packing-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("packing-item").value.trim();
  const assignee = document.getElementById("packing-assignee").value.trim();
  if (!text) return;
  const updated = [...(tripData.packing || []), { id: uid(), text, checked: false, assignee }];
  await saveField("packing", updated);
  e.target.reset();
});

document.getElementById("packing-list").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-action='del-packing']");
  if (delBtn) {
    const updated = (tripData.packing || []).filter((p) => p.id !== delBtn.dataset.id);
    await saveField("packing", updated);
  }
});
document.getElementById("packing-list").addEventListener("change", async (e) => {
  const cb = e.target.closest("[data-action='toggle-packing']");
  if (!cb) return;
  const updated = (tripData.packing || []).map((p) => p.id === cb.dataset.id ? { ...p, checked: cb.checked } : p);
  await saveField("packing", updated);
});

// ---------- PACKING: PERSONAL (per member, editable only by owner) ----------
let personalPackingViewer = null;

function renderPersonalPacking() {
  const select = document.getElementById("personal-packing-select");
  const members = (tripData.members && tripData.members.length) ? tripData.members : [myName];

  const prevValue = personalPackingViewer && members.includes(personalPackingViewer) ? personalPackingViewer : myName;
  select.innerHTML = members.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}${m === myName ? " (du)" : ""}</option>`).join("");
  select.value = prevValue;
  personalPackingViewer = select.value;

  const isMine = personalPackingViewer === myName;
  const personal = (tripData.personalPacking && tripData.personalPacking[personalPackingViewer]) || [];

  const listEl = document.getElementById("personal-packing-list");
  listEl.innerHTML = personal.map((p) => `
    <li class="list-row">
      <div class="item-row">
        <label class="checkbox-row">
          <input type="checkbox" ${p.checked ? "checked" : ""} ${isMine ? "" : "disabled"} data-id="${p.id}" data-action="toggle-personal-packing">
          <span class="${p.checked ? "checked-text" : ""}">${escapeHtml(p.text)}</span>
        </label>
        ${isMine ? `<button class="delete-btn" data-id="${p.id}" data-action="del-personal-packing">✕</button>` : ""}
      </div>
    </li>
  `).join("") || `<p class="hint">${isMine ? "Din personliga packlista är tom." : escapeHtml(personalPackingViewer) + " har inte lagt till något än."}</p>`;

  document.getElementById("personal-packing-form").classList.toggle("hidden", !isMine);
  document.getElementById("personal-packing-readonly-hint").classList.toggle("hidden", isMine);
}

document.getElementById("personal-packing-select").addEventListener("change", (e) => {
  personalPackingViewer = e.target.value;
  renderPersonalPacking();
});

document.getElementById("personal-packing-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("personal-packing-item").value.trim();
  if (!text) return;
  const current = (tripData.personalPacking && tripData.personalPacking[myName]) || [];
  const updated = [...current, { id: uid(), text, checked: false }];
  await updateDoc(tripRef(), { [`personalPacking.${myName}`]: updated });
  e.target.reset();
});

document.getElementById("personal-packing-list").addEventListener("click", async (e) => {
  if (personalPackingViewer !== myName) return;
  const delBtn = e.target.closest("[data-action='del-personal-packing']");
  if (!delBtn) return;
  const current = (tripData.personalPacking && tripData.personalPacking[myName]) || [];
  const updated = current.filter((p) => p.id !== delBtn.dataset.id);
  await updateDoc(tripRef(), { [`personalPacking.${myName}`]: updated });
});
document.getElementById("personal-packing-list").addEventListener("change", async (e) => {
  if (personalPackingViewer !== myName) return;
  const cb = e.target.closest("[data-action='toggle-personal-packing']");
  if (!cb) return;
  const current = (tripData.personalPacking && tripData.personalPacking[myName]) || [];
  const updated = current.map((p) => p.id === cb.dataset.id ? { ...p, checked: cb.checked } : p);
  await updateDoc(tripRef(), { [`personalPacking.${myName}`]: updated });
});

// ---------- PACKING: subtab switching ----------
document.querySelectorAll("#tab-packing .subtab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tab-packing .subtab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("#tab-packing .subtab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.subtab).classList.add("active");
  });
});

// ---------- EXPENSES ----------
function renderExpensePayerOptions() {
  const select = document.getElementById("expense-payer");
  const members = tripData.members || [];
  const prevValue = select.value;
  select.innerHTML = members.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}${m === myName ? " (du)" : ""}</option>`).join("");
  if (members.includes(prevValue)) {
    select.value = prevValue;
  } else if (members.includes(myName)) {
    select.value = myName;
  }
}

function renderExpenses() {
  renderExpensePayerOptions();
  const list = document.getElementById("expense-list");
  const expenses = tripData.expenses || [];
  list.innerHTML = expenses.map((ex) => `
    <li class="list-row">
      <div class="item-row">
        <div>
          <div class="item-card-title">${escapeHtml(ex.desc)} — ${ex.amount.toFixed(2)} kr</div>
          <div class="item-card-meta">Betalat av ${escapeHtml(ex.payer)}</div>
        </div>
        <button class="delete-btn" data-id="${ex.id}" data-action="del-expense">✕</button>
      </div>
    </li>
  `).join("") || `<p class="hint">Inga utlägg registrerade än.</p>`;

  // balances: split evenly across all current members
  const members = tripData.members && tripData.members.length ? tripData.members : [];
  const summaryEl = document.getElementById("expense-summary");
  if (!members.length || !expenses.length) {
    summaryEl.innerHTML = `<p class="hint">Lägg till utlägg för att se saldo mellan er.</p>`;
    return;
  }
  const total = expenses.reduce((s, ex) => s + Number(ex.amount || 0), 0);
  const share = total / members.length;
  const paidByPerson = {};
  members.forEach((m) => paidByPerson[m] = 0);
  expenses.forEach((ex) => {
    paidByPerson[ex.payer] = (paidByPerson[ex.payer] || 0) + Number(ex.amount || 0);
  });
  const rows = members.map((m) => {
    const balance = (paidByPerson[m] || 0) - share;
    const cls = balance >= 0 ? "balance-positive" : "balance-negative";
    const label = balance >= 0
      ? `ska få tillbaka ${balance.toFixed(2)} kr`
      : `är skyldig ${Math.abs(balance).toFixed(2)} kr`;
    return `<div class="balance-row"><span>${escapeHtml(m)}</span><span class="${cls}">${label}</span></div>`;
  }).join("");
  summaryEl.innerHTML = `
    <div class="balance-row"><b>Totalt utlagt</b><b>${total.toFixed(2)} kr</b></div>
    <div class="balance-row"><span>Del per person</span><span>${share.toFixed(2)} kr</span></div>
    <hr style="border-color: var(--border); margin: 8px 0;">
    ${rows}
  `;
}

document.getElementById("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const desc = document.getElementById("expense-desc").value.trim();
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const payer = document.getElementById("expense-payer").value;
  if (!desc || !payer || isNaN(amount)) return;
  if (!(tripData.members || []).includes(payer)) {
    alert("Den valda personen är inte längre med i resan. Välj en av deltagarna i listan.");
    return;
  }
  const updated = [...(tripData.expenses || []), { id: uid(), desc, amount, payer }];
  await saveField("expenses", updated);
  document.getElementById("expense-desc").value = "";
  document.getElementById("expense-amount").value = "";
});

document.getElementById("expense-list").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-action='del-expense']");
  if (!delBtn) return;
  const updated = (tripData.expenses || []).filter((ex) => ex.id !== delBtn.dataset.id);
  await saveField("expenses", updated);
});
