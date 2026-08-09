import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';

export const getNextInvoice = async (): Promise<string> => {
  const lastBill = await prisma.salesBill.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let nextNum = 1;
  if (lastBill && lastBill.invoiceNo.startsWith('INV-')) {
    const parts = lastBill.invoiceNo.split('-');
    const parsed = parseInt(parts[2] || '0');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const year = new Date().getFullYear();
  return `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
};

export const createSalesBill = async (data: any): Promise<any> => {
  const {
    invoiceNo, invDate, payDays, buyerName, address, eType,
    mobileNo, gstNo, printIn, invFormat, invoiceFormat, totalQty, totalAmount,
    cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode,
    fromSalesOrderId
  } = data;

  const db = await getDb();

  const billResult = await db.collection('SalesBill').insertOne({
    invoiceNo,
    invDate: new Date(invDate),
    payDays: Number(payDays) || 0,
    buyerName,
    address,
    eType,
    mobileNo,
    gstNo,
    printIn,
    invFormat: invFormat || invoiceFormat,
    totalQty: Number(totalQty) || 0,
    totalAmount: Number(totalAmount) || 0,
    cgst: Number(cgst) || 0,
    sgst: Number(sgst) || 0,
    roundOff: Number(roundOff) || 0,
    netAmount: Number(netAmount) || 0,
    remarks,
    shippingAddress,
    salesman,
    paymentMode: paymentMode || 'Cash',
    fromSalesOrderId: fromSalesOrderId ? new ObjectId(fromSalesOrderId as string) : null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      let productId = item.productId ? new ObjectId(item.productId as string) : null;
      let product = null;
      if (productId) {
        product = await prisma.product.findUnique({
          where: { id: productId.toString() }
        });
      }
      if (!product && item.itemDesc) {
        product = await prisma.product.findFirst({
          where: {
            OR: [
              { itemCode: item.itemDesc },
              { barcode: item.itemDesc }
            ]
          }
        });
      }
      if (!product && item.itemName) {
        product = await prisma.product.findFirst({
          where: { name: item.itemName }
        });
      }

      const qty = Number(item.qty) || 0;
      if (product) {
        productId = new ObjectId(product.id);
        if (qty > 0) {
          const currentStock = Number(product.stock) || 0;
          const updatedStock = Math.max(0, currentStock - Math.round(qty));
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: updatedStock }
          });
          await db.collection('Product').updateOne(
            { _id: new ObjectId(product.id) },
            { $set: { stock: updatedStock } }
          );
        }
      } else {
        if (qty > 0 && item.itemName) {
          const p = await db.collection('Product').findOne({ name: item.itemName });
          if (p) {
            const currentStock = Number(p.stock) || 0;
            const updatedStock = Math.max(0, currentStock - Math.round(qty));
            await db.collection('Product').updateOne(
              { _id: p._id },
              { $set: { stock: updatedStock } }
            );
          }
        }
      }

      // If this bill is generated from a Sales Order, update unfulfilled quantity
      if (fromSalesOrderId) {
        const orderItem = await prisma.salesOrderItem.findFirst({
          where: {
            salesOrderId: fromSalesOrderId,
            OR: [
              { productId: productId?.toString() },
              { itemCode: item.itemCode || item.itemDesc },
              { itemName: item.itemName }
            ]
          }
        });

        if (orderItem) {
          const newDelivered = Math.min(orderItem.orderedQty, orderItem.deliveredQty + qty);
          const newPending = Math.max(0, orderItem.orderedQty - newDelivered);
          await prisma.salesOrderItem.update({
            where: { id: orderItem.id },
            data: {
              deliveredQty: newDelivered,
              pendingQty: newPending
            }
          });
        }
      }

      itemsToInsert.push({
        salesBillId: billResult.insertedId,
        itemName: item.itemName,
        itemDesc: item.itemDesc,
        size: item.size || product?.size || null,
        qty: qty,
        uom: item.uom,
        rate: Number(item.rate) || 0,
        discPercent: Number(item.discPercent) || 0,
        discAmt: Number(item.discAmt) || 0,
        amount: Number(item.amount) || 0,
        productId: productId
      });
    }
    await db.collection('SalesItem').insertMany(itemsToInsert);
  }

  // Update overall Sales Order status based on all items' remaining pending quantities
  if (fromSalesOrderId) {
    const remainingItems = await prisma.salesOrderItem.findMany({
      where: { salesOrderId: fromSalesOrderId }
    });
    const totalPending = remainingItems.reduce((sum, it) => sum + it.pendingQty, 0);
    const totalDelivered = remainingItems.reduce((sum, it) => sum + it.deliveredQty, 0);

    let newStatus = 'Open';
    if (totalPending === 0) {
      newStatus = 'Completed';
    } else if (totalDelivered > 0) {
      newStatus = 'Partial';
    }

    await db.collection('SalesOrder').updateOne(
      { _id: new ObjectId(fromSalesOrderId as string) },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );
  }

  return { id: billResult.insertedId.toString(), invoiceNo };
};

export const updateSalesBill = async (id: string, data: any): Promise<boolean> => {
  const {
    invoiceNo, invDate, payDays, buyerName, address, eType,
    mobileNo, gstNo, printIn, invFormat, invoiceFormat, totalQty, totalAmount,
    cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode
  } = data;

  const db = await getDb();
  const billId = new ObjectId(id as string);

  // Revert old stock changes
  const oldItems = await db.collection('SalesItem').find({ salesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0) {
      if (item.productId) {
        await prisma.product.updateMany({
          where: { id: item.productId.toString() },
          data: {
            stock: {
              increment: Math.round(qty)
            }
          }
        });
      } else if (item.itemName) {
        await prisma.product.updateMany({
          where: { name: item.itemName },
          data: {
            stock: {
              increment: Math.round(qty)
            }
          }
        });
      }
    }
  }

  const billResult = await db.collection('SalesBill').updateOne(
    { _id: billId },
    {
      $set: {
        invoiceNo,
        invDate: new Date(invDate),
        payDays: Number(payDays) || 0,
        buyerName,
        address,
        eType,
        mobileNo,
        gstNo,
        printIn,
        invFormat: invFormat || invoiceFormat,
        totalQty: Number(totalQty) || 0,
        totalAmount: Number(totalAmount) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        roundOff: Number(roundOff) || 0,
        netAmount: Number(netAmount) || 0,
        remarks,
        shippingAddress,
        salesman,
        paymentMode: paymentMode || 'Cash',
        updatedAt: new Date()
      }
    }
  );

  if (billResult.matchedCount === 0) {
    return false;
  }

  // Delete existing items
  await db.collection('SalesItem').deleteMany({ salesBillId: billId });

  // Insert new items and reduce stock
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      let productId = item.productId ? new ObjectId(item.productId as string) : null;
      let product = null;
      if (productId) {
        product = await prisma.product.findUnique({
          where: { id: productId.toString() }
        });
      }
      if (!product && item.itemDesc) {
        product = await prisma.product.findFirst({
          where: {
            OR: [
              { itemCode: item.itemDesc },
              { barcode: item.itemDesc }
            ]
          }
        });
      }
      if (!product && item.itemName) {
        product = await prisma.product.findFirst({
          where: { name: item.itemName }
        });
      }

      const qty = Number(item.qty) || 0;
      if (product) {
        productId = new ObjectId(product.id);
        if (qty > 0) {
          await prisma.product.updateMany({
            where: { id: product.id },
            data: {
              stock: {
                decrement: Math.round(qty)
              }
            }
          });
        }
      } else {
        if (qty > 0 && item.itemName) {
          await prisma.product.updateMany({
            where: { name: item.itemName },
            data: {
              stock: {
                decrement: Math.round(qty)
              }
            }
          });
        }
      }

      itemsToInsert.push({
        salesBillId: billId,
        itemName: item.itemName,
        itemDesc: item.itemDesc,
        size: item.size || product?.size || null,
        qty: qty,
        uom: item.uom,
        rate: Number(item.rate) || 0,
        discPercent: Number(item.discPercent) || 0,
        discAmt: Number(item.discAmt) || 0,
        amount: Number(item.amount) || 0,
        productId: productId
      });
    }
    await db.collection('SalesItem').insertMany(itemsToInsert);
  }

  return true;
};

export const deleteSalesBill = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const billId = new ObjectId(id as string);

  // Revert stock changes first
  const oldItems = await db.collection('SalesItem').find({ salesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0) {
      if (item.productId) {
        await prisma.product.updateMany({
          where: { id: item.productId.toString() },
          data: {
            stock: {
              increment: Math.round(qty)
            }
          }
        });
      } else if (item.itemName) {
        await prisma.product.updateMany({
          where: { name: item.itemName },
          data: {
            stock: {
              increment: Math.round(qty)
            }
          }
        });
      }
    }
  }

  await db.collection('SalesItem').deleteMany({ salesBillId: billId });
  const result = await db.collection('SalesBill').deleteOne({ _id: billId });
  return result.deletedCount > 0;
};

export const searchSalesBills = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query.$or = [
      { invoiceNo: { $regex: q, $options: 'i' } },
      { buyerName: { $regex: q, $options: 'i' } },
      { paymentMode: { $regex: q, $options: 'i' } },
      { mobileNo: { $regex: q, $options: 'i' } }
    ];
  }
  let cursor = db.collection('SalesBill').find(query).sort({ createdAt: -1 });
  if (!q) {
    cursor = cursor.limit(100);
  }
  return await cursor.toArray();
};

export const getSalesBillByInvoiceNo = async (invoiceNo: string): Promise<any> => {
  const db = await getDb();
  const bill = await db.collection('SalesBill').findOne({ invoiceNo });
  if (!bill) return null;
  const items = await db.collection('SalesItem').find({ salesBillId: bill._id }).toArray();
  const itemsWithDetails = [];
  for (const item of items) {
    let barcode = '';
    let size = item.size || '';
    let prod = null;
    if (item.productId) {
      prod = await db.collection('Product').findOne({ _id: new ObjectId(item.productId as string) });
    }
    if (!prod && item.itemDesc) {
      prod = await db.collection('Product').findOne({ itemCode: item.itemDesc });
    }
    if (!prod && item.itemName) {
      prod = await db.collection('Product').findOne({ name: item.itemName });
    }
    if (prod) {
      barcode = prod.barcode || prod.itemCode || '';
      if (!size) size = prod.size || '';
    }
    itemsWithDetails.push({ ...item, barcode, size: size || '-' });
  }
  return { ...bill, items: itemsWithDetails };
};



export const getNextSalesReturnSequence = async (): Promise<string> => {
  const db = await getDb();
  const lastReturn = await db.collection('SalesReturn').find().sort({ createdAt: -1 }).limit(1).toArray();

  let nextNum = 1;
  if (lastReturn && lastReturn.length > 0 && lastReturn[0].returnNo && lastReturn[0].returnNo.startsWith('CN-')) {
    const parts = lastReturn[0].returnNo.split('-');
    const parsed = parseInt(parts[2] || '0');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const today = new Date();
  const month = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

  return `CN-${fy}-${nextNum.toString().padStart(4, '0')}`;
};

export const createSalesReturn = async (data: any): Promise<any> => {
  const {
    returnNo, returnDate, originalInvoice, customerName, reason, returnType,
    totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items,
    extraReceived, refundAmount, paymentMode, refundMethod, replacementItems
  } = data;

  const db = await getDb();

  const returnResult = await db.collection('SalesReturn').insertOne({
    returnNo,
    returnDate: new Date(returnDate),
    originalInvoice,
    customerName,
    reason,
    returnType: returnType || 'Credit Note (Refund)',
    totalReturnAmount: Number(totalReturnAmount) || 0,
    cgstReturn: Number(cgstReturn) || 0,
    sgstReturn: Number(sgstReturn) || 0,
    igstReturn: Number(igstReturn) || 0,
    roundOff: Number(roundOff) || 0,
    netRefundAmount: Number(netRefundAmount) || 0,
    extraReceived: Number(extraReceived) || 0,
    refundAmount: Number(refundAmount) || 0,
    paymentMode: paymentMode || 'Cash',
    refundMethod: refundMethod || 'Cash',
    replacementItems: replacementItems || [],
    createdAt: new Date()
  });

  if (items && items.length > 0) {
    const itemsToInsert = items.map((item: any) => ({
      salesReturnId: returnResult.insertedId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      invoicedQty: Number(item.invoicedQty) || 0,
      returnQty: Number(item.returnQty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxableAmt: Number(item.taxableAmt) || 0,
      taxPercent: Number(item.taxPercent) || 0,
      disposition: item.disposition,
      subtotal: Number(item.subtotal) || 0,
      productId: item.productId ? new ObjectId(item.productId as string) : null
    }));
    await db.collection('SalesReturnItem').insertMany(itemsToInsert);

    for (const item of itemsToInsert) {
      if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
        if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
          // Increment damagedStock in MongoDB directly
          await db.collection('Product').updateOne(
            { $or: [{ itemCode: item.itemCode }, { name: item.itemName }] },
            { $inc: { damagedStock: item.returnQty } }
          );
        } else {
          // Default or Return to Warehouse: increment normal stock
          await prisma.product.updateMany({
            where: {
              OR: [
                { itemCode: item.itemCode },
                { name: item.itemName }
              ]
            },
            data: {
              stock: {
                increment: item.returnQty
              }
            }
          });
        }
      }
    }
  }

  // Process replacement items stock changes if it is an Exchange
  if (returnType === 'Exchange (Replacement)' && replacementItems && replacementItems.length > 0) {
    for (const repItem of replacementItems) {
      const qty = Number(repItem.qty) || 0;
      if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: repItem.itemCode },
              { name: repItem.itemName }
            ]
          },
          data: {
            stock: {
              decrement: qty
            }
          }
        });
      }
    }
  }

  // Adjust Ledger opening balance
  if (customerName) {
    const ledger = await db.collection('Ledger').findOne({ accountName: customerName });
    if (ledger) {
      let ledgerAdjustment = 0;
      if (returnType === 'Exchange (Replacement)') {
        const netDiff = (Number(extraReceived) || 0) - (Number(refundAmount) || 0);
        if (netDiff > 0) {
          if (paymentMode === 'Credit') {
            ledgerAdjustment = netDiff;
          }
        } else if (netDiff < 0) {
          if (refundMethod === 'Store Credit') {
            ledgerAdjustment = netDiff; // netDiff is negative, so this decrements openingBalance
          }
        }
      } else {
        ledgerAdjustment = -Number(netRefundAmount);
      }

      if (ledgerAdjustment !== 0) {
        await db.collection('Ledger').updateOne(
          { _id: ledger._id },
          { $inc: { openingBalance: Number(ledgerAdjustment) } }
        );
      }
    }
  }

  return { id: returnResult.insertedId.toString(), returnNo };
};

export const searchSalesReturns = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query.$or = [
      { returnNo: { $regex: q, $options: 'i' } },
      { customerName: { $regex: q, $options: 'i' } },
      { paymentMode: { $regex: q, $options: 'i' } },
      { refundMethod: { $regex: q, $options: 'i' } }
    ];
  }
  return await db.collection('SalesReturn').find(query).sort({ createdAt: -1 }).limit(100).toArray();
};

export const getSalesReturnDetails = async (id: string): Promise<any> => {
  const db = await getDb();
  const returnId = new ObjectId(id as string);
  const salesReturn = await db.collection('SalesReturn').findOne({ _id: returnId });
  if (!salesReturn) return null;
  const items = await db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
  return { ...salesReturn, items };
};

export const updateSalesReturn = async (id: string, data: any): Promise<boolean> => {
  const {
    returnNo, returnDate, originalInvoice, customerName, reason, returnType,
    totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items,
    extraReceived, refundAmount, paymentMode, refundMethod, replacementItems
  } = data;

  const db = await getDb();
  const returnId = new ObjectId(id as string);

  // Revert old stock changes
  const oldItems = await db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
  const oldReturn = await db.collection('SalesReturn').findOne({ _id: returnId });
  for (const item of oldItems) {
    if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
      // Revert returned item stock increment
      if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
        await db.collection('Product').updateOne(
          { $or: [{ itemCode: item.itemCode }, { name: item.itemName }] },
          { $inc: { damagedStock: -item.returnQty } }
        );
      } else {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: item.itemCode },
              { name: item.itemName }
            ]
          },
          data: {
            stock: {
              decrement: item.returnQty
            }
          }
        });
      }
    }
  }

  // Revert old replacement item stock decrement if it was an exchange
  if (oldReturn && oldReturn.returnType === 'Exchange (Replacement)' && oldReturn.replacementItems && oldReturn.replacementItems.length > 0) {
    for (const repItem of oldReturn.replacementItems) {
      const qty = Number(repItem.qty) || 0;
      if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: repItem.itemCode },
              { name: repItem.itemName }
            ]
          },
          data: {
            stock: {
              increment: qty
            }
          }
        });
      }
    }
  }

  // Revert old ledger impact
  if (oldReturn && oldReturn.customerName) {
    const ledger = await db.collection('Ledger').findOne({ accountName: oldReturn.customerName });
    if (ledger) {
      let ledgerAdjustment = 0;
      if (oldReturn.returnType === 'Exchange (Replacement)') {
        const oldDiff = (Number(oldReturn.extraReceived) || 0) - (Number(oldReturn.refundAmount) || 0);
        if (oldDiff > 0) {
          if (oldReturn.paymentMode === 'Credit') {
            ledgerAdjustment = -oldDiff;
          }
        } else if (oldDiff < 0) {
          if (oldReturn.refundMethod === 'Store Credit') {
            ledgerAdjustment = -oldDiff;
          }
        }
      } else {
        ledgerAdjustment = Number(oldReturn.netRefundAmount) || 0;
      }

      if (ledgerAdjustment !== 0) {
        await db.collection('Ledger').updateOne(
          { _id: ledger._id },
          { $inc: { openingBalance: Number(ledgerAdjustment) } }
        );
      }
    }
  }

  // Update return header
  const updateResult = await db.collection('SalesReturn').updateOne(
    { _id: returnId },
    {
      $set: {
        returnNo,
        returnDate: new Date(returnDate),
        originalInvoice,
        customerName,
        reason,
        returnType,
        totalReturnAmount: Number(totalReturnAmount) || 0,
        cgstReturn: Number(cgstReturn) || 0,
        sgstReturn: Number(sgstReturn) || 0,
        igstReturn: Number(igstReturn) || 0,
        roundOff: Number(roundOff) || 0,
        netRefundAmount: Number(netRefundAmount) || 0,
        extraReceived: Number(extraReceived) || 0,
        refundAmount: Number(refundAmount) || 0,
        paymentMode: paymentMode || 'Cash',
        refundMethod: refundMethod || 'Cash',
        replacementItems: replacementItems || [],
        updatedAt: new Date()
      }
    }
  );

  if (updateResult.matchedCount === 0) {
    return false;
  }

  // Delete and Insert return items
  await db.collection('SalesReturnItem').deleteMany({ salesReturnId: returnId });

  if (items && items.length > 0) {
    const itemsToInsert = items.map((item: any) => ({
      salesReturnId: returnId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      invoicedQty: Number(item.invoicedQty) || 0,
      returnQty: Number(item.returnQty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxableAmt: Number(item.taxableAmt) || 0,
      taxPercent: Number(item.taxPercent) || 0,
      disposition: item.disposition,
      subtotal: Number(item.subtotal) || 0,
      productId: item.productId ? new ObjectId(item.productId as string) : null
    }));
    await db.collection('SalesReturnItem').insertMany(itemsToInsert);

    // Apply new stock changes
    for (const item of itemsToInsert) {
      if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
        if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
          await db.collection('Product').updateOne(
            { $or: [{ itemCode: item.itemCode }, { name: item.itemName }] },
            { $inc: { damagedStock: item.returnQty } }
          );
        } else {
          await prisma.product.updateMany({
            where: {
              OR: [
                { itemCode: item.itemCode },
                { name: item.itemName }
              ]
            },
            data: {
              stock: {
                increment: item.returnQty
              }
            }
          });
        }
      }
    }
  }

  // Apply new replacement items stock changes if it is an Exchange
  if (returnType === 'Exchange (Replacement)' && replacementItems && replacementItems.length > 0) {
    for (const repItem of replacementItems) {
      const qty = Number(repItem.qty) || 0;
      if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: repItem.itemCode },
              { name: repItem.itemName }
            ]
          },
          data: {
            stock: {
              decrement: qty
            }
          }
        });
      }
    }
  }

  // Apply new ledger impact
  if (customerName) {
    const ledger = await db.collection('Ledger').findOne({ accountName: customerName });
    if (ledger) {
      let ledgerAdjustment = 0;
      if (returnType === 'Exchange (Replacement)') {
        const netDiff = (Number(extraReceived) || 0) - (Number(refundAmount) || 0);
        if (netDiff > 0) {
          if (paymentMode === 'Credit') {
            ledgerAdjustment = netDiff;
          }
        } else if (netDiff < 0) {
          if (refundMethod === 'Store Credit') {
            ledgerAdjustment = netDiff;
          }
        }
      } else {
        ledgerAdjustment = -Number(netRefundAmount);
      }

      if (ledgerAdjustment !== 0) {
        await db.collection('Ledger').updateOne(
          { _id: ledger._id },
          { $inc: { openingBalance: Number(ledgerAdjustment) } }
        );
      }
    }
  }

  return true;
};

export const deleteSalesReturn = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const returnId = new ObjectId(id as string);

  const salesReturn = await db.collection('SalesReturn').findOne({ _id: returnId });
  if (!salesReturn) return false;

  const items = await db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
  for (const item of items) {
    if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
      // Revert returned item stock increment
      if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
        await db.collection('Product').updateOne(
          { $or: [{ itemCode: item.itemCode }, { name: item.itemName }] },
          { $inc: { damagedStock: -item.returnQty } }
        );
      } else {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: item.itemCode },
              { name: item.itemName }
            ]
          },
          data: {
            stock: {
              decrement: item.returnQty
            }
          }
        });
      }
    }
  }

  // Revert replacement item stock decrement if it was an exchange
  if (salesReturn.returnType === 'Exchange (Replacement)' && salesReturn.replacementItems && salesReturn.replacementItems.length > 0) {
    for (const repItem of salesReturn.replacementItems) {
      const qty = Number(repItem.qty) || 0;
      if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: repItem.itemCode },
              { name: repItem.itemName }
            ]
          },
          data: {
            stock: {
              increment: qty
            }
          }
        });
      }
    }
  }

  // Revert ledger impact
  if (salesReturn.customerName) {
    const ledger = await db.collection('Ledger').findOne({ accountName: salesReturn.customerName });
    if (ledger) {
      let ledgerAdjustment = 0;
      if (salesReturn.returnType === 'Exchange (Replacement)') {
        const oldDiff = (Number(salesReturn.extraReceived) || 0) - (Number(salesReturn.refundAmount) || 0);
        if (oldDiff > 0) {
          if (salesReturn.paymentMode === 'Credit') {
            ledgerAdjustment = -oldDiff;
          }
        } else if (oldDiff < 0) {
          if (salesReturn.refundMethod === 'Store Credit') {
            ledgerAdjustment = -oldDiff;
          }
        }
      } else {
        ledgerAdjustment = Number(salesReturn.netRefundAmount) || 0;
      }

      if (ledgerAdjustment !== 0) {
        await db.collection('Ledger').updateOne(
          { _id: ledger._id },
          { $inc: { openingBalance: Number(ledgerAdjustment) } }
        );
      }
    }
  }

  await db.collection('SalesReturnItem').deleteMany({ salesReturnId: returnId });
  const result = await db.collection('SalesReturn').deleteOne({ _id: returnId });
  return result.deletedCount > 0;
};

export const getStockLedger = async (productId: string): Promise<any> => {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });

  if (!product) return null;

  // Outward Movements (Sales)
  const salesItems = await prisma.salesItem.findMany({
    where: { productId },
    include: { salesBill: true }
  }) as any[];

  // Inward Movements (Sales Returns)
  const returnItems = await prisma.salesReturnItem.findMany({
    where: { productId }
  }) as any[];

  const salesReturns = await prisma.salesReturn.findMany();
  const salesReturnMap = new Map(salesReturns.map(r => [r.id, r]));
  for (const item of returnItems) {
    item.salesReturn = salesReturnMap.get(item.salesReturnId) || null;
  }

  // Virtual Movements (Sales Orders)
  let orderItems: any[] = [];
  try {
    orderItems = await (prisma as any).salesOrderItem?.findMany({
      where: {
        productId,
        salesOrder: {
          status: { in: ['Open', 'Partial'] }
        }
      },
      include: {
        salesOrder: true
      }
    }) || [];
  } catch (e) {
    console.error("Error fetching salesOrderItems in getStockLedger:", e);
  }

  let movements = [];

  for (const item of salesItems) {
    if (item.salesBill) {
      movements.push({
        id: item.id,
        date: item.salesBill.invDate,
        vchType: 'Sales',
        vchNo: item.salesBill.invoiceNo,
        particulars: item.salesBill.buyerName,
        inward: 0,
        outward: item.qty
      });
    }
  }

  for (const item of returnItems) {
    if (item.salesReturn) {
      movements.push({
        id: item.id,
        date: item.salesReturn.returnDate,
        vchType: 'Sales Return',
        vchNo: item.salesReturn.returnNo,
        particulars: `Returned by customer: ${item.salesReturn.customerName}`,
        inward: item.returnQty,
        outward: 0,
        disposition: item.disposition,
        reason: item.salesReturn.reason
      });
    }
  }

  for (const item of orderItems) {
    if (item.salesOrder) {
      movements.push({
        id: item.id,
        date: item.salesOrder.orderDate,
        vchType: 'Sales Order',
        vchNo: item.salesOrder.orderNumber,
        particulars: `Ordered by: ${item.salesOrder.buyerName} (Pending: ${item.pendingQty} ${product.uom || 'PCS'} in sales order)`,
        inward: 0,
        outward: 0
      });
    }
  }

  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalInward = movements.reduce((sum, m) => sum + m.inward, 0);
  const totalOutward = movements.reduce((sum, m) => sum + m.outward, 0);

  const calculatedOpeningBalance = product.stock - totalInward + totalOutward;

  return {
    productId,
    productName: product.name,
    currentStock: product.stock,
    openingBalance: calculatedOpeningBalance,
    movements
  };
};

export const getSalesStatusReport = async (): Promise<any[]> => {
  const db = await getDb();
  const bills = await db.collection('SalesBill').find().sort({ createdAt: -1 }).toArray();
  const returns = await db.collection('SalesReturn').find().toArray();

  return bills.map((bill: any) => {
    const billReturns = returns.filter((r: any) => r.originalInvoice === bill.invoiceNo);

    let totalReturned = 0;
    let totalExchanged = 0;
    let totalRefunded = 0;
    let totalExtraReceived = 0;

    billReturns.forEach((r: any) => {
      if (r.returnType === 'Exchange (Replacement)') {
        const returnedVal = (Number(r.totalReturnAmount) || 0) + (Number(r.cgstReturn) || 0) + (Number(r.sgstReturn) || 0) + (Number(r.igstReturn) || 0);
        totalReturned += returnedVal;

        let repVal = 0;
        if (Array.isArray(r.replacementItems)) {
          r.replacementItems.forEach((item: any) => {
            repVal += Number(item.subtotal) || 0;
          });
        }
        totalExchanged += repVal;
        totalExtraReceived += Number(r.extraReceived) || 0;
        totalRefunded += Number(r.refundAmount) || 0;
      } else {
        const returnedVal = Number(r.netRefundAmount) || Number(r.totalReturnAmount) || 0;
        totalReturned += returnedVal;
        totalRefunded += returnedVal;
      }
    });

    const originalSale = bill.netAmount || 0;
    const netSale = originalSale - totalReturned + totalExchanged;

    let status = 'Completed';
    if (billReturns.length > 0) {
      const hasExchange = billReturns.some((r: any) => r.returnType === 'Exchange (Replacement)');
      if (hasExchange) {
        if (totalReturned >= originalSale) {
          status = 'Fully Exchanged';
        } else {
          status = 'Partially Exchanged';
        }
      } else {
        if (totalReturned >= originalSale) {
          status = 'Fully Returned';
        } else {
          status = 'Partially Returned';
        }
      }
    }

    return {
      id: bill._id,
      invoiceNo: bill.invoiceNo,
      invDate: bill.invDate || bill.createdAt,
      buyerName: bill.buyerName,
      originalSale,
      returned: totalReturned,
      exchanged: totalExchanged,
      refunded: totalRefunded,
      extraReceived: totalExtraReceived,
      netSale,
      status
    };
  });
};

export const getReturnsByInvoice = async (invoiceNo: string): Promise<any[]> => {
  const db = await getDb();
  const returns = await db.collection('SalesReturn').find({ originalInvoice: invoiceNo }).toArray();
  for (const r of returns) {
    r.items = await db.collection('SalesReturnItem').find({ salesReturnId: r._id }).toArray();
  }
  return returns;
};

// --- Sales Order Services ---

export const getNextSalesOrderSequence = async (): Promise<string> => {
  const lastOrder = await prisma.salesOrder.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let nextNum = 1;
  if (lastOrder && lastOrder.orderNumber.startsWith('SO-')) {
    const parts = lastOrder.orderNumber.split('-');
    const parsed = parseInt(parts[2] || '0');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const year = new Date().getFullYear();
  return `SO-${year}-${nextNum.toString().padStart(4, '0')}`;
};

export const createSalesOrder = async (data: any): Promise<any> => {
  const {
    orderNo, orderDate, customer, deliveryDate, status, isInterstate,
    summary, items, mobileNo, address, remarks, salesman, advancePaid, paymentMode
  } = data;

  const db = await getDb();
  const orderNumber = orderNo && orderNo !== 'SO-AUTO' ? orderNo : await getNextSalesOrderSequence();

  let customerId = null;
  if (customer) {
    const ledger = await prisma.ledger.findFirst({
      where: { accountName: customer }
    });
    if (ledger) {
      customerId = new ObjectId(ledger.id);
    }
  }

  const advance = Number(advancePaid) || 0;
  const grandTotal = Number(summary.grandTotal) || 0;
  const balanceAmount = Math.max(0, grandTotal - advance);

  let parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
  if (isNaN(parsedOrderDate.getTime())) parsedOrderDate = new Date();

  let parsedDeliveryDate = deliveryDate ? new Date(deliveryDate) : parsedOrderDate;
  if (isNaN(parsedDeliveryDate.getTime())) parsedDeliveryDate = parsedOrderDate;

  const orderResult = await db.collection('SalesOrder').insertOne({
    orderNumber,
    customerId,
    buyerName: customer || 'CASH CUSTOMER',
    mobileNo: mobileNo || '',
    address: address || '',
    orderDate: parsedOrderDate,
    expectedDeliveryDate: parsedDeliveryDate,
    status: status || 'Open',
    subtotal: Number(summary.subtotal) || 0,
    discount: Number(summary.discount) || 0,
    cgst: Number(summary.cgst) || 0,
    sgst: Number(summary.sgst) || 0,
    roundOff: Number(summary.rounding) || 0,
    grandTotal,
    advancePaid: advance,
    balanceAmount,
    remarks,
    salesman,
    paymentMode: paymentMode || 'Cash',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      let productId = item.productId ? new ObjectId(item.productId as string) : null;
      if (!productId && item.itemCode) {
        const prod = await prisma.product.findUnique({
          where: { itemCode: item.itemCode }
        });
        if (prod) {
          productId = new ObjectId(prod.id);
        }
      }

      const qty = Number(item.quantityOrdered) || 0;
      itemsToInsert.push({
        salesOrderId: orderResult.insertedId,
        productId,
        itemCode: item.itemCode,
        itemName: item.itemDescription || item.itemName,
        color: item.color || null,
        size: item.size || null,
        orderedQty: qty,
        deliveredQty: 0,
        pendingQty: qty,
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discountPercentage) || 0,
        tax: Number(item.taxRatePercentage) || 0,
        lineTotal: Number(item.lineSubTotal) || 0
      });
    }
    await db.collection('SalesOrderItem').insertMany(itemsToInsert);
  }

  return { id: orderResult.insertedId.toString(), orderNumber };
};

export const searchSalesOrders = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let filter: any = {};
  if (q) {
    const regex = new RegExp(q, 'i');
    filter = {
      $or: [
        { orderNumber: regex },
        { buyerName: regex },
        { mobileNo: regex }
      ]
    };
  }
  const orders = await db.collection('SalesOrder').find(filter).sort({ createdAt: -1 }).toArray();
  const orderIds = orders.map(o => o._id);
  const items = await db.collection('SalesOrderItem').find({ salesOrderId: { $in: orderIds } }).toArray();
  const itemMap = new Map<string, any[]>();
  for (const item of items) {
    const key = item.salesOrderId?.toString();
    if (!itemMap.has(key)) itemMap.set(key, []);
    itemMap.get(key)!.push({ ...item, id: item._id?.toString() });
  }

  return orders.map(o => ({
    ...o,
    id: o._id.toString(),
    _id: o._id.toString(),
    items: itemMap.get(o._id.toString()) || []
  }));
};

export const getSalesOrderDetails = async (id: string): Promise<any> => {
  const db = await getDb();
  let order = null;
  try {
    order = await db.collection('SalesOrder').findOne({ _id: new ObjectId(id) });
  } catch (e) {
    order = await db.collection('SalesOrder').findOne({ orderNumber: id });
  }
  if (!order) return null;

  const items = await db.collection('SalesOrderItem').find({ salesOrderId: order._id }).toArray();
  return {
    ...order,
    id: order._id.toString(),
    _id: order._id.toString(),
    items: items.map(i => ({ ...i, id: i._id?.toString() }))
  };
};

export const updateSalesOrder = async (id: string, data: any): Promise<boolean> => {
  const {
    orderNo, orderDate, customer, deliveryDate, status, isInterstate,
    summary, items, mobileNo, address, remarks, salesman, advancePaid, paymentMode
  } = data;

  const db = await getDb();
  const orderId = new ObjectId(id);

  const existingOrder = await db.collection('SalesOrder').findOne({ _id: orderId });

  if (!existingOrder) return false;
  if (existingOrder.status === 'Completed' || existingOrder.status === 'Cancelled') {
    throw new Error('Completed or Cancelled orders cannot be modified.');
  }

  let customerId = null;
  if (customer) {
    const ledger = await db.collection('Ledger').findOne({ accountName: customer });
    if (ledger) {
      customerId = ledger._id;
    }
  }

  const advance = Number(advancePaid) || 0;
  const grandTotal = Number(summary?.grandTotal) || Number(data.grandTotal) || 0;
  const balanceAmount = Math.max(0, grandTotal - advance);

  let parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
  if (isNaN(parsedOrderDate.getTime())) parsedOrderDate = new Date();

  let parsedDeliveryDate = deliveryDate ? new Date(deliveryDate) : parsedOrderDate;
  if (isNaN(parsedDeliveryDate.getTime())) parsedDeliveryDate = parsedOrderDate;

  await db.collection('SalesOrder').updateOne(
    { _id: orderId },
    {
      $set: {
        orderNumber: orderNo || existingOrder.orderNumber,
        customerId,
        buyerName: customer || 'CASH CUSTOMER',
        mobileNo: mobileNo || '',
        address: address || '',
        orderDate: parsedOrderDate,
        expectedDeliveryDate: parsedDeliveryDate,
        status: status || existingOrder.status,
        subtotal: Number(summary?.subtotal) || 0,
        discount: Number(summary?.discount) || 0,
        cgst: Number(summary?.cgst) || 0,
        sgst: Number(summary?.sgst) || 0,
        roundOff: Number(summary?.rounding) || 0,
        grandTotal,
        advancePaid: advance,
        balanceAmount,
        remarks,
        salesman,
        paymentMode: paymentMode || 'Cash',
        updatedAt: new Date()
      }
    }
  );

  // Delete existing items
  await db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });

  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      let productId = item.productId ? new ObjectId(item.productId as string) : null;
      if (!productId && item.itemCode) {
        const prod = await db.collection('Product').findOne({ itemCode: item.itemCode });
        if (prod) {
          productId = prod._id;
        }
      }

      const qty = Number(item.quantityOrdered) || Number(item.orderedQty) || 0;
      const delivered = Number(item.quantityFulfilled) || Number(item.deliveredQty) || 0;
      itemsToInsert.push({
        salesOrderId: orderId,
        productId,
        itemCode: item.itemCode,
        itemName: item.itemDescription || item.itemName,
        color: item.color || null,
        size: item.size || null,
        orderedQty: qty,
        deliveredQty: delivered,
        pendingQty: Math.max(0, qty - delivered),
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discountPercentage) || 0,
        tax: Number(item.taxRatePercentage) || 0,
        lineTotal: Number(item.lineSubTotal) || Number(item.lineTotal) || 0
      });
    }
    await db.collection('SalesOrderItem').insertMany(itemsToInsert);
  }

  return true;
};

export const deleteSalesOrder = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const orderId = new ObjectId(id);
  
  await db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });
  const result = await db.collection('SalesOrder').deleteOne({ _id: orderId });
  return result.deletedCount > 0;
};

export const cancelSalesOrder = async (id: string, data: any): Promise<boolean> => {
  const { cancelReason, cancelledBy } = data;
  const db = await getDb();
  const orderId = new ObjectId(id);

  const result = await db.collection('SalesOrder').updateOne(
    { _id: orderId },
    {
      $set: {
        status: 'Cancelled',
        cancelReason: cancelReason || 'User request',
        cancelledBy: cancelledBy || 'System',
        cancelDate: new Date(),
        updatedAt: new Date()
      }
    }
  );

  return result.matchedCount > 0;
};
