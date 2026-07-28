const { BrowserWindow, ipcMain } = require('electron');
const ThermalPrinterService = require('./ThermalPrinterService');

class PrintManager {
  constructor() {
    this.thermalService = new ThermalPrinterService();
  }

  init(mainWindow, ipc) {
    const ipcChannel = ipc || ipcMain;

    // 1. Primary Route: Direct ESC/POS Driver
    ipcChannel.on('print-escpos', async (event, data) => {
      try {
        const result = await this.thermalService.print(data.payload, data.config || {});
        event.reply('print-response', { success: true, result });
      } catch (err) {
        console.error('[PrintManager] ESC/POS Direct Print Error:', err);
        event.reply('print-response', { success: false, error: err ? err.message : String(err) });
      }
    });

    // 2. Secondary Route: Silent Chromium Renderer with Immediate Lifecycle Destruction
    ipcChannel.on('print-receipt', async (event, data) => {
      try {
        await this.printSilentChromium(data.payload, data.config || {});
        event.reply('print-response', { success: true });
      } catch (err) {
        console.error('[PrintManager] Silent Chromium Print Error:', err);
        event.reply('print-response', { success: false, error: err ? err.message : String(err) });
      }
    });

    // 3. Detect System Printers
    ipcChannel.on('detect-printers', async (event) => {
      try {
        const win = BrowserWindow.getFocusedWindow() || new BrowserWindow({ show: false });
        const printers = await win.webContents.getPrintersAsync();
        if (!BrowserWindow.getFocusedWindow()) win.destroy();
        event.reply('detect-printers-response', printers);
      } catch (err) {
        console.error('[PrintManager] Detect Printers Error:', err);
        event.reply('detect-printers-response', []);
      }
    });
  }

