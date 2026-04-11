// ── Helpers ───────────────────────────────────────────────────
// Lokales Datum (nicht UTC) — wichtig für deutsche Zeitzone
const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const categoryMeta = {
  essen:      { label: 'Essen & Trinken',  emoji: '🍔' },
  transport:  { label: 'Transport',         emoji: '🚌' },
  einkauf:    { label: 'Einkauf',           emoji: '🛒' },
  freizeit:   { label: 'Freizeit',          emoji: '🎮' },
  gesundheit: { label: 'Gesundheit',        emoji: '💊' },
  sonstiges:  { label: 'Sonstiges',         emoji: '📦' },
};

function formatEuro(amount) {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Storage ───────────────────────────────────────────────────
function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem('expenses_' + todayKey())) || [];
  } catch { return []; }
}

function saveExpenses(list) {
  localStorage.setItem('expenses_' + todayKey(), JSON.stringify(list));
}

// ── State ─────────────────────────────────────────────────────
let expenses = loadExpenses();

// ── DOM Refs ──────────────────────────────────────────────────
const amountInput   = document.getElementById('amount');
const descInput     = document.getElementById('description');
const categoryInput = document.getElementById('category');
const saveBtn       = document.getElementById('save-btn');
const expenseList   = document.getElementById('expense-list');
const emptyState    = document.getElementById('empty-state');
const totalToday    = document.getElementById('total-today');
const currentDate   = document.getElementById('current-date');

// ── Evening Reminder Banner ───────────────────────────────────
function updateBanner() {
  const banner = document.getElementById('reminder-banner');
  const hour   = new Date().getHours();
  const show   = hour >= 20 && expenses.length === 0;
  banner.hidden = !show;
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  renderList();
  updateBanner();

  // Re-check banner every minute (in case app stays open past 20:00)
  setInterval(updateBanner, 60_000);
}

