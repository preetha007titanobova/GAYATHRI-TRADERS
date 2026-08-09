import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';

export const getNextPurchaseVoucher = async (): Promise<string> => {
  const db = await getDb();
  const lastBill = await db.collection('PurchaseBill')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  let nextNum = 1001;
  if (lastBill && lastBill.voucherNo && lastBill.voucherNo.startsWith('PB-')) {
    const parts = lastBill.voucherNo.split('-');
    const parsed = parseInt(parts[1] || '1000');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `PB-${nextNum}`;
};

export const createPurchaseBill = async (data: any): Promise<any> => {
  const {
    voucherNo, date, supplierInvoiceNo, supplierName, supplierGstin,
    taxableAmt, cgst, sgst, igst, otherCharges, netPayable,
    status, type, paymentMode, items
  } = data;

  const db = await getDb();

  // 1. Create the PurchaseBill
  const billDoc = {
    voucherNo: voucherNo || `PB-${Date.now()}`,
    date: date ? new Date(date) : new Date(),
    supplierInvoiceNo: supplierInvoiceNo || 'N/A',
    supplierName: supplierName || 'General Supplier',
    supplierGstin: supplierGstin || '',
    taxableAmt: Number(taxableAmt) || 0,
    cgst: Number(cgst) || 0,
    sgst: Number(sgst) || 0,
    igst: Number(igst) || 0,
    otherCharges: Number(otherCharges) || 0,
    netPayable: Number(netPayable) || 0,
    status: status || 'Paid',
    type: type || 'Local',
    paymentMode: paymentMode || 'Cash',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const billResult = await db.collection('PurchaseBill').insertOne(billDoc);
  const purchaseBillId = billResult.insertedId;

  // 2. Process each item
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const qty = Number(item.qty || item.purchasedQty) || 0;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const total = Number(item.total) || 0;

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${item.itemCode.trim()}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;

      if (product) {
        productId = product._id;
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : (product.barcode || null);
        await db.collection('Product').updateOne(
          { _id: product._id },
          {
            $inc: { stock: Math.round(qty) },
            $set: {
              purchaseRate: rate,
              price: item.salesRate ? Number(item.salesRate) : product.price,
              mrp: item.mrp ? Number(item.mrp) : product.mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || 'General',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : null;
        const newProd = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Purchase Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: Number(item.salesRate || rate),
          mrp: Number(item.mrp || rate),
          taxPercent: taxPercent,
          stock: Math.round(qty),
          category: item.category || item.department || 'General',
          vendorItemCode: item.vendorItemCode || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        productId = newProd.insertedId;
      }

      itemsToInsert.push({
        purchaseBillId: purchaseBillId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        weight: item.weight || '',
        qty: qty,
        rate: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        total: total
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('PurchaseItem').insertMany(itemsToInsert);
    }
  }

  return { id: purchaseBillId.toString(), voucherNo: billDoc.voucherNo };
};

export const searchPurchaseBills = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query = {
      $or: [
        { voucherNo: { $regex: q, $options: 'i' } },
        { supplierName: { $regex: q, $options: 'i' } },
        { supplierInvoiceNo: { $regex: q, $options: 'i' } }
      ]
    };
  }

  const bills = await db.collection('PurchaseBill')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const populatedBills = [];
  for (const bill of bills) {
    const items = await db.collection('PurchaseItem')
      .find({ purchaseBillId: bill._id })
      .toArray();

    populatedBills.push({
      ...bill,
      id: bill._id.toString(),
      items: items.map(item => ({
        ...item,
        id: item._id.toString(),
        purchaseBillId: item.purchaseBillId.toString(),
        productId: item.productId ? item.productId.toString() : null
      }))
    });
  }

  return populatedBills;
};

export const updatePurchaseBill = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  let filter: any = {};
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ _id: new ObjectId(id) }, { voucherNo: id }] };
  } else {
    filter = { voucherNo: id };
  }

  const existingBill = await db.collection('PurchaseBill').findOne(filter);
  if (!existingBill) return false;
  const billId = existingBill._id;

  // 1. Get old items to revert stock
  const oldItems = await db.collection('PurchaseItem').find({ purchaseBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: -Math.round(qty) } }
      );
    }
  }

  // 2. Delete old items
  await db.collection('PurchaseItem').deleteMany({ purchaseBillId: billId });

  // 3. Update the PurchaseBill document
  const {
    voucherNo, date, supplierInvoiceNo, supplierName, supplierGstin,
    taxableAmt, cgst, sgst, igst, otherCharges, netPayable,
    status, type, paymentMode, items
  } = data;

  const result = await db.collection('PurchaseBill').updateOne(
    { _id: billId },
    {
      $set: {
        voucherNo: voucherNo || existingBill.voucherNo,
        date: date ? new Date(date) : new Date(),
        supplierInvoiceNo: supplierInvoiceNo || 'N/A',
        supplierName: supplierName || existingBill.supplierName,
        supplierGstin: supplierGstin || existingBill.supplierGstin,
        taxableAmt: Number(taxableAmt) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        igst: Number(igst) || 0,
        otherCharges: Number(otherCharges) || 0,
        netPayable: Number(netPayable) || 0,
        status: status || 'Paid',
        type: type || 'Local',
        paymentMode: paymentMode || 'Cash',
        updatedAt: new Date()
      }
    }
  );

  // 4. Insert new items and update stock
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const qty = Number(item.qty || item.purchasedQty) || 0;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const total = Number(item.total) || 0;

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${item.itemCode.trim()}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = product._id;
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : (product.barcode || null);
        await db.collection('Product').updateOne(
          { _id: product._id },
          {
            $inc: { stock: Math.round(qty) },
            $set: {
              purchaseRate: rate,
              price: item.salesRate ? Number(item.salesRate) : product.price,
              mrp: item.mrp ? Number(item.mrp) : product.mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || 'General',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : null;
        const newProd = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Purchase Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: Number(item.salesRate || rate),
          mrp: Number(item.mrp || rate),
          taxPercent: taxPercent,
          stock: Math.round(qty),
          category: item.category || item.department || 'General',
          vendorItemCode: item.vendorItemCode || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        productId = newProd.insertedId;
      }

      itemsToInsert.push({
        purchaseBillId: billId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        weight: item.weight || '',
        qty: qty,
        rate: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        total: total
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('PurchaseItem').insertMany(itemsToInsert);
    }
  }

  return result.matchedCount > 0;
};

export const deletePurchaseBill = async (id: string): Promise<boolean> => {
  const db = await getDb();
  let filter: any = {};
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ _id: new ObjectId(id) }, { voucherNo: id }] };
  } else {
    filter = { voucherNo: id };
  }

  const existingBill = await db.collection('PurchaseBill').findOne(filter);
  if (!existingBill) return false;
  const billId = existingBill._id;

  // Revert stock changes
  const oldItems = await db.collection('PurchaseItem').find({ purchaseBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: -Math.round(qty) } }
      );
    }
  }

  await db.collection('PurchaseItem').deleteMany({ purchaseBillId: billId });
  const result = await db.collection('PurchaseBill').deleteOne({ _id: billId });
  return result.deletedCount > 0;
};

