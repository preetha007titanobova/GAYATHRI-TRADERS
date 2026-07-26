const config = require('./printer.config');

const THERMAL_KEYWORDS = [
    'TVS', 'TSC', 'TE244', 'RP3200', 'POS', 'THERMAL', 'XP-', 'XP ', 
    'ESC', 'RECEIPT', 'LABEL', 'BARCODE', '58MM', '80MM'
];

const VIRTUAL_KEYWORDS = [
    'PDF', 'XPS', 'ONENOTE', 'FAX', 'SEND TO', 'MICROSOFT', 'DOCUMENTS'
];

async function detectPrinters(webContents) {
    try {
        if (!webContents) {
            throw new Error('WebContents is required for printer detection');
        }

        const allPrinters = await webContents.getPrintersAsync();
        
        // 1. Check if we have a saved printer and it's still connected
        const savedPrinterName = config.getSavedPrinter();
        if (savedPrinterName) {
            const stillConnected = allPrinters.find(p => p.name === savedPrinterName);
            if (stillConnected) {
                return {
                    activePrinter: stillConnected,
                    allPrinters,
                    selectionType: 'Saved'
                };
            }
        }

        // 2. Look for thermal/POS printers
        const thermalPrinters = allPrinters.filter(printer => {
            const nameUpper = printer.name.toUpperCase();
            const descUpper = (printer.description || '').toUpperCase();
            
            const matchesThermal = THERMAL_KEYWORDS.some(kw => nameUpper.includes(kw) || descUpper.includes(kw));
            const matchesVirtual = VIRTUAL_KEYWORDS.some(kw => nameUpper.includes(kw));
            
            return matchesThermal && !matchesVirtual;
        });

        if (thermalPrinters.length > 0) {
            // Pick the first matched thermal printer
            const selected = thermalPrinters[0];
            config.savePrinter(selected.name);
            return {
                activePrinter: selected,
                allPrinters,
                selectionType: 'Auto-Detected (Thermal)'
            };
        }

        // 3. Fallback to system default printer
        const defaultPrinter = allPrinters.find(p => p.isDefault);
        if (defaultPrinter) {
            config.savePrinter(defaultPrinter.name);
            return {
                activePrinter: defaultPrinter,
                allPrinters,
                selectionType: 'Default OS Printer'
            };
        }

        // 4. Fallback to the first printer in the list
        if (allPrinters.length > 0) {
            const selected = allPrinters[0];
            config.savePrinter(selected.name);
            return {
                activePrinter: selected,
                allPrinters,
                selectionType: 'Fallback First Connected'
            };
        }

        // 5. No printers found
        return {
            activePrinter: null,
            allPrinters: [],
            selectionType: 'None'
        };

    } catch (err) {
        console.error('Printer detection failed:', err.message);
        return {
            activePrinter: null,
            allPrinters: [],
            selectionType: 'Error: ' + err.message
        };
    }
}

module.exports = {
    detectPrinters
};
