export type PrintEngineMode = 'silent-chromium' | 'direct-escpos';
export type PaperWidth = '80mm' | '58mm';
export type CommunicationType = 'win32-spooler' | 'serial' | 'network' | 'network-socket' | 'usb' | (string & {});

export interface ReceiptItem {
  index?: number;
  itemCode?: string;
  itemName: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ReceiptPayload {
  storeName?: string;
  storeMobile?: string;
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  customerMobile?: string;
  paymentMode?: string;
  items: ReceiptItem[];
  totalQty?: number;
  subTotal?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  roundOff?: number;
  netAmount?: number;
  receiptTitle?: string;
  footerNote?: string;
  favourDiscount?: number;
  gstNo?: string;
  salesman?: string;
}

export interface PrinterConfig {
  engineMode: PrintEngineMode;
  paperWidth: PaperWidth;
  communicationType?: CommunicationType | string;
  printerName?: string;
  autoCut?: boolean;
  openCashDrawer?: boolean;
  [key: string]: any;
}
