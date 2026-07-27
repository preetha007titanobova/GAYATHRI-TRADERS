import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';

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
    voucherNo, date, supplierInvoiceNo, supplierInvoiceDate, supplierName, supplierGstin,
    taxableAmt, cgst, sgst, igst, otherCharges, discount, roundOff, netPayable,
    status, type, paymentMode, items, vendorId
  } = data;

  const db = await getDb();

  // 1. Create the PurchaseBill
  const billDoc = {
    voucherNo,
    date: date ? new Date(date) : new Date(),
    supplierInvoiceNo: supplierInvoiceNo || 'N/A',
    supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate) : null,
    supplierName,
    supplierGstin,
    vendorId: vendorId ? new ObjectId(vendorId) : null,
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
      const rate = Number(item.rate || item.unitPrice || item.purchaseRate) || 0;
      const mrp = Number(item.mrp) || 0;
      const sellingPrice = Number(item.sellingPrice || item.salesRate) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const discountVal = Number(item.discount) || 0;
      const total = Number(item.total) || 0;

      // Check if product exists in DB by itemCode
      let product = null;
      if (item.itemCode) {
        product = await prisma.product.findFirst({
          where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
        });
      }

      let productId: ObjectId | null = null;

      if (product) {
        productId = new ObjectId(product.id);
        // Product exists: update stock, rate, size, variety, department
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              increment: Math.round(qty + freeQty)
            },
            purchaseRate: rate,
            price: sellingPrice ? Number(sellingPrice) : product.price,
            mrp: mrp ? Number(mrp) : product.mrp,
            size: item.size || product.size,
            variety: item.variety || product.variety,
            department: item.category || item.department || product.department,
            factory: item.factory || product.factory,
            vendorItemCode: item.vendorItemCode || product.vendorItemCode,
          }
        });
      } else {
        // Product does not exist: create a new one
        const newProduct = await prisma.product.create({
          data: {
            itemCode: item.itemCode,
            name: item.itemName || item.itemDesc || item.itemCode,
            barcode: item.barcode || item.itemCode, // Default barcode to itemCode
            uom: 'Piece', // Default UOM
            purchaseRate: rate,
            price: Number(sellingPrice || rate),
            mrp: Number(mrp || rate),
            taxPercent: taxPercent,
            stock: Math.round(qty + freeQty),
            department: item.category || item.department || 'None',
            variety: item.variety || '',
            size: item.size || '',
            factory: item.factory || '',
            vendorItemCode: item.vendorItemCode || ''
          }
        });
        productId = new ObjectId(newProduct.id);
      }

      itemsToInsert.push({
        purchaseBillId: purchaseBillId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
        barcode: item.barcode || item.itemCode,
        size: item.size || '',
        variety: item.variety || '',
        color: item.color || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        qty: qty,
        freeQty: freeQty,
        rate: rate,
        mrp: mrp,
        sellingPrice: sellingPrice,
        taxPercent: taxPercent,
        discPercent: discPercent,
        discount: discountVal,
        total: total
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('PurchaseItem').insertMany(itemsToInsert);
    }
  }

  return { id: purchaseBillId.toString(), voucherNo };
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

  // Populate items for each bill
  const populatedBills = [];
  for (const bill of bills) {
    const items = await db.collection('PurchaseItem')
      .find({ purchaseBillId: bill._id })
      .toArray();

    // Map _id to id for frontend compatibility
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
  const billId = new ObjectId(id);

  // 1. Get old items to revert stock
  const oldItems = await db.collection('PurchaseItem').find({ purchaseBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    const freeQty = Number(item.freeQty) || 0;
    if ((qty + freeQty) > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            decrement: Math.round(qty + freeQty)
          }
        }
      });
    }
  }

  // 2. Delete old items
  await db.collection('PurchaseItem').deleteMany({ purchaseBillId: billId });

  // 3. Update the PurchaseBill document
  const {
    voucherNo, date, supplierInvoiceNo, supplierInvoiceDate, supplierName, supplierGstin,
    taxableAmt, cgst, sgst, igst, otherCharges, discount, roundOff, netPayable,
    status, type, paymentMode, items, vendorId
  } = data;

  const result = await db.collection('PurchaseBill').updateOne(
    { _id: billId },
    {
      $set: {
        voucherNo,
        date: date ? new Date(date) : new Date(),
        supplierInvoiceNo: supplierInvoiceNo || 'N/A',
        supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate) : null,
        supplierName,
        supplierGstin,
        vendorId: vendorId ? new ObjectId(vendorId) : null,
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
      const rate = Number(item.rate || item.unitPrice || item.purchaseRate) || 0;
      const mrp = Number(item.mrp) || 0;
      const sellingPrice = Number(item.sellingPrice || item.salesRate) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const discountVal = Number(item.discount) || 0;
      const total = Number(item.total) || 0;

      let product = null;
      if (item.itemCode) {
        product = await prisma.product.findFirst({
          where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = new ObjectId(product.id);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              increment: Math.round(qty + freeQty)
            },
            purchaseRate: rate,
            price: sellingPrice ? Number(sellingPrice) : product.price,
            mrp: mrp ? Number(mrp) : product.mrp,
            size: item.size || product.size,
            variety: item.variety || product.variety,
            department: item.category || item.department || product.department,
            factory: item.factory || product.factory,
            vendorItemCode: item.vendorItemCode || product.vendorItemCode,
          }
        });
      } else {
        const newProduct = await prisma.product.create({
          data: {
            itemCode: item.itemCode,
            name: item.itemName || item.itemDesc || item.itemCode,
            barcode: item.barcode || item.itemCode,
            uom: 'Piece',
            purchaseRate: rate,
            price: Number(sellingPrice || rate),
            mrp: Number(mrp || rate),
            taxPercent: taxPercent,
            stock: Math.round(qty + freeQty),
            department: item.category || item.department || 'None',
            variety: item.variety || '',
            size: item.size || '',
            factory: item.factory || '',
            vendorItemCode: item.vendorItemCode || ''
          }
        });
        productId = new ObjectId(newProduct.id);
      }

      itemsToInsert.push({
        purchaseBillId: billId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
        barcode: item.barcode || item.itemCode,
        size: item.size || '',
        variety: item.variety || '',
        color: item.color || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        qty: qty,
        freeQty: freeQty,
        rate: rate,
        mrp: mrp,
        sellingPrice: sellingPrice,
        taxPercent: taxPercent,
        discPercent: discPercent,
        discount: discountVal,
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
  const billId = new ObjectId(id);

  // Revert stock changes
  const oldItems = await db.collection('PurchaseItem').find({ purchaseBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    const freeQty = Number(item.freeQty) || 0;
    if ((qty + freeQty) > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            decrement: Math.round(qty + freeQty)
          }
        }
      });
    }
  }

  // Delete items
  await db.collection('PurchaseItem').deleteMany({ purchaseBillId: billId });

  // Delete bill
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
    returnNo,
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

      // Decrement stock in DB since we are returning products to vendor
      let product = null;
      if (item.itemCode) {
        product = await prisma.product.findFirst({
          where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = new ObjectId(product.id);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: Math.round(returnQty)
            }
          }
        });
      }

      itemsToInsert.push({
        purchaseReturnId: purchaseReturnId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
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

  return { id: purchaseReturnId.toString(), returnNo };
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
  const returnId = new ObjectId(id);

  // 1. Revert previous stock changes (increment stock)
  const oldItems = await db.collection('PurchaseReturnItem').find({ purchaseReturnId: returnId }).toArray();
  for (const item of oldItems) {
    const returnQty = Number(item.returnQty) || 0;
    if (returnQty > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            increment: Math.round(returnQty)
          }
        }
      });
    }
  }

  // 2. Delete old items
  await db.collection('PurchaseReturnItem').deleteMany({ purchaseReturnId: returnId });

  // 3. Update main record
  const {
    returnNo, returnDate, originalInvoice, customerName, reason,
    settlementMode, grossTotal, cgst, sgst, igst, roundOff, netReturnAmount, items
  } = data;

  const result = await db.collection('PurchaseReturn').updateOne(
    { _id: returnId },
    {
      $set: {
        returnNo,
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

  // 4. Insert new items and update stock
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const returnQty = Number(item.returnQty) || 0;
      if (returnQty <= 0) continue;

      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const totalAmt = Number(item.totalAmt) || 0;

      let product = null;
      if (item.itemCode) {
        product = await prisma.product.findFirst({
          where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
        });
      }

      let productId: ObjectId | null = null;
      if (product) {
        productId = new ObjectId(product.id);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: Math.round(returnQty)
            }
          }
        });
      }

      itemsToInsert.push({
        purchaseReturnId: returnId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
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
  const returnId = new ObjectId(id);

  // Revert stock changes
  const oldItems = await db.collection('PurchaseReturnItem').find({ purchaseReturnId: returnId }).toArray();
  for (const item of oldItems) {
    const returnQty = Number(item.returnQty) || 0;
    if (returnQty > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            increment: Math.round(returnQty)
          }
        }
      });
    }
  }

  // Delete items
  await db.collection('PurchaseReturnItem').deleteMany({ purchaseReturnId: returnId });

  // Delete return bill
  const result = await db.collection('PurchaseReturn').deleteOne({ _id: returnId });
  return result.deletedCount > 0;
};
