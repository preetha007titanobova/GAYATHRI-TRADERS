import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { setupDatabase } from './config/db';
import apiRouter from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount API routes under /api/v1
app.use('/api/v1', apiRouter);

// Serve frontend static files from frontend/dist
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Frontend static files not found. Expected index.html at: ${indexPath}`);
  }
});

// Set up collections & indexes
setupDatabase();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
