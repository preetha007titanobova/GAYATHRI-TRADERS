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
      salesItems: await prisma.salesItem.findMany(),
      salesReturns: await prisma.salesReturn.findMany(),
      salesReturnItems: await prisma.salesReturnItem.findMany(),
      purchaseBills: await prisma.purchaseBill.findMany(),
      purchaseItems: await prisma.purchaseItem.findMany(),
      salesOrders: await prisma.salesOrder.findMany(),
      salesOrderItems: await prisma.salesOrderItem.findMany(),
      staff: await prisma.staff.findMany(),
      staffAttendances: await prisma.staffAttendance.findMany(),
      shopSalesBills: await prisma.shopSalesBill.findMany(),
      shopSalesItems: await prisma.shopSalesItem.findMany()
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
    const { 
      users, categories, products, ledgers, salesBills, salesItems,
      salesReturns, salesReturnItems, purchaseBills, purchaseItems,
      salesOrders, salesOrderItems, staff, staffAttendances,
      shopSalesBills, shopSalesItems
    } = req.body;
    
    await prisma.$transaction(async (tx) => {
      // 1. Wipe current collections (order to prevent foreign keys issues if any)
      await tx.shopSalesItem.deleteMany();
      await tx.shopSalesBill.deleteMany();
      await tx.staffAttendance.deleteMany();
      await tx.staff.deleteMany();
      await tx.salesOrderItem.deleteMany();
      await tx.salesOrder.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.purchaseBill.deleteMany();
      await tx.salesReturnItem.deleteMany();
      await tx.salesReturn.deleteMany();
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
      if (salesReturns && salesReturns.length > 0) await tx.salesReturn.createMany({ data: salesReturns });
      if (salesReturnItems && salesReturnItems.length > 0) await tx.salesReturnItem.createMany({ data: salesReturnItems });
      if (purchaseBills && purchaseBills.length > 0) await tx.purchaseBill.createMany({ data: purchaseBills });
      if (purchaseItems && purchaseItems.length > 0) await tx.purchaseItem.createMany({ data: purchaseItems });
      if (salesOrders && salesOrders.length > 0) await tx.salesOrder.createMany({ data: salesOrders });
      if (salesOrderItems && salesOrderItems.length > 0) await tx.salesOrderItem.createMany({ data: salesOrderItems });
      if (staff && staff.length > 0) await tx.staff.createMany({ data: staff });
      if (staffAttendances && staffAttendances.length > 0) await tx.staffAttendance.createMany({ data: staffAttendances });
      if (shopSalesBills && shopSalesBills.length > 0) await tx.shopSalesBill.createMany({ data: shopSalesBills });
      if (shopSalesItems && shopSalesItems.length > 0) await tx.shopSalesItem.createMany({ data: shopSalesItems });
    });

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error: any) {
    console.error('Backup Restore Error:', error);
    res.status(500).json({ error: 'Failed to restore database', details: error.message });
  }
};

export const resetDatabase = async (req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.shopSalesItem.deleteMany();
      await tx.shopSalesBill.deleteMany();
      await tx.staffAttendance.deleteMany();
      await tx.staff.deleteMany();
      await tx.salesOrderItem.deleteMany();
      await tx.salesOrder.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.purchaseBill.deleteMany();
      await tx.salesReturnItem.deleteMany();
      await tx.salesReturn.deleteMany();
      await tx.salesItem.deleteMany();
      await tx.salesBill.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.ledger.deleteMany();
    });
    res.json({ success: true, message: 'Database reset completed successfully' });
  } catch (error: any) {
    console.error('Database Reset Error:', error);
    res.status(500).json({ error: 'Failed to reset database', details: error.message });
  }
};
