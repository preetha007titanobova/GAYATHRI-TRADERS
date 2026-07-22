const mongoose = require('mongoose');

const ActivationSchema = new mongoose.Schema({
    licenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'License',
        required: true
    },
    machineId: {
        type: String,
        required: true,
        trim: true
    },
    softwareVersion: {
        type: String,
        required: true,
        trim: true
    },
    ipAddress: {
        type: String,
        trim: true
    },
    osDetails: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Deactivated'],
        default: 'Active'
    },
    activatedAt: {
        type: Date,
        default: Date.now
    }
});

// An index to verify if a machine is already bound to a license
ActivationSchema.index({ licenseId: 1, machineId: 1 }, { unique: true });

module.exports = mongoose.model('Activation', ActivationSchema);
