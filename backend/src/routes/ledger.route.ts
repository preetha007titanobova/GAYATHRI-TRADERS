import { Router } from 'express';
import * as ledgerController from '../controllers/ledger.controller';

const router = Router();

router.get('/next-code', ledgerController.getNextLedgerCode);
router.get('/search', ledgerController.searchLedgers);
router.post('/', ledgerController.createLedger);
router.get('/:id/statement', ledgerController.getLedgerStatement);
router.put('/:id', ledgerController.updateLedger);
router.delete('/:id', ledgerController.deleteLedger);

export default router;
