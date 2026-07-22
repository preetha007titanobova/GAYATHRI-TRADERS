import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';

export const getNextShopSalesVoucher = async (): Promise<string> => {
  const db = await getDb();
  const lastBill = await db.collection('ShopSalesBill')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  let nextNum = 1001;
  if (lastBill && lastBill.voucherNo && lastBill.voucherNo.startsWith('SSB-')) {
    const parts = lastBill.voucherNo.split('-');
    const parsed = parseInt(parts[1] || '1000');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `SSB-${nextNum}`;
};

export const createShopSalesBill = async (data: any): Promise<any> => {
  const db = await getDb();
  const purchaseBillId = new ObjectId();
  const voucherNo = data.voucherNo || (await getNextShopSalesVoucher());

  // 1. Create the ShopSalesBill document
  const {
    date, shopName, shopGstin, taxableAmt, cgst, sgst, igst, otherCharges, netPayable, status, type, paymentMode, items
  } = data;

  await db.collection('ShopSalesBill').insertOne({
    _id: purchaseBillId,
    voucherNo,
    date: date ? new Date(date) : new Date(),
    shopName,
    shopGstin: shopGstin || '',
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
  });

  // 2. Process each item (DECREMENT stock since we are selling to another shop)
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const qty = Number(item.qty || item.purchasedQty) || 0;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
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
        // Product exists: decrement stock (sold/transferred out)
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: Math.round(qty)
            },
            purchaseRate: rate,
            price: item.salesRate ? Number(item.salesRate) : product.price,
            mrp: item.mrp ? Number(item.mrp) : product.mrp,
            size: item.size || product.size,
            variety: item.variety || product.variety,
            department: item.category || item.department || product.department,
            factory: item.factory || product.factory,
            vendorItemCode: item.vendorItemCode || product.vendorItemCode,
          }
        });
      } else {
        // Product does not exist: create a new one with negative stock
        const newProduct = await prisma.product.create({
          data: {
            itemCode: item.itemCode,
            name: item.itemName || item.itemDesc || item.itemCode,
            barcode: item.itemCode,
            uom: 'Piece',
            purchaseRate: rate,
            price: Number(item.salesRate || rate),
            mrp: Number(item.mrp || rate),
            taxPercent: taxPercent,
            stock: -Math.round(qty),
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
        shopSalesBillId: purchaseBillId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        qty: qty,
        rate: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        total: total
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('ShopSalesItem').insertMany(itemsToInsert);
    }
  }

  return { id: purchaseBillId.toString(), voucherNo };
};

export const searchShopSalesBills = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    const regex = new RegExp(q, 'i');
    query.$or = [
      { voucherNo: regex },
      { shopName: regex }
    ];
  }

  const bills = await db.collection('ShopSalesBill')
    .find(query)
    .sort({ date: -1 })
    .toArray();

  const mapped = [];
  for (const bill of bills) {
    const items = await db.collection('ShopSalesItem')
      .find({ shopSalesBillId: bill._id })
      .toArray();

    mapped.push({
      ...bill,
      id: bill._id.toString(),
      items: items.map(i => ({
        ...i,
        id: i._id.toString()
      }))
    });
  }
  return mapped;
};

export const updateShopSalesBill = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  const billId = new ObjectId(id);

  // 1. Revert previous stock changes (since we decremented, we must increment old qty back)
  const oldItems = await db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            increment: Math.round(qty)
          }
        }
      });
    }
  }

  // 2. Delete old items
  await db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });

  // 3. Update the ShopSalesBill document
  const {
    voucherNo, date, shopName, shopGstin, taxableAmt, cgst, sgst, igst, otherCharges, netPayable, status, type, paymentMode, items
  } = data;

  const result = await db.collection('ShopSalesBill').updateOne(
    { _id: billId },
    {
      $set: {
        voucherNo,
        date: date ? new Date(date) : new Date(),
        shopName,
        shopGstin: shopGstin || '',
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

  // 4. Insert new items and decrement stock
  if (items && items.length > 0) {
    const itemsToInsert = [];
    for (const item of items) {
      const qty = Number(item.qty || item.purchasedQty) || 0;
      const rate = Number(item.rate || item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      const discPercent = Number(item.discPercent) || 0;
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
              decrement: Math.round(qty)
            },
            purchaseRate: rate,
            price: item.salesRate ? Number(item.salesRate) : product.price,
            mrp: item.mrp ? Number(item.mrp) : product.mrp,
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
            barcode: item.itemCode,
            uom: 'Piece',
            purchaseRate: rate,
            price: Number(item.salesRate || rate),
            mrp: Number(item.mrp || rate),
            taxPercent: taxPercent,
            stock: -Math.round(qty),
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
        shopSalesBillId: billId,
        productId: productId,
        itemCode: item.itemCode,
        itemName: item.itemName || item.itemDesc || item.itemCode,
        size: item.size || '',
        variety: item.variety || '',
        category: item.category || item.department || 'None',
        factory: item.factory || '',
        vendorItemCode: item.vendorItemCode || '',
        qty: qty,
        rate: rate,
        taxPercent: taxPercent,
        discPercent: discPercent,
        total: total
      });
    }

    if (itemsToInsert.length > 0) {
      await db.collection('ShopSalesItem').insertMany(itemsToInsert);
    }
  }

  return result.matchedCount > 0;
};

export const deleteShopSalesBill = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const billId = new ObjectId(id);

  // Revert stock changes (since we decremented, we increment it back)
  const oldItems = await db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await prisma.product.update({
        where: { id: item.productId.toString() },
        data: {
          stock: {
            increment: Math.round(qty)
          }
        }
      });
    }
  }

  // Delete items
  await db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });

  // Delete bill
  const result = await db.collection('ShopSalesBill').deleteOne({ _id: billId });
  return result.deletedCount > 0;
};
