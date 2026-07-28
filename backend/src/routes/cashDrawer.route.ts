import { Router } from 'express';
import {
  saveOpeningCash,
  getTodayOpeningCash,
  getOpeningCashHistory
} from '../controllers/cashDrawer.controller';

const router = Router();

router.post('/opening', saveOpeningCash);
router.get('/opening/today', getTodayOpeningCash);
router.get('/opening/history', getOpeningCashHistory);

export default router;
