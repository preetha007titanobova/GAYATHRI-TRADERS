import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Product } from '../models/product.model';

export const getProductByBarcode = async (barcode: string): Promise<any> => {
  try {
    const cleanCode = (barcode || '').trim();
    if (!cleanCode) return null;

    const db = await getDb();
    const regex = new RegExp(`^${cleanCode}$`, 'i');
    let product: any = await db.collection('Product').findOne({
      $or: [
        { barcode: cleanCode },
        { barcode: regex },
        { itemCode: cleanCode },
        { itemCode: regex },
        { vendorItemCode: cleanCode },
        { vendorItemCode: regex },
        { name: regex }
      ]
    });
    if (!product) {
      try {
        product = await prisma.product.findFirst({
          where: {
            OR: [
              { barcode: { equals: cleanCode, mode: 'insensitive' } },
              { itemCode: { equals: cleanCode, mode: 'insensitive' } },
              { vendorItemCode: { equals: cleanCode, mode: 'insensitive' } },
              { name: { equals: cleanCode, mode: 'insensitive' } }
            ]
          }
        });
      } catch (e) {
        console.error("Prisma barcode search error:", e);
      }
    }
    if (product) {
      product.stock = Math.max(0, Number(product.stock) || 0);
    }
    return product;
  } catch (err) {
    console.error("Error in getProductByBarcode:", err);
    return null;
  }
};

export const searchItems = async (q: string): Promise<any[]> => {
  let mongoItems: any[] = [];
  try {
    const db = await getDb();
    if (!q) {
      mongoItems = await db.collection('Product').find({}).limit(100).toArray();
    } else {
      const regex = new RegExp(q, 'i');
      mongoItems = await db.collection('Product').find({
        $or: [
          { name: regex },
          { itemCode: regex },
          { barcode: regex },
          { category: regex },
          { group: regex },
          { vendorItemCode: regex }
        ]
      }).limit(100).toArray();
    }
  } catch (e) {
    console.error("MongoDB product search error:", e);
  }

  let prismaItems: any[] = [];
  try {
    prismaItems = await prisma.product.findMany({
      where: q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { itemCode: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
          { vendorItemCode: { contains: q, mode: 'insensitive' } }
        ]
      } : undefined,
      take: 100
    });
  } catch (e) {
    console.error("Prisma product search error:", e);
  }

  const map = new Map();
  [...mongoItems, ...prismaItems].forEach((item: any) => {
    const id = item._id?.toString() || item.id;
    if (id && !map.has(id)) {
      map.set(id, {
        ...item,
        id,
        _id: id,
        barcode: item.barcode || '',
        itemCode: item.itemCode || '',
        category: item.category || item.group || '',
        price: Number(item.price) || 0,
        stock: Math.max(0, Number(item.stock) || 0)
      });
    }
  });

  return Array.from(map.values());
};

export const getNextProductCode = async (): Promise<string> => {
  let nextNum = 1001;
  try {
    const db = await getDb();
    const lastMongoProduct = await db.collection('Product')
      .find({ itemCode: { $regex: '^ITM-' } })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (lastMongoProduct && lastMongoProduct.length > 0) {
      const parts = (lastMongoProduct[0].itemCode || '').split('-');
      const num = parseInt(parts[1] || '1000', 10);
      if (!isNaN(num)) nextNum = num + 1;
    } else {
      const lastProduct = await prisma.product.findFirst({
        orderBy: { createdAt: 'desc' },
        where: { itemCode: { not: null } }
      });
      if (lastProduct && lastProduct.itemCode?.startsWith('ITM-')) {
        const parts = lastProduct.itemCode.split('-');
        const num = parseInt(parts[1] || '1000', 10);
        if (!isNaN(num)) nextNum = num + 1;
      }
    }
  } catch (e) {
    console.error("Error in getNextProductCode:", e);
  }
  return `ITM-${nextNum}`;
};

