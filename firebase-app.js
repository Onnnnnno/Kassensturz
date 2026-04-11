// ── Timeout Helper ────────────────────────────────────────────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Zeitüberschreitung – Firestore nicht erreichbar. Wurde die Datenbank in Firebase erstellt?')), ms)
    )
  ]);
}

// ── Firebase Init ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyASXGYB1PfzcPALugEbN0zyIrzJfN_ssus",
  authDomain:        "kassensturz-3c8de.firebaseapp.com",
  projectId:         "kassensturz-3c8de",
  storageBucket:     "kassensturz-3c8de.firebasestorage.app",
  messagingSenderId: "704061916371",
  appId:             "1:704061916371:web:0847b6a18fcca81c184026",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── State ─────────────────────────────────────────────────────
let currentUser  = null;
let currentGroup = null;
let groupListener = null;

// ── Auth State ────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    showGruppeLoggedIn();
    await loadUserGroup();
  } else {
    showGruppeLoggedOut();
  }
});

// ── Helpers ───────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function gruppeError(msg) {
  const el = document.getElementById('gruppe-error');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

function gruppeSuccess(msg) {
  const el = document.getElementById('gruppe-success');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ── UI State ──────────────────────────────────────────────────
function showGruppeLoggedOut() {
  document.getElementById('gruppe-auth').hidden    = false;
  document.getElementById('gruppe-main').hidden    = true;
  document.getElementById('gruppe-no-group').hidden = true;
  document.getElementById('gruppe-group').hidden   = true;
}

function showGruppeLoggedIn() {
  document.getElementById('gruppe-auth').hidden    = true;
  document.getElementById('gruppe-main').hidden    = false;
  document.getElementById('gruppe-no-group').hidden = true; // wird von loadUserGroup gesetzt
  document.getElementById('gruppe-group').hidden   = true;
  const emailEl = document.getElementById('gruppe-user-email');
  if (emailEl) emailEl.textContent = currentUser.email;
}

function showNoGroup() {
  document.getElementById('gruppe-no-group').hidden = false;
  document.getElementById('gruppe-group').hidden    = true;
}

function showGroupView() {
  document.getElementById('gruppe-no-group').hidden = true;
  document.getElementById('gruppe-group').hidden    = false;
}

// ── Auth ──────────────────────────────────────────────────────
document.getElementById('gruppe-register-btn').addEventListener('click', async () => {
  const email = document.getElementById('gruppe-email').value.trim();
  const pw    = document.getElementById('gruppe-pw').value;
  if (!email || !pw) return;
  try {
    await auth.createUserWithEmailAndPassword(email, pw);
    gruppeSuccess('Account erstellt!');
  } catch (e) {
    gruppeError(authErrorMsg(e.code));
  }
});

document.getElementById('gruppe-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('gruppe-email').value.trim();
  const pw    = document.getElementById('gruppe-pw').value;
  if (!email || !pw) return;
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) {
    gruppeError(authErrorMsg(e.code));
  }
});

document.getElementById('gruppe-logout-btn').addEventListener('click', () => {
  if (groupListener) { groupListener(); groupListener = null; }
  currentGroup = null;
  auth.signOut();
});

function authErrorMsg(code) {
  const msgs = {
    'auth/email-already-in-use': 'E-Mail wird bereits verwendet.',
    'auth/invalid-email':        'Ungültige E-Mail-Adresse.',
    'auth/weak-password':        'Passwort zu schwach (min. 6 Zeichen).',
    'auth/user-not-found':       'Kein Account mit dieser E-Mail.',
    'auth/wrong-password':       'Falsches Passwort.',
    'auth/invalid-credential':   'E-Mail oder Passwort falsch.',
  };
  return msgs[code] || 'Fehler: ' + code;
}

