const express = require('express');
const router = express.Router();
const auth = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'dev_secret';

// Middleware to check authentication
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'missing auth' });
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, secret);
    const user = db.prepare('SELECT id,name,email,role,volunteer_radius,hours,supplies FROM users WHERE id=?').get(data.id);
    if (!user) return res.status(401).json({ error: 'invalid user' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Create a pin (needs auth)
router.post('/', auth, (req, res) => {
  const { type, category, details, lat, lng, quantity } = req.body;
  if (!type || !lat || !lng) return res.status(400).json({ error: 'missing required fields' });
  
  const id = uuidv4();
  db.prepare('INSERT INTO pins (id,type,category,details,lat,lng,quantity,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, type, category||'', details||'', lat, lng, quantity||'', Date.now(), req.user.id);

  // Simple geo-fencing logic: find volunteers whose radius covers the pin
  const volunteers = db.prepare('SELECT id,name,email,volunteer_radius,center_lat,center_lng FROM users WHERE role="volunteer" AND volunteer_radius > 0').all();
  const alerts = volunteers.filter(volunteer => {
    if (!volunteer.center_lat || !volunteer.center_lng) return false;
    
    const distance = calculateDistance(
      volunteer.center_lat, volunteer.center_lng,
      lat, lng
    );
    
    return distance <= (volunteer.volunteer_radius * 1000); // Convert km to meters
  });

  // In a real app, you'd send notifications here
  // For now, we'll just return the created pin with alert info
  res.json({
    id,
    status: 'created',
    alertsSent: alerts.length
  });
});

// List pins nearby or all
router.get('/', (req, res) => {
  const { lat, lng, radius } = req.query;
  const rows = db.prepare('SELECT * FROM pins ORDER BY created_at DESC LIMIT 500').all();
  
  // If lat/lng provided, filter by radius on server
  if (lat && lng && radius) {
    const filtered = rows.filter(pin => {
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        pin.lat, pin.lng
      );
      return distance <= parseFloat(radius);
    });
    return res.json({ pins: filtered });
  }
  
  res.json({ pins: rows });
});

// Get single pin
router.get('/:id', (req, res) => {
  const pin = db.prepare('SELECT * FROM pins WHERE id=?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  res.json({ pin });
});

// Update volunteer center location
router.post('/volunteer-center', auth, (req, res) => {
  if (req.user.role !== 'volunteer') {
    return res.status(403).json({ error: 'Only volunteers can set center location' });
  }
  
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing coordinates' });
  
  db.prepare('UPDATE users SET center_lat=?, center_lng=? WHERE id=?')
    .run(lat, lng, req.user.id);
  
  res.json({ status: 'center updated' });
});

// Toggle verification (admin only)
router.post('/:id/verify', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  
  const id = req.params.id;
  const pin = db.prepare('SELECT * FROM pins WHERE id=?').get(id);
  if (!pin) return res.status(404).json({ error: 'not found' });
  
  const newStatus = pin.status === 'verified' ? 'unverified' : 'verified';
  db.prepare('UPDATE pins SET status=? WHERE id=?').run(newStatus, id);
  
  res.json({ id, status: newStatus });
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Convert to meters
}

module.exports = router;
// list pins nearby or all
router.get('/', (req, res) => {
const { lat, lng, radius } = req.query;
const rows = db.prepare('SELECT * FROM pins ORDER BY created_at DESC LIMIT 500').all();
// if lat/lng provided, filter by radius on server
if (lat && lng && radius) {
const R = 6371000;
const toRad = d => d*Math.PI/180;
const la = parseFloat(lat), lo = parseFloat(lng), r = parseFloat(radius);
const filtered = rows.filter(p => {
const dLat = toRad(p.lat-la);
const dLon = toRad(p.lng-lo);
const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(la))*Math.cos(toRad(p.lat))*Math.sin(dLon/2)*Math.sin(dLon/2);
const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const d = R*c;
return d <= r;
});
return res.json({ pins: filtered });
}
res.json({ pins: rows });
});


// toggle verification (admin only)
router.post('/:id/verify', auth, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
const id = req.params.id;
const pin = db.prepare('SELECT * FROM pins WHERE id=?').get(id);
if (!pin) return res.status(404).json({ error: 'not found' });
const newStatus = pin.status === 'verified' ? 'unverified' : 'verified';
db.prepare('UPDATE pins SET status=? WHERE id=?').run(newStatus, id);
res.json({ id, status: newStatus });
});


module.exports = router;