export const createProduct = async (data: Product): Promise<any> => {
  const db = await getDb();
  const cleanBarcode = data.barcode && typeof data.barcode === 'string' && data.barcode.trim() !== '' ? data.barcode.trim() : null;
  const cleanItemCode = data.itemCode && typeof data.itemCode === 'string' && data.itemCode.trim() !== '' ? data.itemCode.trim() : null;
  const cleanVendorCode = data.vendorItemCode && typeof data.vendorItemCode === 'string' && data.vendorItemCode.trim() !== '' ? data.vendorItemCode.trim() : null;

  const doc: any = {
    ...data,
    name: data.name ? data.name.trim() : '',
    itemCode: cleanItemCode,
    vendorItemCode: cleanVendorCode,
    barcode: cleanBarcode,
    purchaseRate: Number(data.purchaseRate) || 0,
    price: Number(data.price) || 0,
    mrp: Number(data.mrp) || 0,
    taxPercent: Number(data.taxPercent) || 0,
    stock: Math.max(0, Math.round(Number(data.stock) || 0)),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return await db.collection('Product').insertOne(doc);
};

export const updateProduct = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  const { id: _, _id, createdAt, updatedAt, ...updatableFields } = data;
  const cleanBarcode = data.barcode && typeof data.barcode === 'string' && data.barcode.trim() !== '' ? data.barcode.trim() : null;
  const cleanItemCode = data.itemCode && typeof data.itemCode === 'string' && data.itemCode.trim() !== '' ? data.itemCode.trim() : null;
  const cleanVendorCode = data.vendorItemCode && typeof data.vendorItemCode === 'string' && data.vendorItemCode.trim() !== '' ? data.vendorItemCode.trim() : null;

  const result = await db.collection('Product').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...updatableFields,
        name: data.name ? data.name.trim() : updatableFields.name,
        itemCode: cleanItemCode,
        vendorItemCode: cleanVendorCode,
        barcode: cleanBarcode,
        purchaseRate: Number(data.purchaseRate) || 0,
        price: Number(data.price) || 0,
        mrp: Number(data.mrp) || 0,
        taxPercent: Number(data.taxPercent) || 0,
        stock: Math.max(0, Math.round(Number(data.stock) || 0)),
        updatedAt: new Date()
      }
    }
  );
  return result.matchedCount > 0;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Product').deleteOne({ _id: new ObjectId(id as string) });
  return result.deletedCount > 0;
};

