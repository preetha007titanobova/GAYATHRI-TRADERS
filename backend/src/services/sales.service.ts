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
    cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode
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
        salesBillId: billResult.insertedId,
        itemName: item.itemName,
        itemDesc: item.itemDesc,
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
      { buyerName: { $regex: q, $options: 'i' } }
    ];
  }
  let cursor = db.collection('SalesBill').find(query).sort({ createdAt: -1 });
  if (!q) {
    cursor = cursor.limit(50);
  }
  return await cursor.toArray();
};

export const getSalesBillByInvoiceNo = async (invoiceNo: string): Promise<any> => {
  const db = await getDb();
  const bill = await db.collection('SalesBill').findOne({ invoiceNo });
  if (!bill) return null;
  const items = await db.collection('SalesItem').find({ salesBillId: bill._id }).toArray();
  const itemsWithBarcode = [];
  for (const item of items) {
    let barcode = '';
    if (item.productId) {
      const prod = await db.collection('Product').findOne({ _id: new ObjectId(item.productId as string) });
      if (prod) {
        barcode = prod.barcode || '';
      }
    }
    itemsWithBarcode.push({ ...item, barcode });
  }
  return { ...bill, items: itemsWithBarcode };
};

export const createSalesOrder = async (data: any): Promise<any> => {
  const { orderNo, orderDate, customer, deliveryDate, paymentTerms, status, isInterstate, summary, items } = data;
  const db = await getDb();

  const orderResult = await db.collection('SalesOrder').insertOne({
    orderNo,
    orderDate: new Date(orderDate),
    customer,
    deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
    paymentTerms,
    status: status || 'OPEN',
    isInterstate,
    subtotal: summary?.subtotal || 0,
    cgst: summary?.cgst || 0,
    sgst: summary?.sgst || 0,
    igst: summary?.igst || 0,
    rounding: summary?.rounding || 0,
    grandTotal: summary?.grandTotal || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  if (items && items.length > 0) {
    const itemsToInsert = items.map((item: any) => ({
      salesOrderId: orderResult.insertedId,
      orderNo,
      lineId: item.lineId,
      lineIndex: item.lineIndex,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      quantityOrdered: Number(item.quantityOrdered) || 0,
      quantityFulfilled: Number(item.quantityFulfilled) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      discountPercentage: Number(item.discountPercentage) || 0,
      taxableAmount: Number(item.taxableAmount) || 0,
      taxRatePercentage: Number(item.taxRatePercentage) || 0,
      cgstAmount: Number(item.cgstAmount) || 0,
      sgstAmount: Number(item.sgstAmount) || 0,
      igstAmount: Number(item.igstAmount) || 0,
      lineSubTotal: Number(item.lineSubTotal) || 0
    }));
    await db.collection('SalesOrderItem').insertMany(itemsToInsert);

    for (const item of itemsToInsert) {
      if (item.quantityOrdered > 0 && (item.itemCode || item.itemDescription)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: item.itemCode },
              { barcode: item.itemCode },
              { name: item.itemDescription }
            ]
          },
          data: {
            committedStock: {
              increment: item.quantityOrdered
            }
          }
        });
      }
    }
  }

  return { id: orderResult.insertedId.toString(), orderNo };
};

export const searchSalesOrders = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query.$or = [
      { orderNo: { $regex: q, $options: 'i' } },
      { customer: { $regex: q, $options: 'i' } }
    ];
  }
  return await db.collection('SalesOrder').find(query).sort({ createdAt: -1 }).limit(100).toArray();
};

export const getSalesOrderDetails = async (id: string): Promise<any> => {
  const db = await getDb();
  const orderId = new ObjectId(id as string);
  const order = await db.collection('SalesOrder').findOne({ _id: orderId });
  if (!order) return null;
  const items = await db.collection('SalesOrderItem').find({ salesOrderId: orderId }).toArray();
  return { ...order, items };
};