// ── Render ────────────────────────────────────────────────────
function renderList() {
  // Clear existing items (keep empty-state template)
  [...expenseList.querySelectorAll('.expense-item')].forEach(el => el.remove());

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  totalToday.textContent = formatEuro(total);

  if (expenses.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Render newest first
  [...expenses].reverse().forEach((expense, reversedIndex) => {
    const realIndex = expenses.length - 1 - reversedIndex;
    const meta = categoryMeta[expense.category] || categoryMeta.sonstiges;
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <span class="expense-emoji">${meta.emoji}</span>
      <div class="expense-info">
        <div class="expense-desc">${escapeHtml(expense.description || 'Keine Beschreibung')}</div>
        <div class="expense-cat">${meta.label}</div>
      </div>
      <span class="expense-amount">-${formatEuro(expense.amount)}</span>
      <button class="expense-delete" data-index="${realIndex}" aria-label="Löschen">✕</button>
    `;
    expenseList.appendChild(li);
  });
}

// ── Save ──────────────────────────────────────────────────────
function handleSave() {
  const rawAmount = parseFloat(amountInput.value.replace(',', '.'));

  if (isNaN(rawAmount) || rawAmount <= 0) {
    shake(amountInput);
    amountInput.focus();
    return;
  }

  const expense = {
    id:          Date.now(),
    amount:      Math.round(rawAmount * 100) / 100,
    description: descInput.value.trim(),
    category:    categoryInput.value,
  };

  expenses.push(expense);
  saveExpenses(expenses);

  // Reset form
  amountInput.value = '';
  descInput.value   = '';
  categoryInput.value = 'essen';

  // Flash button green
  saveBtn.style.background = 'var(--green)';
  setTimeout(() => saveBtn.style.background = '', 700);

  renderList();
  updateBanner();
  amountInput.focus();
}

// ── Delete ────────────────────────────────────────────────────
expenseList.addEventListener('click', (e) => {
  const btn = e.target.closest('.expense-delete');
  if (!btn) return;
  const index = parseInt(btn.dataset.index, 10);
  expenses.splice(index, 1);
  saveExpenses(expenses);
  renderList();
});

// ── Button & Enter key ────────────────────────────────────────
saveBtn.addEventListener('click', handleSave);

[amountInput, descInput].forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
  });
});

// ── Shake animation for invalid input ────────────────────────
function shake(el) {
  el.style.borderColor = 'var(--danger)';
  el.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-6px)' },
    { transform: 'translateX(6px)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(0)' },
  ], { duration: 300, easing: 'ease-in-out' });
  setTimeout(() => { el.style.borderColor = ''; }, 600);
}

// ── XSS guard ─────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('tab-ausgaben').hidden   = target !== 'ausgaben';
    document.getElementById('tab-abos').hidden       = target !== 'abos';
    document.getElementById('tab-uebersicht').hidden = target !== 'uebersicht';
    document.getElementById('tab-gruppe').hidden     = target !== 'gruppe';
    if (target === 'uebersicht') { renderUebersicht(); renderChart(); }
  });
});

// ── Abo Storage ───────────────────────────────────────────────
const aboMeta = {
  streaming:   { label: 'Streaming',    emoji: '📺' },
  musik:       { label: 'Musik',        emoji: '🎵' },
  sport:       { label: 'Sport',        emoji: '💪' },
  software:    { label: 'Software',     emoji: '💻' },
  versicherung:{ label: 'Versicherung', emoji: '🛡️' },
  sonstiges:   { label: 'Sonstiges',    emoji: '📦' },
};

function loadAbos() {
  try { return JSON.parse(localStorage.getItem('abos')) || []; }
  catch { return []; }
}

function saveAbos(list) {
  localStorage.setItem('abos', JSON.stringify(list));
}

let abos = loadAbos();

// ── Abo Render ────────────────────────────────────────────────
function renderAbos() {
  const list        = document.getElementById('abo-list');
  const emptyEl     = document.getElementById('abo-empty-state');
  const totalEl     = document.getElementById('total-abos');
  const yearlyEl    = document.getElementById('yearly-abos');

  [...list.querySelectorAll('.expense-item')].forEach(el => el.remove());

  // Monatliche Gesamtkosten berechnen
  const monthlyTotal = abos.reduce((sum, a) => {
    return sum + (a.cycle === 'yearly' ? a.amount / 12 : a.amount);
  }, 0);

  totalEl.textContent  = formatEuro(monthlyTotal);
  yearlyEl.textContent = `${formatEuro(monthlyTotal * 12)} pro Jahr`;

  if (abos.length === 0) { emptyEl.style.display = 'flex'; return; }
  emptyEl.style.display = 'none';

  [...abos].reverse().forEach((abo, reversedIndex) => {
    const realIndex = abos.length - 1 - reversedIndex;
    const meta = aboMeta[abo.category] || aboMeta.sonstiges;
    const cycleLabel = abo.cycle === 'yearly' ? 'Jährlich' : 'Monatlich';

    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <span class="expense-emoji">${meta.emoji}</span>
      <div class="expense-info">
        <div class="expense-desc">${escapeHtml(abo.name)}</div>
        <div class="expense-cat">${meta.label}</div>
      </div>
      <span class="abo-badge">${cycleLabel}</span>
      <span class="expense-amount">-${formatEuro(abo.amount)}</span>
      <button class="expense-delete" data-abo-index="${realIndex}" aria-label="Löschen">✕</button>
    `;
    list.appendChild(li);
  });
}

// ── Abo Save ──────────────────────────────────────────────────
document.getElementById('abo-save-btn').addEventListener('click', () => {
  const name      = document.getElementById('abo-name').value.trim();
  const rawAmount = parseFloat(document.getElementById('abo-amount').value.replace(',', '.'));
  const cycle     = document.getElementById('abo-cycle').value;
  const category  = document.getElementById('abo-category').value;

  if (!name) { shake(document.getElementById('abo-name')); return; }
  if (isNaN(rawAmount) || rawAmount <= 0) { shake(document.getElementById('abo-amount')); return; }

  abos.push({ id: Date.now(), name, amount: Math.round(rawAmount * 100) / 100, cycle, category });
  saveAbos(abos);

  document.getElementById('abo-name').value   = '';
  document.getElementById('abo-amount').value = '';

  const btn = document.getElementById('abo-save-btn');
  btn.style.background = 'var(--green)';
  setTimeout(() => btn.style.background = '', 700);

  renderAbos();
});

// ── Abo Delete ────────────────────────────────────────────────
document.getElementById('abo-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-abo-index]');
  if (!btn) return;
  abos.splice(parseInt(btn.dataset.aboIndex, 10), 1);
  saveAbos(abos);
  renderAbos();
});

