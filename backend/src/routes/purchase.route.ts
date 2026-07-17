import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller';

const router = Router();

router.get('/next-voucher', purchaseController.getNextPurchaseVoucher);
router.post('/', purchaseController.createPurchaseBill);
router.get('/', purchaseController.searchPurchaseBills);
router.put('/:id', purchaseController.updatePurchaseBill);
router.delete('/:id', purchaseController.deletePurchaseBill);

// Purchase Returns / Debit Notes
router.get('/returns/next-voucher', purchaseController.getNextPurchaseReturnVoucher);
router.post('/returns', purchaseController.createPurchaseReturn);
router.get('/returns', purchaseController.searchPurchaseReturns);
router.put('/returns/:id', purchaseController.updatePurchaseReturn);
router.delete('/returns/:id', purchaseController.deletePurchaseReturn);

export default router;
