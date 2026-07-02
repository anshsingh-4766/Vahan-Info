const sessionStatus = document.getElementById('sessionStatus');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const detailsForm = document.getElementById('detailsForm');
const resultDiv = document.getElementById('result');
const logoutButton = document.getElementById('logoutButton');
const authTabs = Array.from(document.querySelectorAll('[data-auth-tab]'));
const authForms = Array.from(document.querySelectorAll('.auth-form'));

const accountName = document.getElementById('accountName');
const accountEmail = document.getElementById('accountEmail');
const accountPhone = document.getElementById('accountPhone');
const accountCity = document.getElementById('accountCity');
const recordCount = document.getElementById('recordCount');
const dashboardTitle = document.getElementById('dashboardTitle');
const dashboardSubtitle = document.getElementById('dashboardSubtitle');

const totalCountEl = document.getElementById('totalCount');
const todayCountEl = document.getElementById('todayCount');
const typeCountEl = document.getElementById('typeCount');
const accountNameSmall = document.getElementById('accountNameSmall');
const recordCountSmall = document.getElementById('recordCountSmall');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerPhone = document.getElementById('registerPhone');
const registerCity = document.getElementById('registerCity');

const rcNumber = document.getElementById('rcNumber');
const licenseNumber = document.getElementById('licenseNumber');
const vehicleNumberInput = document.getElementById('vehicleNumber');
const vehicleModel = document.getElementById('vehicleModel');
const vehicleFuel = document.getElementById('vehicleFuel');
const vehicleRegistrationDate = document.getElementById('vehicleRegistrationDate');

const toastContainer = document.getElementById('toastContainer');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

const globalSearch = document.getElementById('globalSearch');
const searchButton = document.getElementById('searchButton');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

let currentUser = null;
let currentToken = null;
let currentRecords = [];
let currentPage = 1;
let pageSize = 6;

const SESSION_KEY = 'vahan-session';
const THEME_KEY = 'vahan-theme';

function getStoredSession() {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    return null;
  }
}

function setCurrentSession(session) {
  if (session?.user && session?.token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    currentUser = session.user;
    currentToken = session.token;
  } else {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    currentToken = null;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function showToast(message, type = 'default', ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 20);
  setTimeout(() => el.remove(), ms);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmModal.hidden = false;
    function cleanup(result) {
      confirmModal.hidden = true;
      confirmOk.removeEventListener('click', ok);
      confirmCancel.removeEventListener('click', cancel);
      resolve(result);
    }
    function ok() { cleanup(true) }
    function cancel() { cleanup(false) }
    confirmOk.addEventListener('click', ok);
    confirmCancel.addEventListener('click', cancel);
  });
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  return fetch(url, { ...options, headers });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function setAuthTab(tabName) {
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.authTab === tabName;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  authForms.forEach((form) => {
    form.classList.toggle('auth-form--active', form.id === `${tabName}Form`);
  });
}

function renderEmptyState() {
  resultDiv.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">•</div>
      <h3>No records yet</h3>
      <p>Add your RC, license, and vehicle details to populate this panel.</p>
    </div>
  `;
}

function renderError(message) {
  resultDiv.innerHTML = `<div class="error-card">${escapeHtml(message)}</div>`;
}

async function loadUserRecords(userId) {
  try {
    const response = await apiFetch(`/api/records/${userId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to load records.');
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Failed to load records:', error);
    return [];
  }
}
function renderSkeleton(rows = 4) {
  resultDiv.innerHTML = '<div class="record-list">' + Array.from({ length: rows })
    .map(() => `<div class="record-item" aria-busy="true"><div class="record-item-header"><strong class="skeleton" style="width:120px;height:18px"></strong></div><div class="record-fields">${'<div class="record-field"><div class="skeleton" style="height:14px;width:80%"></div></div>'.repeat(3)}</div></div>`)
    .join('') + '</div>';
}

