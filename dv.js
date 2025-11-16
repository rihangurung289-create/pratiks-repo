// lightweight sqlite wrapper using better-sqlite3
const Database = require('better-sqlite3');
const db = new Database('./data.sqlite');


// create tables if not exist
db.exec(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT,
email TEXT UNIQUE,
password TEXT,
role TEXT DEFAULT 'volunteer',
volunteer_radius INTEGER DEFAULT 3000,
hours INTEGER DEFAULT 0,
supplies INTEGER DEFAULT 0
);


CREATE TABLE IF NOT EXISTS pins (
id TEXT PRIMARY KEY,
type TEXT,
category TEXT,
details TEXT,
lat REAL,
lng REAL,
quantity TEXT,
status TEXT DEFAULT 'unverified',
created_at INTEGER,
created_by TEXT
);
`);


// seed an admin/volunteer
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
try {
const row = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (row.c === 0) {
const pwd = bcrypt.hashSync('password', 8);
db.prepare('INSERT INTO users (id,name,email,password,role,volunteer_radius) VALUES (?,?,?,?,?,?)')
.run(uuidv4(), 'Admin User', 'admin@example.com', pwd, 'admin', 5000);
db.prepare('INSERT INTO users (id,name,email,password,role,volunteer_radius) VALUES (?,?,?,?,?,?)')
.run(uuidv4(), 'Volunteer A', 'vol1@example.com', pwd, 'volunteer', 2000);
}
} catch (e) {
console.error('DB seed error', e);
}


module.exports = db;