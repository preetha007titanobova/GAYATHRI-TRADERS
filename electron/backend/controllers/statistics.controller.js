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
exports.getDashboardStatistics = exports.getStatistics = void 0;
const db_1 = require("../config/db");
const getStatistics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, db_1.getDb)();
        const getStats = (collectionName) => __awaiter(void 0, void 0, void 0, function* () {
            const count = yield db.collection(collectionName).countDocuments();
            const last = yield db.collection(collectionName).find().sort({ createdAt: -1 }).limit(1).toArray();
            const lastEntry = last.length > 0 && last[0].createdAt ? new Date(last[0].createdAt).toISOString().split('T')[0] : '--';
            return { count, lastEntry };
        });
        const getPrismaStats = (modelName) => __awaiter(void 0, void 0, void 0, function* () {
            const count = yield db_1.prisma[modelName].count();
            const last = yield db_1.prisma[modelName].findFirst({ orderBy: { createdAt: 'desc' } });
            const lastEntry = last && last.createdAt ? new Date(last.createdAt).toISOString().split('T')[0] : '--';
            return { count, lastEntry };
        });
        const stats = [
            Object.assign({ id: 1, type: 'Sales Bills', route: '/sales-register' }, (yield getStats('SalesBill'))),
            Object.assign({ id: 2, type: 'Sales Returns', route: '/sales-register' }, (yield getStats('SalesReturn'))),
            Object.assign({ id: 3, type: 'Sales Orders', route: '/sales-register' }, (yield getStats('SalesOrder'))),
            Object.assign({ id: 4, type: 'Quotations', route: '/sales-register' }, (yield getStats('Quotation'))),
            Object.assign({ id: 5, type: 'Ledgers', route: '/view-ledger' }, (yield getStats('Ledger'))),
            Object.assign({ id: 6, type: 'Item Master', route: '/item-master' }, (yield getPrismaStats('product'))),
            { id: 7, type: 'Bank Book', route: '/bank-book', count: 0, lastEntry: '--' },
            { id: 8, type: 'Cash Book', route: '/cash-book', count: 0, lastEntry: '--' },
            { id: 9, type: 'Journal Entries', route: '/journal-entry', count: 0, lastEntry: '--' },
        ];
        res.json(stats);
    }
    catch (error) {
        console.error('Statistics Error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
exports.getStatistics = getStatistics;
const getDashboardStatistics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const openOrders = (yield ((_a = db_1.prisma.salesOrder) === null || _a === void 0 ? void 0 : _a.findMany({ where: { status: 'Open' } }))) || [];
        const partialOrders = (yield ((_b = db_1.prisma.salesOrder) === null || _b === void 0 ? void 0 : _b.findMany({ where: { status: 'Partial' } }))) || [];
        const completedOrdersCount = (yield ((_c = db_1.prisma.salesOrder) === null || _c === void 0 ? void 0 : _c.count({ where: { status: 'Completed' } }))) || 0;
        const cancelledOrdersCount = (yield ((_d = db_1.prisma.salesOrder) === null || _d === void 0 ? void 0 : _d.count({ where: { status: 'Cancelled' } }))) || 0;
        // Pending Delivery Amount: sum of balanceAmount for Open and Partial orders
        const pendingDeliveryAmount = [...openOrders, ...partialOrders].reduce((sum, o) => sum + (o.balanceAmount || 0), 0);
        const todaysOrdersCount = (yield ((_e = db_1.prisma.salesOrder) === null || _e === void 0 ? void 0 : _e.count({
            where: {
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd
                }
            }
        }))) || 0;
        const thisMonthsOrdersCount = (yield ((_f = db_1.prisma.salesOrder) === null || _f === void 0 ? void 0 : _f.count({
            where: {
                createdAt: {
                    gte: monthStart
                }
            }
        }))) || 0;
        res.json({
            totalOpenOrders: openOrders.length,
            totalPartialOrders: partialOrders.length,
            completedOrders: completedOrdersCount,
            cancelledOrders: cancelledOrdersCount,
            pendingDeliveryAmount,
            todaysOrders: todaysOrdersCount,
            thisMonthsOrders: thisMonthsOrdersCount
        });
    }
    catch (error) {
        console.error('Dashboard Statistics Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});
exports.getDashboardStatistics = getDashboardStatistics;
