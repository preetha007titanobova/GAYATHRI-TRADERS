const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const EscPosBuilder = require('./EscPosBuilder');

class ThermalPrinterService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  async print(payload, config) {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, config, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      const { payload, config, resolve, reject } = task;
      const builder = new EscPosBuilder({
        paperWidth: config.paperWidth || '80mm',
        openCashDrawer: config.openCashDrawer,
        autoCut: config.autoCut !== false
      });

      if (config.openCashDrawer) {
        builder.openCashDrawer();
      }

      const buffer = builder.printReceipt(payload);

      if (config.communicationType === 'network-socket' && config.networkIp) {
        await this.sendToNetworkPrinter(buffer, config.networkIp, config.networkPort || 9100);
        resolve({ success: true, message: `Sent to network printer ${config.networkIp}` });
      } else {
        await this.sendToLocalPrinterSpooler(buffer, config.printerName || 'POS-80');
        resolve({ success: true, message: `Sent raw ESC/POS payload to printer spooler ${config.printerName}` });
      }
    } catch (err) {
      console.error('[ThermalPrinterService] Print Error:', err);
      task.reject({ success: false, error: err ? err.message : String(err) });
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }

  sendToNetworkPrinter(buffer, ip, port) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(port, ip, () => {
        client.write(buffer, () => {
          client.end();
          resolve();
        });
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Connection to printer ${ip}:${port} timed out.`));
      });
    });
  }

  sendToLocalPrinterSpooler(buffer, printerName) {
    return new Promise((resolve, reject) => {
      if (process.platform === 'win32') {
        const tempFilePath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `escpos_${Date.now()}.bin`);
        fs.writeFileSync(tempFilePath, buffer);

        const psCommand = `Get-Content "${tempFilePath}" -Encoding Byte | Out-Printer -Name "${printerName}"`;
        exec(`powershell -Command "${psCommand}"`, (error) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch (e) {}

          if (error) {
            exec(`copy /b "${tempFilePath}" "${printerName}"`, (copyErr) => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        const tempFilePath = path.join('/tmp', `escpos_${Date.now()}.bin`);
        fs.writeFileSync(tempFilePath, buffer);
        exec(`lp -d "${printerName}" -o raw "${tempFilePath}"`, (error) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch (e) {}
          if (error) reject(error);
          else resolve();
        });
      }
    });
  }
}

module.exports = ThermalPrinterService;
