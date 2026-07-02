const express = require('express');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const DATABASE_FILE = process.env.DATABASE_FILE || path.join(__dirname, 'vahan-records.db');

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (!CORS_ORIGIN.length || CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use((req, res, next) => {
  if (req.path && req.path.toLowerCase().includes('.db')) {
    return res.status(404).end();
  }

  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(__dirname));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

const db = new Database(DATABASE_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password TEXT,
    passwordHash TEXT,
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
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_records_userId ON records(userId);
`);

ensureColumn('users', 'passwordHash', 'TEXT');
migrateLegacyPasswords();

function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function migrateLegacyPasswords() {
  const users = db
    .prepare("SELECT id, password, passwordHash FROM users WHERE password IS NOT NULL AND TRIM(password) != '' AND (passwordHash IS NULL OR passwordHash = '')")
    .all();
  const updateUser = db.prepare('UPDATE users SET passwordHash = ?, password = NULL WHERE id = ?');

  for (const user of users) {
    updateUser.run(bcrypt.hashSync(user.password, 12), user.id);
  }
}

function generateId() {
  return crypto.randomUUID();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9]{10,15}$/.test(phone);
}

function isStrongPassword(password) {
  return typeof password === 'string' && password.trim().length >= 8;
}

function isValidVehicleNumber(vehicleNumber) {
  return /^[A-Z0-9\-\s]{2,20}$/.test(vehicleNumber);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function getPublicUser(userId) {
  return db.prepare('SELECT id, name, email, phone, city FROM users WHERE id = ?').get(userId) || null;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
    req.authUser = getPublicUser(payload.sub);

    if (!req.authUser) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function authorizeSelf(req, res, next) {
  if (req.authUser.id !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

function authorizeRecordOwner(req, res, next) {
  const record = db.prepare('SELECT userId FROM records WHERE id = ?').get(req.params.recordId);
  if (!record) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (record.userId !== req.authUser.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.recordOwnerId = record.userId;
  next();
}

app.post('/api/auth/check-user', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);

  if (email) {
    const user = db.prepare('SELECT id, name, email, phone, city FROM users WHERE email = ?').get(email);
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
  const name = normalizeText(req.body.name);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const phone = normalizePhone(req.body.phone);
  const city = normalizeText(req.body.city);

  if (!name || !email || !password || !phone || !city) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR phone = ?').get(email, phone);
  if (existing) {
    return res.status(409).json({ error: 'Email or phone already registered.' });
  }

  const userId = generateId();
  const passwordHash = bcrypt.hashSync(password, 12);

  try {
    db.prepare(
      'INSERT INTO users (id, name, email, password, passwordHash, phone, city, authProvider) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)'
    ).run(userId, name, email, passwordHash, phone, city, 'email');

    const user = { id: userId, name, email, phone, city };
    const token = signToken(user);

    res.json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

function authenticateByIdentifier(identifier, password) {
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);
  const user = db
    .prepare('SELECT id, name, email, phone, city, passwordHash FROM users WHERE email = ? OR phone = ?')
    .get(normalizedEmail, normalizedPhone);

  if (!user || !user.passwordHash) {
    return null;
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
  };
}

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = authenticateByIdentifier(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(user);
  res.json({ success: true, token, user });
});

app.post('/api/auth/login-mobile', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const password = String(req.body.password || '');

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required.' });
  }

  const user = authenticateByIdentifier(phone, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid phone or password.' });
  }

  const token = signToken(user);
  res.json({ success: true, token, user });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.authUser });
});

app.post('/api/records/save', authenticateToken, (req, res) => {
  const rcNumber = normalizeText(req.body.rcNumber);
  const licenseNumber = normalizeText(req.body.licenseNumber);
  const vehicleNumber = normalizeText(req.body.vehicleNumber).toUpperCase();
  const vehicleModel = normalizeText(req.body.vehicleModel);
  const vehicleFuel = normalizeText(req.body.vehicleFuel);
  const vehicleRegistrationDate = normalizeText(req.body.vehicleRegistrationDate);

  if (!rcNumber || !licenseNumber || !vehicleNumber || !vehicleModel || !vehicleFuel || !vehicleRegistrationDate) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!isValidVehicleNumber(vehicleNumber)) {
    return res.status(400).json({ error: 'Enter a valid vehicle number.' });
  }

  const recordId = generateId();
  try {
    db.prepare(
      'INSERT INTO records (id, userId, rcNumber, licenseNumber, vehicleNumber, vehicleModel, vehicleFuel, vehicleRegistrationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(recordId, req.authUser.id, rcNumber, licenseNumber, vehicleNumber, vehicleModel, vehicleFuel, vehicleRegistrationDate);

    res.json({ success: true, recordId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save record.' });
  }
});

app.get('/api/records/me', authenticateToken, (req, res) => {
  const records = db.prepare('SELECT * FROM records WHERE userId = ? ORDER BY createdAt DESC').all(req.authUser.id);
  res.json({ records });
});

app.get('/api/records/:userId', authenticateToken, authorizeSelf, (req, res) => {
  const records = db.prepare('SELECT * FROM records WHERE userId = ? ORDER BY createdAt DESC').all(req.params.userId);
  res.json({ records });
});

app.delete('/api/records/:recordId', authenticateToken, authorizeRecordOwner, (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.recordId);
  res.json({ success: true });
});

app.get('/api/vahan', (req, res) => {
  const vehicleNumber = normalizeText(req.query.number);

  res.json({
    owner: 'Rahul Sharma',
    model: 'Maruti Suzuki Swift',
    registrationDate: '2018-06-12',
    fuel: 'Petrol',
    number: vehicleNumber,
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
