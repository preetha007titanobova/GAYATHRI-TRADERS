export interface Ledger {
  id?: string;
  ledgerCode: string;
  accountName: string;
  alias?: string;
  accountGroup: string;
  contactPerson?: string;
  mobileNo?: string;
  email?: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNo?: string;
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  openingBalance: number;
  drCr: string;
  creditLimit: number;
  defaultCreditPeriod?: number;
  registrationType?: string;
  isRegular?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
