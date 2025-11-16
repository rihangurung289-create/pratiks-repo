const jwt = require('jsonwebtoken');
const db = require('../db');
const secret = process.env.JWT_SECRET || 'dev_secret';




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




module.exports = auth;