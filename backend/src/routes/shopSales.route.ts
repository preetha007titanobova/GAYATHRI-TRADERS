import { Router } from 'express';
import * as shopSalesController from '../controllers/shopSales.controller';

const router = Router();

router.get('/next-voucher', shopSalesController.getNextShopSalesVoucher);
router.post('/', shopSalesController.createShopSalesBill);
router.get('/', shopSalesController.searchShopSalesBills);
router.put('/:id', shopSalesController.updateShopSalesBill);
router.delete('/:id', shopSalesController.deleteShopSalesBill);

export default router;
