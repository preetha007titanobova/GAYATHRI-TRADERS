const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let privateKey = null;

function loadPrivateKey() {
    if (privateKey) return privateKey;

    const privateKeyPath = path.join(__dirname, '..', 'keys', 'private.key');
    if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`Private signing key not found at ${privateKeyPath}. Run keygen first.`);
    }

    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    return privateKey;
}

/**
 * Digitally signs the license data payload using Ed25519
 * @param {Object} licenseData 
 * @returns {Object} { data: licenseData, signature: hexSignature }
 */
function signLicensePayload(licenseData) {
    const key = loadPrivateKey();
    
    // Canonical serialization of license data
    const serializedPayload = JSON.stringify(licenseData);
    
    // Generate signature using Ed25519 private key
    const signature = crypto.sign(
        null, // Ed25519 does not take a digest algorithm
        Buffer.from(serializedPayload),
        key
    );

    return {
        data: licenseData,
        signature: signature.toString('hex')
    };
}

module.exports = {
    signLicensePayload
};