// ── Load User Group ───────────────────────────────────────────
async function loadUserGroup() {
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const groupId = userDoc.exists ? userDoc.data().groupId : null;

    if (!groupId) {
      showNoGroup();
      return;
    }

    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      await db.collection('users').doc(currentUser.uid).update({ groupId: null });
      showNoGroup();
      return;
    }

    currentGroup = { id: groupId, ...groupDoc.data() };
    renderGroupInfo();
    showGroupView();
    listenGroupExpenses(groupId);
  } catch (e) {
    console.error('Firestore Fehler:', e);
    gruppeError('Datenbankfehler: ' + e.message);
    showNoGroup();
  }
}

// ── Gruppe erstellen ──────────────────────────────────────────
document.getElementById('gruppe-create-btn').addEventListener('click', async () => {
  const name = document.getElementById('gruppe-name-input').value.trim();
  if (!name) { shake(document.getElementById('gruppe-name-input')); return; }

  const btn = document.getElementById('gruppe-create-btn');
  btn.disabled = true;
  btn.textContent = 'Wird erstellt…';

  try {
    const code     = generateCode();
    const groupRef = db.collection('groups').doc();
    const groupData = {
      name,
      inviteCode: code,
      createdBy:  currentUser.uid,
      members:    [{ uid: currentUser.uid, email: currentUser.email }],
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    };

    await withTimeout(groupRef.set(groupData));
    await withTimeout(db.collection('users').doc(currentUser.uid).set({ groupId: groupRef.id }, { merge: true }));

    currentGroup = { id: groupRef.id, ...groupData };
    renderGroupInfo();
    showGroupView();
    listenGroupExpenses(groupRef.id);
    gruppeSuccess('Gruppe erstellt!');
  } catch (e) {
    console.error(e);
    gruppeError('Fehler: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">✓</span> Erstellen';
  }
});

// ── Gruppe beitreten ──────────────────────────────────────────
document.getElementById('gruppe-join-btn').addEventListener('click', async () => {
  const code = document.getElementById('gruppe-code-input').value.trim().toUpperCase();
  if (!code) { shake(document.getElementById('gruppe-code-input')); return; }

  const btn = document.getElementById('gruppe-join-btn');
  btn.disabled = true;
  btn.textContent = 'Suche…';

  try {
    const snap = await withTimeout(db.collection('groups').where('inviteCode', '==', code).limit(1).get());
    if (snap.empty) {
      gruppeError('Ungültiger Code.');
      return;
    }

    const groupDoc  = snap.docs[0];
    const groupId   = groupDoc.id;
    const groupData = groupDoc.data();

    const alreadyMember = groupData.members.some(m => m.uid === currentUser.uid);
    if (!alreadyMember) {
      await groupDoc.ref.update({
        members: firebase.firestore.FieldValue.arrayUnion({
          uid:   currentUser.uid,
          email: currentUser.email,
        }),
      });
    }

    await db.collection('users').doc(currentUser.uid).set({ groupId }, { merge: true });

    currentGroup = { id: groupId, ...groupData };
    renderGroupInfo();
    showGroupView();
    listenGroupExpenses(groupId);
    gruppeSuccess('Gruppe beigetreten!');
  } catch (e) {
    console.error(e);
    gruppeError('Fehler: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">→</span> Beitreten';
  }
});

// ── Gruppe verlassen ──────────────────────────────────────────
document.getElementById('gruppe-leave-btn').addEventListener('click', async () => {
  if (!currentGroup) return;
  if (!confirm('Gruppe wirklich verlassen?')) return;

  await db.collection('groups').doc(currentGroup.id).update({
    members: firebase.firestore.FieldValue.arrayRemove({
      uid:   currentUser.uid,
      email: currentUser.email,
    }),
  });
  await db.collection('users').doc(currentUser.uid).update({ groupId: null });

  if (groupListener) { groupListener(); groupListener = null; }
  currentGroup = null;
  showNoGroup();
});

// ── Gruppe anzeigen ───────────────────────────────────────────
function renderGroupInfo() {
  if (!currentGroup) return;
  document.getElementById('gruppe-title').textContent     = currentGroup.name;
  document.getElementById('gruppe-invite-code').textContent = currentGroup.inviteCode;

  const members = currentGroup.members || [];
  const list = document.getElementById('gruppe-members-list');
  list.innerHTML = members.map(m =>
    `<li class="gruppe-member">${escapeHtml(m.email)}${m.uid === currentGroup.createdBy ? ' <span class="gruppe-owner-badge">Admin</span>' : ''}</li>`
  ).join('');
}

// ── Ausgaben live hören ───────────────────────────────────────
function listenGroupExpenses(groupId) {
  if (groupListener) groupListener();

  groupListener = db.collection('groups').doc(groupId)
    .collection('expenses')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .onSnapshot(snap => {
      const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderGroupExpenses(expenses);
      updateGruppenShare(expenses);
    });
}

// ── Gruppenanteil berechnen & in Übersicht einfließen ─────────
function updateGruppenShare(groupExpenses) {
  const memberCount = (currentGroup && currentGroup.members)
    ? currentGroup.members.length : 1;

  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const todayTotal = groupExpenses
    .filter(e => e.date === today)
    .reduce((s, e) => s + e.amount, 0);

  const monthTotal = groupExpenses
    .filter(e => e.date && e.date.startsWith(thisMonth))
    .reduce((s, e) => s + e.amount, 0);

  window.gruppenShare = {
    todayShare:  todayTotal  / memberCount,
    monthShare:  monthTotal  / memberCount,
    memberCount,
    groupName: currentGroup ? currentGroup.name : '',
  };

  // Übersicht neu rendern falls gerade sichtbar
  if (typeof renderUebersicht === 'function' &&
      !document.getElementById('tab-uebersicht').hidden) {
    renderUebersicht();
  }
}

// ── Ausgabe eintragen ─────────────────────────────────────────
document.getElementById('gruppe-expense-save-btn').addEventListener('click', async () => {
  if (!currentGroup) return;

  const rawAmount = parseFloat(document.getElementById('gruppe-amount').value.replace(',', '.'));
  const desc      = document.getElementById('gruppe-desc').value.trim();
  const cat       = document.getElementById('gruppe-cat').value;

  if (isNaN(rawAmount) || rawAmount <= 0) {
    shake(document.getElementById('gruppe-amount'));
    return;
  }

  await db.collection('groups').doc(currentGroup.id).collection('expenses').add({
    amount:      Math.round(rawAmount * 100) / 100,
    description: desc,
    category:    cat,
    paidByUid:   currentUser.uid,
    paidByEmail: currentUser.email,
    date:        new Date().toISOString().slice(0, 10),
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
  });

  document.getElementById('gruppe-amount').value = '';
  document.getElementById('gruppe-desc').value   = '';

  const btn = document.getElementById('gruppe-expense-save-btn');
  btn.style.background = 'var(--green)';
  setTimeout(() => btn.style.background = '', 700);
});

// ── Ausgaben rendern ──────────────────────────────────────────
function renderGroupExpenses(expenses) {
  const list        = document.getElementById('gruppe-expense-list');
  const emptyEl     = document.getElementById('gruppe-expense-empty');
  const totalEl     = document.getElementById('gruppe-total');
  const memberCount = (currentGroup && currentGroup.members)
    ? currentGroup.members.length : 1;

  list.querySelectorAll('.gruppe-expense-item').forEach(el => el.remove());

  if (expenses.length === 0) {
    emptyEl.hidden = false;
    totalEl.textContent = '0,00 €';
    document.getElementById('gruppe-my-total').textContent    = '0,00 €';
    document.getElementById('gruppe-other-total').textContent = '0,00 €';
    return;
  }
  emptyEl.hidden = true;

  // Gesamtanteil pro Person
  const total      = expenses.reduce((s, e) => s + e.amount, 0);
  const shareTotal = total / memberCount;
  totalEl.textContent = formatEuro(shareTotal) + ' / Person';

  // Mein Anteil = was ich insgesamt zahlen müsste
  const iPaid   = expenses.filter(e => e.paidByUid === currentUser.uid).reduce((s, e) => s + e.amount, 0);
  const myShare = shareTotal; // total / memberCount

  // Saldo: was ich gezahlt habe minus meinen eigenen Anteil
  // positiv → andere schulden mir, negativ → ich schulde noch
  const saldo = iPaid - myShare;

  document.getElementById('gruppe-my-total').textContent = formatEuro(myShare);

  const saldoEl    = document.getElementById('gruppe-other-total');
  const saldoSubEl = document.getElementById('gruppe-saldo-sub');
  saldoEl.textContent = formatEuro(Math.abs(saldo));
  if (saldo > 0.005) {
    saldoEl.style.color   = 'var(--green)';
    saldoSubEl.textContent = 'bekommst du zurück';
  } else if (saldo < -0.005) {
    saldoEl.style.color   = 'var(--danger)';
    saldoSubEl.textContent = 'schuldest du noch';
  } else {
    saldoEl.style.color   = '';
    saldoSubEl.textContent = 'quitt';
  }

  expenses.forEach(exp => {
    const meta        = categoryMeta[exp.category] || categoryMeta.sonstiges;
    const isMe        = exp.paidByUid === currentUser.uid;
    const dateStr     = exp.date ? formatDate(exp.date) : '';
    const share       = exp.amount / memberCount;
    const settledBy   = exp.settledBy || [];
    const iSettled    = settledBy.includes(currentUser.uid);

    // Wer hat noch nicht überwiesen (nur für Zahler sichtbar)
    const members     = (currentGroup && currentGroup.members) || [];
    const notSettled  = members.filter(m => m.uid !== exp.paidByUid && !settledBy.includes(m.uid));
    const allSettled  = notSettled.length === 0 && members.length > 1;

    const li = document.createElement('li');
    li.className = 'gruppe-expense-item' + (allSettled ? ' gruppe-expense-settled' : '');

    let settlementHtml = '';
    if (!isMe) {
      // Nicht-Zahler: Checkbox zum Abhaken
      settlementHtml = `
        <label class="gruppe-settle-label ${iSettled ? 'gruppe-settle-done' : ''}" title="Überweisung getätigt">
          <input type="checkbox" class="gruppe-settle-cb" data-id="${exp.id}" ${iSettled ? 'checked' : ''} />
          <span class="gruppe-settle-box">${iSettled ? '✓' : ''}</span>
        </label>`;
    } else if (members.length > 1) {
      // Zahler: sieht offene Rückzahlungen
      const openCount = notSettled.length;
      settlementHtml = openCount > 0
        ? `<span class="gruppe-open-badge">${openCount} offen</span>`
        : `<span class="gruppe-done-badge">✓ alle</span>`;
    }

    li.innerHTML = `
      <span class="expense-emoji">${meta.emoji}</span>
      <div class="expense-info">
        <div class="expense-desc">${escapeHtml(exp.description || 'Keine Beschreibung')}</div>
        <div class="expense-cat">${isMe ? 'Du hast gezahlt' : escapeHtml(exp.paidByEmail)} · ${dateStr}</div>
        <div class="gruppe-share-row">
          <span class="gruppe-share-amount">Dein Anteil: ${formatEuro(share)}</span>
          <span class="gruppe-full-amount">Gesamt: ${formatEuro(exp.amount)}</span>
        </div>
      </div>
      <div class="gruppe-item-actions">
        ${settlementHtml}
        ${isMe ? `<button class="expense-delete gruppe-del-btn" data-id="${exp.id}">✕</button>` : ''}
      </div>
    `;
    list.appendChild(li);
  });
}

// ── Settlement toggeln ────────────────────────────────────────
document.getElementById('gruppe-expense-list').addEventListener('change', async (e) => {
  const cb = e.target.closest('.gruppe-settle-cb');
  if (!cb || !currentGroup) return;
  const expId = cb.dataset.id;
  const ref   = db.collection('groups').doc(currentGroup.id).collection('expenses').doc(expId);
  if (cb.checked) {
    await ref.update({ settledBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
  } else {
    await ref.update({ settledBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
  }
});

// ── Ausgabe löschen ───────────────────────────────────────────
document.getElementById('gruppe-expense-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.gruppe-del-btn');
  if (!btn || !currentGroup) return;
  await db.collection('groups').doc(currentGroup.id).collection('expenses').doc(btn.dataset.id).delete();
});
