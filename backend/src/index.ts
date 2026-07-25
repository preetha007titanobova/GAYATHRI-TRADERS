import './polyfill';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
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

// Serve frontend static assets from the compiled production build
const distPath = process.env.FRONTEND_DIST_PATH || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distPath));

// For all non-API paths, return the index.html template (enables React Router paths like /activation)
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Set up collections & indexes
setupDatabase();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
