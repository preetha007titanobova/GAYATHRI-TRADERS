import { Router } from 'express';
import ledgerRoutes from './ledger.route';
import productRoutes from './product.route';
import salesRoutes from './sales.route';
import quotationRoutes from './quotation.route';
import backupRoutes from './backup.route';
import statisticsRoutes from './statistics.route';
import paymentRoutes from './payment.route';

const router = Router();

router.use('/ledgers', ledgerRoutes);
router.use('/products', productRoutes);
router.use('/sales', salesRoutes);
router.use('/quotations', quotationRoutes);
router.use('/backup', backupRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/payments', paymentRoutes);

export default router;
