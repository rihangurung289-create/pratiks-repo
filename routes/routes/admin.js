const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const secret = process.env.JWT_SECRET || 'dev_secret';

// Middleware to check authentication and admin role
function adminAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'missing auth' });
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, secret);
    const user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(data.id);
    if (!user) return res.status(401).json({ error: 'invalid user' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'admin access required' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Get all users (admin only)
router.get('/users', adminAuth, (req, res) => {
  const users = db.prepare('SELECT id,name,email,role,volunteer_radius,hours,supplies,created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// Create admin user
router.post('/create-admin', adminAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    db.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, name, email, passwordHash, 'admin', Date.now());

    res.json({ message: 'Admin user created successfully', userId: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Get statistics
router.get('/stats', adminAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalVolunteers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role="volunteer"').get().count;
  const totalPins = db.prepare('SELECT COUNT(*) as count FROM pins').get().count;
  const needPins = db.prepare('SELECT COUNT(*) as count FROM pins WHERE type="need"').get().count;
  const offerPins = db.prepare('SELECT COUNT(*) as count FROM pins WHERE type="offer"').get().count;
  const verifiedPins = db.prepare('SELECT COUNT(*) as count FROM pins WHERE status="verified"').get().count;

  res.json({
    stats: {
      totalUsers,
      totalVolunteers,
      totalPins,
      needPins,
      offerPins,
      verifiedPins
    }
  });
});

// Update user role
router.patch('/users/:id/role', adminAuth, (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;
  
  if (!['user', 'volunteer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, userId);
  
  res.json({ message: 'User role updated successfully' });
});

// Delete user
router.delete('/users/:id', adminAuth, (req, res) => {
  const userId = req.params.id;
  
  // Don't allow deleting self
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  db.prepare('DELETE FROM pins WHERE created_by=?').run(userId);
  db.prepare('DELETE FROM users WHERE id=?').run(userId);
  
  res.json({ message: 'User deleted successfully' });
});

module.exports = router;