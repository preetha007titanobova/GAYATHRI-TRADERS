import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const exportBackup = async (req: Request, res: Response) => {
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
};

export const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { users, categories, products, ledgers, salesBills, salesItems } = req.body;
    
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
};
