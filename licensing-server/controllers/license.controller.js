const License = require('../models/License');
const Customer = require('../models/Customer');
const Activation = require('../models/Activation');
const { signLicensePayload } = require('../services/crypto.service');
const crypto = require('crypto');

// Generate a unique license key format: INK-XXXX-XXXX-XXXX-XXXX
function generateLicenseKey(tier) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randSegment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `INK-${tier.substring(0, 3).toUpperCase()}-${randSegment()}-${randSegment()}-${randSegment()}`;
}

// 1. Online Activation (Client Endpoint)
async function activateLicense(req, res) {
    try {
        const { licenseKey, machineId, shopName, softwareVersion, osDetails } = req.body;

        if (!licenseKey || !machineId) {
            return res.status(400).json({ success: false, message: 'License key and Machine ID are required.' });
        }

        // Find license
        const license = await License.findOne({ licenseKey }).populate('customerId');
        if (!license) {
            return res.status(404).json({ success: false, message: 'License key not found.' });
        }

        // Verify status
        if (license.status === 'Suspended') {
            return res.status(403).json({ success: false, message: 'This license has been suspended.' });
        }

        // Verify expiration
        const now = new Date();
        if (license.expiresAt && license.expiresAt < now) {
            license.status = 'Expired';
            await license.save();
            return res.status(403).json({ success: false, message: 'This license has expired.' });
        }

        // Check activations
        let activations = await Activation.find({ licenseId: license._id, status: 'Active' });
        let currentActivation = activations.find(act => act.machineId === machineId);

        if (!currentActivation) {
            // Check if limit reached
            if (activations.length >= license.maxActivations) {
                return res.status(403).json({
                    success: false,
                    errorCode: 'ACTIVATION_LIMIT_EXCEEDED',
                    message: `Activation limit exceeded. Max allowed: ${license.maxActivations} PC(s). Please request a machine reset.`
                });
            }

            // Register new activation
            currentActivation = new Activation({
                licenseId: license._id,
                machineId,
                softwareVersion: softwareVersion || '1.0.0',
                ipAddress: req.ip || req.headers['x-forwarded-for'],
                osDetails: osDetails || 'Windows OS',
                status: 'Active'
            });
            await currentActivation.save();
        }

        // Prepare license payload structure
        const licensePayload = {
            licenseKey: license.licenseKey,
            shopName: license.customerId.shopName,
            ownerMobile: license.customerId.mobileNo,
            machineId: machineId,
            planType: license.planType,
            issuedAt: new Date().toISOString(),
            expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
            features: license.features
        };

        // Cryptographically sign the payload
        const signedLicense = signLicensePayload(licensePayload);

        res.json({
            success: true,
            message: 'Activation successful.',
            licenseFile: signedLicense
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 2. Local Deactivation (Client Endpoint)
async function deactivateLicense(req, res) {
    try {
        const { licenseKey, machineId } = req.body;
        if (!licenseKey || !machineId) {
            return res.status(400).json({ success: false, message: 'License key and Machine ID are required.' });
        }

        const license = await License.findOne({ licenseKey });
        if (!license) {
            return res.status(404).json({ success: false, message: 'License not found.' });
        }

        const result = await Activation.findOneAndUpdate(
            { licenseId: license._id, machineId, status: 'Active' },
            { status: 'Deactivated' }
        );

        if (!result) {
            return res.status(404).json({ success: false, message: 'Active machine association not found.' });
        }

        res.json({ success: true, message: 'Device deactivated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 3. Create License (Admin Route)
async function createLicense(req, res) {
    try {
        const { shopName, contactName, mobileNo, email, gstNo, address, planType, features, maxActivations, expiresAt } = req.body;

        if (!shopName || !contactName || !mobileNo || !planType) {
            return res.status(400).json({ success: false, message: 'Shop name, contact details, mobile, and plan type are required.' });
        }

        // 1. Find or create customer
        let customer = await Customer.findOne({ mobileNo });
        if (!customer) {
            customer = new Customer({ shopName, contactName, mobileNo, email, gstNo, address });
            await customer.save();
        }

        // 2. Determine expiration date
        let calculatedExpiry = expiresAt ? new Date(expiresAt) : null;
        if (!calculatedExpiry && planType !== 'Lifetime') {
            const now = new Date();
            if (planType === 'Monthly') calculatedExpiry = new Date(now.setMonth(now.getMonth() + 1));
            else if (planType === '3-Month') calculatedExpiry = new Date(now.setMonth(now.getMonth() + 3));
            else if (planType === 'Annual') calculatedExpiry = new Date(now.setFullYear(now.getFullYear() + 1));
            else if (planType === 'Trial') calculatedExpiry = new Date(now.setDate(now.getDate() + 7));
        }

        // 3. Create license record
        const licenseKey = generateLicenseKey(planType);
        const license = new License({
            licenseKey,
            customerId: customer._id,
            planType,
            features: features || {
                billing: true,
                inventory: true,
                barcode_printing: false,
                thermal_printing: true,
                whatsapp_invoice: false,
                daily_sales_report: true,
                gst_reports: false,
                multiple_users: false,
                cloud_backup: false
            },
            maxActivations: maxActivations || 1,
            expiresAt: calculatedExpiry
        });

        await license.save();

        res.status(201).json({
            success: true,
            message: 'License generated successfully.',
            license
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 4. List / Search Licenses (Admin Route)
async function listLicenses(req, res) {
    try {
        const { search, status, plan } = req.query;
        let query = {};

        // Filters
        if (status) query.status = status;
        if (plan) query.planType = plan;

        let licenses = await License.find(query).populate('customerId');

        // Manual search filter on populated fields
        if (search) {
            const searchLower = search.toLowerCase();
            licenses = licenses.filter(lic => {
                const shopMatches = lic.customerId && lic.customerId.shopName.toLowerCase().includes(searchLower);
                const mobileMatches = lic.customerId && lic.customerId.mobileNo.includes(searchLower);
                const keyMatches = lic.licenseKey.toLowerCase().includes(searchLower);
                return shopMatches || mobileMatches || keyMatches;
            });
        }

        res.json({ success: true, licenses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 5. License Details & Activation Logs (Admin Route)
async function getLicenseDetails(req, res) {
    try {
        const { id } = req.params;
        const license = await License.findById(id).populate('customerId');
        if (!license) {
            return res.status(404).json({ success: false, message: 'License not found.' });
        }

        const activations = await Activation.find({ licenseId: license._id });

        res.json({
            success: true,
            license,
            activations
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 6. Renew / Extend License (Admin Route)
async function renewLicense(req, res) {
    try {
        const { id } = req.params;
        const { planType, monthsToAdd, expiresAt } = req.body;

        const license = await License.findById(id);
        if (!license) {
            return res.status(404).json({ success: false, message: 'License not found.' });
        }

        if (expiresAt) {
            license.expiresAt = new Date(expiresAt);
        } else {
            const baseDate = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt : new Date();
            const months = monthsToAdd ? parseInt(monthsToAdd) : (planType === 'Annual' ? 12 : (planType === '3-Month' ? 3 : 1));
            baseDate.setMonth(baseDate.getMonth() + months);
            license.expiresAt = baseDate;
        }

        license.status = 'Active';
        if (planType) license.planType = planType;
        
        await license.save();
        res.json({ success: true, message: 'License renewed successfully.', license });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 7. Suspend / Activate Toggle (Admin Route)
async function suspendLicense(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Active' or 'Suspended'

        if (!['Active', 'Suspended'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be Active or Suspended.' });
        }

        const license = await License.findByIdAndUpdate(id, { status }, { new: true });
        if (!license) return res.status(404).json({ success: false, message: 'License not found.' });

        res.json({ success: true, message: `License status changed to ${status}.`, license });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 8. Reset Machine Activations (Admin Route)
async function resetMachine(req, res) {
    try {
        const { id } = req.params; // License ID

        const license = await License.findById(id);
        if (!license) {
            return res.status(404).json({ success: false, message: 'License not found.' });
        }

        // Deactivate all activations
        await Activation.updateMany({ licenseId: license._id }, { status: 'Deactivated' });

        res.json({
            success: true,
            message: 'All associated machine profiles have been uncoupled/reset.'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// 9. Manual Offline Issue / Download Signed License file (Admin Route)
async function downloadOfflineLicense(req, res) {
    try {
        const { id } = req.params;
        const { machineId } = req.query;

        if (!machineId) {
            return res.status(400).json({ success: false, message: 'Machine ID query parameter is required.' });
        }

        const license = await License.findById(id).populate('customerId');
        if (!license) return res.status(404).json({ success: false, message: 'License not found.' });

        // Build Payload
        const licensePayload = {
            licenseKey: license.licenseKey,
            shopName: license.customerId.shopName,
            ownerMobile: license.customerId.mobileNo,
            machineId: machineId.toUpperCase(),
            planType: license.planType,
            issuedAt: new Date().toISOString(),
            expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
            features: license.features
        };

        const signedLicense = signLicensePayload(licensePayload);

        res.json({
            success: true,
            licenseFile: signedLicense
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    activateLicense,
    deactivateLicense,
    createLicense,
    listLicenses,
    getLicenseDetails,
    renewLicense,
    suspendLicense,
    resetMachine,
    downloadOfflineLicense
};
