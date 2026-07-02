import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { MongoClient, ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const mongoClient = new MongoClient(process.env.DATABASE_URL as string);

let isConnected = false;

async function getDb() {
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

// Setup database collections and indexes manually to prevent Prisma transaction errors on Atlas Free Tier
async function setupDatabase() {
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

setupDatabase();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json());

// --- API: Send Quotation Email ---
app.post('/api/quotations/send-email', async (req, res) => {
  try {
    const { quoteNo, quoteDate, customer, totalAmount, items } = req.body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const itemsHtml = items.map((item: any) => 
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
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email Error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

// --- API: Next Quotation Sequence ---
app.get('/api/quotations/next-sequence', async (req, res) => {
  try {
    const db = await getDb();
    const lastQuote = await db.collection('Quotation').find().sort({ createdAt: -1 }).limit(1).toArray();
    
    let nextNum = 1;
    if (lastQuote && lastQuote.length > 0 && lastQuote[0].quoteNo && lastQuote[0].quoteNo.startsWith('QT-')) {
      const parts = lastQuote[0].quoteNo.split('-');
      nextNum = parseInt(parts[2] || '0') + 1;
    }
    
    // FY format logic (e.g. 2026-2027)
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    const quoteNo = `QT-${fy}-${nextNum.toString().padStart(3, '0')}`;
    
    res.json({ quoteNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate quotation sequence' });
  }
});

// --- API: Next Invoice Number ---
app.get('/api/sales/next-invoice', async (req, res) => {
  try {
    const lastBill = await prisma.salesBill.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    let nextNum = 1;
    if (lastBill && lastBill.invoiceNo.startsWith('INV-')) {
      const parts = lastBill.invoiceNo.split('-');
      nextNum = parseInt(parts[2] || '0') + 1;
    }
    
    const year = new Date().getFullYear();
    const invoiceNo = `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
    
    res.json({ invoiceNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice sequence' });
  }
});

// --- API: Create Sales Bill ---
app.post('/api/sales', async (req, res) => {
  try {
    const { 
      invoiceNo, invDate, payDays, buyerName, address, eType, 
      mobileNo, gstNo, printIn, invFormat, invoiceFormat, totalQty, totalAmount, 
      cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode 
    } = req.body;
    
    const db = await getDb();

    // Create the bill using native mongodb to bypass transactions
    const billResult = await db.collection('SalesBill').insertOne({
        invoiceNo,
        invDate: new Date(invDate),
        payDays: Number(payDays) || 0,
        buyerName,
        address,
        eType,
        mobileNo,
        gstNo,
        printIn,
        invFormat: invFormat || invoiceFormat,
        totalQty,
        totalAmount,
        cgst,
        sgst,
        roundOff,
        netAmount,
        remarks,
        shippingAddress,
        salesman,
        paymentMode: paymentMode || 'Cash',
        createdAt: new Date()
    });

    // Create the items separately if they exist
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
          salesBillId: billResult.insertedId,
          itemName: item.itemName,
          itemDesc: item.itemDesc,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          discPercent: item.discPercent,
          discAmt: item.discAmt,
          amount: item.amount,
          productId: item.productId ? new ObjectId(item.productId) : null
      }));
      await db.collection('SalesItem').insertMany(itemsToInsert);
    }

    res.json({ success: true, bill: { id: billResult.insertedId.toString(), invoiceNo } });
  } catch (error: any) {
    console.error("Sales Bill Error:", error);
    res.status(500).json({ error: 'Failed to save sales bill', details: error.message });
  }
});

// --- API: Create Sales Order & Commit Stock ---
app.post('/api/sales-orders', async (req, res) => {
  try {
    const { orderNo, orderDate, customer, deliveryDate, paymentTerms, status, isInterstate, summary, items } = req.body;
    
    const db = await getDb();

    // Insert Order Header
    const orderResult = await db.collection('SalesOrder').insertOne({
        orderNo,
        orderDate: new Date(orderDate),
        customer,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms,
        status: status || 'OPEN',
        isInterstate,
        subtotal: summary?.subtotal || 0,
        cgst: summary?.cgst || 0,
        sgst: summary?.sgst || 0,
        igst: summary?.igst || 0,
        rounding: summary?.rounding || 0,
        grandTotal: summary?.grandTotal || 0,
        createdAt: new Date()
    });

    // Insert Order Items and Update Committed Stock
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
          salesOrderId: orderResult.insertedId,
          orderNo,
          lineId: item.lineId,
          lineIndex: item.lineIndex,
          itemCode: item.itemCode,
          itemDescription: item.itemDescription,
          quantityOrdered: Number(item.quantityOrdered) || 0,
          quantityFulfilled: Number(item.quantityFulfilled) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          discountPercentage: Number(item.discountPercentage) || 0,
          taxableAmount: Number(item.taxableAmount) || 0,
          taxRatePercentage: Number(item.taxRatePercentage) || 0,
          cgstAmount: Number(item.cgstAmount) || 0,
          sgstAmount: Number(item.sgstAmount) || 0,
          igstAmount: Number(item.igstAmount) || 0,
          lineSubTotal: Number(item.lineSubTotal) || 0
      }));
      await db.collection('SalesOrderItem').insertMany(itemsToInsert);

      // Increment Committed Stock in Product Collection
      for (const item of itemsToInsert) {
        if (item.quantityOrdered > 0 && (item.itemCode || item.itemDescription)) {
          // Attempt to match by itemCode, barcode, or name
          await prisma.product.updateMany({
            where: {
              OR: [
                { itemCode: item.itemCode },
                { barcode: item.itemCode },
                { name: item.itemDescription }
              ]
            },
            data: {
              committedStock: {
                increment: item.quantityOrdered
              }
            }
          });
        }
      }
    }

    res.json({ success: true, order: { id: orderResult.insertedId.toString(), orderNo } });
  } catch (error: any) {
    console.error("Sales Order Error:", error);
    res.status(500).json({ error: 'Failed to save sales order', details: error.message });
  }
});

// --- API: Search Items ---
app.get('/api/items/search', async (req, res) => {
  try {
    const q = req.query.q as string || '';
    const products = await prisma.product.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' } 
      },
      take: 100
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search items' });
  }
});

// --- API: Seed Mock Items ---
app.post('/api/seed', async (req, res) => {
  try {
    const items = [
      { name: 'Almonds Premium 1kg', price: 15.99, stock: 100, barcode: 'A123' },
      { name: 'Walnuts Organic 500g', price: 12.50, stock: 50, barcode: 'W456' },
      { name: 'Cashews Roasted 250g', price: 8.00, stock: 200, barcode: 'C789' }
    ];
    
    for (const item of items) {
      await prisma.product.upsert({
        where: { barcode: item.barcode },
        update: {},
        create: {
          name: item.name,
          price: item.price,
          stock: item.stock,
          barcode: item.barcode
        }
      });
    }
    res.json({ success: true, message: 'Mock data seeded' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Seeding failed', details: error.message });
  }
});

// --- API: Ledger Master ---
app.get('/api/ledgers/next-code', async (req, res) => {
  try {
    const lastLedger = await prisma.ledger.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    let nextNum = 1;
    if (lastLedger && lastLedger.ledgerCode.startsWith('LDG-')) {
      const parts = lastLedger.ledgerCode.split('-');
      nextNum = parseInt(parts[1] || '0') + 1;
    }
    
    const ledgerCode = `LDG-${nextNum.toString().padStart(3, '0')}`;
    res.json({ ledgerCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate ledger code' });
  }
});

app.get('/api/ledgers/search', async (req, res) => {
  try {
    const q = req.query.q as string || '';
    const group = req.query.group as string || '';
    const db = await getDb();
    
    let query: any = {};
    if (q) {
      query.accountName = { $regex: q, $options: 'i' };
    }
    if (group) {
      // In LedgerMaster we use 'Sundry Debtors', handle exact or case-insensitive if needed
      query.accountGroup = { $regex: `^${group}$`, $options: 'i' };
    }
    
    const ledgers = await db.collection('Ledger').find(query).limit(100).toArray();
    res.json(ledgers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search ledgers' });
  }
});

app.post('/api/ledgers', async (req, res) => {
  try {
    const { 
      ledgerCode, accountName, alias, accountGroup, contactPerson, mobileNo, 
      email, panNo, address, city, state, pincode, gstNo, bankName, accountNo, ifscCode, openingBalance, drCr, creditLimit, defaultCreditPeriod, registrationType
    } = req.body;

    const db = await getDb();
    const result = await db.collection('Ledger').insertOne({
        ledgerCode, accountName, alias, accountGroup, contactPerson, mobileNo,
        email, panNo, address, city, state, pincode, gstNo, bankName, accountNo, ifscCode,
        openingBalance: Number(openingBalance) || 0, 
        drCr, 
        creditLimit: Number(creditLimit) || 0,
        defaultCreditPeriod: Number(defaultCreditPeriod) || 0,
        registrationType,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    res.json({ success: true, ledger: { id: result.insertedId.toString(), ledgerCode, accountName } });
  } catch (error: any) {
    console.error("Ledger Error:", error);
    res.status(500).json({ error: 'Failed to save ledger', details: error.message });
  }
});

// --- API: Backup & Restore ---
app.get('/api/backup/export', async (req, res) => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      users: await prisma.user.findMany(),
      categories: await prisma.category.findMany(),
      products: await prisma.product.findMany(),
      ledgers: await prisma.ledger.findMany(),
      salesBills: await prisma.salesBill.findMany(),
      salesItems: await prisma.salesItem.findMany()
    };
    
    res.setHeader('Content-disposition', `attachment; filename=ERP_Backup_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('Backup Export Error:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

app.post('/api/backup/restore', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { users, categories, products, ledgers, salesBills, salesItems } = req.body;
    
    // In MongoDB Prisma, bulk deletes and creates are straight forward.
    // We execute sequentially to ensure complete wipe before insert.
    await prisma.$transaction(async (tx) => {
      // 1. Wipe current collections
      await tx.salesItem.deleteMany();
      await tx.salesBill.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.ledger.deleteMany();
      await tx.user.deleteMany();
      
      // 2. Insert data from backup (if present)
      if (users && users.length > 0) await tx.user.createMany({ data: users });
      if (categories && categories.length > 0) await tx.category.createMany({ data: categories });
      if (products && products.length > 0) await tx.product.createMany({ data: products });
      if (ledgers && ledgers.length > 0) await tx.ledger.createMany({ data: ledgers });
      if (salesBills && salesBills.length > 0) await tx.salesBill.createMany({ data: salesBills });
      if (salesItems && salesItems.length > 0) await tx.salesItem.createMany({ data: salesItems });
    });

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error: any) {
    console.error('Backup Restore Error:', error);
    res.status(500).json({ error: 'Failed to restore database', details: error.message });
  }
});

// --- API: Item Master (Products) ---
app.get('/api/products/next-code', async (req, res) => {
  try {
    const lastProduct = await prisma.product.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { itemCode: { not: null } }
    });
    
    let nextNum = 1001; // Start from 1001 to match legacy style
    if (lastProduct && lastProduct.itemCode?.startsWith('ITM-')) {
      const parts = lastProduct.itemCode.split('-');
      nextNum = parseInt(parts[1] || '1000') + 1;
    }
    
    const itemCode = `ITM-${nextNum}`;
    res.json({ itemCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate item code' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      itemCode, name, barcode, uom, purchaseRate, price, mrp, taxPercent, stock 
    } = req.body;

    const db = await getDb();
    const result = await db.collection('Product').insertOne({
        itemCode, 
        name, 
        barcode: barcode || null,
        uom: uom || 'PCS',
        purchaseRate: Number(purchaseRate) || 0,
        price: Number(price) || 0,
        mrp: Number(mrp) || 0,
        taxPercent: Number(taxPercent) || 0,
        stock: Number(stock) || 0,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    res.json({ success: true, product: { id: result.insertedId.toString(), itemCode, name } });
  } catch (error: any) {
    console.error("Product Error:", error);
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      if (error.message.includes('barcode')) {
        return res.status(400).json({ error: 'A product with this barcode already exists.', details: error.message });
      }
      if (error.message.includes('itemCode')) {
        return res.status(400).json({ error: 'Item Code already exists. Please refresh the page to get the next available code.', details: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to save product', details: error.message });
  }
});

// --- API: Search Sales Bills ---
app.get('/api/sales-bills/search', async (req, res) => {
  try {
    const q = req.query.q as string || '';
    const db = await getDb();
    const bills = await db.collection('SalesBill').find({
      invoiceNo: { $regex: q, $options: 'i' }
    }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json(bills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search sales bills' });
  }
});

// --- API: Get Sales Bill by Invoice No ---
app.get('/api/sales-bills/:invoiceNo', async (req, res) => {
  try {
    const { invoiceNo } = req.params;
    const db = await getDb();
    const bill = await db.collection('SalesBill').findOne({ invoiceNo });
    if (!bill) {
      return res.status(404).json({ error: 'Sales bill not found' });
    }
    const items = await db.collection('SalesItem').find({ salesBillId: bill._id }).toArray();
    res.json({ ...bill, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sales bill details' });
  }
});

// --- API: Next Sales Return Sequence ---
app.get('/api/sales-returns/next-sequence', async (req, res) => {
  try {
    const db = await getDb();
    const lastReturn = await db.collection('SalesReturn').find().sort({ createdAt: -1 }).limit(1).toArray();
    
    let nextNum = 1;
    if (lastReturn && lastReturn.length > 0 && lastReturn[0].returnNo && lastReturn[0].returnNo.startsWith('CN-')) {
      const parts = lastReturn[0].returnNo.split('-');
      nextNum = parseInt(parts[2] || '0') + 1;
    }
    
    const today = new Date();
    const month = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    const returnNo = `CN-${fy}-${nextNum.toString().padStart(4, '0')}`;
    
    res.json({ returnNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate return sequence' });
  }
});

// --- API: Create Sales Return ---
app.post('/api/sales-returns', async (req, res) => {
  try {
    const { 
      returnNo, returnDate, originalInvoice, customerName, reason, 
      totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items 
    } = req.body;
    
    const db = await getDb();

    // 1. Create the return document
    const returnResult = await db.collection('SalesReturn').insertOne({
        returnNo,
        returnDate: new Date(returnDate),
        originalInvoice,
        customerName,
        reason,
        totalReturnAmount,
        cgstReturn,
        sgstReturn,
        igstReturn,
        roundOff,
        netRefundAmount,
        createdAt: new Date()
    });

    // 2. Create the return items & handle inventory
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
          salesReturnId: returnResult.insertedId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          invoicedQty: item.invoicedQty,
          returnQty: item.returnQty,
          unitPrice: item.unitPrice,
          taxableAmt: item.taxableAmt,
          taxPercent: item.taxPercent,
          disposition: item.disposition,
          subtotal: item.subtotal,
          productId: item.productId ? new ObjectId(item.productId) : null
      }));
      await db.collection('SalesReturnItem').insertMany(itemsToInsert);

      // Increment Physical Stock if 'Return to Warehouse'
      for (const item of itemsToInsert) {
        if (item.returnQty > 0 && item.disposition === 'Return to Warehouse' && (item.itemCode || item.itemName)) {
          await prisma.product.updateMany({
            where: {
              OR: [
                { itemCode: item.itemCode },
                { name: item.itemName }
              ]
            },
            data: {
              stock: {
                increment: item.returnQty
              }
            }
          });
        }
      }
    }

    // 3. Double-Entry Impact: Find Ledger and decrease Account Receivable liability (by crediting them)
    if (customerName && netRefundAmount > 0) {
      // Look for the customer ledger by name
      const ledger = await db.collection('Ledger').findOne({ accountName: customerName });
      if (ledger) {
        // Simple logic: credit the balance. A customer usually has a Debit balance. Crediting reduces what they owe us.
        // Assuming openingBalance represents the current outstanding amount for now based on the simple schema.
        await db.collection('Ledger').updateOne(
          { _id: ledger._id },
          { $inc: { openingBalance: -netRefundAmount } }
        );
      }
    }

    res.json({ success: true, returnNote: { id: returnResult.insertedId.toString(), returnNo } });
  } catch (error: any) {
    console.error("Sales Return Error:", error);
    res.status(500).json({ error: 'Failed to save sales return', details: error.message });
  }
});

// --- API: Stock Ledger (Movements) ---
app.get('/api/stock-ledger/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Outward Movements (Sales)
    const salesItems = await prisma.salesItem.findMany({
      where: { productId },
      include: { salesBill: true }
    });

    // Inward Movements (Sales Returns)
    const returnItems = await prisma.salesReturnItem.findMany({
      where: { productId, disposition: 'Return to Warehouse' },
      include: { salesReturn: true }
    });

    let movements = [];

    for (const item of salesItems) {
      if (item.salesBill) {
        movements.push({
          id: item.id,
          date: item.salesBill.invDate,
          vchType: 'Sales',
          vchNo: item.salesBill.invoiceNo,
          particulars: item.salesBill.buyerName,
          inward: 0,
          outward: item.qty
        });
      }
    }

    for (const item of returnItems) {
      if (item.salesReturn) {
        movements.push({
          id: item.id,
          date: item.salesReturn.returnDate,
          vchType: 'Sales Return',
          vchNo: item.salesReturn.returnNo,
          particulars: item.salesReturn.customerName,
          inward: item.returnQty,
          outward: 0
        });
      }
    }

    // Sort by date ascending
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate historical opening balance
    // The current `product.stock` is the closing balance.
    // So opening balance = closing balance - total inward + total outward
    const totalInward = movements.reduce((sum, m) => sum + m.inward, 0);
    const totalOutward = movements.reduce((sum, m) => sum + m.outward, 0);
    
    // We assume product.stock is the current actual stock.
    // However, if the user manually updates product.stock, this backward calculation might yield a weird initial stock.
    // In a real ERP, we store opening balance separately. But for now this provides a consistent ledger.
    const calculatedOpeningBalance = product.stock - totalInward + totalOutward;

    res.json({ 
      productId,
      productName: product.name,
      currentStock: product.stock,
      openingBalance: calculatedOpeningBalance,
      movements 
    });
  } catch (error) {
    console.error('Stock Ledger Error:', error);
    res.status(500).json({ error: 'Failed to fetch stock ledger' });
  }
});

// --- API: Statistics ---
app.get('/api/statistics', async (req, res) => {
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
});

app.listen(PORT, () => {
});
