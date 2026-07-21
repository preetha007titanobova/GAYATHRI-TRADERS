import { Router } from 'express';
import * as staffController from '../controllers/staff.controller';

const router = Router();

router.get('/next-code', staffController.getNextStaffCode);
router.get('/search', staffController.searchStaff);
router.post('/', staffController.createStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

router.get('/attendance', staffController.getAttendanceByDate);
router.post('/attendance/bulk', staffController.saveBulkAttendance);
router.post('/attendance/biometric-punch', staffController.processBiometricPunch);

export default router;
