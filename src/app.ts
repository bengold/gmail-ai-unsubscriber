// Load environment variables first
import './config/env';

import express from 'express';
import path from 'path';
import { emailRoutes } from './routes/emailRoutes';
import { authRoutes } from './routes/authRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/emails', emailRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Gmail AI Unsubscriber is ready!`);
});

export default app;