export interface SalesBill {
  id?: string;
  invoiceNo: string;
  invDate: Date;
  payDays: number;
  buyerName: string;
  address?: string;
  eType: string;
  mobileNo?: string;
  gstNo?: string;
  printIn?: string;
  invFormat?: string;
  totalQty: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  netAmount: number;
  remarks?: string;
  shippingAddress?: string;
  salesman?: string;
  paymentMode?: string;
  userId?: string;
  items?: SalesItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SalesItem {
  id?: string;
  salesBillId?: string;
  productId?: string;
  itemName: string;
  itemDesc?: string;
  qty: number;
  uom?: string;
  rate: number;
  discPercent: number;
  discAmt: number;
  amount: number;
}

export interface SalesOrder {
  id?: string;
  orderNo: string;
  orderDate: Date;
  customer: string;
  deliveryDate?: Date;
  paymentTerms?: string;
  status: 'OPEN' | 'PENDING' | 'FULFILLED' | 'CANCELLED';
  isInterstate: boolean;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  summary?: string;
  items?: SalesOrderItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SalesOrderItem {
  id?: string;
  salesOrderId?: string;
  lineId?: string;
  lineIndex?: number;
  productId?: string;
  itemCode?: string;
  itemDescription?: string;
  quantityOrdered: number;
  quantityFulfilled: number;
  unitPrice: number;
  discountPercentage: number;
  taxableAmount: number;
  taxRatePercentage: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineSubTotal: number;
}

export interface SalesReturn {
  id?: string;
  returnNo: string;
  returnDate: Date;
  originalInvoice: string;
  customerName: string;
  reason: string;
  totalReturnAmount: number;
  cgstReturn: number;
  sgstReturn: number;
  igstReturn: number;
  roundOff: number;
  netRefundAmount: number;
  userId?: string;
  items?: SalesReturnItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SalesReturnItem {
  id?: string;
  salesReturnId?: string;
  productId?: string;
  itemCode?: string;
  itemName: string;
  invoicedQty: number;
  returnQty: number;
  unitPrice: number;
  taxableAmt: number;
  taxPercent: number;
  disposition: string;
  subtotal: number;
}
