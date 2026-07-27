import { Router } from 'express';
import * as statisticsController from '../controllers/statistics.controller';

const router = Router();

router.get('/dashboard', statisticsController.getDashboardStatistics);
router.get('/summary-counts', statisticsController.getSummaryCounts);
router.get('/', statisticsController.getStatistics);

export default router;