// ── Budget ────────────────────────────────────────────────────
function loadBudget() {
  return parseFloat(localStorage.getItem('monthly_budget')) || 0;
}

function renderBudget(monthTotal) {
  const budget     = loadBudget();
  const statusEl   = document.getElementById('budget-status');
  const barEl      = document.getElementById('budget-bar');
  const spentEl    = document.getElementById('budget-spent');
  const limitEl    = document.getElementById('budget-limit');
  const remainEl   = document.getElementById('budget-remaining');
  const dailyEl    = document.getElementById('budget-daily');
  const displayEl  = document.getElementById('budget-display');

  spentEl.textContent = formatEuro(monthTotal);

  if (budget <= 0) {
    limitEl.textContent  = '— €';
    barEl.style.width    = '0%';
    barEl.className      = 'budget-bar';
    remainEl.textContent = '';
    statusEl.textContent = 'Kein Budget gesetzt';
    statusEl.className   = 'budget-status not-set';
    dailyEl.hidden       = true;
    displayEl.hidden     = false;
    return;
  }

  const pct  = Math.min((monthTotal / budget) * 100, 100);
  const rest = budget - monthTotal;

  limitEl.textContent = formatEuro(budget);
  barEl.style.width   = pct + '%';

  if (pct >= 100) {
    barEl.className      = 'budget-bar over';
    statusEl.textContent = '⚠️ Budget überschritten!';
    statusEl.className   = 'budget-status over';
    remainEl.textContent = `${formatEuro(Math.abs(rest))} über Budget`;
  } else if (pct >= 80) {
    barEl.className      = 'budget-bar warn';
    statusEl.textContent = `Noch ${formatEuro(rest)} übrig`;
    statusEl.className   = 'budget-status warn';
    remainEl.textContent = `${pct.toFixed(0)}% verbraucht`;
  } else {
    barEl.className      = 'budget-bar';
    statusEl.textContent = `Noch ${formatEuro(rest)} übrig`;
    statusEl.className   = 'budget-status ok';
    remainEl.textContent = `${pct.toFixed(0)}% verbraucht`;
  }

  // Tägliches Budget berechnen
  const now      = new Date();
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate() + 1; // inkl. heute
  if (rest > 0 && daysLeft > 0) {
    const perDay = rest / daysLeft;
    dailyEl.textContent = `${formatEuro(perDay)} pro Tag · noch ${daysLeft} Tag${daysLeft !== 1 ? 'e' : ''}`;
    dailyEl.hidden = false;
  } else {
    dailyEl.hidden = true;
  }

  displayEl.hidden = false;
}

// Budget bearbeiten
document.getElementById('budget-edit-btn').addEventListener('click', () => {
  const formEl    = document.getElementById('budget-form');
  const displayEl = document.getElementById('budget-display');
  const input     = document.getElementById('budget-input');
  const current   = loadBudget();
  if (current > 0) input.value = current;
  formEl.hidden    = false;
  displayEl.hidden = true;
  input.focus();
});

