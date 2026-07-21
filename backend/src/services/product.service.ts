import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Product } from '../models/product.model';

export const getProductByBarcode = async (barcode: string): Promise<any> => {
  try {
    const db = await getDb();
    let product = await db.collection('Product').findOne({
      $or: [{ barcode: barcode }, { itemCode: barcode }]
    });
    if (!product) {
      try {
        product = await prisma.product.findFirst({
          where: {
            OR: [{ barcode: barcode }, { itemCode: barcode }]
          }
        });
      } catch (e) {
        console.error("Prisma barcode search error:", e);
      }
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
          { variety: regex },
          { department: regex },
          { size: regex }
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
          { variety: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
          { size: { contains: q, mode: 'insensitive' } }
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
        size: item.size || '',
        price: Number(item.price) || 0,
        stock: Number(item.stock) || 0
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
  return await db.collection('Product').insertOne({
    ...data,
    purchaseRate: Number(data.purchaseRate) || 0,
    price: Number(data.price) || 0,
    mrp: Number(data.mrp) || 0,
    taxPercent: Number(data.taxPercent) || 0,
    stock: Number(data.stock) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

export const updateProduct = async (id: string, data: any): Promise<boolean> => {
  const db = await getDb();
  const { id: _, _id, createdAt, updatedAt, ...updatableFields } = data;
  const result = await db.collection('Product').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...updatableFields,
        purchaseRate: Number(data.purchaseRate) || 0,
        price: Number(data.price) || 0,
        mrp: Number(data.mrp) || 0,
        taxPercent: Number(data.taxPercent) || 0,
        stock: Math.round(Number(data.stock) || 0),
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

  return products.map(product => {
    const prodId = product.id || product._id;

    const productSales = salesItems.filter(item => item.productId === prodId);
    const productReturns = salesReturnItems.filter(item => item.productId === prodId);
    const productPurchases = purchaseItems.filter(item => item.productId?.toString() === prodId || (item.itemCode === product.itemCode));

    let outwardToday = 0;
    let inwardToday = 0;
    let outwardAfterToday = 0;
    let inwardAfterToday = 0;

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

    for (const item of productReturns) {
      if (item.salesReturn) {
        const returnDate = new Date(item.salesReturn.returnDate);
        if (returnDate >= startOfDay && returnDate <= endOfDay) {
          inwardToday += item.returnQty || 0;
        } else if (returnDate > endOfDay) {
          inwardAfterToday += item.returnQty || 0;
        }
      }
    }

    for (const item of productPurchases) {
      if (item.purchaseBill) {
        const purchaseDate = new Date(item.purchaseBill.date);
        if (purchaseDate >= startOfDay && purchaseDate <= endOfDay) {
          inwardToday += item.qty || 0;
        } else if (purchaseDate > endOfDay) {
          inwardAfterToday += item.qty || 0;
        }
      }
    }

    const currentStock = Number(product.stock) || 0;
    const closingStock = currentStock - inwardAfterToday + outwardAfterToday;
    const openingStock = closingStock - inwardToday + outwardToday;

    return {
      id: prodId,
      itemCode: product.itemCode || '',
      name: product.name,
      uom: product.uom || 'PCS',
      purchaseRate: Number(product.purchaseRate) || 0,
      price: Number(product.price) || 0,
      openingStock,
      inwardToday,
      outwardToday,
      closingStock,
      pendingOrderQty: 0,
      valuation: closingStock * (Number(product.purchaseRate) || 0)
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

  return products.map(product => {
    const prodId = product.id || product._id;

    const prodSales = salesItems.filter(item => item.productId === prodId);
    const prodReturns = salesReturnItems.filter(item => item.productId === prodId);
    const prodPurchases = purchaseItems.filter(item => item.productId?.toString() === prodId || (item.itemCode === product.itemCode));

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
        dbMovements.push({
          id: item._id?.toString() || item.id,
          date: item.purchaseBill.date,
          vchType: 'Purchase',
          vchNo: item.purchaseBill.voucherNo,
          particulars: item.purchaseBill.supplierName,
          inward: item.qty,
          outward: 0
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
      purchaseRate: Number(product.purchaseRate) || 0,
      price: Number(product.price) || 0,
      dbStock: Number(product.stock) || 0,
      openingBalance: calculatedOpeningBalance,
      pendingOrderQty: 0,
      movements: dbMovements
    };
  });
};
