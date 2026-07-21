import { Router } from 'express';
import ledgerRoutes from './ledger.route';
import productRoutes from './product.route';
import salesRoutes from './sales.route';
import quotationRoutes from './quotation.route';
import backupRoutes from './backup.route';
import statisticsRoutes from './statistics.route';
import purchaseRoutes from './purchase.route';
import staffRoutes from './staff.route';

const router = Router();

router.use('/ledgers', ledgerRoutes);
router.use('/products', productRoutes);
router.use('/sales', salesRoutes);
router.use('/quotations', quotationRoutes);
router.use('/backup', backupRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/purchase-bills', purchaseRoutes);
router.use('/staff', staffRoutes);

export default router;
