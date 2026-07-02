🚗 Vahan Information Portal

A secure vehicle information portal with browser-based login, registration, and saved record management backed by Express and SQLite.

📌 Features

🔐 JWT authentication for login, registration, and session restore

🛡️ Passwords stored with bcrypt hashing

🔎 Save, list, and delete vehicle records per authenticated user

🚦 Helmet, CORS, and rate limiting enabled on the API

📱 Responsive single-page frontend

🛠️ Tech Stack

HTML – Structure of the application

CSS – Styling and layout

JavaScript – Form handling and API integration

Node.js + Express – API server

SQLite + better-sqlite3 – Local persistence

🔧 Environment Variables

Create a `.env` file from `.env.example` and set:

- `PORT`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `DATABASE_FILE`

▶️ Run

```bash
npm install
npm start
```
