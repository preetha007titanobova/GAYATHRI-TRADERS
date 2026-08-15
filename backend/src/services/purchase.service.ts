import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const populateBillWithReturns = async (db: any, bill: any) => {
  const items = await db.collection('PurchaseItem')
    .find({ purchaseBillId: bill._id })
    .toArray();

  // Find linked returns matching originalInvoice equal to bill.voucherNo OR bill.supplierInvoiceNo
  const returns = await db.collection('PurchaseReturn')
    .find({
      $or: [
        { originalInvoice: bill.voucherNo },
        { originalInvoice: bill.supplierInvoiceNo }
      ]
    })
    .toArray();

  const returnIds = returns.map((r: any) => r._id);
  const returnItems = returnIds.length > 0
    ? await db.collection('PurchaseReturnItem').find({ purchaseReturnId: { $in: returnIds } }).toArray()
    : [];

  const returnQtyByItemCode: { [key: string]: number } = {};
  for (const ri of returnItems) {
    const code = (ri.itemCode || '').toUpperCase().trim();
    if (code) {
      returnQtyByItemCode[code] = (returnQtyByItemCode[code] || 0) + (Number(ri.returnQty) || 0);
    }
  }

  let totalReturnedQty = 0;
  let totalReturnedAmt = 0;

  const returnSummaries = returns.map((r: any) => {
    const rAmt = Number(r.netReturnAmount || r.grossTotal || 0);
    totalReturnedAmt += rAmt;
    const rItems = returnItems.filter((ri: any) => ri.purchaseReturnId.toString() === r._id.toString());
    const rQty = rItems.reduce((acc: number, curr: any) => acc + (Number(curr.returnQty) || 0), 0);
    totalReturnedQty += rQty;

    return {
      id: r._id.toString(),
      returnNo: r.returnNo,
      returnDate: r.returnDate ? new Date(r.returnDate).toISOString().split('T')[0] : '',
      reason: r.reason || '',
      netReturnAmount: rAmt,
      itemsCount: rItems.length
    };
  });

  const totalPurchasedQty = items.reduce((acc: number, curr: any) => acc + (Number(curr.qty) || 0) + (Number(curr.freeQty) || 0), 0);
  const netQty = Math.max(0, totalPurchasedQty - totalReturnedQty);

  let returnStatus: 'None' | 'Partially Returned' | 'Fully Returned' = 'None';
  if (totalReturnedQty > 0) {
    returnStatus = netQty <= 0 ? 'Fully Returned' : 'Partially Returned';
  }

  const mappedItems = items.map((item: any) => {
    const code = (item.itemCode || '').toUpperCase().trim();
    const itemRetQty = returnQtyByItemCode[code] || 0;
    const itemPurchasedQty = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
    const itemNetQty = Math.max(0, itemPurchasedQty - itemRetQty);

    return {
      ...item,
      id: item._id.toString(),
      purchaseBillId: item.purchaseBillId.toString(),
      productId: item.productId ? item.productId.toString() : null,
      returnedQty: itemRetQty,
      netQty: itemNetQty
    };
  });

  return {
    ...bill,
    id: bill._id.toString(),
    totalQty: totalPurchasedQty,
    returnedQty: totalReturnedQty,
    netQty: netQty,
    returnedAmt: totalReturnedAmt,
    returnStatus: returnStatus,
    returns: returnSummaries,
    items: mappedItems
  };
};

export const getPurchaseBillById = async (id: string): Promise<any | null> => {
  const db = await getDb();
  let filter: any = {};
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ _id: new ObjectId(id) }, { voucherNo: id }] };
  } else {
    filter = { voucherNo: id };
  }

  const bill = await db.collection('PurchaseBill').findOne(filter);
  if (!bill) return null;

  return await populateBillWithReturns(db, bill);
};

