import { Router } from 'express';
import { createPayment, getPayments, deletePayment } from '../controllers/payment.controller';

const router = Router();

router.post('/', createPayment);
router.get('/', getPayments);
router.delete('/:id', deletePayment);

export default router;
