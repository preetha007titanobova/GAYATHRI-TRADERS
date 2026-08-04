import { Router } from 'express';
import * as quotationController from '../controllers/quotation.controller';

const router = Router();

router.post('/send-email', quotationController.sendEmail);
router.get('/next-sequence', quotationController.getNextSequence);

router.post('/', quotationController.createQuotation);
router.get('/', quotationController.getQuotations);
router.get('/:id', quotationController.getQuotationById);
router.delete('/:id', quotationController.deleteQuotation);

export default router;