function renderRecordList(records) {
  currentRecords = records;
  if (!records.length) {
    renderEmptyState();
    return;
  }

  // client-side pagination
  const start = (currentPage - 1) * pageSize;
  const pageRows = records.slice(start, start + pageSize);

  const headers = ['Vehicle No', 'Model', 'Fuel', 'Reg Date', 'Saved', 'Actions'];
  const rowsHtml = pageRows.map(r => `
    <tr>
      <td>${escapeHtml(r.vehicleNumber)}</td>
      <td>${escapeHtml(r.vehicleModel)}</td>
      <td>${escapeHtml(r.vehicleFuel)}</td>
      <td>${escapeHtml(formatDate(r.vehicleRegistrationDate))}</td>
      <td>${escapeHtml(formatDate(r.createdAt))}</td>
      <td class="row-actions">
        <button class="btn ghost btn-edit" data-id="${r.id}">Edit</button>
        <button class="btn danger btn-delete" data-id="${r.id}">Delete</button>
      </td>
    </tr>`).join('');

  resultDiv.innerHTML = `
    <div class="table-wrap">
      <table class="records-table" role="table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  // update pagination UI
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  // attach actions
  resultDiv.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = await showConfirm('Delete this record? This action cannot be undone.');
      if (!ok) return;
      try {
        const resp = await apiFetch(`/api/records/${id}`, { method: 'DELETE' });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || 'Delete failed');
        }
        showToast('Record deleted', 'success');
        await refreshDashboard();
      } catch (err) { showToast(err.message || 'Failed to delete', 'error') }
    });
  });

  resultDiv.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const rec = currentRecords.find(r => r.id === id);
      if (!rec) return;
      // prefill form for edit
      rcNumber.value = rec.rcNumber || '';
      licenseNumber.value = rec.licenseNumber || '';
      vehicleNumberInput.value = rec.vehicleNumber || '';
      vehicleModel.value = rec.vehicleModel || '';
      vehicleFuel.value = rec.vehicleFuel || '';
      vehicleRegistrationDate.value = rec.vehicleRegistrationDate || '';
      // focus save
      window.scrollTo({ top: detailsForm.offsetTop - 80, behavior: 'smooth' });
      detailsForm.dataset.editing = id;
    });
  });
}

async function refreshDashboard() {
  if (!currentUser) {
    dashboard.hidden = true;
    sessionStatus.textContent = 'Guest mode';
    renderEmptyState();
    return;
  }

  dashboard.hidden = false;
  sessionStatus.textContent = `Signed in as ${currentUser.name}`;
  dashboardTitle.textContent = `Welcome, ${currentUser.name}`;
  dashboardSubtitle.textContent = 'Your personal record vault is ready.';
  if (accountName) accountName.textContent = currentUser.name;
  if (accountEmail) accountEmail.textContent = currentUser.email || '-';
  if (accountPhone) accountPhone.textContent = currentUser.phone || '-';
  if (accountCity) accountCity.textContent = currentUser.city || '-';
  if (accountNameSmall) accountNameSmall.textContent = currentUser.name;

  // show skeleton while loading
  renderSkeleton(4);
  const records = await loadUserRecords(currentUser.id);
  if (recordCount) recordCount.textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
  recordCountSmall.textContent = records.length;
  totalCountEl.textContent = records.length;
  todayCountEl.textContent = records.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length;
  typeCountEl.textContent = records.filter(r => r.vehicleType).length;
  renderRecordList(records);
}

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => setAuthTab(tab.dataset.authTab));
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Signing in...';
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  try {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || 'Invalid email or password.', 'error');
      btn.disabled = false; btn.textContent = 'Sign In';
      return;
    }
    const data = await response.json();
    setCurrentSession({ user: data.user, token: data.token });
    loginForm.reset();
    setAuthTab('login');
    await refreshDashboard();
    showToast('Signed in', 'success');
  } catch (error) {
    showToast('Login failed', 'error');
  } finally { btn.disabled = false; btn.textContent = 'Sign In' }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = registerForm.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Creating...';
  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  const phone = registerPhone.value.trim();
  const city = registerCity.value.trim();
  try {
    const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, phone, city }) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || 'Registration failed.', 'error');
      btn.disabled = false; btn.textContent = 'Create Account';
      return;
    }
    const data = await response.json();
    setCurrentSession({ user: data.user, token: data.token });
    registerForm.reset();
    setAuthTab('login');
    await refreshDashboard();
    showToast('Account created', 'success');
  } catch (error) {
    showToast('Registration failed.', 'error');
  } finally { btn.disabled = false; btn.textContent = 'Create Account' }
});

detailsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { showToast('Please log in before saving records.', 'error'); return }
  const btn = detailsForm.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Saving...';
  const rcNum = rcNumber.value.trim();
  const licNum = licenseNumber.value.trim();
  const vehNum = vehicleNumberInput.value.trim().toUpperCase();
  const vehModel = vehicleModel.value.trim();
  const vehFuel = vehicleFuel.value.trim();
  const vehRegDate = vehicleRegistrationDate.value;
  try {
    const response = await apiFetch('/api/records/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rcNumber: rcNum, licenseNumber: licNum, vehicleNumber: vehNum, vehicleModel: vehModel, vehicleFuel: vehFuel, vehicleRegistrationDate: vehRegDate }) });
    if (!response.ok) { const error = await response.json().catch(() => ({})); showToast(error.error || 'Failed to save record.', 'error'); return }
    detailsForm.reset(); detailsForm.dataset.editing = '';
    await refreshDashboard(); showToast('Saved', 'success');
  } catch (error) { showToast(error.message || 'Failed to save record.', 'error') } finally { btn.disabled = false; btn.textContent = 'Save details' }
});

logoutButton.addEventListener('click', () => {
  setCurrentSession(null);
  setAuthTab('login');
  refreshDashboard();
});

// password toggles
document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    target.type = target.type === 'password' ? 'text' : 'password';
    btn.textContent = target.type === 'password' ? '👁️' : '🙈';
  });
});

// theme handling
const themeToggle = document.getElementById('themeToggle');
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem(THEME_KEY, t); themeToggle.textContent = t === 'dark' ? '☀️' : '🌙' }
themeToggle.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
const savedTheme = localStorage.getItem(THEME_KEY) || 'light'; setTheme(savedTheme);

// mobile menu
document.getElementById('mobileMenuToggle').addEventListener('click', () => { document.getElementById('mainNav').classList.toggle('open') });

// pagination
prevPageBtn.addEventListener('click', () => { if (currentPage>1) { currentPage--; renderRecordList(currentRecords) } });
nextPageBtn.addEventListener('click', () => { const totalPages = Math.max(1, Math.ceil((currentRecords.length||0)/pageSize)); if (currentPage<totalPages) { currentPage++; renderRecordList(currentRecords) } });

searchButton.addEventListener('click', async () => {
  const q = (globalSearch.value || '').trim();
  if (!q) { await refreshDashboard(); return }
  // try server-side search where available
  renderSkeleton(3);
  try {
    const resp = await apiFetch(`/api/records/search?number=${encodeURIComponent(q)}&owner=${encodeURIComponent(q)}&model=${encodeURIComponent(q)}`);
    if (!resp.ok) { showToast('Search failed', 'error'); await refreshDashboard(); return }
    const data = await resp.json();
    const rows = (data.data && data.data.rows) ? data.data.rows.map(r => ({ ...r })) : (data.records || []);
    currentPage = 1; currentRecords = rows; renderRecordList(rows); showToast(`${rows.length} results`, 'success');
  } catch (err) { showToast('Search failed', 'error'); await refreshDashboard() }
});

async function restoreSession() {
  const storedSession = getStoredSession();
  if (!storedSession?.token || !storedSession?.user) {
    setCurrentSession(null);
    setAuthTab('login');
    await refreshDashboard();
    return;
  }

  currentToken = storedSession.token;
  currentUser = storedSession.user;

  try {
    const response = await apiFetch('/api/auth/me');
    if (!response.ok) {
      throw new Error('Session expired');
    }

    const data = await response.json();
    setCurrentSession({ user: data.user, token: storedSession.token });
  } catch (error) {
    setCurrentSession(null);
  }

  setAuthTab('login');
  await refreshDashboard();
}

restoreSession();
