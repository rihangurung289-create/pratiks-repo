const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');


// create a pin (needs auth)
router.post('/', auth, (req, res) => {
const { type, category, details, lat, lng, quantity } = req.body;
if (!type || !lat || !lng) return res.status(400).json({ error: 'missing' });
const id = uuidv4();
db.prepare('INSERT INTO pins (id,type,category,details,lat,lng,quantity,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)')
.run(id, type, category||'', details||'', lat, lng, quantity||'', Date.now(), req.user.id);


// simple notify logic: find volunteers whose radius covers the pin
const vols = db.prepare('SELECT id,name,email,volunteer_radius FROM users WHERE role="volunteer"').all();
const toAlert = vols.filter(v => {
const R = 6371000; // meters
function toRad(d){return d*Math.PI/180}
// For simplicity, assume volunteer's location is unknown; in a full app, volunteers would set a center. We'll skip distance calc here.
return false; // placeholder — in this MVP we will rely on client-side geo-fence matching
});


res.json({ id, status: 'created' });
});


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