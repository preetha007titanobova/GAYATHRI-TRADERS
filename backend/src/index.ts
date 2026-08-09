import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { setupDatabase } from './config/db';
import apiRouter from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json());

// Mount API routes under /api/v1
app.use('/api/v1', apiRouter);

// Set up collections & indexes
setupDatabase();

import path from 'path';
import fs from 'fs';

// Serve frontend build static files if present
const frontendPaths = [
  path.join(__dirname, '../../frontend/dist'),
  path.join(__dirname, '../frontend'),
  path.join(__dirname, '../../frontend')
];

let frontendDist: string | null = null;
for (const p of frontendPaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    frontendDist = p;
    break;
  }
}

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist!, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
