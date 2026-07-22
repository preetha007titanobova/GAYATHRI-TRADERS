import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Ledger } from '../models/ledger.model';

export const getNextLedgerCode = async (): Promise<string> => {
  const lastLedger = await prisma.ledger.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  let nextNum = 1;
  if (lastLedger && lastLedger.ledgerCode) {
    const parts = lastLedger.ledgerCode.split('-');
    const currentNum = parseInt(parts[1]);
    if (!isNaN(currentNum)) {
      nextNum = currentNum + 1;
    }
  }
  return `LDG-${nextNum.toString().padStart(3, '0')}`;
};

export const searchLedgers = async (q: string, group?: string): Promise<Ledger[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query.$or = [
      { accountName: { $regex: q, $options: 'i' } },
      { ledgerCode: { $regex: q, $options: 'i' } }
    ];
  }
  if (group && group.trim() !== '') {
    if (group.toLowerCase().includes('customer') || group.toLowerCase().includes('debtor')) {
      query.accountGroup = { $regex: 'customer|debtor', $options: 'i' };
    } else if (group.toLowerCase().includes('supplier') || group.toLowerCase().includes('creditor')) {
      query.accountGroup = { $regex: 'supplier|creditor', $options: 'i' };
    } else {
      query.accountGroup = { $regex: group, $options: 'i' };
    }
  }
  const items = await db.collection('Ledger').find(query).limit(100).toArray();
  return items.map(item => ({
    ...item,
    id: item._id.toString(),
    _id: item._id.toString()
  })) as unknown as Ledger[];
};

export const createLedger = async (data: Ledger): Promise<any> => {
  const db = await getDb();
  return await db.collection('Ledger').insertOne({
    ...data,
    openingBalance: Number(data.openingBalance) || 0,
    creditLimit: Number(data.creditLimit) || 0,
    defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

export const updateLedger = async (id: string, data: Ledger): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Ledger').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...data,
        openingBalance: Number(data.openingBalance) || 0,
        creditLimit: Number(data.creditLimit) || 0,
        defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0,
        updatedAt: new Date()
      }
    }
  );
  return result.matchedCount > 0;
};

export const deleteLedger = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Ledger').deleteOne({ _id: new ObjectId(id as string) });
  return result.deletedCount > 0;
};

