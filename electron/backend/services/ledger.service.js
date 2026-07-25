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
exports.getLedgerStatement = exports.deleteLedger = exports.updateLedger = exports.createLedger = exports.searchLedgers = exports.getNextLedgerCode = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const getNextLedgerCode = () => __awaiter(void 0, void 0, void 0, function* () {
    const lastLedger = yield db_1.prisma.ledger.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    let nextNum = 1;
    if (lastLedger && lastLedger.ledgerCode) {
        const parts = lastLedger.ledgerCode.split('-');
        const currentNum = parseInt(parts[1]);
        if (!isNaN(currentNum)) {
            nextNum = currentNum + 1;
        }
    }
    return `LDG-${nextNum.toString().padStart(3, '0')}`;
});
exports.getNextLedgerCode = getNextLedgerCode;
const searchLedgers = (q, group) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let query = {};
    if (q) {
        query.$or = [
            { accountName: { $regex: q, $options: 'i' } },
            { ledgerCode: { $regex: q, $options: 'i' } }
        ];
    }
    if (group && group.trim() !== '') {
        if (group.toLowerCase().includes('customer') || group.toLowerCase().includes('debtor')) {
            query.accountGroup = { $regex: 'customer|debtor', $options: 'i' };
        }
        else if (group.toLowerCase().includes('supplier') || group.toLowerCase().includes('creditor')) {
            query.accountGroup = { $regex: 'supplier|creditor', $options: 'i' };
        }
        else {
            query.accountGroup = { $regex: group, $options: 'i' };
        }
    }
    const items = yield db.collection('Ledger').find(query).limit(100).toArray();
    return items.map(item => (Object.assign(Object.assign({}, item), { id: item._id.toString(), _id: item._id.toString() })));
});
exports.searchLedgers = searchLedgers;
const createLedger = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    return yield db.collection('Ledger').insertOne(Object.assign(Object.assign({}, data), { openingBalance: Number(data.openingBalance) || 0, creditLimit: Number(data.creditLimit) || 0, defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0, createdAt: new Date(), updatedAt: new Date() }));
});
exports.createLedger = createLedger;
const updateLedger = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const result = yield db.collection('Ledger').updateOne({ _id: new mongodb_1.ObjectId(id) }, {
        $set: Object.assign(Object.assign({}, data), { openingBalance: Number(data.openingBalance) || 0, creditLimit: Number(data.creditLimit) || 0, defaultCreditPeriod: Number(data.defaultCreditPeriod) || 0, updatedAt: new Date() })
    });
    return result.matchedCount > 0;
});
exports.updateLedger = updateLedger;
const deleteLedger = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const result = yield db.collection('Ledger').deleteOne({ _id: new mongodb_1.ObjectId(id) });
    return result.deletedCount > 0;
});
exports.deleteLedger = deleteLedger;
const getLedgerStatement = (id, fromDateStr, toDateStr) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const ledger = yield db.collection('Ledger').findOne({ _id: new mongodb_1.ObjectId(id) });
    if (!ledger) {
        throw new Error('Ledger not found');
    }
    const accountName = ledger.accountName;
    const accountGroup = ledger.accountGroup || '';
    const movements = [];
    const salesBills = yield db.collection('SalesBill').find({}).toArray();
    const salesReturns = yield db.collection('SalesReturn').find({}).toArray();
    const purchaseBills = yield db.collection('PurchaseBill').find({}).toArray();
    const purchaseReturns = yield db.collection('PurchaseReturn').find({}).toArray();
    const shopSalesBills = yield db.collection('ShopSalesBill').find({}).toArray();
    const addMovement = (idStr, date, particulars, vchType, vchNo, dr, cr) => {
        movements.push({
            id: idStr,
            date: date.toISOString().split('T')[0],
            dateObj: date,
            particulars,
            vchType,
            vchNo,
            dr: Number(dr) || 0,
            cr: Number(cr) || 0
        });
    };
    if (accountGroup.toLowerCase().includes('customer') || accountGroup.toLowerCase().includes('debtor')) {
        salesBills.forEach((bill) => {
            var _a;
            if (bill.buyerName === accountName) {
                const billDate = new Date(bill.invDate || bill.createdAt);
                addMovement(`sales-${bill._id}`, billDate, 'To Sales A/c', 'Sales Bill', bill.invoiceNo, bill.netPayable, 0);
                if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash' || !bill.paymentMode) {
                    addMovement(`sales-pay-${bill._id}`, billDate, 'By Cash Receipt', 'Receipt', bill.invoiceNo, 0, bill.netPayable);
                }
            }
        });
        salesReturns.forEach((ret) => {
            var _a;
            if (ret.customerName === accountName) {
                const retDate = new Date(ret.returnDate || ret.createdAt);
                addMovement(`sales-ret-${ret._id}`, retDate, 'By Sales Return A/c', 'Sales Return', ret.returnNo, 0, ret.netRefundAmount);
                if (((_a = ret.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                    addMovement(`sales-ret-pay-${ret._id}`, retDate, 'To Cash Paid', 'Payment', ret.returnNo, ret.netRefundAmount, 0);
                }
            }
        });
    }
    else if (accountGroup.toLowerCase().includes('supplier') || accountGroup.toLowerCase().includes('creditor')) {
        purchaseBills.forEach((bill) => {
            var _a;
            if (bill.supplierName === accountName) {
                const billDate = new Date(bill.date || bill.createdAt);
                addMovement(`purchase-${bill._id}`, billDate, 'By Purchase A/c', 'Purchase Bill', bill.voucherNo, 0, bill.netPayable);
                if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                    addMovement(`purchase-pay-${bill._id}`, billDate, 'To Cash Paid', 'Payment', bill.voucherNo, bill.netPayable, 0);
                }
            }
        });
        purchaseReturns.forEach((ret) => {
            var _a;
            if (ret.customerName === accountName) {
                const retDate = new Date(ret.returnDate || ret.createdAt);
                addMovement(`purchase-ret-${ret._id}`, retDate, 'To Purchase Return A/c', 'Purchase Return', ret.returnNo, ret.netReturnAmount, 0);
                if (((_a = ret.settlementMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                    addMovement(`purchase-ret-pay-${ret._id}`, retDate, 'By Cash Receipt', 'Receipt', ret.returnNo, 0, ret.netReturnAmount);
                }
            }
        });
    }
    else if (accountGroup.toLowerCase().includes('shop') || accountGroup.toLowerCase().includes('branch')) {
        shopSalesBills.forEach((bill) => {
            var _a;
            if (bill.shopName === accountName) {
                const billDate = new Date(bill.date || bill.createdAt);
                addMovement(`shop-sales-${bill._id}`, billDate, 'To Wholesale Sales A/c', 'Shop Sales Bill', bill.voucherNo, bill.netPayable, 0);
                if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                    addMovement(`shop-sales-pay-${bill._id}`, billDate, 'By Cash Receipt', 'Receipt', bill.voucherNo, 0, bill.netPayable);
                }
            }
        });
    }
    else if (accountGroup.toLowerCase().includes('cash')) {
        salesBills.forEach((bill) => {
            var _a;
            if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash' || !bill.paymentMode) {
                const billDate = new Date(bill.invDate || bill.createdAt);
                addMovement(`cash-sale-${bill._id}`, billDate, `To Sales A/c (${bill.buyerName})`, 'Sales Bill', bill.invoiceNo, bill.netPayable, 0);
            }
        });
        salesReturns.forEach((ret) => {
            var _a;
            if (((_a = ret.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                const retDate = new Date(ret.returnDate || ret.createdAt);
                addMovement(`cash-sale-ret-${ret._id}`, retDate, `By Sales Return (${ret.customerName})`, 'Sales Return', ret.returnNo, 0, ret.netRefundAmount);
            }
        });
        purchaseBills.forEach((bill) => {
            var _a;
            if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                const billDate = new Date(bill.date || bill.createdAt);
                addMovement(`cash-purchase-${bill._id}`, billDate, `By Purchase A/c (${bill.supplierName})`, 'Purchase Bill', bill.voucherNo, 0, bill.netPayable);
            }
        });
        purchaseReturns.forEach((ret) => {
            var _a;
            if (((_a = ret.settlementMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                const retDate = new Date(ret.returnDate || ret.createdAt);
                addMovement(`cash-purchase-ret-${ret._id}`, retDate, `To Purchase Return (${ret.customerName})`, 'Purchase Return', ret.returnNo, ret.netReturnAmount, 0);
            }
        });
        shopSalesBills.forEach((bill) => {
            var _a;
            if (((_a = bill.paymentMode) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'cash') {
                const billDate = new Date(bill.date || bill.createdAt);
                addMovement(`cash-shop-sale-${bill._id}`, billDate, `To Wholesale Sales (${bill.shopName})`, 'Shop Sales Bill', bill.voucherNo, bill.netPayable, 0);
            }
        });
    }
    movements.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return {
        ledger: {
            id: ledger._id.toString(),
            ledgerCode: ledger.ledgerCode,
            accountName: ledger.accountName,
            accountGroup: ledger.accountGroup,
            openingBalance: Number(ledger.openingBalance) || 0,
            drCr: ledger.drCr || 'Dr'
        },
        movements
    };
});
exports.getLedgerStatement = getLedgerStatement;
