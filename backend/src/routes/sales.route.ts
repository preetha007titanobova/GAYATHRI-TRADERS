import { Router } from 'express';
import * as salesController from '../controllers/sales.controller';

const router = Router();

// Sales Bills
router.get('/next-invoice', salesController.getNextInvoice);
router.post('/', salesController.createSalesBill);
router.put('/:id', salesController.updateSalesBill);
router.delete('/:id', salesController.deleteSalesBill);
router.get('/search', salesController.searchSalesBills);
router.get('/bills/search', salesController.searchSalesBills);
router.get('/bills/:invoiceNo', salesController.getSalesBillByInvoiceNo);

// Sales Orders
router.get('/orders/next-sequence', salesController.getNextSalesOrderSequence);
router.post('/orders', salesController.createSalesOrder);
router.get('/orders/search', salesController.searchSalesOrders);
router.get('/orders/:id', salesController.getSalesOrderDetails);
router.put('/orders/:id', salesController.updateSalesOrder);
router.put('/orders/:id/cancel', salesController.cancelSalesOrder);
router.delete('/orders/:id', salesController.deleteSalesOrder);

// Sales Returns
router.get('/returns/next-sequence', salesController.getNextSalesReturnSequence);
router.post('/returns', salesController.createSalesReturn);
router.get('/returns/search', salesController.searchSalesReturns);
router.get('/returns/:id', salesController.getSalesReturnDetails);
router.put('/returns/:id', salesController.updateSalesReturn);
router.delete('/returns/:id', salesController.deleteSalesReturn);
router.get('/returns/invoice/:invoiceNo', salesController.getReturnsByInvoice);

// Sales Status Report
router.get('/status/report', salesController.getSalesStatusReport);

// Stock Ledger
router.get('/stock-ledger/:productId', salesController.getStockLedger);

export default router;
