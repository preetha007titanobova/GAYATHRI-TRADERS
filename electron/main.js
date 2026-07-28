if (typeof process !== 'undefined' && !process.getBuiltinModule) {
    process.getBuiltinModule = function(name) {
        return require(name);
    };
}

const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const printerService = require('./printer/printer.service');
const printManager = require('./printer/PrintManager');

let mainWindow;
let mongodProcess;
let backendProcess;
let isQuitting = false;
let isFrontendReady = false;

const LICENSE_PATH = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'IthuNammaKada', 'license.lic');
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGm7aeYXKDQtKBnuOGKHq+pz6uDP5L6mvfz9Dv0sgKu8=
-----END PUBLIC KEY-----`;

// Stable Machine ID generation (Section 3 of Blueprint)
function getHardwareId() {
    try {
        const { machineIdSync } = require('node-machine-id');
        const id = machineIdSync();
        if (id) return crypto.createHash('sha256').update(id).digest('hex').toUpperCase();
    } catch (e) {
        console.warn('node-machine-id failed, falling back to wmic:', e.message);
    }
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

        // Verify cryptographic signature (Bypassed temporarily for testing)
        /*
        const isSigValid = crypto.verify(
            null,
            Buffer.from(JSON.stringify(data)),
            PUBLIC_KEY_PEM,
            Buffer.from(signature, 'hex')
        );

        if (!isSigValid) return { valid: false, reason: 'TAMPERED' };
        */

        // Verify machine ID (Bypassed temporarily for testing)
        /*
        const activeMachineId = getHardwareId();
        if (data.machineId !== activeMachineId) return { valid: false, reason: 'INVALID_MACHINE' };
        */

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
    const mongoDataDir = path.join(app.getPath('userData'), 'mongodb_data');
    if (!fs.existsSync(mongoDataDir)) {
        fs.mkdirSync(mongoDataDir, { recursive: true });
    }

    // Clean up any stale lock files from previous unclean shutdowns
    const lockPath = path.join(mongoDataDir, 'mongod.lock');
    if (fs.existsSync(lockPath)) {
        try {
            fs.unlinkSync(lockPath);
            console.log('Stale database lock file cleaned up.');
        } catch (e) {
            console.warn('Could not remove database lock file:', e.message);
        }
    }

    // Path to the portable mongod.exe bundled in the application resources
    // Place your portable mongod binary inside your packaging resources folder
    const mongodPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'bin', 'mongod.exe')
        : path.join(__dirname, 'bin', 'mongod.exe');

    if (!fs.existsSync(mongodPath)) {
        console.warn(`Local portable mongod.exe not found at ${mongodPath}. Ensure binary is packaged.`);
        return;
    }

    console.log('Starting local database engine (Replica Set)...');
    mongodProcess = spawn(mongodPath, [
        '--dbpath', mongoDataDir,
        '--port', '27017',
        '--bind_ip', '127.0.0.1',
        '--replSet', 'rs0'
    ]);

    mongodProcess.stdout.on('data', (data) => console.log('Local Database Log:', data.toString()));
    mongodProcess.stderr.on('data', (data) => console.error('Local Database Error:', data.toString()));

    try {
        const logPath = path.join(app.getPath('userData'), 'mongodb.log');
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });
        mongodProcess.stdout.on('data', (data) => logStream.write(data.toString()));
        mongodProcess.stderr.on('data', (data) => logStream.write(data.toString()));
    } catch (err) {
        console.error('Failed to initialize MongoDB log file stream:', err.message);
    }

    // Wait a couple seconds, then initiate the replica set
    setTimeout(async () => {
        try {
            const { MongoClient } = require('mongodb');
            const client = new MongoClient('mongodb://127.0.0.1:27017', { directConnection: true });
            await client.connect();
            try {
                await client.db('admin').command({ 
                    replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] } 
                });
                console.log('Local MongoDB Replica Set rs0 initialized successfully.');
            } catch (err) {
                // If it's already initiated, we'll get an error we can safely ignore
                if (err.message && !err.message.includes('already initialized')) {
                    console.error('ReplSetInitiate failed:', err.message);
                }
            } finally {
                await client.close();
            }
        } catch (e) {
            console.error('Error initiating replica set connection:', e.message);
        }
    }, 3000);
}

let resolvedDbUrl = 'mongodb://127.0.0.1:27017/ERP_DB';

function resolveDatabaseUrl() {
    let dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        try {
            const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
            const packagedEnvPath = path.join(__dirname, 'backend', '.env');
            let envPath = fs.existsSync(backendEnvPath) 
                ? backendEnvPath 
                : (fs.existsSync(packagedEnvPath) ? packagedEnvPath : null);
            if (envPath) {
                const dotenv = require('dotenv');
                dotenv.config({ path: envPath });
                dbUrl = process.env.DATABASE_URL;
            }
        } catch (e) {
            console.warn('Failed to load dotenv in Electron:', e.message);
        }
    }
    if (dbUrl) {
        resolvedDbUrl = dbUrl;
    }
    console.log('Using resolved DATABASE_URL:', resolvedDbUrl);
}

// 3. Spawn Local Express Backend
function startLocalBackend() {
    console.log('Spawning billing logic server...');
    const dbUrlToUse = resolvedDbUrl;

    if (app.isPackaged) {
        const prodBackendPath = path.join(__dirname, 'backend', 'index.js');
        backendProcess = fork(prodBackendPath, [], {
            env: {
                PORT: 5000,
                DATABASE_URL: dbUrlToUse,
                NODE_ENV: 'production'
            }
        });
    } else {
        const backendDir = path.join(__dirname, '..', 'backend');
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        const args = process.platform === 'win32' ? ['/c', 'npm run dev'] : ['-c', 'npm run dev'];
        
        backendProcess = spawn(shell, args, {
            cwd: backendDir,
            env: {
                ...process.env,
                PORT: 5000,
                DATABASE_URL: dbUrlToUse,
                NODE_ENV: 'development'
            },
            stdio: 'ignore'
        });
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

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER CONSOLE] Level ${level}: ${message} (${sourceId}:${line})`);
    });

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            if (isFrontendReady) {
                e.preventDefault();
                mainWindow.webContents.send('app-close-requested');
            } else {
                isQuitting = true;
            }
        }
    });

    const route = licenseStatus.valid ? '' : '#/activation';

    let devServerFailed = false;

    // Smart fallback loader: Connect to local Express server on port 5000
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        if (errorCode === -102 || errorCode === -105) { // ERR_CONNECTION_REFUSED / ERR_NAME_NOT_RESOLVED
            if (validatedURL.includes('5173') && !devServerFailed) {
                devServerFailed = true;
                console.log('Vite dev server (5173) not active. Switching to local backend server (http://localhost:5000)...');
                mainWindow.loadURL(`http://localhost:5000/${route}`);
            } else if (validatedURL.includes('5000')) {
                console.log('Backend server (5000) starting up. Retrying in 1 second...');
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.loadURL(`http://localhost:5000/${route}`);
                    }
                }, 1000);
            }
        }
    });

    const isDev = !app.isPackaged;
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

    if (isDev) {
        console.log(`Attempting to connect to Vite dev server at ${devServerUrl}/${route}`);
        mainWindow.loadURL(`${devServerUrl}/${route}`).catch(() => {
            mainWindow.loadURL(`http://localhost:5000/${route}`);
        });
    } else {
        mainWindow.loadURL(`http://localhost:5000/${route}`);
    }

    // Initialize automated print service & dual-engine manager
    printerService.init(mainWindow, ipcMain);
    printManager.init(mainWindow, ipcMain);
}

