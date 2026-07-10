import { Router } from 'express';
import * as quotationController from '../controllers/quotation.controller';

const router = Router();

router.post('/send-email', quotationController.sendEmail);
router.get('/next-sequence', quotationController.getNextSequence);

export default router;
