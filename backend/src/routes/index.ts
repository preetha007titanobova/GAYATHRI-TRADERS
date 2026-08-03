import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import ledgerRoutes from './ledger.route';
import productRoutes from './product.route';
import salesRoutes from './sales.route';
import quotationRoutes from './quotation.route';
import backupRoutes from './backup.route';
import statisticsRoutes from './statistics.route';
import purchaseRoutes from './purchase.route';
import staffRoutes from './staff.route';
import shopSalesRoutes from './shopSales.route';
import cashDrawerRoutes from './cashDrawer.route';

const router = Router();

router.get('/rupee-font', (req, res) => {
  try {
    const windowsFontPath = 'C:\\Windows\\Fonts\\arial.ttf';
    if (fs.existsSync(windowsFontPath)) {
      res.setHeader('Content-Type', 'font/ttf');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(windowsFontPath);
    }
  } catch (err) {
    console.error('Error sending font file:', err);
  }
  res.status(404).json({ error: 'Font not found' });
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
router.use('/cash-drawer', cashDrawerRoutes);

export default router;
