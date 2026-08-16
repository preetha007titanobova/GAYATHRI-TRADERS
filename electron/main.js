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
            silent: true,
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

let isClosingApp = false;

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

    mainWindow.on('close', (e) => {
        if (!isClosingApp) {
            e.preventDefault();
            mainWindow.webContents.send('app-close-requested');
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

ipcMain.on('app-close-confirmed', () => {
    isClosingApp = true;
    if (mainWindow) mainWindow.close();
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

// ============================================================================
// --- PRINTER DETECTION & HARDWARE TSPL SPOOLER MODULE ---
// ============================================================================
const PRINTER_CONFIG_FILE = path.join(app.getPath('userData'), 'printer_config.json');
let cachedActivePrinter = '';

function getSavedPrinterPreference() {
    try {
        if (fs.existsSync(PRINTER_CONFIG_FILE)) {
            const raw = fs.readFileSync(PRINTER_CONFIG_FILE, 'utf8');
            const data = JSON.parse(raw);
            return data.activePrinter || '';
        }
    } catch (e) {
        console.error('Error reading saved printer config:', e);
    }
    return '';
}

function savePrinterPreference(name) {
    try {
        cachedActivePrinter = name;
        fs.writeFileSync(PRINTER_CONFIG_FILE, JSON.stringify({ activePrinter: name }, null, 2));
    } catch (e) {
        console.error('Error saving printer preference:', e);
    }
}

// Windows CIM Printer discovery fallback using PowerShell
function getWindowsCimPrinters() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            return resolve([]);
        }
        const { exec } = require('child_process');
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json"`;
        exec(cmd, { timeout: 2000 }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const parsed = JSON.parse(stdout.trim());
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const printers = list.map(p => ({
                    name: p.Name || p.name,
                    isDefault: !!(p.Default || p.isDefault)
                }));
                resolve(printers);
            } catch (e) {
                resolve([]);
            }
        });
    });
}

async function getSystemPrinters() {
    let list = [];
    if (mainWindow && mainWindow.webContents) {
        try {
            if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
                list = await mainWindow.webContents.getPrintersAsync();
            } else if (typeof mainWindow.webContents.getPrinters === 'function') {
                list = mainWindow.webContents.getPrinters();
            }
        } catch (e) {
            console.error('getPrintersAsync error:', e);
        }
    }

    if (!list || list.length === 0) {
        // Fallback to direct Windows CIM query
        list = await getWindowsCimPrinters();
    }

    return list.map(p => ({
        name: p.name || p.Name,
        isDefault: !!(p.isDefault || p.isDefault || p.Default)
    }));
}

async function resolveActivePrinter(printers) {
    const saved = getSavedPrinterPreference() || cachedActivePrinter;
    if (saved && printers.some(p => p.name === saved)) {
        return saved;
    }
    // Auto-detect thermal barcode or receipt printer
    const thermal = printers.find(p => {
        const n = p.name.toUpperCase();
        return n.includes('TSC') || n.includes('TE244') || n.includes('BARCODE') || n.includes('LABEL') || n.includes('POS') || n.includes('THERMAL') || n.includes('TVS') || n.includes('ZEBRA') || n.includes('XPRINTER');
    });
    if (thermal) {
        savePrinterPreference(thermal.name);
        return thermal.name;
    }
    // Fallback to default printer
    const defaultP = printers.find(p => p.isDefault);
    if (defaultP) return defaultP.name;
    return printers[0] ? printers[0].name : '';
}

