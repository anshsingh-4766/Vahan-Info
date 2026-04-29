const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const db = new Database('vahan-records.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password TEXT,
    city TEXT,
    authProvider TEXT DEFAULT 'email',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    rcNumber TEXT NOT NULL,
    licenseNumber TEXT NOT NULL,
    vehicleNumber TEXT NOT NULL,
    vehicleModel TEXT NOT NULL,
    vehicleFuel TEXT NOT NULL,
    vehicleRegistrationDate TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_records_userId ON records(userId);
`);

function generateId() {
  return crypto.randomUUID();
}

app.post('/api/auth/check-user', (req, res) => {
  const { email, phone } = req.body;

  if (email) {
    const user = db.prepare('SELECT id, name, email, phone, city FROM users WHERE email = ?').get(email.toLowerCase());
    if (user) {
      return res.json({ exists: true, user });
    }
  }

  if (phone) {
    const user = db.prepare('SELECT id, name, email, phone, city FROM users WHERE phone = ?').get(phone);
    if (user) {
      return res.json({ exists: true, user });
    }
  }

  res.json({ exists: false });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, city } = req.body;

  if (!name || !email || !password || !phone || !city) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR phone = ?')
    .get(normalizedEmail, phone);

  if (existing) {
    return res.status(409).json({ error: 'Email or phone already registered.' });
  }

  const userId = generateId();
  try {
    db.prepare(
      'INSERT INTO users (id, name, email, password, phone, city, authProvider) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, name, normalizedEmail, password, phone, city, 'email');

    res.json({ success: true, userId, user: { id: userId, name, email: normalizedEmail, phone, city } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db
    .prepare('SELECT id, name, email, phone, city FROM users WHERE email = ? AND password = ?')
    .get(email.toLowerCase(), password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({ success: true, user });
});

app.post('/api/auth/login-mobile', (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required.' });
  }

  const user = db
    .prepare('SELECT id, name, email, phone, city FROM users WHERE phone = ? AND password = ?')
    .get(phone, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid phone or password.' });
  }

  res.json({ success: true, user });
});

app.post('/api/records/save', (req, res) => {
  const { userId, rcNumber, licenseNumber, vehicleNumber, vehicleModel, vehicleFuel, vehicleRegistrationDate } = req.body;

  if (!userId || !rcNumber || !licenseNumber || !vehicleNumber || !vehicleModel || !vehicleFuel || !vehicleRegistrationDate) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const recordId = generateId();
  try {
    db.prepare(
      'INSERT INTO records (id, userId, rcNumber, licenseNumber, vehicleNumber, vehicleModel, vehicleFuel, vehicleRegistrationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(recordId, userId, rcNumber, licenseNumber, vehicleNumber.toUpperCase(), vehicleModel, vehicleFuel, vehicleRegistrationDate);

    res.json({ success: true, recordId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save record.' });
  }
});

app.get('/api/records/:userId', (req, res) => {
  const { userId } = req.params;

  const records = db.prepare('SELECT * FROM records WHERE userId = ? ORDER BY createdAt DESC').all(userId);
  res.json({ records });
});

app.delete('/api/records/:recordId', (req, res) => {
  const { recordId } = req.params;

  db.prepare('DELETE FROM records WHERE id = ?').run(recordId);
  res.json({ success: true });
});

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