export const getNextPurchaseReturnVoucher = async (): Promise<string> => {
  const db = await getDb();
  const lastReturn = await db.collection('PurchaseReturn')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  let nextNum = 1001;
  if (lastReturn && lastReturn.returnNo && lastReturn.returnNo.startsWith('PR-')) {
    const parts = lastReturn.returnNo.split('-');
    const parsed = parseInt(parts[1] || '1000');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `PR-${nextNum}`;
};

export const createPurchaseReturn = async (data: any): Promise<any> => {
  const db = await getDb();
  const {
    returnNo, returnDate, originalInvoice, customerName, reason,
    settlementMode, grossTotal, cgst, sgst, igst, roundOff, netReturnAmount, items
  } = data;

  const returnDoc = {
    returnNo: returnNo || `PR-${Date.now()}`,
    returnDate: returnDate ? new Date(returnDate) : new Date(),
    originalInvoice: originalInvoice || 'N/A',
    customerName: customerName || 'General Supplier',
    reason: reason || '',
    settlementMode: settlementMode || 'Cash',
    grossTotal: Number(grossTotal) || 0,
    cgst: Number(cgst) || 0,
    sgst: Number(sgst) || 0,
    igst: Number(igst) || 0,
    roundOff: Number(roundOff) || 0,
    netReturnAmount: Number(netReturnAmount) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const returnResult = await db.collection('PurchaseReturn').insertOne(returnDoc);
  const purchaseReturnId = returnResult.insertedId;

  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const returnQty = Number(item.returnQty) || 0;
      if (returnQty <= 0) continue;

      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const totalAmt = Number(item.totalAmt) || 0;

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${item.itemCode.trim()}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = product._id;
        await db.collection('Product').updateOne(
          { _id: product._id },
          { $inc: { stock: -Math.round(returnQty) } }
        );
      }

      itemsToInsert.push({
        purchaseReturnId: purchaseReturnId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
        batchNo: item.batchNo || 'N/A',
        purchasedQty: Number(item.purchasedQty) || 0,
        returnQty: returnQty,
        unitPrice: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        totalAmt: totalAmt
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('PurchaseReturnItem').insertMany(itemsToInsert);
    }
  }

  return { id: purchaseReturnId.toString(), returnNo: returnDoc.returnNo };
};

export const searchPurchaseReturns = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query = {
      $or: [
        { returnNo: { $regex: q, $options: 'i' } },
        { customerName: { $regex: q, $options: 'i' } },
        { originalInvoice: { $regex: q, $options: 'i' } }
      ]
    };
  }

  const returns = await db.collection('PurchaseReturn')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const populatedReturns = [];
  for (const ret of returns) {
    const items = await db.collection('PurchaseReturnItem')
      .find({ purchaseReturnId: ret._id })
      .toArray();

    populatedReturns.push({
      ...ret,
      id: ret._id.toString(),
      items: items.map(item => ({
        ...item,
        id: item._id.toString(),
        purchaseReturnId: item.purchaseReturnId.toString(),
        productId: item.productId ? item.productId.toString() : null
      }))
    });
  }

  return populatedReturns;
};

