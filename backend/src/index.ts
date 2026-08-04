import './polyfill';
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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json());

// Mount API routes under /api/v1
app.use('/api/v1', apiRouter);

// Serve frontend static assets from the compiled production build
const possibleDistPaths = [
  process.env.FRONTEND_DIST_PATH,
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(__dirname, '..', '..', 'frontend', 'dist'),
  path.join(__dirname, 'frontend', 'dist'),
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), 'resources', 'app', 'frontend', 'dist'),
  path.join(process.cwd(), 'resources', 'frontend', 'dist')
].filter((p): p is string => !!p && fs.existsSync(p));

const distPath = possibleDistPaths[0] || path.join(__dirname, '..', 'frontend', 'dist');
console.log('Serving frontend dist from:', distPath);

app.use(express.static(distPath));

// For all non-API paths, return the index.html template (enables React Router paths like /activation)
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Frontend static files not found. Expected index.html at: ' + indexPath);
});

// Set up collections & indexes
setupDatabase();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