export const updateSalesOrder = async (id: string, data: any): Promise<boolean> => {
  const { orderNo, orderDate, customer, deliveryDate, paymentTerms, status, isInterstate, summary, items } = data;
  const db = await getDb();
  const orderId = new ObjectId(id as string);

  // Revert old stock commitment
  const oldItems = await db.collection('SalesOrderItem').find({ salesOrderId: orderId }).toArray();
  for (const item of oldItems) {
    if (item.quantityOrdered > 0 && (item.itemCode || item.itemDescription)) {
      await prisma.product.updateMany({
        where: {
          OR: [
            { itemCode: item.itemCode },
            { barcode: item.itemCode },
            { name: item.itemDescription }
          ]
        },
        data: {
          committedStock: {
            decrement: item.quantityOrdered
          }
        }
      });
    }
  }

  // Update Order header
  const updateResult = await db.collection('SalesOrder').updateOne(
    { _id: orderId },
    {
      $set: {
        orderNo,
        orderDate: new Date(orderDate),
        customer,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms,
        status: status || 'OPEN',
        isInterstate,
        subtotal: summary?.subtotal || 0,
        cgst: summary?.cgst || 0,
        sgst: summary?.sgst || 0,
        igst: summary?.igst || 0,
        rounding: summary?.rounding || 0,
        grandTotal: summary?.grandTotal || 0,
        updatedAt: new Date()
      }
    }
  );

  if (updateResult.matchedCount === 0) {
    return false;
  }

  // Delete and Insert new items
  await db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });

  if (items && items.length > 0) {
    const itemsToInsert = items.map((item: any) => ({
      salesOrderId: orderId,
      orderNo,
      lineId: item.lineId,
      lineIndex: item.lineIndex,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      quantityOrdered: Number(item.quantityOrdered) || 0,
      quantityFulfilled: Number(item.quantityFulfilled) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      discountPercentage: Number(item.discountPercentage) || 0,
      taxableAmount: Number(item.taxableAmount) || 0,
      taxRatePercentage: Number(item.taxRatePercentage) || 0,
      cgstAmount: Number(item.cgstAmount) || 0,
      sgstAmount: Number(item.sgstAmount) || 0,
      igstAmount: Number(item.igstAmount) || 0,
      lineSubTotal: Number(item.lineSubTotal) || 0
    }));
    await db.collection('SalesOrderItem').insertMany(itemsToInsert);

    // Apply new commitments
    for (const item of itemsToInsert) {
      if (item.quantityOrdered > 0 && (item.itemCode || item.itemDescription)) {
        await prisma.product.updateMany({
          where: {
            OR: [
              { itemCode: item.itemCode },
              { barcode: item.itemCode },
              { name: item.itemDescription }
            ]
          },
          data: {
            committedStock: {
              increment: item.quantityOrdered
            }
          }
        });
      }
    }
  }

  return true;
};

export const deleteSalesOrder = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const orderId = new ObjectId(id as string);

  const items = await db.collection('SalesOrderItem').find({ salesOrderId: orderId }).toArray();
  for (const item of items) {
    if (item.quantityOrdered > 0 && (item.itemCode || item.itemDescription)) {
      await prisma.product.updateMany({
        where: {
          OR: [
            { itemCode: item.itemCode },
            { barcode: item.itemCode },
            { name: item.itemDescription }
          ]
        },
        data: {
          committedStock: {
            decrement: item.quantityOrdered
          }
        }
      });
    }
  }

  await db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });
  const result = await db.collection('SalesOrder').deleteOne({ _id: orderId });
  return result.deletedCount > 0;
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
    totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items
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

        // If it is an exchange, a replacement item is given, so decrement normal stock
        if (returnType === 'Exchange (Replacement)') {
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
  }

  if (customerName && netRefundAmount > 0 && returnType !== 'Exchange (Replacement)') {
    const ledger = await db.collection('Ledger').findOne({ accountName: customerName });
    if (ledger) {
      await db.collection('Ledger').updateOne(
        { _id: ledger._id },
        { $inc: { openingBalance: -Number(netRefundAmount) } }
      );
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
      { customerName: { $regex: q, $options: 'i' } }
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
    totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items
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

      // Revert replacement item stock decrement if it was an exchange
      if (oldReturn && oldReturn.returnType === 'Exchange (Replacement)') {
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

  // Revert ledger impact
  if (oldReturn && oldReturn.customerName && oldReturn.netRefundAmount > 0 && oldReturn.returnType !== 'Exchange (Replacement)') {
    const ledger = await db.collection('Ledger').findOne({ accountName: oldReturn.customerName });
    if (ledger) {
      await db.collection('Ledger').updateOne(
        { _id: ledger._id },
        { $inc: { openingBalance: Number(oldReturn.netRefundAmount) } }
      );
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

        // If it is an exchange, a replacement item is given, so decrement normal stock
        if (returnType === 'Exchange (Replacement)') {
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
  }

  // Apply new ledger impact
  if (customerName && netRefundAmount > 0 && returnType !== 'Exchange (Replacement)') {
    const ledger = await db.collection('Ledger').findOne({ accountName: customerName });
    if (ledger) {
      await db.collection('Ledger').updateOne(
        { _id: ledger._id },
        { $inc: { openingBalance: -Number(netRefundAmount) } }
      );
    }
  }

  return true;
};

export const deleteSalesReturn = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const returnId = new ObjectId(id as string);

  const salesReturn = await db.collection('SalesReturn').findOne({ _id: returnId });

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

      // Revert replacement item stock decrement if it was an exchange
      if (salesReturn && salesReturn.returnType === 'Exchange (Replacement)') {
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

  if (salesReturn && salesReturn.customerName && salesReturn.netRefundAmount > 0 && salesReturn.returnType !== 'Exchange (Replacement)') {
    const ledger = await db.collection('Ledger').findOne({ accountName: salesReturn.customerName });
    if (ledger) {
      await db.collection('Ledger').updateOne(
        { _id: ledger._id },
        { $inc: { openingBalance: Number(salesReturn.netRefundAmount) } }
      );
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
