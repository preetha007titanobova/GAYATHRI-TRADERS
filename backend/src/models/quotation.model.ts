export interface Quotation {
  id?: string;
  quoteNo: string;
  quoteDate: Date;
  customer: string;
  totalAmount: number;
  items?: QuotationItem[];
  createdAt?: Date;
}

export interface QuotationItem {
  id?: string;
  quotationId?: string;
  itemCode?: string;
  itemDescription?: string;
  quantity: number;
  unitPrice: number;
}