document.getElementById('budget-save-btn').addEventListener('click', () => {
  const raw = parseFloat(document.getElementById('budget-input').value.replace(',', '.'));
  if (isNaN(raw) || raw <= 0) { shake(document.getElementById('budget-input')); return; }
  localStorage.setItem('monthly_budget', raw);
  document.getElementById('budget-form').hidden    = true;
  document.getElementById('budget-input').value    = '';
  renderUebersicht();
});

// ── Übersicht ─────────────────────────────────────────────────

// Alle Tage mit Ausgaben aus localStorage sammeln
function getAllExpenseDays() {
  const days = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('expenses_')) {
      const dateStr = key.replace('expenses_', '');
      try {
        const list = JSON.parse(localStorage.getItem(key)) || [];
        const total = list.reduce((s, e) => s + e.amount, 0);
        days.push({ date: dateStr, expenses: list, total });
      } catch { /* skip */ }
    }
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function monthlyAboTotal() {
  return abos.reduce((sum, a) => sum + (a.cycle === 'yearly' ? a.amount / 12 : a.amount), 0);
}

// Tages-Abo-Anteil = monatliche Kosten / 30
function dailyAboShare() {
  return monthlyAboTotal() / 30;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Übersicht rendern ─────────────────────────────────────────
function renderUebersicht() {
  const aboMonthly  = monthlyAboTotal();
  const aboDaily    = dailyAboShare();
  const todayExp    = expenses.reduce((s, e) => s + e.amount, 0);
  const todayTotal  = todayExp + aboDaily;
  const allDays     = getAllExpenseDays();

  // Monatsausgaben (alle Tage dieses Monats)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = allDays
    .filter(d => d.date.startsWith(thisMonth))
    .reduce((s, d) => s + d.total, 0);
  const monthTotal = monthExpenses + aboMonthly;

  // Karten oben befüllen
  document.getElementById('ueb-total-today').textContent = formatEuro(todayTotal);
  document.getElementById('ueb-split-today').textContent =
    `${formatEuro(todayExp)} Ausgaben + ${formatEuro(aboDaily)} Abos`;

  document.getElementById('ueb-month-total').textContent = formatEuro(monthTotal);
  document.getElementById('ueb-month-sub').textContent   =
    `${formatEuro(monthExpenses)} + ${formatEuro(aboMonthly)} Abos`;

  document.getElementById('ueb-abo-monthly').textContent = formatEuro(aboMonthly);
  document.getElementById('ueb-abo-daily').textContent   = `${formatEuro(aboDaily)} pro Tag`;

  renderBudget(monthTotal);
  renderTagView();
  renderVerlauf(allDays, aboDaily);
}

// ── Tagesansicht ──────────────────────────────────────────────
let currentDayOffset = 0; // 0 = heute, -1 = gestern, ...

function getDateByOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function renderTagView() {
  const dateStr    = getDateByOffset(currentDayOffset);
  const aboDaily   = dailyAboShare();
  const dayList    = JSON.parse(localStorage.getItem('expenses_' + dateStr) || '[]');
  const expTotal   = dayList.reduce((s, e) => s + e.amount, 0);
  const grandTotal = expTotal + aboDaily;

  const label = currentDayOffset === 0 ? 'Heute' :
                currentDayOffset === -1 ? 'Gestern' :
                formatDate(dateStr);
  document.getElementById('day-label').textContent = label;
  document.getElementById('day-next').disabled = currentDayOffset >= 0;

  const list     = document.getElementById('tag-list');
  const emptyEl  = document.getElementById('tag-empty');
  const totalRow = document.getElementById('day-total-row');

  [...list.querySelectorAll('.expense-item')].forEach(el => el.remove());

  if (dayList.length === 0) {
    emptyEl.style.display = 'flex';
    totalRow.hidden = true;
    return;
  }

  emptyEl.style.display = 'none';
  totalRow.hidden = false;

  [...dayList].reverse().forEach(expense => {
    const meta = categoryMeta[expense.category] || categoryMeta.sonstiges;
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <span class="expense-emoji">${meta.emoji}</span>
      <div class="expense-info">
        <div class="expense-desc">${escapeHtml(expense.description || 'Keine Beschreibung')}</div>
        <div class="expense-cat">${meta.label}</div>
      </div>
      <span class="expense-amount">-${formatEuro(expense.amount)}</span>
    `;
    list.appendChild(li);
  });

  // Abo-Anteil als eigene Zeile
  const aboLi = document.createElement('li');
  aboLi.className = 'expense-item';
  aboLi.innerHTML = `
    <span class="expense-emoji">📅</span>
    <div class="expense-info">
      <div class="expense-desc">Abo-Anteil</div>
      <div class="expense-cat">Täglicher Durchschnitt</div>
    </div>
    <span class="expense-amount">-${formatEuro(aboDaily)}</span>
  `;
  list.appendChild(aboLi);

  document.getElementById('day-expenses-sum').textContent = formatEuro(expTotal);
  document.getElementById('day-abo-share').textContent    = formatEuro(aboDaily);
  document.getElementById('day-grand-total').textContent  = formatEuro(grandTotal);
}

document.getElementById('day-prev').addEventListener('click', () => {
  currentDayOffset--;
  renderTagView();
});
document.getElementById('day-next').addEventListener('click', () => {
  if (currentDayOffset < 0) { currentDayOffset++; renderTagView(); }
});

// ── Verlauf ───────────────────────────────────────────────────
function renderVerlauf(allDays, aboDaily) {
  const container = document.getElementById('verlauf-list');
  const emptyEl   = document.getElementById('verlauf-empty');
  [...container.querySelectorAll('.verlauf-row')].forEach(el => el.remove());

  if (allDays.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  let cumulative = 0;
  // Älteste zuerst → Aufbau sichtbar
  allDays.forEach(day => {
    const dayTotal = day.total + aboDaily;
    cumulative += dayTotal;

    const row = document.createElement('div');
    row.className = 'verlauf-row';
    const d = new Date(day.date + 'T00:00:00');
    row.innerHTML = `
      <div class="verlauf-date">
        <div class="verlauf-date-main">${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</div>
        <div class="verlauf-date-sub">${d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
      </div>
      <div class="verlauf-amounts">
        <div class="verlauf-day-cost">-${formatEuro(dayTotal)}</div>
        <div class="verlauf-day-sub">${formatEuro(day.total)} + ${formatEuro(aboDaily)} Abos</div>
      </div>
      <div class="verlauf-cumulative">
        <div class="verlauf-cum-amount">${formatEuro(cumulative)}</div>
        <div class="verlauf-cum-label">kumuliert</div>
      </div>
    `;
    container.appendChild(row);
  });
}

// ── Tortendiagramm ────────────────────────────────────────────
const PIE_COLORS = {
  essen:       '#ff6b6b',
  transport:   '#ffa94d',
  einkauf:     '#ffd43b',
  freizeit:    '#69db7c',
  gesundheit:  '#4dabf7',
  sonstiges:   '#9775fa',
  streaming:   '#f783ac',
  musik:       '#63e6be',
  sport:       '#74c0fc',
  software:    '#a9e34b',
  versicherung:'#ff8787',
  __abos__:    '#ffd43b',
};

let currentChartRange = 'heute';

function getChartData(range) {
  const totals   = {};
  const aboDaily = dailyAboShare();
  const aboMonth = monthlyAboTotal();

  // Hilfsfunktion: Ausgaben einer Tagesliste addieren
  function addExpenses(list) {
    list.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
  }

  // Hilfsfunktion: Abo-Anteil als eigenen Slice hinzufügen
  function addAboSlice(amount) {
    if (amount > 0) totals['__abos__'] = (totals['__abos__'] || 0) + amount;
  }

  if (range === 'heute') {
    addExpenses(expenses);
    addAboSlice(aboDaily);

  } else if (range === 'woche') {
    const allDays = getAllExpenseDays();
    // Letzte 7 Tage
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const day = allDays.find(x => x.date === key);
      if (day) addExpenses(day.expenses);
    }
    addAboSlice(aboDaily * 7);

  } else if (range === 'monat') {
    const thisMonth = todayKey().slice(0, 7);
    getAllExpenseDays()
      .filter(d => d.date.startsWith(thisMonth))
      .forEach(day => addExpenses(day.expenses));
    addAboSlice(aboMonth);

  } else if (range === 'gesamt') {
    getAllExpenseDays().forEach(day => addExpenses(day.expenses));
    // Abos: so viele Monate wie es Daten gibt
    const allDays = getAllExpenseDays();
    if (allDays.length > 0) {
      const firstDate = new Date(allDays[0].date + 'T00:00:00');
      const today     = new Date();
      const months    = Math.max(1,
        (today.getFullYear() - firstDate.getFullYear()) * 12 +
        (today.getMonth() - firstDate.getMonth()) + 1
      );
      addAboSlice(aboMonth * months);
    }
  }

  // __abos__ bekommt einen lesbaren Namen
  const result = Object.entries(totals)
    .map(([cat, amount]) => ({
      cat,
      label: cat === '__abos__' ? '📅 Abos' : null,
      amount,
    }))
    .filter(d => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return result;
}

function drawPie(data) {
  const canvas  = document.getElementById('pie-canvas');
  const ctx     = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 88;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  data.forEach(d => {
    const slice = (d.amount / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[d.cat] || '#9775fa';
    ctx.fill();
    startAngle += slice;
  });

  // Donut-Loch
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, 2 * Math.PI);
  ctx.fillStyle = '#111111';
  ctx.fill();

  // Gesamtbetrag in der Mitte
  ctx.fillStyle = '#e8eaf0';
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatEuro(total), cx, cy);
}

function renderChart() {
  const data    = getChartData(currentChartRange);
  const legend  = document.getElementById('chart-legend');
  const emptyEl = document.getElementById('chart-empty');
  const canvas  = document.getElementById('pie-canvas');
  legend.innerHTML = '';

  if (data.length === 0) {
    canvas.style.opacity = '0.2';
    emptyEl.hidden = false;
    drawPie([]);
    return;
  }

  canvas.style.opacity = '1';
  emptyEl.hidden = true;
  drawPie(data);

  const total = data.reduce((s, d) => s + d.amount, 0);
  const meta  = { ...categoryMeta, ...aboMeta };

  data.forEach(d => {
    const pct   = total > 0 ? (d.amount / total * 100).toFixed(1) : 0;
    const color = d.cat === '__abos__' ? '#ffd43b' : (PIE_COLORS[d.cat] || '#9775fa');
    const label = d.cat === '__abos__'
      ? '📅 Abos'
      : (meta[d.cat]?.emoji || '📦') + ' ' + (meta[d.cat]?.label || d.cat);
    const li = document.createElement('li');
    li.className = 'chart-legend-item';
    li.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <div style="flex:1">
        <div class="legend-info">
          <span class="legend-label">${label}</span>
          <span class="legend-amount">${formatEuro(d.amount)} · ${pct}%</span>
        </div>
        <div class="legend-bar-wrap">
          <div class="legend-bar" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `;
    legend.appendChild(li);
  });
}

// Chart-Buttons
document.querySelectorAll('.chart-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentChartRange = btn.dataset.range;
    renderChart();
  });
});

