require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const pinsRoutes = require('./routes/routes/pins');
const adminRoutes = require('./routes/routes/admin');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pins', pinsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log('🚀 Aaphat-Sathi server running on port', port);
  console.log('📍 Map-based Help Platform for Kathmandu Valley');
  console.log('🌐 Health check: http://localhost:' + port + '/api/health');
});