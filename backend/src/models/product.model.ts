export interface Product {
  id?: string;
  itemCode?: string;
  vendorItemCode?: string;
  name: string;
  barcode?: string;
  uom?: string;
  purchaseRate: number;
  price: number; // Sales Rate
  mrp: number;
  taxPercent: number;
  stock: number; // Physical Stock
  committedStock?: number;
  categoryId?: string;
  department?: string;
  variety?: string;
  size?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  id?: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
