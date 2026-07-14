import { ObjectId } from 'mongodb';
import { prisma, getDb } from '../config/db';
import { Ledger } from '../models/ledger.model';

export const getNextLedgerCode = async (): Promise<string> => {
  const lastLedger = await prisma.ledger.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  let nextNum = 1;
  if (lastLedger && lastLedger.ledgerCode) {
    const parts = lastLedger.ledgerCode.split('-');
    const currentNum = parseInt(parts[1]);
    if (!isNaN(currentNum)) {
      nextNum = currentNum + 1;
    }
  }
  return `LDG-${nextNum.toString().padStart(3, '0')}`;
};

export const searchLedgers = async (q: string, group?: string): Promise<Ledger[]> => {
  const db = await getDb();
  let query: any = {};
  if (q) {
    query.accountName = { $regex: q, $options: 'i' };
  }
  if (group) {
    query.accountGroup = { $regex: `^${group}$`, $options: 'i' };
  }
  return (await db.collection('Ledger').find(query).limit(100).toArray()) as unknown as Ledger[];
};

export const createLedger = async (data: Ledger): Promise<any> => {
  const db = await getDb();
  return await db.collection('Ledger').insertOne({
    ...data,
    openingBalance: Number(data.openingBalance) || 0,
    creditLimit: Number(data.creditLimit) || 0,
    defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

export const updateLedger = async (id: string, data: Ledger): Promise<boolean> => {
  const db = await getDb();
  const updateData: any = { ...data };
  delete updateData._id;
  delete updateData.id;
  const result = await db.collection('Ledger').updateOne(
    { _id: new ObjectId(id as string) },
    {
      $set: {
        ...updateData,
        openingBalance: Number(data.openingBalance) || 0,
        creditLimit: Number(data.creditLimit) || 0,
        defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0,
        updatedAt: new Date()
      }
    }
  );
  return result.matchedCount > 0;
};

export const deleteLedger = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Ledger').deleteOne({ _id: new ObjectId(id as string) });
  return result.deletedCount > 0;
};
