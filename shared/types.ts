export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  stock: number;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesBill {
  id: string;
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

  items: SalesItem[];
  createdAt: Date;
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
