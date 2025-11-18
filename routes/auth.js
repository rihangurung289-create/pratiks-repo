const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const router = express.Router();
const secret = process.env.JWT_SECRET || 'dev_secret';

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, volunteer_radius } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    db.prepare('INSERT INTO users (id, name, email, password_hash, role, volunteer_radius, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, email, passwordHash, role || 'user', volunteer_radius || 0, Date.now());

    const token = jwt.sign({ id }, secret, { expiresIn: '7d' });
    res.json({ token, user: { id, name, email, role: role || 'user' } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        volunteer_radius: user.volunteer_radius,
        hours: user.hours,
        supplies: user.supplies
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', (req, res) => {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Missing auth' });
  
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, secret);
    const user = db.prepare('SELECT id,name,email,role,volunteer_radius,hours,supplies,center_lat,center_lng FROM users WHERE id=?').get(data.id);
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    res.json({ user });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
module.exports = auth;