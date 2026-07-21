import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e);
}

dotenv.config();

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
    if (e.code !== 48) { // 48 = NamespaceExists
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
}
