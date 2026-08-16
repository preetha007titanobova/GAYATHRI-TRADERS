import { Router } from 'express';
import * as cashDrawerController from '../controllers/cashDrawer.controller';

const router = Router();

router.get('/opening/today', cashDrawerController.getTodayOpeningCash);
router.get('/opening/history', cashDrawerController.getOpeningCashHistory);
router.post('/opening', cashDrawerController.saveOpeningCash);

export default router;
