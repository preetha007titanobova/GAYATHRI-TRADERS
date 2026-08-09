import { Router } from 'express';
import ledgerRoutes from './ledger.route';
import productRoutes from './product.route';
import salesRoutes from './sales.route';
import quotationRoutes from './quotation.route';
import backupRoutes from './backup.route';
import statisticsRoutes from './statistics.route';
import purchaseRoutes from './purchase.route';
import staffRoutes from './staff.route';
import shopSalesRoutes from './shopSales.route';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/ledgers', ledgerRoutes);
router.use('/products', productRoutes);
router.use('/sales', salesRoutes);
router.use('/quotations', quotationRoutes);
router.use('/backup', backupRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/purchase-bills', purchaseRoutes);
router.use('/staff', staffRoutes);
router.use('/shop-sales-bills', shopSalesRoutes);

export default router;
