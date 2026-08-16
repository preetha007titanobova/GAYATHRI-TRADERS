import type { ReceiptPayload, PrinterConfig } from '../types/receipt';

export interface PrintCartItem {
  itemCode?: string;
  itemDesc: string;
  qty: number;
  rate: number;
  totalAmt: number;
}

export interface PrintReceiptData {
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  paymentMode?: string;
  cashAmount?: number;
  upiAmount?: number;
  totalQty?: number;
  subTotal?: number;
  cgst?: number;
  sgst?: number;
  totalAmount?: number;
  customerMobile?: string;
  storeName?: string;
  storePhone?: string;
  receiptTitle?: string;
  gridData?: any[];
  favourDiscount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  roundOff?: number;
  grandTotal?: number;
  mobileNo?: string;
  invDate?: string;
  buyerName?: string;
  gstNo?: string;
  salesman?: string;
}

export const convertToReceiptPayload = (data: PrintReceiptData): ReceiptPayload => {
  const itemsArr = data.gridData || [];
  const mappedItems = itemsArr.map((item, idx) => ({
    index: idx + 1,
    itemName: item.itemName || item.itemDesc || 'Item',
    qty: Number(item.qty) || 1,
    uom: item.uom,
    baseUnit: item.baseUnit,
    packagings: item.packagings,
    conversionFactor: item.conversionFactor,
    rate: Number(item.rate) || 0,
    amount: Number(item.amount) || Number(item.totalAmt) || 0
  }));

  const subTotalCalc = data.subTotal !== undefined ? data.subTotal : mappedItems.reduce((acc, i) => acc + i.amount, 0);
  const grandTotalCalc = data.grandTotal !== undefined ? data.grandTotal : (data.totalAmount !== undefined ? data.totalAmount : subTotalCalc);

  return {
    storeName: data.storeName || localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || 'SRI GAYATHRI TRADERS',
    storeMobile: data.storePhone || localStorage.getItem('registered_shop_mobile') || localStorage.getItem('close_day_whatsapp') || '',
    gstNo: data.gstNo || localStorage.getItem('shop_gstin') || localStorage.getItem('gst_number') || '',
    salesman: data.salesman || '',
    invoiceNo: data.invoiceNo || '',
    date: data.invDate || data.date || new Date().toISOString().split('T')[0],
    customerName: data.buyerName || data.customerName || 'CASH CUSTOMER',
    customerMobile: data.mobileNo || data.customerMobile || '',
    paymentMode: data.paymentMode || 'Cash',
    cashAmount: data.cashAmount,
    upiAmount: data.upiAmount,
    items: mappedItems,
    totalQty: data.totalQty || mappedItems.reduce((acc, i) => acc + i.qty, 0),
    subTotal: subTotalCalc,
    cgstAmount: data.cgstAmount || data.cgst,
    sgstAmount: data.sgstAmount || data.sgst,
    roundOff: data.roundOff,
    netAmount: grandTotalCalc,
    receiptTitle: data.receiptTitle || 'TAX INVOICE',
    footerNote: 'Thank you for purchasing!\nHave a great day!'
  };
};

export const printReceipt = (data: PrintReceiptData, config?: Partial<PrinterConfig>) => {
  const payload = convertToReceiptPayload(data);

  const savedPrinter = localStorage.getItem('selected_printer') || localStorage.getItem('active_printer') || '';
  const activeConfig: PrinterConfig = {
    engineMode: config?.engineMode || 'silent-chromium',
    paperWidth: config?.paperWidth || '80mm',
    communicationType: config?.communicationType || 'win32-spooler',
    printerName: config?.printerName || savedPrinter || '',
    autoCut: true,
    openCashDrawer: false,
    ...config
  };

  // If Electron API is available, send via IPC channel
  if ((window as any).api && typeof (window as any).api.send === 'function') {
    if (activeConfig.engineMode === 'direct-escpos') {
      (window as any).api.send('print-escpos', { payload, config: activeConfig });
    } else {
      (window as any).api.send('print-receipt', { payload, config: activeConfig });
    }
  } else {
    // Browser fallback print window
    window.print();
  }
};