export const createPurchaseBill = async (data: any): Promise<any> => {
  const {
    voucherNo, date, supplierInvoiceNo, supplierInvoiceDate, supplierName, supplierGstin, vendorId,
    taxableAmt, cgst, sgst, igst, otherCharges, discount, roundOff, netPayable,
    status, type, paymentMode, items
  } = data;

  const db = await getDb();

  // 1. Create the PurchaseBill
  const billDoc = {
    voucherNo: voucherNo || `PB-${Date.now()}`,
    date: date ? new Date(date) : new Date(),
    supplierInvoiceNo: supplierInvoiceNo || 'N/A',
    supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate) : null,
    supplierName: supplierName || 'General Supplier',
    supplierGstin: supplierGstin || '',
    vendorId: vendorId || '',
    taxableAmt: Number(taxableAmt) || 0,
    cgst: Number(cgst) || 0,
    sgst: Number(sgst) || 0,
    igst: Number(igst) || 0,
    otherCharges: Number(otherCharges) || 0,
    discount: Number(discount) || 0,
    roundOff: Number(roundOff) || 0,
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
      const freeQty = Number(item.freeQty) || 0;
      const totalQty = qty + freeQty;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const sellingPrice = Number(item.sellingPrice ?? item.salesRate ?? rate) || rate;
      const mrp = Number(item.mrp ?? sellingPrice) || sellingPrice;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const discountVal = Number(item.discount) || (qty * rate * (discPercent / 100));
      const total = Number(item.total) || 0;
      const cgstAmt = Number(item.cgst || item.cgstAmt) || 0;
      const sgstAmt = Number(item.sgst || item.sgstAmt) || 0;
      const igstAmt = Number(item.igst || item.igstAmt) || 0;
      const barcodeStr = item.barcode || item.hsn || '';

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        const escapedCode = escapeRegex(item.itemCode.trim());
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${escapedCode}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;

      if (product) {
        productId = product._id;
        const cleanBarcode = barcodeStr && barcodeStr.trim() !== '' ? barcodeStr.trim() : (product.barcode || null);
        await db.collection('Product').updateOne(
          { _id: product._id },
          {
            $inc: { stock: Math.round(totalQty) },
            $set: {
              purchaseRate: rate,
              price: sellingPrice,
              mrp: mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || 'General',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = barcodeStr && barcodeStr.trim() !== '' ? barcodeStr.trim() : null;
        const newProd = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Purchase Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: sellingPrice,
          mrp: mrp,
          taxPercent: taxPercent,
          stock: Math.round(totalQty),
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
        itemDesc: item.itemDesc || item.itemName || '',
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        weight: item.weight || '',
        unit: item.unit || '',
        barcode: barcodeStr,
        hsn: barcodeStr,
        qty: qty,
        freeQty: freeQty,
        rate: rate,
        unitPrice: rate,
        sellingPrice: sellingPrice,
        salesRate: sellingPrice,
        mrp: mrp,
        taxPercent: taxPercent,
        discPercent: discPercent,
        discount: discountVal,
        cgstAmt: cgstAmt,
        sgstAmt: sgstAmt,
        igstAmt: igstAmt,
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
    const escapedQ = escapeRegex(q);
    query = {
      $or: [
        { voucherNo: { $regex: escapedQ, $options: 'i' } },
        { supplierName: { $regex: escapedQ, $options: 'i' } },
        { supplierInvoiceNo: { $regex: escapedQ, $options: 'i' } }
      ]
    };
  }

  const bills = await db.collection('PurchaseBill')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const populatedBills = [];
  for (const bill of bills) {
    const populated = await populateBillWithReturns(db, bill);
    populatedBills.push(populated);
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
    const freeQty = Number(item.freeQty) || 0;
    const totalQty = qty + freeQty;
    if (totalQty > 0) {
      if (item.productId) {
        await db.collection('Product').updateOne(
          { _id: new ObjectId(item.productId.toString()) },
          { $inc: { stock: -Math.round(totalQty) } }
        );
      } else if (item.itemCode && item.itemCode.trim()) {
        const escapedCode = escapeRegex(item.itemCode.trim());
        await db.collection('Product').updateOne(
          { itemCode: { $regex: `^${escapedCode}$`, $options: 'i' } },
          { $inc: { stock: -Math.round(totalQty) } }
        );
      }
    }
  }

  // 2. Delete old items
  await db.collection('PurchaseItem').deleteMany({ purchaseBillId: billId });

  // 3. Update the PurchaseBill document
  const {
    voucherNo, date, supplierInvoiceNo, supplierInvoiceDate, supplierName, supplierGstin, vendorId,
    taxableAmt, cgst, sgst, igst, otherCharges, discount, roundOff, netPayable,
    status, type, paymentMode, items
  } = data;

  const result = await db.collection('PurchaseBill').updateOne(
    { _id: billId },
    {
      $set: {
        voucherNo: voucherNo || existingBill.voucherNo,
        date: date ? new Date(date) : new Date(),
        supplierInvoiceNo: supplierInvoiceNo || 'N/A',
        supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate) : (existingBill.supplierInvoiceDate || null),
        supplierName: supplierName || existingBill.supplierName,
        supplierGstin: supplierGstin || existingBill.supplierGstin,
        vendorId: vendorId || existingBill.vendorId || '',
        taxableAmt: Number(taxableAmt) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        igst: Number(igst) || 0,
        otherCharges: Number(otherCharges) || 0,
        discount: Number(discount) || 0,
        roundOff: Number(roundOff) || 0,
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
      const freeQty = Number(item.freeQty) || 0;
      const totalQty = qty + freeQty;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const sellingPrice = Number(item.sellingPrice ?? item.salesRate ?? rate) || rate;
      const mrp = Number(item.mrp ?? sellingPrice) || sellingPrice;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const discountVal = Number(item.discount) || (qty * rate * (discPercent / 100));
      const total = Number(item.total) || 0;
      const cgstAmt = Number(item.cgst || item.cgstAmt) || 0;
      const sgstAmt = Number(item.sgst || item.sgstAmt) || 0;
      const igstAmt = Number(item.igst || item.igstAmt) || 0;
      const barcodeStr = item.barcode || item.hsn || '';

      let product: any = null;
      if (item.itemCode && item.itemCode.trim()) {
        const escapedCode = escapeRegex(item.itemCode.trim());
        product = await db.collection('Product').findOne({
          itemCode: { $regex: `^${escapedCode}$`, $options: 'i' }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = product._id;
        const cleanBarcode = barcodeStr && barcodeStr.trim() !== '' ? barcodeStr.trim() : (product.barcode || null);
        await db.collection('Product').updateOne(
          { _id: product._id },
          {
            $inc: { stock: Math.round(totalQty) },
            $set: {
              purchaseRate: rate,
              price: sellingPrice,
              mrp: mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || 'General',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = barcodeStr && barcodeStr.trim() !== '' ? barcodeStr.trim() : null;
        const newProd = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Purchase Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: sellingPrice,
          mrp: mrp,
          taxPercent: taxPercent,
          stock: Math.round(totalQty),
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
        itemDesc: item.itemDesc || item.itemName || '',
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        weight: item.weight || '',
        unit: item.unit || '',
        barcode: barcodeStr,
        hsn: barcodeStr,
        qty: qty,
        freeQty: freeQty,
        rate: rate,
        unitPrice: rate,
        sellingPrice: sellingPrice,
        salesRate: sellingPrice,
        mrp: mrp,
        taxPercent: taxPercent,
        discPercent: discPercent,
        discount: discountVal,
        cgstAmt: cgstAmt,
        sgstAmt: sgstAmt,
        igstAmt: igstAmt,
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
    const freeQty = Number(item.freeQty) || 0;
    const totalQty = qty + freeQty;
    if (totalQty > 0) {
      if (item.productId) {
        await db.collection('Product').updateOne(
          { _id: new ObjectId(item.productId.toString()) },
          { $inc: { stock: -Math.round(totalQty) } }
        );
      } else if (item.itemCode && item.itemCode.trim()) {
        const escapedCode = escapeRegex(item.itemCode.trim());
        await db.collection('Product').updateOne(
          { itemCode: { $regex: `^${escapedCode}$`, $options: 'i' } },
          { $inc: { stock: -Math.round(totalQty) } }
        );
      }
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
