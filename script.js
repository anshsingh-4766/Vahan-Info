const form = document.getElementById('vahanForm');
const vehicleNumberInput = document.getElementById('vehicleNumber');
const resultDiv = document.getElementById('result');

function renderEmptyState() {
  resultDiv.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">•</div>
      <h3>Results will appear here</h3>
      <p>Enter a vehicle number above to see a professional details card.</p>
    </div>
  `;
}

function renderLoadingState() {
  resultDiv.innerHTML = `
    <div class="result-card">
      <div class="status-banner"><span class="status-dot"></span>Fetching vehicle information</div>
      <h2>Loading details</h2>
      <p style="color: var(--muted);">Please wait while we prepare the vehicle summary.</p>
    </div>
  `;
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

function renderError(message) {
  resultDiv.innerHTML = `
    <div class="error-card">${message}</div>
  `;
}

function renderVehicleCard(data) {
  resultDiv.innerHTML = `
    <div class="result-card">
      <div class="status-banner"><span class="status-dot"></span>Verified vehicle summary</div>
      <h2>Vehicle Details</h2>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">Registration Number</span>
          <span class="result-value">${data.number || 'N/A'}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Owner</span>
          <span class="result-value">${data.owner || 'N/A'}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Model</span>
          <span class="result-value">${data.model || 'N/A'}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Fuel Type</span>
          <span class="result-value">${data.fuel || 'N/A'}</span>
        </div>
        <div class="result-item" style="grid-column: 1 / -1;">
          <span class="result-label">Registration Date</span>
          <span class="result-value">${formatDate(data.registrationDate)}</span>
        </div>
      </div>
    </div>
  `;
}

renderEmptyState();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const vehicleNumber = vehicleNumberInput.value.trim().toUpperCase();
  if (!vehicleNumber) {
    renderError('Please enter a valid vehicle number.');
    return;
  }

  vehicleNumberInput.value = vehicleNumber;
  renderLoadingState();

  try {
    const response = await fetch(`/api/vahan?number=${encodeURIComponent(vehicleNumber)}`);
    if (!response.ok) {
      throw new Error('Unable to load vehicle information right now.');
    }

    const data = await response.json();
    if (data.error) {
      renderError(data.error);
      return;
    }

    renderVehicleCard(data);
  } catch (error) {
    renderError(error.message || 'Something went wrong while fetching the vehicle details.');
  }
});
