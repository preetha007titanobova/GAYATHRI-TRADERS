"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreBackup = exports.exportBackup = void 0;
const db_1 = require("../config/db");
const exportBackup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            users: yield db_1.prisma.user.findMany(),
            categories: yield db_1.prisma.category.findMany(),
            products: yield db_1.prisma.product.findMany(),
            ledgers: yield db_1.prisma.ledger.findMany(),
            salesBills: yield db_1.prisma.salesBill.findMany(),
            salesItems: yield db_1.prisma.salesItem.findMany(),
            salesReturns: yield db_1.prisma.salesReturn.findMany(),
            salesReturnItems: yield db_1.prisma.salesReturnItem.findMany(),
            purchaseBills: yield db_1.prisma.purchaseBill.findMany(),
            purchaseItems: yield db_1.prisma.purchaseItem.findMany(),
            salesOrders: yield db_1.prisma.salesOrder.findMany(),
            salesOrderItems: yield db_1.prisma.salesOrderItem.findMany(),
            staff: yield db_1.prisma.staff.findMany(),
            staffAttendances: yield db_1.prisma.staffAttendance.findMany(),
            shopSalesBills: yield db_1.prisma.shopSalesBill.findMany(),
            shopSalesItems: yield db_1.prisma.shopSalesItem.findMany()
        };
        res.setHeader('Content-disposition', `attachment; filename=ERP_Backup_${new Date().toISOString().split('T')[0]}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(backup, null, 2));
    }
    catch (error) {
        console.error('Backup Export Error:', error);
        res.status(500).json({ error: 'Failed to export database' });
    }
});
exports.exportBackup = exportBackup;
const restoreBackup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { users, categories, products, ledgers, salesBills, salesItems, salesReturns, salesReturnItems, purchaseBills, purchaseItems, salesOrders, salesOrderItems, staff, staffAttendances, shopSalesBills, shopSalesItems } = req.body;
        yield db_1.prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Wipe current collections (order to prevent foreign keys issues if any)
            yield tx.shopSalesItem.deleteMany();
            yield tx.shopSalesBill.deleteMany();
            yield tx.staffAttendance.deleteMany();
            yield tx.staff.deleteMany();
            yield tx.salesOrderItem.deleteMany();
            yield tx.salesOrder.deleteMany();
            yield tx.purchaseItem.deleteMany();
            yield tx.purchaseBill.deleteMany();
            yield tx.salesReturnItem.deleteMany();
            yield tx.salesReturn.deleteMany();
            yield tx.salesItem.deleteMany();
            yield tx.salesBill.deleteMany();
            yield tx.product.deleteMany();
            yield tx.category.deleteMany();
            yield tx.ledger.deleteMany();
            yield tx.user.deleteMany();
            // 2. Insert data from backup (if present)
            if (users && users.length > 0)
                yield tx.user.createMany({ data: users });
            if (categories && categories.length > 0)
                yield tx.category.createMany({ data: categories });
            if (products && products.length > 0)
                yield tx.product.createMany({ data: products });
            if (ledgers && ledgers.length > 0)
                yield tx.ledger.createMany({ data: ledgers });
            if (salesBills && salesBills.length > 0)
                yield tx.salesBill.createMany({ data: salesBills });
            if (salesItems && salesItems.length > 0)
                yield tx.salesItem.createMany({ data: salesItems });
            if (salesReturns && salesReturns.length > 0)
                yield tx.salesReturn.createMany({ data: salesReturns });
            if (salesReturnItems && salesReturnItems.length > 0)
                yield tx.salesReturnItem.createMany({ data: salesReturnItems });
            if (purchaseBills && purchaseBills.length > 0)
                yield tx.purchaseBill.createMany({ data: purchaseBills });
            if (purchaseItems && purchaseItems.length > 0)
                yield tx.purchaseItem.createMany({ data: purchaseItems });
            if (salesOrders && salesOrders.length > 0)
                yield tx.salesOrder.createMany({ data: salesOrders });
            if (salesOrderItems && salesOrderItems.length > 0)
                yield tx.salesOrderItem.createMany({ data: salesOrderItems });
            if (staff && staff.length > 0)
                yield tx.staff.createMany({ data: staff });
            if (staffAttendances && staffAttendances.length > 0)
                yield tx.staffAttendance.createMany({ data: staffAttendances });
            if (shopSalesBills && shopSalesBills.length > 0)
                yield tx.shopSalesBill.createMany({ data: shopSalesBills });
            if (shopSalesItems && shopSalesItems.length > 0)
                yield tx.shopSalesItem.createMany({ data: shopSalesItems });
        }));
        res.json({ success: true, message: 'Database restored successfully' });
    }
    catch (error) {
        console.error('Backup Restore Error:', error);
        res.status(500).json({ error: 'Failed to restore database', details: error.message });
    }
});
exports.restoreBackup = restoreBackup;
