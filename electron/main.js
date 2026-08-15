const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let mongodProcess;
let backendProcess;

const LICENSE_PATH = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'BillingSoftware', 'license.lic');
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGm7aeYXKDQtKBnuOGKHq+pz6uDP5L6mvfz9Dv0sgKu8=
-----END PUBLIC KEY-----`;

// Stable Machine ID generation (Section 3 of Blueprint)
function getHardwareId() {
    try {
        const { execSync } = require('child_process');
        const motherboard = execSync('wmic baseboard get serialnumber').toString().split('\n')[1].trim();
        const cpu = execSync('wmic cpu get processorid').toString().split('\n')[1].trim();
        const baseString = `${motherboard}|${cpu}`;
        return crypto.createHash('sha256').update(baseString).digest('hex').toUpperCase();
    } catch {
        return 'FALLBACK-DEVICE-ID-9821-INK';
    }
}

// 1. Offline License Guard
function verifyLicenseOffline() {
    try {
        if (!fs.existsSync(LICENSE_PATH)) {
            return { valid: false, reason: 'MISSING' };
        }
        const raw = fs.readFileSync(LICENSE_PATH, 'utf8');
        const { data, signature } = JSON.parse(raw);

        // Verify cryptographic signature
        const isSigValid = crypto.verify(
            null,
            Buffer.from(JSON.stringify(data)),
            PUBLIC_KEY_PEM,
            Buffer.from(signature, 'hex')
        );

        if (!isSigValid) return { valid: false, reason: 'TAMPERED' };

        // Verify machine ID
        const activeMachineId = getHardwareId();
        if (data.machineId !== activeMachineId) return { valid: false, reason: 'INVALID_MACHINE' };

        // Verify expiry
        if (data.expiresAt && Date.now() > new Date(data.expiresAt).getTime()) {
            return { valid: false, reason: 'EXPIRED', data };
        }

        return { valid: true, data };
    } catch (err) {
        return { valid: false, reason: 'ERROR', message: err.message };
    }
}

// 2. Spawn Local Portable MongoDB (mongod.exe)
function startLocalMongo() {
    const mongoDataDir = path.join(app.getPath('userData'), 'gayathri_mongodb_data');
    if (!fs.existsSync(mongoDataDir)) {
        fs.mkdirSync(mongoDataDir, { recursive: true });
    }

    const mongodPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'bin', 'mongod.exe')
        : path.join(__dirname, 'bin', 'mongod.exe');

    if (!fs.existsSync(mongodPath)) {
        console.warn(`Local portable mongod.exe not found at ${mongodPath}. Ensure binary is packaged.`);
        return;
    }

    console.log(`Starting local database engine from ${mongodPath}...`);
    mongodProcess = spawn(mongodPath, [
        '--dbpath', mongoDataDir,
        '--port', '27017',
        '--bind_ip', '127.0.0.1'
    ]);

    mongodProcess.stderr.on('data', (data) => console.error('Local Database Error:', data.toString()));
}

// 3. Spawn Local Express Backend
function startLocalBackend() {
    console.log('Spawning billing logic server...');
    const localDbUrl = 'mongodb://127.0.0.1:27017/GAYATHRI_ERP_DB';
    const backendDir = path.join(__dirname, '..', 'backend');

    if (app.isPackaged) {
        const prodBackendPath = path.join(process.resourcesPath, 'backend', 'dist', 'src', 'index.js');
        const frontendDistPath = path.join(process.resourcesPath, 'frontend', 'dist');
        const backendCwd = path.join(process.resourcesPath, 'backend');

        console.log(`Launching packaged backend script from: ${prodBackendPath}`);
        if (!fs.existsSync(prodBackendPath)) {
            console.error(`Packaged backend entry file missing at: ${prodBackendPath}`);
            return;
        }

        backendProcess = fork(prodBackendPath, [], {
            cwd: backendCwd,
            env: { 
                ...process.env, 
                ELECTRON_RUN_AS_NODE: '1', 
                PORT: 5050, 
                DATABASE_URL: localDbUrl, 
                NODE_ENV: 'production',
                FRONTEND_DIST_PATH: frontendDistPath
            }
        });
        if (backendProcess.stdout) {
            backendProcess.stdout.on('data', (d) => console.log('[Backend]', d.toString().trim()));
        }
        if (backendProcess.stderr) {
            backendProcess.stderr.on('data', (d) => console.error('[Backend Err]', d.toString().trim()));
        }
    } else {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'npx.cmd' : 'npx';
        backendProcess = spawn(cmd, ['ts-node-dev', '--respawn', '--transpile-only', 'src/index.ts'], {
            cwd: backendDir,
            shell: true,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: 5050, DATABASE_URL: localDbUrl, NODE_ENV: 'production' }
        });
        if (backendProcess.stdout) {
            backendProcess.stdout.on('data', (d) => console.log('[Backend]', d.toString().trim()));
        }
        if (backendProcess.stderr) {
            backendProcess.stderr.on('data', (d) => console.error('[Backend Err]', d.toString().trim()));
        }
    }

    backendProcess.on('error', (err) => console.error('Backend logic server crashed:', err));
}

function createWindow() {
    const licenseStatus = verifyLicenseOffline();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // In dev mode (when not packaged), load main POS app
    const targetUrl = (app.isPackaged && !licenseStatus.valid) 
        ? 'http://localhost:5050/activation' 
        : 'http://localhost:5050';

    const loadApp = () => {
        mainWindow.loadURL(targetUrl).catch((err) => {
            console.log(`Backend server starting up... retrying load (reason: ${err.message})`);
            setTimeout(loadApp, 1000);
        });
    };

    loadApp();
}

app.whenReady().then(() => {
    // 1. Spawns local MongoDB & Express Service
    startLocalMongo();
    startLocalBackend();

    // 2. Launch UI Window
    createWindow();
});

// IPC communication endpoints for React
ipcMain.on('get-machine-id', (event) => {
    event.reply('machine-id-response', getHardwareId());
});

ipcMain.on('get-license-status', (event) => {
    event.reply('license-status-response', verifyLicenseOffline());
});

ipcMain.on('save-license', (event, licenseObject) => {
    try {
        const dir = path.dirname(LICENSE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(LICENSE_PATH, JSON.stringify(licenseObject, null, 2));
        event.reply('save-license-response', { success: true });
        
        // Reboot app to apply license
        app.relaunch();
        app.exit();
    } catch (err) {
        event.reply('save-license-response', { success: false, error: err.message });
    }
});

ipcMain.on('revoke-license', (event) => {
    try {
        if (fs.existsSync(LICENSE_PATH)) {
            fs.unlinkSync(LICENSE_PATH);
            console.log('Revoked local license file successfully:', LICENSE_PATH);
        }
        event.reply('revoke-license-response', { success: true });
    } catch (err) {
        console.error('Error removing local license file on revocation:', err);
        event.reply('revoke-license-response', { success: false, error: err.message });
    }
});

// Shutdown services gracefully on exit
app.on('window-all-closed', () => {
    if (mongodProcess) mongodProcess.kill();
    if (backendProcess) backendProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});
