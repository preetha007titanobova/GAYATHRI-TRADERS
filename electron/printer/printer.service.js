const { BrowserWindow, ipcMain } = require('electron');
const config = require('./printer.config');
const detector = require('./printer.detector');
const queue = require('./printer.queue');

let activePrinter = null;
let selectionType = 'None';
let allPrinters = [];
let mainWindowRef = null;

async function refreshPrinterStatus() {
    if (!mainWindowRef) return;
    try {
        const result = await detector.detectPrinters(mainWindowRef.webContents);
        activePrinter = result.activePrinter;
        allPrinters = result.allPrinters;
        selectionType = result.selectionType;
        console.log(`[PrinterService] Active printer: ${activePrinter ? activePrinter.name : 'None'} (${selectionType})`);
    } catch (err) {
        console.error('[PrinterService] Error refreshing printer status:', err.message);
    }
}

function init(mainWindow, ipcMainInstance) {
    mainWindowRef = mainWindow;
    
    // Initial detection after main window is ready
    mainWindowRef.webContents.on('did-finish-load', () => {
        refreshPrinterStatus();
    });

    // 1. Get printer status
    ipcMainInstance.on('get-printer-status', async (event) => {
        await refreshPrinterStatus();
        event.reply('printer-status-response', {
            activePrinter: activePrinter ? activePrinter.name : null,
            isConnected: !!activePrinter,
            selectionType,
            allPrinters: allPrinters.map(p => ({ name: p.name, isDefault: p.isDefault }))
        });
    });

    // 2. Trigger auto-detection manually
    ipcMainInstance.on('detect-printers', async (event) => {
        config.clearConfig(); // clear saved configuration to force fresh scan
        await refreshPrinterStatus();
        event.reply('detect-printers-response', {
            success: true,
            activePrinter: activePrinter ? activePrinter.name : null,
            isConnected: !!activePrinter,
            selectionType
        });
    });

    // 3. Override active printer manually (if needed)
    ipcMainInstance.on('set-active-printer', async (event, printerName) => {
        const printerExists = allPrinters.some(p => p.name === printerName);
        if (printerExists) {
            config.savePrinter(printerName);
            await refreshPrinterStatus();
            event.reply('save-printer-response', { success: true, activePrinter: printerName });
        } else {
            event.reply('save-printer-response', { success: false, error: 'Printer not connected or not found' });
        }
    });
}

function printHTML(htmlContent) {
    // Schedule printing inside the sequential queue
    return queue.addToQueue(() => {
        return new Promise((resolve, reject) => {
            let printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            // Inject base href tag to resolve relative compiled assets/stylesheets from local backend server
            let processedHtml = htmlContent;
            if (htmlContent.includes('<head>')) {
                processedHtml = htmlContent.replace('<head>', '<head><base href="http://localhost:5000/">');
            } else {
                processedHtml = `<base href="http://localhost:5000/">` + htmlContent;
            }

            const fs = require('fs');
            const path = require('path');
            const { app } = require('electron');
            const tempWritePath = path.join(app.getPath('userData'), 'temp_print.html');
            fs.writeFileSync(tempWritePath, processedHtml, 'utf8');

            printWindow.loadFile(tempWritePath);

            printWindow.webContents.on('did-finish-load', () => {
                const printOptions = {
                    silent: !!activePrinter, // print silently if we detected a printer
                    printBackground: true,
                    margins: { marginType: 'none' }
                };

                if (activePrinter) {
                    printOptions.deviceName = activePrinter.name;
                }

                printWindow.webContents.print(printOptions, (success, errorType) => {
                    printWindow.destroy();
                    printWindow = null;
                    try { if (fs.existsSync(tempWritePath)) fs.unlinkSync(tempWritePath); } catch (e) {}

                    if (success) {
                        resolve(true);
                    } else {
                        // Fallback to showing system dialog if silent printing fails
                        console.warn(`[PrinterService] Silent print failed: ${errorType}. Falling back to system dialog...`);
                        
                        // Retry with system dialog
                        let fallbackWindow = new BrowserWindow({
                            show: false,
                            webPreferences: {
                                nodeIntegration: false,
                                contextIsolation: true
                            }
                        });

                        const fallbackWritePath = path.join(app.getPath('userData'), 'fallback_print.html');
                        fs.writeFileSync(fallbackWritePath, processedHtml, 'utf8');
                        fallbackWindow.loadFile(fallbackWritePath);
                        fallbackWindow.webContents.on('did-finish-load', () => {
                            fallbackWindow.webContents.print({
                                silent: false,
                                printBackground: true,
                                margins: { marginType: 'none' }
                            }, (fallbackSuccess, fallbackError) => {
                                fallbackWindow.destroy();
                                fallbackWindow = null;
                                try { if (fs.existsSync(fallbackWritePath)) fs.unlinkSync(fallbackWritePath); } catch (e) {}
                                if (fallbackSuccess) {
                                    resolve(true);
                                } else {
                                    reject(new Error(fallbackError || 'System printing dialog cancelled or failed'));
                                }
                            });
                        });
                    }
                });
            });
        });
    });
}

module.exports = {
    init,
    printHTML,
    refreshPrinterStatus
};