app.whenReady().then(() => {
    // Enable legacy print dialog on Windows to bypass Windows 11 modern print dialog bug
    if (process.platform === 'win32') {
        const { exec } = require('child_process');
        exec('reg add "HKCU\\Software\\Microsoft\\Print\\UnifiedPrintDialog" /v PreferLegacyPrintDialog /d 1 /t REG_DWORD /f', (err) => {
            if (err) console.error('Failed to set legacy print dialog registry:', err.message);
        });
    }

    resolveDatabaseUrl();

    // Spawn local MongoDB only if resolved database URL points to localhost/127.0.0.1
    const isLocal = resolvedDbUrl.includes('127.0.0.1') || resolvedDbUrl.includes('localhost');
    if (isLocal) {
        startLocalMongo();
    } else {
        console.log('Remote DATABASE_URL detected. Skipping local MongoDB startup.');
    }

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
ipcMain.on('app-close-confirmed', () => {
    isQuitting = true;
    if (mainWindow) {
        mainWindow.close();
    }
});
ipcMain.on('app-ready', () => {
    isFrontendReady = true;
});

ipcMain.on('print-html', (event, htmlContent) => {
    printerService.printHTML(htmlContent).catch((err) => {
        console.error('[Main] Printer service print failed:', err.message);
    });
});

// Shutdown services gracefully on exit
app.on('window-all-closed', () => {
    if (mongodProcess) mongodProcess.kill();
    if (backendProcess) backendProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});
