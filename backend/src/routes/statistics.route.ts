import { Router } from 'express';
import * as statisticsController from '../controllers/statistics.controller';

const router = Router();

router.get('/', statisticsController.getStatistics);

export default router;
