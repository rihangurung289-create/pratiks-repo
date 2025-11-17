require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const pinsRoutes = require('./routes/pins');
const db = require('./db');


const app = express();
app.use(cors());
app.use(bodyParser.json());


app.use('/api/auth', authRoutes);
app.use('/api/pins', pinsRoutes);


app.get('/api/health', (req, res) => res.json({ ok: true }));


const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Server running on', port));