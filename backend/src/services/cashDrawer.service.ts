import { getDb } from '../config/db';

export const getTodayOpeningCash = async (dateStr?: string): Promise<any> => {
  const db = await getDb();
  const date = dateStr || new Date().toISOString().split('T')[0];
  const record = await db.collection('OpeningCash').findOne({ date });
  if (!record) {
    return { hasOpeningCash: false, data: null };
  }
  return {
    hasOpeningCash: true,
    data: {
      ...record,
      id: record._id.toString()
    }
  };
};

export const saveOpeningCash = async (data: any): Promise<any> => {
  const db = await getDb();
  const date = data.date || new Date().toISOString().split('T')[0];
  const payload = {
    date,
    counter: data.counter || 'Counter 1',
    shift: data.shift || 'Morning',
    cashier: data.cashier || 'Admin',
    denominations: data.denominations || {},
    totalOpeningCash: Number(data.totalOpeningCash) || 0,
    remarks: data.remarks || '',
    updatedAt: new Date()
  };

  await db.collection('OpeningCash').updateOne(
    { date },
    {
      $set: payload,
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  const updatedRecord = await db.collection('OpeningCash').findOne({ date });
  return {
    ...updatedRecord,
    id: updatedRecord?._id?.toString()
  };
};

export const getOpeningCashHistory = async (): Promise<any[]> => {
  const db = await getDb();
  const items = await db.collection('OpeningCash')
    .find({})
    .sort({ date: -1, createdAt: -1 })
    .limit(100)
    .toArray();
    
  return items.map(item => ({
    ...item,
    id: item._id.toString()
  }));
};
