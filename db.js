const Database = require('better-sqlite3');
const db = new Database('aaphat-sathi.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    volunteer_radius INTEGER DEFAULT 0,
    hours INTEGER DEFAULT 0,
    supplies INTEGER DEFAULT 0,
    center_lat REAL,
    center_lng REAL,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS pins (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT,
    details TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    quantity TEXT,
    status TEXT DEFAULT 'unverified',
    created_at INTEGER,
    created_by TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_pins_type ON pins(type);
  CREATE INDEX IF NOT EXISTS idx_pins_created_at ON pins(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`);

module.exports = db;