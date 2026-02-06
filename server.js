const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));

// Mock API route
app.get('/api/vahan', (req, res) => {
  const vehicleNumber = req.query.number;

  // Fake data for demo
  const mockData = {
    owner: "Rahul Sharma",
    model: "Maruti Suzuki Swift",
    registrationDate: "2018-06-12",
    fuel: "Petrol",
    number: vehicleNumber
  };

  res.json(mockData);
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
