import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';

export const getNextShopSalesVoucher = async (): Promise<string> => {
  const db = await getDb();
  const lastBill = await db.collection('ShopSalesBill')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  let nextNum = 1001;
  if (lastBill && lastBill.voucherNo && lastBill.voucherNo.startsWith('SB-')) {
    const parts = lastBill.voucherNo.split('-');
    const parsed = parseInt(parts[1] || '1000');
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `SB-${nextNum}`;
};

export const createShopSalesBill = async (data: any): Promise<any> => {
  const {
    voucherNo, date, shopName, shopGstin, taxableAmt, cgst, sgst, igst, otherCharges, netPayable, status, type, paymentMode, items
  } = data;

  const db = await getDb();

  // 1. Create the ShopSalesBill
  const billDoc = {
    voucherNo: voucherNo || `SB-${Date.now()}`,
    date: date ? new Date(date) : new Date(),
    shopName: shopName || 'General Shop',
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
  };

  const billResult = await db.collection('ShopSalesBill').insertOne(billDoc);
  const purchaseBillId = billResult.insertedId;

  // 2. Process each item (DECREMENT stock since we are selling/transferring out)
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
            $inc: { stock: -Math.round(qty) },
            $set: {
              purchaseRate: rate,
              price: item.salesRate ? Number(item.salesRate) : product.price,
              mrp: item.mrp ? Number(item.mrp) : product.mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || '',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : null;
        const newProduct = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Shop Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: Number(item.salesRate || rate),
          mrp: Number(item.mrp || rate),
          taxPercent: taxPercent,
          stock: -Math.round(qty),
          category: item.category || item.department || '',
          vendorItemCode: item.vendorItemCode || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        productId = newProduct.insertedId;
      }

      itemsToInsert.push({
        shopSalesBillId: purchaseBillId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
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

  return { id: purchaseBillId.toString(), voucherNo: billDoc.voucherNo };
};

export const searchShopSalesBills = async (q: string): Promise<any[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query = {
      $or: [
        { voucherNo: { $regex: q, $options: 'i' } },
        { shopName: { $regex: q, $options: 'i' } }
      ]
    };
  }

  const bills = await db.collection('ShopSalesBill')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const populatedBills = [];
  for (const bill of bills) {
    const items = await db.collection('ShopSalesItem')
      .find({ shopSalesBillId: bill._id })
      .toArray();

    populatedBills.push({
      ...bill,
      id: bill._id.toString(),
      items: items.map(item => ({
        ...item,
        id: item._id.toString(),
        shopSalesBillId: item.shopSalesBillId.toString(),
        productId: item.productId ? item.productId.toString() : null
      }))
    });
  }

  return populatedBills;
};

export const updateShopSalesBill = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  const billId = new ObjectId(id);

  // 1. Revert previous stock changes (increment back)
  const oldItems = await db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: Math.round(qty) } }
      );
    }
  }

  // 2. Delete old items
  await db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });

  // 3. Update document
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
            $inc: { stock: -Math.round(qty) },
            $set: {
              purchaseRate: rate,
              price: item.salesRate ? Number(item.salesRate) : product.price,
              mrp: item.mrp ? Number(item.mrp) : product.mrp,
              barcode: cleanBarcode,
              category: item.category || item.department || product.category || '',
              vendorItemCode: item.vendorItemCode || product.vendorItemCode || '',
              updatedAt: new Date()
            }
          }
        );
      } else {
        const cleanBarcode = item.barcode && item.barcode.trim() !== '' ? item.barcode.trim() : null;
        const newProduct = await db.collection('Product').insertOne({
          itemCode: item.itemCode || `ITM-${Date.now()}`,
          name: item.itemName || item.itemDesc || item.itemCode || 'Shop Item',
          barcode: cleanBarcode,
          uom: 'PCS',
          purchaseRate: rate,
          price: Number(item.salesRate || rate),
          mrp: Number(item.mrp || rate),
          taxPercent: taxPercent,
          stock: -Math.round(qty),
          category: item.category || item.department || '',
          vendorItemCode: item.vendorItemCode || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        productId = newProduct.insertedId;
      }

      itemsToInsert.push({
        shopSalesBillId: billId,
        productId: productId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || item.itemDesc || item.itemCode || 'Item',
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

  const oldItems = await db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
  for (const item of oldItems) {
    const qty = Number(item.qty) || 0;
    if (qty > 0 && item.productId) {
      await db.collection('Product').updateOne(
        { _id: new ObjectId(item.productId.toString()) },
        { $inc: { stock: Math.round(qty) } }
      );
    }
  }

  await db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });
  const result = await db.collection('ShopSalesBill').deleteOne({ _id: billId });
  return result.deletedCount > 0;
};