// ── View Toggle (Tagesansicht / Verlauf) ─────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-tag').hidden     = btn.dataset.view !== 'tag';
    document.getElementById('view-verlauf').hidden = btn.dataset.view !== 'verlauf';
  });
});

// ── Excel Export ──────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  if (typeof XLSX === 'undefined') {
    alert('Export-Library nicht geladen. Bitte Seite neu laden.');
    return;
  }
  const wb = XLSX.utils.book_new();

  // ── Blatt 1: Alle Ausgaben ──
  const allDays = getAllExpenseDays();
  const expRows = [['Datum', 'Beschreibung', 'Kategorie', 'Betrag (€)']];
  allDays.forEach(day => {
    day.expenses.forEach(e => {
      const meta = categoryMeta[e.category] || categoryMeta.sonstiges;
      expRows.push([
        day.date,
        e.description || 'Keine Beschreibung',
        meta.label,
        e.amount,
      ]);
    });
  });
  const wsAusgaben = XLSX.utils.aoa_to_sheet(expRows);
  wsAusgaben['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsAusgaben, 'Ausgaben');

  // ── Blatt 2: Abos ──
  const aboRows = [['Name', 'Kategorie', 'Betrag (€)', 'Zeitraum', 'Monatlich (€)']];
  abos.forEach(a => {
    const meta    = aboMeta[a.category] || aboMeta.sonstiges;
    const monthly = a.cycle === 'yearly' ? (a.amount / 12).toFixed(2) : a.amount;
    aboRows.push([
      a.name,
      meta.label,
      a.amount,
      a.cycle === 'yearly' ? 'Jährlich' : 'Monatlich',
      parseFloat(monthly),
    ]);
  });
  const wsAbos = XLSX.utils.aoa_to_sheet(aboRows);
  wsAbos['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsAbos, 'Abos');

  // ── Blatt 3: Monatszusammenfassung ──
  const months = {};
  allDays.forEach(day => {
    const m = day.date.slice(0, 7);
    months[m] = (months[m] || 0) + day.total;
  });
  const aboMonthly = monthlyAboTotal();
  const sumRows = [['Monat', 'Ausgaben (€)', 'Abos (€)', 'Gesamt (€)']];
  Object.entries(months).sort().forEach(([m, total]) => {
    sumRows.push([m, total, aboMonthly, total + aboMonthly]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(sumRows);
  wsSummary['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Monatsübersicht');

  // Download
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Kassensturz_${date}.xlsx`);
});

// ── Push Notifications ────────────────────────────────────────
let swRegistration = null;

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/service-worker.js');
  } catch (e) { console.warn('SW Registrierung fehlgeschlagen', e); }
}

function scheduleInSW() {
  if (swRegistration?.active) {
    swRegistration.active.postMessage({ type: 'SCHEDULE_REMINDER' });
  } else if (swRegistration) {
    const sw = swRegistration.installing || swRegistration.waiting;
    sw?.addEventListener('statechange', () => {
      if (sw.state === 'activated') {
        sw.postMessage({ type: 'SCHEDULE_REMINDER' });
      }
    });
  }
}

async function initNotifications() {
  await registerSW();
  const permission = Notification.permission;

  // Schon erlaubt → direkt planen, kein Banner
  if (permission === 'granted') {
    scheduleInSW();
    return;
  }

  // Abgelehnt → Banner nicht zeigen
  if (permission === 'denied') return;

  // Noch nicht entschieden → nur zeigen wenn noch nicht gefragt
  if (localStorage.getItem('notif_asked')) return;
  document.getElementById('notif-banner').hidden = false;
}

document.getElementById('notif-yes').addEventListener('click', async () => {
  document.getElementById('notif-banner').hidden = true;
  localStorage.setItem('notif_asked', '1');
  const result = await Notification.requestPermission();
  if (result === 'granted') scheduleInSW();
});

document.getElementById('notif-no').addEventListener('click', () => {
  document.getElementById('notif-banner').hidden = true;
  localStorage.setItem('notif_asked', '1');
});

// ── Start ─────────────────────────────────────────────────────
init();
renderAbos();
initNotifications();
