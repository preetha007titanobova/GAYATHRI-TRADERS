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

    const stats = [
      { id: 1, type: 'Sales Bills', route: '/sales-register', ...(await getStats('SalesBill')) },
      { id: 2, type: 'Sales Returns', route: '/sales-register', ...(await getStats('SalesReturn')) },
      { id: 3, type: 'Sales Orders', route: '/sales-register', ...(await getStats('SalesOrder')) },
      { id: 4, type: 'Quotations', route: '/sales-register', ...(await getStats('Quotation')) },
      { id: 5, type: 'Ledgers', route: '/view-ledger', ...(await getStats('Ledger')) },
      { id: 6, type: 'Item Master', route: '/item-master', ...(await getStats('Product')) },
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

export const getDashboardStatistics = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const openOrders = await db.collection('SalesOrder').find({ status: 'Open' }).toArray();
    const partialOrders = await db.collection('SalesOrder').find({ status: 'Partial' }).toArray();
    const completedOrdersCount = await db.collection('SalesOrder').countDocuments({ status: 'Completed' });
    const cancelledOrdersCount = await db.collection('SalesOrder').countDocuments({ status: 'Cancelled' });

    // Pending Delivery Amount: sum of balanceAmount for Open and Partial orders
    const pendingDeliveryAmount = [...openOrders, ...partialOrders].reduce((sum, o: any) => sum + (o.balanceAmount || 0), 0);

    const todaysOrdersCount = await db.collection('SalesOrder').countDocuments({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });

    const thisMonthsOrdersCount = await db.collection('SalesOrder').countDocuments({
      createdAt: {
        $gte: monthStart
      }
    });

    res.json({
      totalOpenOrders: openOrders.length,
      totalPartialOrders: partialOrders.length,
      completedOrders: completedOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      pendingDeliveryAmount,
      todaysOrders: todaysOrdersCount,
      thisMonthsOrders: thisMonthsOrdersCount
    });
  } catch (error) {
    console.error('Dashboard Statistics Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};
