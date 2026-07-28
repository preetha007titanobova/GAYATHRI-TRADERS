import { PrismaClient } from '../generated/client';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('mongodb+srv')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch (e) {
    console.warn('Could not set custom DNS servers:', e);
  }
}

export const prisma = new PrismaClient();
export const mongoClient = new MongoClient(process.env.DATABASE_URL as string);

let isConnected = false;

export async function getDb() {
  if (!isConnected) {
    try {
      await mongoClient.connect();
      isConnected = true;
    } catch (e) {
      console.error("MongoDB Connection Error:", e);
      throw e;
    }
  }
  return mongoClient.db();
}

export async function setupDatabase() {
  try {
    await prisma.$runCommandRaw({ create: "Ledger" });
    console.log("Ledger collection ready");
  } catch (e: any) {
    if (e.code !== 48) {
      console.log("Setup note:", e.message);
    }
  }

  try {
    await prisma.$runCommandRaw({
      createIndexes: "Ledger",
      indexes: [{ key: { ledgerCode: 1 }, name: "ledgerCode_1", unique: true }]
    });
    console.log("Ledger indexes ready");
  } catch (e: any) {
    console.log("Index setup note:", e.message);
  }

  // Ensure Product collection and indexes for fast barcode scanning
  try {
    const db = await getDb();
    await db.collection('Product').createIndex({ barcode: 1 });
    await db.collection('Product').createIndex({ itemCode: 1 });
    // Automatically sanitize and reset any negative stock products to 0
    await db.collection('Product').updateMany(
      { stock: { $lt: 0 } },
      { $set: { stock: 0 } }
    );
    try {
      await prisma.product.updateMany({
        where: { stock: { lt: 0 } },
        data: { stock: 0 }
      });
    } catch (pe) {
      console.warn("Prisma stock cleanup note:", pe);
    }
    console.log("Product database setup & stock non-negative sanitization ready");

    // Seed sample product 100002 if missing
    const existing = await db.collection('Product').findOne({
      $or: [{ barcode: '100002' }, { itemCode: 'ITM-100002' }]
    });

    if (!existing) {
      await db.collection('Product').insertOne({
        itemCode: 'ITM-100002',
        name: "Men's Shirt",
        barcode: '100002',
        size: 'L',
        department: 'Mens',
        variety: 'Formal',
        uom: 'PCS',
        purchaseRate: 450,
        price: 799,
        mrp: 799,
        taxPercent: 5,
        stock: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Seeded default barcode product 100002 (Men's Shirt, Size: L, Price: 799)");
    }
  } catch (e: any) {
    console.log("Product database setup note:", e.message);
  }
}
