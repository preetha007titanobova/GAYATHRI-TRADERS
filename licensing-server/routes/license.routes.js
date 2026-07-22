const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/license.controller');
const { authenticateToken } = require('../controllers/auth.controller');

// --- Client Endpoints (No JWT authentication required) ---
router.post('/activate', licenseController.activateLicense);
router.post('/deactivate', licenseController.deactivateLicense);

// --- Admin Endpoints (JWT authentication required) ---
router.post('/admin/licenses', authenticateToken, licenseController.createLicense);
router.get('/admin/licenses', authenticateToken, licenseController.listLicenses);
router.get('/admin/licenses/:id', authenticateToken, licenseController.getLicenseDetails);
router.post('/admin/licenses/:id/renew', authenticateToken, licenseController.renewLicense);
router.post('/admin/licenses/:id/suspend', authenticateToken, licenseController.suspendLicense);
router.post('/admin/licenses/:id/reset', authenticateToken, licenseController.resetMachine);
router.get('/admin/licenses/:id/download', authenticateToken, licenseController.downloadOfflineLicense);

module.exports = router;
