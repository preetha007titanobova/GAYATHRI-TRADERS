const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
    const keysDir = path.join(__dirname, '..', 'keys');
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
    }

    const privateKeyPath = path.join(keysDir, 'private.key');
    const publicKeyPath = path.join(keysDir, 'public.key');

    console.log('Generating Ed25519 Key Pair...');
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);

    console.log(`Keys generated successfully:`);
    console.log(`Private Key: ${privateKeyPath}`);
    console.log(`Public Key: ${publicKeyPath}`);
}

generateKeyPair();
