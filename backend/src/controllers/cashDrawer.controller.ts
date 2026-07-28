import { Request, Response } from 'express';
import { prisma, getDb } from '../config/db';

export const saveOpeningCash = async (req: Request, res: Response) => {
  try {
    const {
      date,
      counter = 'Counter 1',
      shift = 'Morning',
      cashier = 'Admin',
      denominations,
      totalOpeningCash = 0,
      remarks = ''
    } = req.body;

    const todayStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];

    // Try Prisma first, fallback to raw MongoDB
    let record;
    try {
      record = await (prisma as any).openingCash.upsert({
        where: { dateStr: todayStr },
        update: {
          counter,
          shift,
          cashier,
          denominations,
          totalOpeningCash: Number(totalOpeningCash) || 0,
          remarks,
          updatedAt: new Date()
        },
        create: {
          dateStr: todayStr,
          date: date ? new Date(date) : new Date(),
          counter,
          shift,
          cashier,
          denominations,
          totalOpeningCash: Number(totalOpeningCash) || 0,
          remarks
        }
      });
    } catch (prismaErr) {
      const db = await getDb();
      const collection = db.collection('OpeningCash');
      const updateData = {
        dateStr: todayStr,
        date: date ? new Date(date) : new Date(),
        counter,
        shift,
        cashier,
        denominations,
        totalOpeningCash: Number(totalOpeningCash) || 0,
        remarks,
        updatedAt: new Date()
      };
      await collection.updateOne(
        { dateStr: todayStr },
        { $set: updateData, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      record = updateData;
    }

    res.json({
      success: true,
      message: 'Opening Cash Status saved successfully',
      data: record
    });
  } catch (error: any) {
    console.error('Error saving opening cash:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save opening cash' });
  }
};

export const getTodayOpeningCash = async (req: Request, res: Response) => {
  try {
    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];

    let record = null;
    try {
      record = await (prisma as any).openingCash.findUnique({
        where: { dateStr: dateParam }
      });
    } catch (e) {
      const db = await getDb();
      record = await db.collection('OpeningCash').findOne({ dateStr: dateParam });
    }

    if (record) {
      res.json({ success: true, hasOpeningCash: true, data: record });
    } else {
      res.json({ success: true, hasOpeningCash: false, data: null });
    }
  } catch (error: any) {
    console.error('Error fetching today opening cash:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch opening cash status' });
  }
};

export const getOpeningCashHistory = async (req: Request, res: Response) => {
  try {
    let history = [];
    try {
      history = await (prisma as any).openingCash.findMany({
        orderBy: { date: 'desc' },
        take: 30
      });
    } catch (e) {
      const db = await getDb();
      history = await db.collection('OpeningCash').find().sort({ date: -1 }).limit(30).toArray();
    }
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching opening cash history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
