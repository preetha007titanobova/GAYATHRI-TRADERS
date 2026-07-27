import { Router } from 'express';
import * as backupController from '../controllers/backup.controller';

const router = Router();

router.get('/export', backupController.exportBackup);
router.post('/restore', backupController.restoreBackup);
router.post('/reset', backupController.resetDatabase);

export default router;