function spoolRawToWindowsPrinter(printerName, rawContent) {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            return resolve({ success: false, error: 'Raw spooler only supported on Windows OS' });
        }

        const tempDir = path.join(app.getPath('temp'), 'gt_print_spool');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempFile = path.join(tempDir, `print_job_${Date.now()}.tspl`);
        fs.writeFileSync(tempFile, rawContent, 'utf8');

        // PowerShell Win32 winspool.drv RAW Printer Spooler Script
        const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW pDocInfo);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool PrintFile(string printerName, string filePath) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "Gayathri Printers Raw Spool Job";
        di.pDataType = "RAW";
        byte[] bytes = System.IO.File.ReadAllBytes(filePath);
        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocHGlobal(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written = 0;
                    bool success = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                    Marshal.FreeHGlobal(pBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return success;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$res = [RawPrinter]::PrintFile($args[0], $args[1])
if ($res) { Write-Output "SUCCESS" } else { Write-Output "FAILED" }
`;
        const scriptFile = path.join(tempDir, `spool_${Date.now()}.ps1`);
        fs.writeFileSync(scriptFile, psScript, 'utf8');

        const { execFile } = require('child_process');
        execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', scriptFile, printerName, tempFile], (err, stdout) => {
            try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                if (fs.existsSync(scriptFile)) fs.unlinkSync(scriptFile);
            } catch (e) {}

            if (err) {
                console.error('PowerShell raw printer error:', err);
                return resolve({ success: false, error: err.message });
            }
            if (stdout && stdout.includes('SUCCESS')) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: 'Failed to write raw data to Windows spooler' });
            }
        });
    });
}

// IPC Main Handlers for Printer Discovery & Control
ipcMain.on('get-printer-status', async (event) => {
    try {
        const printers = await getSystemPrinters();
        const active = await resolveActivePrinter(printers);
        const replyPayload = {
            activePrinter: active || 'TSC TE244 Barcode Printer',
            isConnected: printers.length > 0,
            selectionType: active ? (active.toUpperCase().includes('TSC') || active.toUpperCase().includes('POS') ? 'Thermal Hardware Spooler' : 'Windows Printer Spooler') : 'Thermal Spooler',
            allPrinters: printers.length > 0 ? printers : [{ name: active || 'TSC TE244 Barcode Printer', isDefault: true }]
        };
        event.reply('printer-status-response', replyPayload);
    } catch (err) {
        console.error('get-printer-status IPC error:', err);
        const saved = getSavedPrinterPreference() || 'TSC TE244 Barcode Printer';
        event.reply('printer-status-response', {
            activePrinter: saved,
            isConnected: true,
            selectionType: 'Thermal Spooler',
            allPrinters: [{ name: saved, isDefault: true }]
        });
    }
});

ipcMain.on('detect-printers', async (event) => {
    try {
        const printers = await getSystemPrinters();
        const active = await resolveActivePrinter(printers);
        event.reply('detect-printers-response', {
            success: true,
            activePrinter: active || 'TSC TE244 Barcode Printer',
            isConnected: true,
            selectionType: active ? 'Windows Spooler' : 'Thermal Spooler'
        });
    } catch (err) {
        event.reply('detect-printers-response', { success: false, error: err.message });
    }
});

ipcMain.on('get-printers', async (event) => {
    try {
        const printers = await getSystemPrinters();
        event.reply('get-printers-response', printers);
    } catch (err) {
        event.reply('get-printers-response', []);
    }
});

ipcMain.on('set-active-printer', (event, name) => {
    savePrinterPreference(name);
    event.reply('save-printer-response', { success: true, activePrinter: name });
});

ipcMain.on('print-tspl-raw', async (event, tsplPayload, options) => {
    try {
        let tsplString = typeof tsplPayload === 'string' ? tsplPayload : (tsplPayload?.tsplString || '');
        let targetPrinter = (typeof tsplPayload === 'object' && tsplPayload?.printerName) ? tsplPayload.printerName : (options?.printerName || getSavedPrinterPreference());

        if (!targetPrinter) {
            const printers = await getSystemPrinters();
            targetPrinter = await resolveActivePrinter(printers);
        }

        if (!targetPrinter) {
            targetPrinter = 'TSC TE244 Barcode Printer';
        }

        console.log(`Sending TSPL Raw Print job to target printer: "${targetPrinter}"...`);
        const result = await spoolRawToWindowsPrinter(targetPrinter, tsplString);
        event.reply('print-response', result);
    } catch (err) {
        console.error('print-tspl-raw error:', err);
        event.reply('print-response', { success: false, error: err.message });
    }
});

ipcMain.on('print-html', (event, htmlContent, options) => {
    try {
        const targetPrinter = options?.printerName || getSavedPrinterPreference();
        const printWin = new BrowserWindow({
            show: false,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        printWin.webContents.on('did-finish-load', () => {
            printWin.webContents.print({
                silent: options?.showDialog ? false : true,
                printBackground: true,
                deviceName: targetPrinter || '',
                landscape: !!options?.landscape
            }, (success, failureReason) => {
                event.reply('print-response', { success, error: failureReason });
                printWin.close();
            });
        });
    } catch (err) {
        console.error('print-html error:', err);
        event.reply('print-response', { success: false, error: err.message });
    }
});

