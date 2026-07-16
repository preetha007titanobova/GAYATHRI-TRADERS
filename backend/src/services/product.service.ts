import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Product } from '../models/product.model';

export const searchItems = async (q: string): Promise<any[]> => {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { itemCode: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { variety: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
        { size: { contains: q, mode: 'insensitive' } }
      ]
    },
    take: 100
  });

  const pendingItems = await prisma.salesOrderItem.groupBy({
    by: ['productId', 'itemCode', 'itemName'],
    where: {
      salesOrder: {
        status: { in: ['Open', 'Partial'] }
      }
    },
    _sum: {
      pendingQty: true
    }
  });

  const pendingMap = new Map<string, number>();
  const pendingByCodeMap = new Map<string, number>();
  const pendingByNameMap = new Map<string, number>();

  for (const item of pendingItems) {
    const qty = item._sum.pendingQty || 0;
    if (qty > 0) {
      if (item.productId) pendingMap.set(item.productId, qty);
      if (item.itemCode) pendingByCodeMap.set(item.itemCode, qty);
      if (item.itemName) pendingByNameMap.set(item.itemName.toLowerCase(), qty);
    }
  }

  return products.map((p: any) => {
    const qty = pendingMap.get(p.id) || pendingByCodeMap.get(p.itemCode || '') || pendingByNameMap.get(p.name.toLowerCase()) || 0;
    return {
      ...p,
      pendingOrderQty: qty
    };
  });
};

export const getNextProductCode = async (): Promise<string> => {
  const lastProduct = await prisma.product.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { itemCode: { not: null } }
  });
  
  let nextNum = 1001; // Start from 1001 to match legacy style
  if (lastProduct && lastProduct.itemCode?.startsWith('ITM-')) {
    const parts = lastProduct.itemCode.split('-');
    nextNum = parseInt(parts[1] || '1000') + 1;
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

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  const salesItems = await prisma.salesItem.findMany({
    where: {
      salesBill: {
        invDate: { gte: startOfDay }
      }
    },
    include: {
      salesBill: true
    }
  });

  const salesReturnItems = await prisma.salesReturnItem.findMany({
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

  // Dynamic Sales Order pending quantities
  const pendingItems = await prisma.salesOrderItem.groupBy({
    by: ['productId', 'itemCode', 'itemName'],
    where: {
      salesOrder: {
        status: { in: ['Open', 'Partial'] }
      }
    },
    _sum: {
      pendingQty: true
    }
  });

  const pendingMap = new Map<string, number>();
  const pendingByCodeMap = new Map<string, number>();
  const pendingByNameMap = new Map<string, number>();

  for (const item of pendingItems) {
    const qty = item._sum.pendingQty || 0;
    if (qty > 0) {
      if (item.productId) pendingMap.set(item.productId, qty);
      if (item.itemCode) pendingByCodeMap.set(item.itemCode, qty);
      if (item.itemName) pendingByNameMap.set(item.itemName.toLowerCase(), qty);
    }
  }

  return products.map(product => {
    const prodId = product.id;

    const productSales = salesItems.filter(item => item.productId === prodId);
    const productReturns = salesReturnItems.filter(item => item.productId === prodId);

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

    const currentStock = product.stock || 0;
    const closingStock = currentStock - inwardAfterToday + outwardAfterToday;
    const openingStock = closingStock - inwardToday + outwardToday;
    const pendingOrderQty = pendingMap.get(product.id) || pendingByCodeMap.get(product.itemCode || '') || pendingByNameMap.get(product.name.toLowerCase()) || 0;

    return {
      id: product.id,
      itemCode: product.itemCode || '',
      name: product.name,
      uom: product.uom || 'PCS',
      purchaseRate: product.purchaseRate || 0,
      price: product.price || 0,
      openingStock,
      inwardToday,
      outwardToday,
      closingStock,
      pendingOrderQty,
      valuation: closingStock * (product.purchaseRate || 0)
    };
  });
};

export const getStockRegisterReport = async (): Promise<any[]> => {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  const salesItems = await prisma.salesItem.findMany({
    include: {
      salesBill: true
    }
  }) as any[];

  const salesReturnItems = await prisma.salesReturnItem.findMany({
    where: {
      disposition: 'Return to Warehouse'
    }
  }) as any[];

  const salesReturns = await prisma.salesReturn.findMany();
  const salesReturnMap = new Map(salesReturns.map(r => [r.id, r]));
  for (const item of salesReturnItems) {
    item.salesReturn = salesReturnMap.get(item.salesReturnId) || null;
  }

  // Dynamic Sales Order pending quantities
  const pendingItems = await prisma.salesOrderItem.groupBy({
    by: ['productId', 'itemCode', 'itemName'],
    where: {
      salesOrder: {
        status: { in: ['Open', 'Partial'] }
      }
    },
    _sum: {
      pendingQty: true
    }
  });

  const pendingMap = new Map<string, number>();
  const pendingByCodeMap = new Map<string, number>();
  const pendingByNameMap = new Map<string, number>();

  for (const item of pendingItems) {
    const qty = item._sum.pendingQty || 0;
    if (qty > 0) {
      if (item.productId) pendingMap.set(item.productId, qty);
      if (item.itemCode) pendingByCodeMap.set(item.itemCode, qty);
      if (item.itemName) pendingByNameMap.set(item.itemName.toLowerCase(), qty);
    }
  }

  return products.map(product => {
    const prodId = product.id;

    const prodSales = salesItems.filter(item => item.productId === prodId);
    const prodReturns = salesReturnItems.filter(item => item.productId === prodId);

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

    dbMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalInward = dbMovements.reduce((sum, m) => sum + m.inward, 0);
    const totalOutward = dbMovements.reduce((sum, m) => sum + m.outward, 0);

    const calculatedOpeningBalance = (product.stock || 0) - totalInward + totalOutward;
    const pendingOrderQty = pendingMap.get(product.id) || pendingByCodeMap.get(product.itemCode || '') || pendingByNameMap.get(product.name.toLowerCase()) || 0;

    return {
      id: product.id,
      itemCode: product.itemCode || '',
      name: product.name,
      department: product.department || '',
      variety: product.variety || '',
      size: product.size || '',
      uom: product.uom || 'PCS',
      purchaseRate: product.purchaseRate || 0,
      price: product.price || 0,
      dbStock: product.stock || 0,
      openingBalance: calculatedOpeningBalance,
      pendingOrderQty,
      movements: dbMovements
    };
  });
};


