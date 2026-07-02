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

let currentUser = null;
let currentToken = null;

const SESSION_KEY = 'vahan-session';

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

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  return fetch(url, {
    ...options,
    headers
  });
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

function renderRecordList(records) {
  if (!records.length) {
    renderEmptyState();
    return;
  }

  resultDiv.innerHTML = `
    <div class="record-list">
      ${records
        .map(
          (record, index) => `
            <article class="record-item">
              <div class="record-item-header">
                <strong>${escapeHtml(record.vehicleNumber)}</strong>
                <span>Record ${index + 1}</span>
              </div>
              <div class="record-fields">
                <div class="record-field">
                  <label>RC number</label>
                  <span>${escapeHtml(record.rcNumber)}</span>
                </div>
                <div class="record-field">
                  <label>License number</label>
                  <span>${escapeHtml(record.licenseNumber)}</span>
                </div>
                <div class="record-field">
                  <label>Vehicle model</label>
                  <span>${escapeHtml(record.vehicleModel)}</span>
                </div>
                <div class="record-field">
                  <label>Fuel type</label>
                  <span>${escapeHtml(record.vehicleFuel)}</span>
                </div>
                <div class="record-field">
                  <label>Registration date</label>
                  <span>${escapeHtml(formatDate(record.vehicleRegistrationDate))}</span>
                </div>
                <div class="record-field">
                  <label>Saved on</label>
                  <span>${escapeHtml(formatDate(record.createdAt))}</span>
                </div>
              </div>
              <div class="record-actions">
                <button class="danger-button" type="button" data-remove-record="${record.id}">Remove</button>
              </div>
            </article>
          `
        )
        .join('')}
    </div>
  `;

  resultDiv.querySelectorAll('[data-remove-record]').forEach((button) => {
    button.addEventListener('click', async () => {
      const recordId = button.dataset.removeRecord;
      try {
        const response = await apiFetch(`/api/records/${recordId}`, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to delete record.');
        }

        refreshDashboard();
      } catch (error) {
        renderError(error.message || 'Failed to delete record.');
      }
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
  accountName.textContent = currentUser.name;
  accountEmail.textContent = currentUser.email || '-';
  accountPhone.textContent = currentUser.phone || '-';
  accountCity.textContent = currentUser.city || '-';

  const records = await loadUserRecords(currentUser.id);
  recordCount.textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
  renderRecordList(records);
}

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => setAuthTab(tab.dataset.authTab));
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      renderError(error.error || 'Invalid email or password.');
      return;
    }

    const data = await response.json();
    setCurrentSession({ user: data.user, token: data.token });
    loginForm.reset();
    setAuthTab('login');
    refreshDashboard();
  } catch (error) {
    renderError('Login failed.');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  const phone = registerPhone.value.trim();
  const city = registerCity.value.trim();

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone, city })
    });

    if (!response.ok) {
      const error = await response.json();
      renderError(error.error || 'Registration failed.');
      return;
    }

    const data = await response.json();
    setCurrentSession({ user: data.user, token: data.token });
    registerForm.reset();
    setAuthTab('login');
    refreshDashboard();
  } catch (error) {
    renderError('Registration failed.');
  }
});

detailsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    renderError('Please log in before saving records.');
    return;
  }

  const rcNum = rcNumber.value.trim();
  const licNum = licenseNumber.value.trim();
  const vehNum = vehicleNumberInput.value.trim().toUpperCase();
  const vehModel = vehicleModel.value.trim();
  const vehFuel = vehicleFuel.value.trim();
  const vehRegDate = vehicleRegistrationDate.value;

  try {
    const response = await apiFetch('/api/records/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rcNumber: rcNum,
        licenseNumber: licNum,
        vehicleNumber: vehNum,
        vehicleModel: vehModel,
        vehicleFuel: vehFuel,
        vehicleRegistrationDate: vehRegDate
      })
    });

    if (!response.ok) {
      const error = await response.json();
      renderError(error.error || 'Failed to save record.');
      return;
    }

    detailsForm.reset();
    refreshDashboard();
  } catch (error) {
    renderError(error.message || 'Failed to save record.');
  }
});

logoutButton.addEventListener('click', () => {
  setCurrentSession(null);
  setAuthTab('login');
  refreshDashboard();
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