export const updatePurchaseReturn = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  let filter: any = {};
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ _id: new ObjectId(id) }, { returnNo: id }] };
  } else {
    filter = { returnNo: id };
  }

  const existingReturn = await db.collection('PurchaseReturn').findOne(filter);
  if (!existingReturn) return false;
  const returnId = existingReturn._id;

  const oldItems = await db.collection('PurchaseReturnItem').find({ purchaseReturnId: returnId }).toArray();
  for (const item of oldItems) {
    const returnQty = Number(item.returnQty) || 0;
    if (returnQty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: Math.round(returnQty) } }
      );
    }
  }

  await db.collection('PurchaseReturnItem').deleteMany({ purchaseReturnId: returnId });

  const {
    returnNo, returnDate, originalInvoice, customerName, reason,
    settlementMode, grossTotal, cgst, sgst, igst, roundOff, netReturnAmount, items
  } = data;

  const result = await db.collection('PurchaseReturn').updateOne(
    { _id: returnId },
    {
      $set: {
        returnNo: returnNo || existingReturn.returnNo,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        originalInvoice,
        customerName,
        reason,
        settlementMode,
        grossTotal: Number(grossTotal) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        igst: Number(igst) || 0,
        roundOff: Number(roundOff) || 0,
        netReturnAmount: Number(netReturnAmount) || 0,
        updatedAt: new Date()
      }
    }
  );

  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const returnQty = Number(item.returnQty) || 0;
      if (returnQty <= 0) continue;

      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const totalAmt = Number(item.totalAmt) || 0;

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${item.itemCode.trim()}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = product._id;
        await db.collection('Product').updateOne(
          { _id: product._id },
          { $inc: { stock: -Math.round(returnQty) } }
        );
      }

      itemsToInsert.push({
        purchaseReturnId: returnId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
        batchNo: item.batchNo || 'N/A',
        purchasedQty: Number(item.purchasedQty) || 0,
        returnQty: returnQty,
        unitPrice: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        totalAmt: totalAmt
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('PurchaseReturnItem').insertMany(itemsToInsert);
    }
  }

  return result.matchedCount > 0;
};

export const deletePurchaseReturn = async (id: string): Promise<boolean> => {
  const db = await getDb();
  let filter: any = {};
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ _id: new ObjectId(id) }, { returnNo: id }] };
  } else {
    filter = { returnNo: id };
  }

  const existingReturn = await db.collection('PurchaseReturn').findOne(filter);
  if (!existingReturn) return false;
  const returnId = existingReturn._id;

  const oldItems = await db.collection('PurchaseReturnItem').find({ purchaseReturnId: returnId }).toArray();
  for (const item of oldItems) {
    const returnQty = Number(item.returnQty) || 0;
    if (returnQty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: Math.round(returnQty) } }
      );
    }
  }

  await db.collection('PurchaseReturnItem').deleteMany({ purchaseReturnId: returnId });
  const result = await db.collection('PurchaseReturn').deleteOne({ _id: returnId });
  return result.deletedCount > 0;
};
