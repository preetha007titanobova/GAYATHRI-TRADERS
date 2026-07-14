import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Product } from '../models/product.model';

export const searchItems = async (q: string): Promise<any[]> => {
  return await prisma.product.findMany({
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

export const updateProduct = async (id: string, data: Product): Promise<boolean> => {
  const db = await getDb();
  const updateData: any = { ...data };
  delete updateData._id;
  delete updateData.id;
  const result = await db.collection('Product').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...updateData,
        purchaseRate: Number(data.purchaseRate) || 0,
        price: Number(data.price) || 0,
        mrp: Number(data.mrp) || 0,
        taxPercent: Number(data.taxPercent) || 0,
        stock: Number(data.stock) || 0,
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
      valuation: closingStock * (product.purchaseRate || 0)
    };
  });
};