export const getLedgerStatement = async (id: string, fromDateStr: string, toDateStr: string): Promise<any> => {
  const db = await getDb();
  
  const ledger = await db.collection('Ledger').findOne({ _id: new ObjectId(id) });
  if (!ledger) {
    throw new Error('Ledger not found');
  }

  const accountName = ledger.accountName;
  const accountGroup = ledger.accountGroup || '';

  const movements: any[] = [];

  const salesBills = await db.collection('SalesBill').find({}).toArray();
  const salesReturns = await db.collection('SalesReturn').find({}).toArray();
  const purchaseBills = await db.collection('PurchaseBill').find({}).toArray();
  const purchaseReturns = await db.collection('PurchaseReturn').find({}).toArray();
  const shopSalesBills = await db.collection('ShopSalesBill').find({}).toArray();

  const addMovement = (idStr: string, date: Date, particulars: string, vchType: string, vchNo: string, dr: number, cr: number) => {
    movements.push({
      id: idStr,
      date: date.toISOString().split('T')[0],
      dateObj: date,
      particulars,
      vchType,
      vchNo,
      dr: Number(dr) || 0,
      cr: Number(cr) || 0
    });
  };

  if (accountGroup.toLowerCase().includes('customer') || accountGroup.toLowerCase().includes('debtor')) {
    salesBills.forEach((bill: any) => {
      if (bill.buyerName === accountName) {
        const billDate = new Date(bill.invDate || bill.createdAt);
        addMovement(`sales-${bill._id}`, billDate, 'To Sales A/c', 'Sales Bill', bill.invoiceNo, bill.netPayable, 0);
        if (bill.paymentMode?.toLowerCase() === 'cash' || !bill.paymentMode) {
          addMovement(`sales-pay-${bill._id}`, billDate, 'By Cash Receipt', 'Receipt', bill.invoiceNo, 0, bill.netPayable);
        }
      }
    });

    salesReturns.forEach((ret: any) => {
      if (ret.customerName === accountName) {
        const retDate = new Date(ret.returnDate || ret.createdAt);
        addMovement(`sales-ret-${ret._id}`, retDate, 'By Sales Return A/c', 'Sales Return', ret.returnNo, 0, ret.netRefundAmount);
        if (ret.paymentMode?.toLowerCase() === 'cash') {
          addMovement(`sales-ret-pay-${ret._id}`, retDate, 'To Cash Paid', 'Payment', ret.returnNo, ret.netRefundAmount, 0);
        }
      }
    });
  } 
  else if (accountGroup.toLowerCase().includes('supplier') || accountGroup.toLowerCase().includes('creditor')) {
    purchaseBills.forEach((bill: any) => {
      if (bill.supplierName === accountName) {
        const billDate = new Date(bill.date || bill.createdAt);
        addMovement(`purchase-${bill._id}`, billDate, 'By Purchase A/c', 'Purchase Bill', bill.voucherNo, 0, bill.netPayable);
        if (bill.paymentMode?.toLowerCase() === 'cash') {
          addMovement(`purchase-pay-${bill._id}`, billDate, 'To Cash Paid', 'Payment', bill.voucherNo, bill.netPayable, 0);
        }
      }
    });

    purchaseReturns.forEach((ret: any) => {
      if (ret.customerName === accountName) {
        const retDate = new Date(ret.returnDate || ret.createdAt);
        addMovement(`purchase-ret-${ret._id}`, retDate, 'To Purchase Return A/c', 'Purchase Return', ret.returnNo, ret.netReturnAmount, 0);
        if (ret.settlementMode?.toLowerCase() === 'cash') {
          addMovement(`purchase-ret-pay-${ret._id}`, retDate, 'By Cash Receipt', 'Receipt', ret.returnNo, 0, ret.netReturnAmount);
        }
      }
    });
  }
  else if (accountGroup.toLowerCase().includes('shop') || accountGroup.toLowerCase().includes('branch')) {
    shopSalesBills.forEach((bill: any) => {
      if (bill.shopName === accountName) {
        const billDate = new Date(bill.date || bill.createdAt);
        addMovement(`shop-sales-${bill._id}`, billDate, 'To Wholesale Sales A/c', 'Shop Sales Bill', bill.voucherNo, bill.netPayable, 0);
        if (bill.paymentMode?.toLowerCase() === 'cash') {
          addMovement(`shop-sales-pay-${bill._id}`, billDate, 'By Cash Receipt', 'Receipt', bill.voucherNo, 0, bill.netPayable);
        }
      }
    });
  }
  else if (accountGroup.toLowerCase().includes('cash')) {
    salesBills.forEach((bill: any) => {
      if (bill.paymentMode?.toLowerCase() === 'cash' || !bill.paymentMode) {
        const billDate = new Date(bill.invDate || bill.createdAt);
        addMovement(`cash-sale-${bill._id}`, billDate, `To Sales A/c (${bill.buyerName})`, 'Sales Bill', bill.invoiceNo, bill.netPayable, 0);
      }
    });

    salesReturns.forEach((ret: any) => {
      if (ret.paymentMode?.toLowerCase() === 'cash') {
        const retDate = new Date(ret.returnDate || ret.createdAt);
        addMovement(`cash-sale-ret-${ret._id}`, retDate, `By Sales Return (${ret.customerName})`, 'Sales Return', ret.returnNo, 0, ret.netRefundAmount);
      }
    });

    purchaseBills.forEach((bill: any) => {
      if (bill.paymentMode?.toLowerCase() === 'cash') {
        const billDate = new Date(bill.date || bill.createdAt);
        addMovement(`cash-purchase-${bill._id}`, billDate, `By Purchase A/c (${bill.supplierName})`, 'Purchase Bill', bill.voucherNo, 0, bill.netPayable);
      }
    });

    purchaseReturns.forEach((ret: any) => {
      if (ret.settlementMode?.toLowerCase() === 'cash') {
        const retDate = new Date(ret.returnDate || ret.createdAt);
        addMovement(`cash-purchase-ret-${ret._id}`, retDate, `To Purchase Return (${ret.customerName})`, 'Purchase Return', ret.returnNo, ret.netReturnAmount, 0);
      }
    });

    shopSalesBills.forEach((bill: any) => {
      if (bill.paymentMode?.toLowerCase() === 'cash') {
        const billDate = new Date(bill.date || bill.createdAt);
        addMovement(`cash-shop-sale-${bill._id}`, billDate, `To Wholesale Sales (${bill.shopName})`, 'Shop Sales Bill', bill.voucherNo, bill.netPayable, 0);
      }
    });
  }

  movements.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  return {
    ledger: {
      id: ledger._id.toString(),
      ledgerCode: ledger.ledgerCode,
      accountName: ledger.accountName,
      accountGroup: ledger.accountGroup,
      openingBalance: Number(ledger.openingBalance) || 0,
      drCr: ledger.drCr || 'Dr'
    },
    movements
  };
};
