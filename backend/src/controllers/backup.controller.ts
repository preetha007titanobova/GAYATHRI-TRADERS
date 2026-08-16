import { Request, Response } from 'express';
import { prisma, getDb } from '../config/db';

export const exportBackup = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const backup = {
      timestamp: new Date().toISOString(),
      users: await db.collection('User').find({}).toArray(),
      categories: await db.collection('Category').find({}).toArray(),
      products: await db.collection('Product').find({}).toArray(),
      ledgers: await db.collection('Ledger').find({}).toArray(),
      salesBills: await db.collection('SalesBill').find({}).toArray(),
      salesItems: await db.collection('SalesItem').find({}).toArray()
    };
    
    res.setHeader('Content-disposition', `attachment; filename=ERP_Backup_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('Backup Export Error:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
};

export const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { users, categories, products, ledgers, salesBills, salesItems } = req.body;
    const db = await getDb();
    
    // 1. Wipe current collections
    await db.collection('SalesItem').deleteMany({});
    await db.collection('SalesBill').deleteMany({});
    await db.collection('Product').deleteMany({});
    await db.collection('Category').deleteMany({});
    await db.collection('Ledger').deleteMany({});
    await db.collection('User').deleteMany({});
    
    // 2. Insert data from backup (if present)
    if (users && users.length > 0) await db.collection('User').insertMany(users);
    if (categories && categories.length > 0) await db.collection('Category').insertMany(categories);
    if (products && products.length > 0) await db.collection('Product').insertMany(products);
    if (ledgers && ledgers.length > 0) await db.collection('Ledger').insertMany(ledgers);
    if (salesBills && salesBills.length > 0) await db.collection('SalesBill').insertMany(salesBills);
    if (salesItems && salesItems.length > 0) await db.collection('SalesItem').insertMany(salesItems);

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error: any) {
    console.error('Backup Restore Error:', error);
    res.status(500).json({ error: 'Failed to restore database', details: error.message });
  }
};