  async printSilentChromium(payload, config) {
    return new Promise((resolve, reject) => {
      let printWindow = new BrowserWindow({
        show: false,
        width: 300,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const paperWidthPx = config.paperWidth === '58mm' ? '48mm' : '72mm';
      const items = payload.items || [];
      const itemsHtml = items.map((item, idx) => `
        <tr>
          <td style="text-align:left; width: 50%;">${item.index || idx + 1} ${item.itemName}</td>
          <td style="text-align:right; width: 15%;">${item.qty}</td>
          <td style="text-align:right; width: 17%;">${Number(item.rate).toFixed(2)}</td>
          <td style="text-align:right; width: 18%;">${Number(item.amount).toFixed(2)}</td>
        </tr>
      `).join('');

      const totalQty = payload.totalQty || items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
      const subTotal = payload.subTotal !== undefined ? payload.subTotal : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const cleanInvNo = (payload.invoiceNo || '').replace(/^INV--+/, 'INV-');

      const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt</title>
          <style>
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; background: #fff; color: #000; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              color: #000;
              margin: 0;
              padding: 3mm 2mm;
              box-sizing: border-box;
              width: ${paperWidthPx};
              line-height: 1.25;
            }
            .center { text-align: center; }
            .title { font-size: 1.25em; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
            .subtitle { font-size: 0.9em; font-weight: 700; margin-bottom: 2px; }
            .tax-invoice { font-size: 1.05em; font-weight: 900; text-transform: uppercase; margin: 4px 0; }
            .meta { flex-direction: row; display: flex; justify-content: space-between; font-size: 0.92em; font-weight: 700; }
            .dashed { border-top: 1px dashed #000; margin: 4px 0; }
            table.items-table { width: 100%; border-collapse: collapse; font-size: 0.95em; font-weight: 700; table-layout: fixed; }
            th, td { padding: 3px 1px; vertical-align: top; }
            th { font-weight: 900; text-transform: uppercase; }
            .summary { display: flex; justify-content: space-between; font-size: 0.95em; font-weight: 700; margin: 2px 0; }
            .grand-total { text-align: center; font-size: 1.2em; font-weight: 900; margin: 6px 0; }
            .footer { text-align: center; margin-top: 8px; font-size: 0.9em; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="center">
            ${payload.storeName ? `<div class="title">${payload.storeName}</div>` : ''}
            ${payload.storeMobile ? `<div class="subtitle">Mobile: ${payload.storeMobile}</div>` : ''}
            <div class="tax-invoice">${payload.receiptTitle || 'TAX INVOICE'}</div>
          </div>

          <div class="meta">
            <div>
              <div>Inv: ${cleanInvNo}</div>
              <div>Cust: ${payload.customerName || 'Cash'}</div>
            </div>
            <div style="text-align: right;">
              <div>Date: ${payload.date || new Date().toISOString().split('T')[0]}</div>
              <div>Mode: ${payload.paymentMode || 'Cash'}</div>
            </div>
          </div>

          <div class="dashed"></div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align:left; width: 42%;"># ITEM</th>
                <th style="text-align:right; width: 14%;">QTY</th>
                <th style="text-align:right; width: 22%;">RATE</th>
                <th style="text-align:right; width: 22%;">AMT</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td style="text-align:left; word-break: break-word;">${item.index || idx + 1} ${item.itemName}</td>
                  <td style="text-align:right;">${item.qty}</td>
                  <td style="text-align:right;">${Number(item.rate).toFixed(2)}</td>
                  <td style="text-align:right;">${Number(item.amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="dashed"></div>

          <div class="summary">
            <span>Items: ${items.length}</span>
            <span>Total Qty: ${totalQty}</span>
          </div>

          <div class="summary" style="justify-content: flex-end; gap: 8px;">
            <span>SubTotal:</span>
            <span>₹${subTotal.toFixed(2)}</span>
          </div>

          <div class="dashed"></div>

          <div class="grand-total">
            Grand Total: ₹${(Number(payload.netAmount) || subTotal).toFixed(2)}
          </div>

          <div class="dashed"></div>

          <div class="footer">
            <div>Thank you for purchasing!</div>
            <div>Have a great day!</div>
          </div>
        </body>
        </html>
      `;

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);

      printWindow.webContents.on('did-finish-load', async () => {
        if (!printWindow) return;

        let targetDeviceName = '';

        try {
          const availablePrinters = await printWindow.webContents.getPrintersAsync();
          console.log('[PrintManager] Connected System Printers:', availablePrinters.map(p => p.name));

          // 1. Check if user requested a specific printer name that exists in system
          if (config.printerName && config.printerName.trim() !== '') {
            const requested = config.printerName.trim().toLowerCase();
            const matched = availablePrinters.find(p => p.name.toLowerCase() === requested || p.name.toLowerCase().includes(requested));
            if (matched) {
              targetDeviceName = matched.name;
            }
          }

          // 2. Auto-detect RP3200, TVS, Thermal, POS receipt printer in Windows Print Queues
          if (!targetDeviceName && availablePrinters.length > 0) {
            const thermalKeywords = ['RP3200', 'TVS', 'POS', 'THERMAL', 'XP-', 'XP ', 'RECEIPT', 'ESC', '80MM', '58MM'];
            const virtualKeywords = ['PDF', 'XPS', 'ONENOTE', 'FAX', 'MICROSOFT'];

            const thermalPrinter = availablePrinters.find(p => {
              const nameUpper = p.name.toUpperCase();
              const isThermal = thermalKeywords.some(kw => nameUpper.includes(kw));
              const isVirtual = virtualKeywords.some(kw => nameUpper.includes(kw));
              return isThermal && !isVirtual;
            });

            if (thermalPrinter) {
              targetDeviceName = thermalPrinter.name;
              console.log(`[PrintManager] Auto-selected thermal printer: "${targetDeviceName}"`);
            } else {
              // 3. Fallback to default OS printer or first physical printer
              const defaultPrinter = availablePrinters.find(p => p.isDefault) || availablePrinters.find(p => !virtualKeywords.some(kw => p.name.toUpperCase().includes(kw)));
              if (defaultPrinter) {
                targetDeviceName = defaultPrinter.name;
                console.log(`[PrintManager] Fallback system printer: "${targetDeviceName}"`);
              }
            }
          }
        } catch (e) {
          console.warn('[PrintManager] Could not query system printers:', e.message);
        }

        const printOptions = {
          silent: true,
          printBackground: true,
          margin: { marginType: 'none' }
        };

        if (targetDeviceName) {
          printOptions.deviceName = targetDeviceName;
        }

        console.log(`[PrintManager] Printing bill to device: "${printOptions.deviceName || 'Windows Default'}"`);

        printWindow.webContents.print(
          printOptions,
          (success, failureReason) => {
            if (success) {
              if (printWindow && !printWindow.isDestroyed()) {
                printWindow.destroy();
                printWindow = null;
              }
              resolve();
            } else {
              console.warn(`[PrintManager] Silent print to "${targetDeviceName}" failed: ${failureReason}. Retrying with system print dialog...`);
              if (printWindow && !printWindow.isDestroyed()) {
                try {
                  printWindow.show();
                  printWindow.focus();
                } catch (e) {}

                printWindow.webContents.print({
                  silent: false,
                  printBackground: true,
                  margin: { marginType: 'none' }
                }, (fallbackSuccess, fallbackFailure) => {
                  if (printWindow && !printWindow.isDestroyed()) {
                    printWindow.destroy();
                    printWindow = null;
                  }
                  if (fallbackSuccess) resolve();
                  else reject(new Error(`Print Failed: ${fallbackFailure}`));
                });
              } else {
                reject(new Error(`Chromium Silent Print Failed: ${failureReason}`));
              }
            }
          }
        );
      });
    });
  }
}

module.exports = new PrintManager();
