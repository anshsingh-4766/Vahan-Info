document.getElementById('vahanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const vehicleNumber = document.getElementById('vehicleNumber').value;

  const response = await fetch(`/api/vahan?number=${vehicleNumber}`);
  const data = await response.json();

  const resultDiv = document.getElementById('result');
  if (data.error) {
    resultDiv.innerHTML = `<p style="color:red;">${data.error}</p>`;
  } else {
    resultDiv.innerHTML = `
      <div class="result-card">
        <h2>Vehicle Details</h2>
        <p><strong>Owner:</strong> ${data.owner}</p>
        <p><strong>Model:</strong> ${data.model}</p>
        <p><strong>Registration Date:</strong> ${data.registrationDate}</p>
        <p><strong>Fuel Type:</strong> ${data.fuel}</p>
      </div>
    `;
  }
});
