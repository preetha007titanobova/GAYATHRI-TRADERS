export interface ProductPackaging {
  id: string;
  packagingName: string;
  conversionFactor: number;
  unit: string;
  sellingPrice?: number;
  purchaseRate?: number;
  purchaseAllowed?: boolean;
  salesAllowed?: boolean;
  canBreak?: boolean;
}

export interface Product {
  id?: string;
  itemCode?: string;
  vendorItemCode?: string;
  name: string;
  barcode?: string;
  uom?: string;
  inventoryType?: 'Weight' | 'Volume' | 'Length' | 'Count';
  baseUnit?: string;
  packagings?: ProductPackaging[];
  purchaseRate: number;
  price: number; // Sales Rate
  mrp: number;
  taxPercent: number;
  stock: number; // Physical Stock in Base Unit
  committedStock?: number;
  categoryId?: string;
  department?: string;
  variety?: string;
  size?: string;
  weight?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  id?: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
