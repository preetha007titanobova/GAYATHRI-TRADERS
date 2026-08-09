export interface PrinterStatusInfo {
  activePrinter: string | null;
  isConnected: boolean;
  selectionType: string;
  allPrinters: Array<{ name: string; isDefault: boolean }>;
}

export const getPrinterStatus = (callback: (status: PrinterStatusInfo) => void): (() => void) => {
  if ((window as any).api) {
    (window as any).api.receive('printer-status-response', (event: any, status: PrinterStatusInfo) => {
      callback(status);
    });
    (window as any).api.send('get-printer-status');

    return () => {
      // In this setup, preload receives removeAllListeners on next mount, but we provide empty cleanup
    };
  } else {
    // Browser mock fallback
    callback({
      activePrinter: 'DEV-MODE-MOCK-PRINTER',
      isConnected: true,
      selectionType: 'Dev Mock',
      allPrinters: [{ name: 'DEV-MODE-MOCK-PRINTER', isDefault: true }]
    });
    return () => {};
  }
};

export const detectPrinters = (callback: (result: { success: boolean; activePrinter: string | null; isConnected: boolean; selectionType: string }) => void) => {
  if ((window as any).api) {
    (window as any).api.receive('detect-printers-response', (event: any, result: any) => {
      callback(result);
    });
    (window as any).api.send('detect-printers');
  } else {
    // Browser mock
    callback({
      success: true,
      activePrinter: 'DEV-MODE-MOCK-PRINTER',
      isConnected: true,
      selectionType: 'Dev Mock Reset'
    });
  }
};

export const setActivePrinter = (name: string, callback: (result: { success: boolean; activePrinter?: string; error?: string }) => void) => {
  if ((window as any).api) {
    (window as any).api.receive('save-printer-response', (event: any, result: any) => {
      callback(result);
    });
    (window as any).api.send('set-active-printer', name);
  } else {
    // Browser mock
    callback({ success: true, activePrinter: name });
  }
};

export const printHTML = (htmlContent: string, options?: { showDialog?: boolean; landscape?: boolean }) => {
  if ((window as any).api) {
    (window as any).api.send('print-html', htmlContent, options);
  } else {
    console.log('Dev Mode Print HTML payload:', htmlContent, options);
  }
};

export const printTSPLRaw = (tsplString: string, options?: { printerName?: string }) => {
  if ((window as any).api) {
    (window as any).api.send('print-tspl-raw', tsplString, options);
  } else {
    console.log('Dev Mode Print TSPL payload:', tsplString, options);
  }
};
