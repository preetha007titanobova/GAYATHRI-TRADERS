const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'IthuNammaKada');
const CONFIG_FILE = path.join(CONFIG_DIR, 'printer_config.json');

function getSavedPrinter() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            return null;
        }
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        return config.printerName || null;
    } catch (err) {
        console.error('Failed to read printer config:', err.message);
        return null;
    }
}

function savePrinter(printerName) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        const config = { printerName };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Failed to save printer config:', err.message);
        return false;
    }
}

function clearConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
        return true;
    } catch (err) {
        console.error('Failed to clear printer config:', err.message);
        return false;
    }
}

module.exports = {
    getSavedPrinter,
    savePrinter,
    clearConfig
};
