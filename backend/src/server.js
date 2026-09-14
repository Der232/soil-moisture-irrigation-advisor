const express = require('express');
const cors = require('cors');
require('dotenv').config();

const zoneRoutes = require('./routes/zoneRoutes');
const readingRoutes = require('./routes/readingRoutes');
const irrigationRoutes = require('./routes/irrigationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/zones', zoneRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/irrigation-events', irrigationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const db = require('./config/db');
  db.query('SELECT 1').then(() => {
    console.log('Database connected successfully.');
  }).catch((err) => {
    console.error('Database connection failed:', err.message);
    console.error('Check your .env file — make sure DB_PASSWORD is set to your MySQL root password.');
    console.error('The server will run but all database operations will return errors until this is fixed.');
  });
});
