// ── Helpers ───────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10); // "2024-04-03"

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
    document.getElementById('tab-ausgaben').hidden = target !== 'ausgaben';
    document.getElementById('tab-abos').hidden     = target !== 'abos';
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

// ── Start ─────────────────────────────────────────────────────
init();
renderAbos();