export const getDailyStockStatus = async (dateStr: string): Promise<any[]> => {
  const startOfDay = new Date(`${dateStr}T00:00:00.000`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999`);

  const products = await searchItems('');

  let salesItems: any[] = [];
  try {
    salesItems = await prisma.salesItem.findMany({
      where: {
        salesBill: {
          invDate: { gte: startOfDay }
        }
      },
      include: {
        salesBill: true
      }
    });
  } catch (e) {
    console.error("Error fetching salesItems:", e);
  }

  let salesReturnItems: any[] = [];
  try {
    salesReturnItems = await prisma.salesReturnItem.findMany({
      where: {
        disposition: 'Return to Warehouse',
        salesReturn: {
          returnDate: { gte: startOfDay }
        }
      },
      include: {
        salesReturn: true
      }
    });
  } catch (e) {
    console.error("Error fetching salesReturnItems:", e);
  }

  let purchaseItems: any[] = [];
  try {
    const db = await getDb();
    const purchaseBills = await db.collection('PurchaseBill').find({
      date: { $gte: startOfDay }
    }).toArray();
    const purchaseBillMap = new Map(purchaseBills.map(b => [b._id.toString(), b]));

    purchaseItems = await db.collection('PurchaseItem').find({
      purchaseBillId: { $in: purchaseBills.map(b => b._id) }
    }).toArray();
    for (const item of purchaseItems) {
      item.purchaseBill = purchaseBillMap.get(item.purchaseBillId?.toString()) || null;
    }
  } catch (e) {
    console.error("Error fetching purchaseItems:", e);
  }

  let shopSalesItems: any[] = [];
  try {
    const db = await getDb();
    const shopSalesBills = await db.collection('ShopSalesBill').find({
      date: { $gte: startOfDay }
    }).toArray();
    const shopSalesBillMap = new Map(shopSalesBills.map(b => [b._id.toString(), b]));

    shopSalesItems = await db.collection('ShopSalesItem').find({
      shopSalesBillId: { $in: shopSalesBills.map(b => b._id) }
    }).toArray();
    for (const item of shopSalesItems) {
      item.shopSalesBill = shopSalesBillMap.get(item.shopSalesBillId?.toString()) || null;
    }
  } catch (e) {
    console.error("Error fetching shopSalesItems:", e);
  }

  return products.map(product => {
    const prodId = product.id || product._id;

    const productSales = salesItems.filter(item => item.productId === prodId);
    const productReturns = salesReturnItems.filter(item => item.productId === prodId);
    const productPurchases = purchaseItems.filter(item => item.productId?.toString() === prodId || (item.itemCode === product.itemCode));
    const productShopSales = shopSalesItems.filter(item => item.productId?.toString() === prodId || (item.itemCode === product.itemCode));

    let outwardToday = 0;
    let inwardToday = 0;
    let outwardAfterToday = 0;
    let inwardAfterToday = 0;

    let purchasesToday = 0;
    let returnsToday = 0;

    for (const item of productSales) {
      if (item.salesBill) {
        const invDate = new Date(item.salesBill.invDate);
        if (invDate >= startOfDay && invDate <= endOfDay) {
          outwardToday += item.qty || 0;
        } else if (invDate > endOfDay) {
          outwardAfterToday += item.qty || 0;
        }
      }
    }

    for (const item of productShopSales) {
      if (item.shopSalesBill) {
        const saleDate = new Date(item.shopSalesBill.date);
        if (saleDate >= startOfDay && saleDate <= endOfDay) {
          outwardToday += item.qty || 0;
        } else if (saleDate > endOfDay) {
          outwardAfterToday += item.qty || 0;
        }
      }
    }

    for (const item of productReturns) {
      if (item.salesReturn) {
        const returnDate = new Date(item.salesReturn.returnDate);
        if (returnDate >= startOfDay && returnDate <= endOfDay) {
          inwardToday += item.returnQty || 0;
          returnsToday += item.returnQty || 0;
        } else if (returnDate > endOfDay) {
          inwardAfterToday += item.returnQty || 0;
        }
      }
    }

    for (const item of productPurchases) {
      if (item.purchaseBill) {
        const purchaseDate = new Date(item.purchaseBill.date);
        const conv = Number(item.unitsPerPack || item.conversionFactor) > 0 ? Number(item.unitsPerPack || item.conversionFactor) : 1;
        const baseQty = item.totalBaseQty || (((Number(item.qty) || 0) + (Number(item.freeQty) || 0)) * conv);
        if (purchaseDate >= startOfDay && purchaseDate <= endOfDay) {
          inwardToday += baseQty;
          purchasesToday += baseQty;
        } else if (purchaseDate > endOfDay) {
          inwardAfterToday += baseQty;
        }
      }
    }

    const currentStock = Number(product.stock) || 0;
    const closingStock = currentStock - inwardAfterToday + outwardAfterToday;
    const openingStock = closingStock - inwardToday + outwardToday;

    // Determine unique payment modes for today's transactions
    const soldModes: string[] = [];
    productSales.forEach(item => {
      if (item.salesBill) {
        const invDate = new Date(item.salesBill.invDate);
        if (invDate >= startOfDay && invDate <= endOfDay && item.salesBill.paymentMode) {
          if (!soldModes.includes(item.salesBill.paymentMode)) {
            soldModes.push(item.salesBill.paymentMode);
          }
        }
      }
    });

    productShopSales.forEach(item => {
      if (item.shopSalesBill) {
        const saleDate = new Date(item.shopSalesBill.date);
        if (saleDate >= startOfDay && saleDate <= endOfDay && item.shopSalesBill.paymentMode) {
          if (!soldModes.includes(item.shopSalesBill.paymentMode)) {
            soldModes.push(item.shopSalesBill.paymentMode);
          }
        }
      }
    });

    const purchasedModes: string[] = [];
    productPurchases.forEach(item => {
      if (item.purchaseBill) {
        const purchaseDate = new Date(item.purchaseBill.date);
        if (purchaseDate >= startOfDay && purchaseDate <= endOfDay && item.purchaseBill.paymentMode) {
          if (!purchasedModes.includes(item.purchaseBill.paymentMode)) {
            purchasedModes.push(item.purchaseBill.paymentMode);
          }
        }
      }
    });

    const returnedModes: string[] = [];
    productReturns.forEach(item => {
      if (item.salesReturn) {
        const returnDate = new Date(item.salesReturn.returnDate);
        if (returnDate >= startOfDay && returnDate <= endOfDay && item.salesReturn.paymentMode) {
          if (!returnedModes.includes(item.salesReturn.paymentMode)) {
            returnedModes.push(item.salesReturn.paymentMode);
          }
        }
      }
    });

    const mapPaymentMode = (mode: string): string => {
      const m = mode.toLowerCase();
      if (m.includes('upi') || m.includes('online')) return 'Online Pay';
      if (m.includes('card') || m.includes('bank')) return 'Card Pay';
      if (m.includes('credit') || m.includes('ledger')) return 'Credit Pay';
      if (m.includes('cash')) return 'Cash Pay';
      return mode;
    };

    const allModes: string[] = [];
    soldModes.forEach(m => {
      const mapped = mapPaymentMode(m);
      if (!allModes.includes(mapped)) allModes.push(mapped);
    });
    purchasedModes.forEach(m => {
      const mapped = `${mapPaymentMode(m)} (Pur)`;
      if (!allModes.includes(mapped)) allModes.push(mapped);
    });
    returnedModes.forEach(m => {
      const mapped = `${mapPaymentMode(m)} (Ret)`;
      if (!allModes.includes(mapped)) allModes.push(mapped);
    });
    const paymentMode = allModes.join(', ') || '-';

    let status = 'In Stock';
    if (closingStock <= 0) {
      status = 'Out of Stock';
    } else if (closingStock < 10) {
      status = 'Low Stock';
    }

    return {
      id: prodId,
      itemCode: product.itemCode || '',
      name: product.name,
      barcode: product.barcode || '',
      category: product.department || '',
      size: product.size || '',
      uom: product.baseUnit || product.uom || product.unit || 'PCS',
      purchaseRate: Number(product.purchaseRate) || 0,
      price: Number(product.price) || 0,
      openingStock,
      inwardToday: purchasesToday, // only purchases today
      returnsToday, // returns today
      outwardToday, // sold today
      closingStock,
      pendingOrderQty: 0,
      valuation: closingStock * (Number(product.purchaseRate) || 0),
      status,
      paymentMode
    };
  });
};

export const getStockRegisterReport = async (): Promise<any[]> => {
  const products = await searchItems('');

  let salesItems: any[] = [];
  try {
    salesItems = await prisma.salesItem.findMany({
      include: { salesBill: true }
    });
  } catch (e) {
    console.error("Error in getStockRegisterReport salesItems:", e);
  }

  let salesReturnItems: any[] = [];
  try {
    salesReturnItems = await prisma.salesReturnItem.findMany({
      where: { disposition: 'Return to Warehouse' }
    });
    const salesReturns = await prisma.salesReturn.findMany();
    const salesReturnMap = new Map(salesReturns.map(r => [r.id, r]));
    for (const item of salesReturnItems) {
      item.salesReturn = salesReturnMap.get(item.salesReturnId) || null;
    }
  } catch (e) {
    console.error("Error in getStockRegisterReport salesReturnItems:", e);
  }

  let purchaseItems: any[] = [];
  try {
    const db = await getDb();
    purchaseItems = await db.collection('PurchaseItem').find({}).toArray();
    const purchaseBills = await db.collection('PurchaseBill').find({}).toArray();
    const purchaseBillMap = new Map(purchaseBills.map(b => [b._id.toString(), b]));
    for (const item of purchaseItems) {
      item.purchaseBill = purchaseBillMap.get(item.purchaseBillId?.toString()) || null;
    }
  } catch (e) {
    console.error("Error in getStockRegisterReport purchaseItems:", e);
  }

  let purchaseReturnItems: any[] = [];
  try {
    const db = await getDb();
    purchaseReturnItems = await db.collection('PurchaseReturnItem').find({}).toArray();
    const purchaseReturns = await db.collection('PurchaseReturn').find({}).toArray();
    const purchaseReturnMap = new Map(purchaseReturns.map(r => [r._id.toString(), r]));
    for (const item of purchaseReturnItems) {
      item.purchaseReturn = purchaseReturnMap.get(item.purchaseReturnId?.toString()) || null;
    }
  } catch (e) {
    console.error("Error in getStockRegisterReport purchaseReturnItems:", e);
  }

  return products.map(product => {
    const prodId = product.id || product._id;

    const prodSales = salesItems.filter(item => item.productId === prodId);
    const prodReturns = salesReturnItems.filter(item => item.productId === prodId);

    const prodPurchases = purchaseItems.filter(item => {
      const isIdMatch = item.productId && item.productId.toString() === prodId;
      const isCodeMatch = (item.itemCode && product.itemCode && item.itemCode.trim().toLowerCase() === product.itemCode.trim().toLowerCase()) ||
                          (item.vendorItemCode && product.vendorItemCode && item.vendorItemCode.trim().toLowerCase() === product.vendorItemCode.trim().toLowerCase());
      const isNameMatch = (item.itemName && product.name && item.itemName.trim().toLowerCase() === product.name.trim().toLowerCase()) ||
                          (item.itemDesc && product.name && item.itemDesc.trim().toLowerCase() === product.name.trim().toLowerCase());
      return isIdMatch || isCodeMatch || isNameMatch;
    });

    const prodPurchaseReturns = purchaseReturnItems.filter(item => {
      const isIdMatch = item.productId && item.productId.toString() === prodId;
      const isCodeMatch = (item.itemCode && product.itemCode && item.itemCode.trim().toLowerCase() === product.itemCode.trim().toLowerCase());
      const isNameMatch = (item.itemName && product.name && item.itemName.trim().toLowerCase() === product.name.trim().toLowerCase()) ||
                          (item.itemDesc && product.name && item.itemDesc.trim().toLowerCase() === product.name.trim().toLowerCase());
      return isIdMatch || isCodeMatch || isNameMatch;
    });

    const dbMovements: any[] = [];

    for (const item of prodSales) {
      if (item.salesBill) {
        dbMovements.push({
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

    for (const item of prodReturns) {
      if (item.salesReturn) {
        dbMovements.push({
          id: item.id,
          date: item.salesReturn.returnDate,
          vchType: 'Sales Return',
          vchNo: item.salesReturn.returnNo,
          particulars: item.salesReturn.customerName,
          inward: item.returnQty,
          outward: 0
        });
      }
    }

    for (const item of prodPurchases) {
      if (item.purchaseBill) {
        const conv = Number(item.unitsPerPack || item.conversionFactor) > 0 ? Number(item.unitsPerPack || item.conversionFactor) : 1;
        const purQty = Number(item.totalBaseQty) || (((Number(item.qty) || 0) + (Number(item.freeQty) || 0)) * conv);
        dbMovements.push({
          id: item._id?.toString() || item.id,
          date: item.purchaseBill.date,
          vchType: 'Purchase',
          vchNo: item.purchaseBill.voucherNo,
          particulars: item.purchaseBill.supplierName,
          inward: purQty,
          outward: 0
        });
      }
    }

    for (const item of prodPurchaseReturns) {
      if (item.purchaseReturn) {
        const conv = Number(item.unitsPerPack || item.conversionFactor) > 0 ? Number(item.unitsPerPack || item.conversionFactor) : 1;
        const purRetQty = Number(item.totalBaseQty) || (Number(item.returnQty) || 0) * conv;
        dbMovements.push({
          id: item._id?.toString() || item.id,
          date: item.purchaseReturn.returnDate || item.purchaseReturn.createdAt,
          vchType: 'Purchase Return',
          vchNo: item.purchaseReturn.returnNo,
          particulars: item.purchaseReturn.customerName || item.purchaseReturn.supplierName || 'Supplier',
          inward: 0,
          outward: purRetQty
        });
      }
    }

    dbMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalInward = dbMovements.reduce((sum, m) => sum + m.inward, 0);
    const totalOutward = dbMovements.reduce((sum, m) => sum + m.outward, 0);

    const calculatedOpeningBalance = (Number(product.stock) || 0) - totalInward + totalOutward;

    return {
      id: prodId,
      itemCode: product.itemCode || '',
      name: product.name,
      department: product.department || '',
      variety: product.variety || '',
      size: product.size || '',
      uom: product.uom || 'PCS',
      baseUnit: product.baseUnit || product.uom || 'PCS',
      packagings: product.packagings || [],
      conversionFactor: product.conversionFactor || 1,
      purchaseRate: Number(product.purchaseRate) || 0,
      price: Number(product.price) || 0,
      dbStock: Number(product.stock) || 0,
      openingBalance: calculatedOpeningBalance,
      pendingOrderQty: 0,
      movements: dbMovements
    };
  });
};
