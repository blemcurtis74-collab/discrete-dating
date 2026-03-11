require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./backend/config/db');

const authRoutes = require('./backend/routes/authRoutes');
const matchRoutes = require('./backend/routes/matchRoutes');
const messageRoutes = require('./backend/routes/messageRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('Failed to connect to DB:', err);
      process.exit(1);
    });
}

module.exports = app;
