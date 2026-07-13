import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { ObjectId } from 'mongodb';

export const createPayment = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { customerName, amount, paymentMode, date, notes } = req.body;
    
    const payment = {
      customerName,
      amount: Number(amount) || 0,
      paymentMode,
      date: date ? new Date(date) : new Date(),
      notes: notes || '',
      createdAt: new Date()
    };

    const result = await db.collection('Payment').insertOne(payment);
    res.json({ success: true, id: result.insertedId.toString() });
  } catch (error: any) {
    console.error("Create Payment Error:", error);
    res.status(500).json({ error: 'Failed to save payment', details: error.message });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const customerName = req.query.customerName as string;
    let query: any = {};
    if (customerName) {
      query.customerName = customerName;
    }
    const payments = await db.collection('Payment').find(query).sort({ date: -1 }).toArray();
    res.json(payments);
  } catch (error: any) {
    console.error("Get Payments Error:", error);
    res.status(500).json({ error: 'Failed to load payments' });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const result = await db.collection('Payment').deleteOne({ _id: new ObjectId(id as string) });
    res.json({ success: result.deletedCount > 0 });
  } catch (error: any) {
    console.error("Delete Payment Error:", error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
};
