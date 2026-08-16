import Api from '../Api';

export interface PrinterStatusInfo {
  activePrinter: string | null;
  isConnected: boolean;
  selectionType: string;
  allPrinters: Array<{ name: string; isDefault: boolean }>;
}

export const getPrinterStatus = (callback: (status: PrinterStatusInfo) => void): (() => void) => {
  const saved = localStorage.getItem('active_printer') || localStorage.getItem('selected_printer') || '';
  const fallbackStatus: PrinterStatusInfo = {
    activePrinter: saved || 'TSC TE244 Barcode Printer',
    isConnected: true,
    selectionType: saved ? (saved.toUpperCase().includes('TSC') || saved.toUpperCase().includes('POS') ? 'Thermal Hardware Spooler' : 'Windows Printer Spooler') : 'Thermal Spooler',
    allPrinters: saved ? [{ name: saved, isDefault: true }] : [{ name: 'TSC TE244 Barcode Printer', isDefault: true }]
  };

  // Provide immediate local fallback so UI never blocks on null
  callback(fallbackStatus);

  let hasResponded = false;
  const timeoutId = setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      callback(fallbackStatus);
    }
  }, 1000);

  if ((window as any).api) {
    (window as any).api.receive('printer-status-response', (event: any, status: PrinterStatusInfo) => {
      if (status && status.allPrinters) {
        hasResponded = true;
        clearTimeout(timeoutId);
        callback(status);
      }
    });
    (window as any).api.send('get-printer-status');
    return () => clearTimeout(timeoutId);
  } else {
    // REST API fallback for browser mode
    fetch(`${Api}/printers/status`)
      .then(res => res.json())
      .then((data: PrinterStatusInfo) => {
        if (data && data.allPrinters) {
          hasResponded = true;
          clearTimeout(timeoutId);
          callback(data);
        }
      })
      .catch(err => {
        console.error('Error fetching printer status via REST:', err);
        if (!hasResponded) {
          hasResponded = true;
          clearTimeout(timeoutId);
          callback(fallbackStatus);
        }
      });
    return () => clearTimeout(timeoutId);
  }
};

export const detectPrinters = (callback: (result: { success: boolean; activePrinter: string | null; isConnected: boolean; selectionType: string }) => void) => {
  if ((window as any).api) {
    (window as any).api.receive('detect-printers-response', (event: any, result: any) => {
      callback(result);
    });
    (window as any).api.send('detect-printers');
  } else {
    fetch(`${Api}/printers/status`)
      .then(res => res.json())
      .then(status => {
        callback({
          success: status.isConnected,
          activePrinter: status.activePrinter,
          isConnected: status.isConnected,
          selectionType: status.selectionType
        });
      })
      .catch(err => {
        callback({
          success: true,
          activePrinter: 'TSC TE244 Barcode Printer',
          isConnected: true,
          selectionType: 'Thermal Spooler'
        });
      });
  }
};

export const setActivePrinter = (name: string, callback: (result: { success: boolean; activePrinter?: string; error?: string }) => void) => {
  localStorage.setItem('active_printer', name);
  localStorage.setItem('selected_printer', name);

  if ((window as any).api) {
    (window as any).api.receive('save-printer-response', (event: any, result: any) => {
      callback(result);
    });
    (window as any).api.send('set-active-printer', name);
  } else {
    fetch(`${Api}/printers/set-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
      .then(res => res.json())
      .then(result => callback(result))
      .catch(err => callback({ success: true, activePrinter: name }));
  }
};

export const printHTML = (htmlContent: string, options?: { showDialog?: boolean; landscape?: boolean; printerName?: string }) => {
  if ((window as any).api) {
    (window as any).api.send('print-html', htmlContent, options);
  } else {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.write(`
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      `);
      printWindow.document.close();
      printWindow.focus();
    }
  }
};

export const printTSPLRaw = (tsplString: string, options?: { printerName?: string }) => {
  const targetPrinter = options?.printerName || localStorage.getItem('active_printer') || localStorage.getItem('selected_printer') || 'TSC TE244 Barcode Printer';
  if ((window as any).api) {
    (window as any).api.send('print-tspl-raw', { tsplString, printerName: targetPrinter });
  } else {
    fetch(`${Api}/printers/print-tspl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tsplString, printerName: targetPrinter })
    })
      .then(res => res.json())
      .then(data => {
        console.log('REST raw TSPL print result:', data);
      })
      .catch(err => console.error('REST raw TSPL print error:', err));
  }
};
