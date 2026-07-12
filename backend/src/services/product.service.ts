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
  const result = await db.collection('Product').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...data,
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
