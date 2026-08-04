import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';

export const sendQuotationEmail = async (data: any): Promise<boolean> => {
  const { quoteNo, quoteDate, customer, totalAmount, items } = data;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const itemsHtml = (items || []).map((item: any) => 
    `<tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.itemCode || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.itemDescription || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity || 0}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">₹${item.unitPrice || 0}</td>
    </tr>`
  ).join('');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'titanobovapvt@gmail.com',
    subject: `Quotation ${quoteNo || 'New'} from Billing System`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Quotation Details</h1>
        </div>
        <div style="padding: 20px;">
          <p><strong>Quote No:</strong> ${quoteNo || 'N/A'}</p>
          <p><strong>Date:</strong> ${quoteDate || 'N/A'}</p>
          <p><strong>Customer:</strong> ${customer || 'N/A'}</p>
          
          <h3 style="margin-top: 30px; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item Code</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: right; background-color: #f9fafb; padding: 15px; border-radius: 6px;">
            <h2 style="margin: 0; color: #4f46e5;">Grand Total: ₹${totalAmount || 0}</h2>
          </div>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  return true;
};

export const getNextSequence = async (): Promise<string> => {
  const db = await getDb();
  const lastQuote = await db.collection('Quotation').find().sort({ createdAt: -1 }).limit(1).toArray();
  
  let nextNum = 1;
  if (lastQuote && lastQuote.length > 0 && lastQuote[0].quoteNo && lastQuote[0].quoteNo.startsWith('QT-')) {
    const parts = lastQuote[0].quoteNo.split('-');
    const numPart = parts[parts.length - 1];
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  
  const today = new Date();
  const month = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

  return `QT-${fy}-${nextNum.toString().padStart(3, '0')}`;
};

export const createQuotation = async (data: any): Promise<any> => {
  const db = await getDb();
  const newQuote = {
    ...data,
    quoteNo: data.quoteNo || await getNextSequence(),
    quoteDate: data.quoteDate ? new Date(data.quoteDate) : new Date(),
    validityDate: data.validityDate ? new Date(data.validityDate) : null,
    customer: data.customer || 'CASH CUSTOMER',
    mobileNo: data.mobileNo || '',
    paymentTerms: data.paymentTerms || '',
    isInterstate: !!data.isInterstate,
    status: data.status || 'SAVED',
    totalQty: Number(data.totalQty) || 0,
    totalTaxable: Number(data.totalTaxable) || 0,
    totalCgst: Number(data.totalCgst) || 0,
    totalSgst: Number(data.totalSgst) || 0,
    totalIgst: Number(data.totalIgst) || 0,
    roundedGrandTotal: Number(data.roundedGrandTotal) || 0,
    items: Array.isArray(data.items) ? data.items : [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('Quotation').insertOne(newQuote);
  return { ...newQuote, _id: result.insertedId };
};

export const getQuotations = async (filters: any = {}): Promise<any[]> => {
  const db = await getDb();
  const query: any = {};

  if (filters.startDate || filters.endDate) {
    query.quoteDate = {};
    if (filters.startDate) {
      query.quoteDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.quoteDate.$lte = end;
    }
  }

  if (filters.q) {
    const regex = new RegExp(filters.q, 'i');
    query.$or = [
      { quoteNo: regex },
      { customer: regex },
      { mobileNo: regex }
    ];
  }

  const quotes = await db.collection('Quotation').find(query).sort({ quoteDate: -1, createdAt: -1 }).toArray();
  return quotes;
};

export const getQuotationById = async (id: string): Promise<any> => {
  const db = await getDb();
  const orConditions: any[] = [{ quoteNo: id }];
  if (ObjectId.isValid(id)) {
    orConditions.push({ _id: new ObjectId(id) });
  }
  return await db.collection('Quotation').findOne({ $or: orConditions });
};

export const deleteQuotation = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const orConditions: any[] = [{ quoteNo: id }];
  if (ObjectId.isValid(id)) {
    orConditions.push({ _id: new ObjectId(id) });
  }
  const res = await db.collection('Quotation').deleteOne({ $or: orConditions });
  return res.deletedCount > 0;
};
