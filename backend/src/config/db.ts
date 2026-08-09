import { PrismaClient } from '@prisma/client';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const prisma = new PrismaClient();

let mongoClientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;
let mongodProcess: any = null;

async function startPortableMongod() {
  if (mongodProcess) return;
  const mongodPath = path.resolve(__dirname, '../../bin/mongod.exe');
  if (!fs.existsSync(mongodPath)) {
    console.warn(`Local portable mongod.exe not found at ${mongodPath}`);
    return;
  }

  const dataDir = path.resolve(__dirname, '../../../mongodb_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log("Launching local portable MongoDB engine from bin/mongod.exe...");
  mongodProcess = spawn(mongodPath, [
    '--dbpath', dataDir,
    '--port', '27017',
    '--bind_ip', '127.0.0.1'
  ], { detached: true });

  if (mongodProcess.unref) mongodProcess.unref();

  // Wait 1.5 seconds for engine startup
  await new Promise(r => setTimeout(r, 1500));
}

export async function getDb(): Promise<Db> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  const defaultUrl = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/GAYATHRI_ERP_DB';

  // 1. Try standard connection to MongoDB on 27017
  try {
    const client = new MongoClient(defaultUrl, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    mongoClientInstance = client;
    dbInstance = client.db('GAYATHRI_ERP_DB');
    isConnected = true;
    console.log("Connected to primary MongoDB server at:", defaultUrl);
    return dbInstance;
  } catch (err: any) {
    console.warn("MongoDB on 27017 not running. Auto-starting local portable mongod.exe database engine...");
  }

  // 2. Auto-start local portable mongod.exe & retry connection
  try {
    await startPortableMongod();
    const client = new MongoClient(defaultUrl, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    mongoClientInstance = client;
    dbInstance = client.db('GAYATHRI_ERP_DB');
    isConnected = true;
    console.log("Successfully connected to local portable MongoDB engine at:", defaultUrl);
    return dbInstance;
  } catch (err2: any) {
    console.error("Failed to connect to MongoDB engine:", err2.message);
    throw err2;
  }
}

export const mongoClient = new MongoClient(process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/GAYATHRI_ERP_DB');

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
  } catch (e: any) {
    console.log("Product database setup note:", e.message);
  }
}
