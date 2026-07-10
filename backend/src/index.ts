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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
