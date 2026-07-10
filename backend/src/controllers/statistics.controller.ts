import { Request, Response } from 'express';
import { prisma, getDb } from '../config/db';

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    
    const getStats = async (collectionName: string) => {
      const count = await db.collection(collectionName).countDocuments();
      const last = await db.collection(collectionName).find().sort({ createdAt: -1 }).limit(1).toArray();
      const lastEntry = last.length > 0 && last[0].createdAt ? new Date(last[0].createdAt).toISOString().split('T')[0] : '--';
      return { count, lastEntry };
    };

    const getPrismaStats = async (modelName: 'product' | 'category' | 'user') => {
      const count = await (prisma[modelName] as any).count();
      const last = await (prisma[modelName] as any).findFirst({ orderBy: { createdAt: 'desc' } });
      const lastEntry = last && last.createdAt ? new Date(last.createdAt).toISOString().split('T')[0] : '--';
      return { count, lastEntry };
    };

    const stats = [
      { id: 1, type: 'Sales Bills', route: '/sales-register', ...(await getStats('SalesBill')) },
      { id: 2, type: 'Sales Returns', route: '/sales-register', ...(await getStats('SalesReturn')) },
      { id: 3, type: 'Sales Orders', route: '/sales-register', ...(await getStats('SalesOrder')) },
      { id: 4, type: 'Quotations', route: '/sales-register', ...(await getStats('Quotation')) },
      { id: 5, type: 'Ledgers', route: '/view-ledger', ...(await getStats('Ledger')) },
      { id: 6, type: 'Item Master', route: '/item-master', ...(await getPrismaStats('product')) },
      { id: 7, type: 'Bank Book', route: '/bank-book', count: 0, lastEntry: '--' },
      { id: 8, type: 'Cash Book', route: '/cash-book', count: 0, lastEntry: '--' },
      { id: 9, type: 'Journal Entries', route: '/journal-entry', count: 0, lastEntry: '--' },
    ];

    res.json(stats);
  } catch (error) {
    console.error('Statistics Error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
