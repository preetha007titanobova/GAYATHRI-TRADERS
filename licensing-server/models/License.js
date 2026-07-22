const mongoose = require('mongoose');

const LicenseSchema = new mongoose.Schema({
    licenseKey: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    planType: {
        type: String,
        enum: ['Lifetime', 'Annual', '3-Month', 'Monthly', 'Trial'],
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Suspended', 'Expired'],
        default: 'Active'
    },
    features: {
        billing: { type: Boolean, default: true },
        inventory: { type: Boolean, default: true },
        barcode_printing: { type: Boolean, default: false },
        thermal_printing: { type: Boolean, default: true },
        whatsapp_invoice: { type: Boolean, default: false },
        daily_sales_report: { type: Boolean, default: true },
        gst_reports: { type: Boolean, default: false },
        multiple_users: { type: Boolean, default: false },
        cloud_backup: { type: Boolean, default: false }
    },
    maxActivations: {
        type: Number,
        default: 1
    },
    expiresAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('License', LicenseSchema);
