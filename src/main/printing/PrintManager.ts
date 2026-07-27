import { app, BrowserWindow, ipcMain } from 'electron';
import { ReceiptPayload, PrinterConfig } from './types';
import { ThermalPrinterService } from './ThermalPrinterService';

export class PrintManager {
  private thermalService: ThermalPrinterService;

  constructor() {
    this.thermalService = new ThermalPrinterService();
    this.registerIpcListeners();
  }

  private registerIpcListeners() {
    // 1. Primary Route: Direct ESC/POS Driver
    ipcMain.on('print-escpos', async (event, data: { payload: ReceiptPayload; config: PrinterConfig }) => {
      try {
        const result = await this.thermalService.print(data.payload, data.config);
        event.reply('print-response', { success: true, result });
      } catch (err: any) {
        console.error('[PrintManager] ESC/POS Direct Print Error:', err);
        event.reply('print-response', { success: false, error: err?.message || String(err) });
      }
    });

    // 2. Secondary Route: Silent Chromium Renderer with Strict Lifecycle Management
    ipcMain.on('print-receipt', async (event, data: { payload: ReceiptPayload; config: PrinterConfig }) => {
      try {
        await this.printSilentChromium(data.payload, data.config);
        event.reply('print-response', { success: true });
      } catch (err: any) {
        console.error('[PrintManager] Silent Chromium Print Error:', err);
        event.reply('print-response', { success: false, error: err?.message || String(err) });
      }
    });

    // 3. Detect System Printers
    ipcMain.on('detect-printers', async (event) => {
      try {
        const win = BrowserWindow.getFocusedWindow() || new BrowserWindow({ show: false });
        const printers = await win.webContents.getPrintersAsync();
        if (!BrowserWindow.getFocusedWindow()) win.destroy();
        event.reply('detect-printers-response', printers);
      } catch (err: any) {
        console.error('[PrintManager] Detect Printers Error:', err);
        event.reply('detect-printers-response', []);
      }
    });
  }

  public async printSilentChromium(payload: ReceiptPayload, config: PrinterConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      let printWindow: BrowserWindow | null = new BrowserWindow({
        show: false,
        width: 300,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const paperWidthPx = config.paperWidth === '58mm' ? '48mm' : '72mm';
      const itemsHtml = payload.items.map((item, idx) => `
        <tr>
          <td style="text-align:left; width: 50%;">${item.index || idx + 1} ${item.itemName}</td>
          <td style="text-align:right; width: 15%;">${item.qty}</td>
          <td style="text-align:right; width: 17%;">${Number(item.rate).toFixed(2)}</td>
          <td style="text-align:right; width: 18%;">${Number(item.amount).toFixed(2)}</td>
        </tr>
      `).join('');

      const totalQty = payload.totalQty || payload.items.reduce((s, i) => s + i.qty, 0);
      const subTotal = payload.subTotal !== undefined ? payload.subTotal : payload.items.reduce((s, i) => s + i.amount, 0);

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
              padding: 4mm 3mm;
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
            table { width: 100%; border-collapse: collapse; font-size: 0.95em; font-weight: 700; }
            th, td { padding: 2px 0; vertical-align: top; }
            th { font-weight: 900; text-transform: uppercase; }
            .summary { display: flex; justify-content: space-between; font-size: 0.95em; font-weight: 700; margin: 2px 0; }
            .grand-total { text-align: center; font-size: 1.2em; font-weight: 900; margin: 6px 0; }
            .footer { text-align: center; margin-top: 8px; font-size: 0.9em; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">${payload.storeName || 'ITHU NAMMA KADA'}</div>
            <div class="subtitle">Mobile: ${payload.storeMobile || '8270691757'}</div>
            <div class="tax-invoice">${payload.receiptTitle || 'TAX INVOICE'}</div>
          </div>

          <div class="meta">
            <div>
              <div>Inv: ${payload.invoiceNo}</div>
              <div>Cust: ${payload.customerName || 'Cash'}</div>
            </div>
            <div style="text-align: right;">
              <div>Date: ${payload.date || new Date().toISOString().split('T')[0]}</div>
              <div>Mode: ${payload.paymentMode || 'Cash'}</div>
            </div>
          </div>

          <div class="dashed"></div>

          <table>
            <thead>
              <tr>
                <th style="text-align:left; width: 50%;"># Item</th>
                <th style="text-align:right; width: 15%;">Qty</th>
                <th style="text-align:right; width: 17%;">Rate</th>
                <th style="text-align:right; width: 18%;">Amt</th>
              </tr>
            </thead>
          </table>

          <div class="dashed"></div>

          <table>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="dashed"></div>

          <div class="summary">
            <span>Items: ${payload.items.length}</span>
            <span>Total Qty: ${totalQty}</span>
          </div>

          <div class="summary" style="justify-content: flex-end; gap: 8px;">
            <span>SubTotal:</span>
            <span>₹${subTotal.toFixed(2)}</span>
          </div>

          <div class="dashed"></div>

          <div class="grand-total">
            Grand Total: ₹${payload.netAmount.toFixed(2)}
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

      printWindow.webContents.on('did-finish-load', () => {
        if (!printWindow) return;

        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: config.printerName || '',
            margin: { marginType: 'none' }
          },
          (success, failureReason) => {
            // STRICT LIFECYCLE CLEANUP TO PREVENT MEMORY LEAKS
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.destroy();
              printWindow = null;
            }
            if (success) resolve();
            else reject(new Error(`Chromium Silent Print Failed: ${failureReason}`));
          }
        );
      });
    });
  }
}
