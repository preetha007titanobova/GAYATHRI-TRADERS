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
exports.getOpeningCashHistory = exports.getTodayOpeningCash = exports.saveOpeningCash = void 0;
const db_1 = require("../config/db");
const saveOpeningCash = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date, counter = 'Counter 1', shift = 'Morning', cashier = 'Admin', denominations, totalOpeningCash = 0, remarks = '' } = req.body;
        const todayStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];
        // Try Prisma first, fallback to raw MongoDB
        let record;
        try {
            record = yield db_1.prisma.openingCash.upsert({
                where: { dateStr: todayStr },
                update: {
                    counter,
                    shift,
                    cashier,
                    denominations,
                    totalOpeningCash: Number(totalOpeningCash) || 0,
                    remarks,
                    updatedAt: new Date()
                },
                create: {
                    dateStr: todayStr,
                    date: date ? new Date(date) : new Date(),
                    counter,
                    shift,
                    cashier,
                    denominations,
                    totalOpeningCash: Number(totalOpeningCash) || 0,
                    remarks
                }
            });
        }
        catch (prismaErr) {
            const db = yield (0, db_1.getDb)();
            const collection = db.collection('OpeningCash');
            const updateData = {
                dateStr: todayStr,
                date: date ? new Date(date) : new Date(),
                counter,
                shift,
                cashier,
                denominations,
                totalOpeningCash: Number(totalOpeningCash) || 0,
                remarks,
                updatedAt: new Date()
            };
            yield collection.updateOne({ dateStr: todayStr }, { $set: updateData, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
            record = updateData;
        }
        res.json({
            success: true,
            message: 'Opening Cash Status saved successfully',
            data: record
        });
    }
    catch (error) {
        console.error('Error saving opening cash:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to save opening cash' });
    }
});
exports.saveOpeningCash = saveOpeningCash;
const getTodayOpeningCash = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dateParam = req.query.date || new Date().toISOString().split('T')[0];
        let record = null;
        try {
            record = yield db_1.prisma.openingCash.findUnique({
                where: { dateStr: dateParam }
            });
        }
        catch (e) {
            const db = yield (0, db_1.getDb)();
            record = yield db.collection('OpeningCash').findOne({ dateStr: dateParam });
        }
        if (record) {
            res.json({ success: true, hasOpeningCash: true, data: record });
        }
        else {
            res.json({ success: true, hasOpeningCash: false, data: null });
        }
    }
    catch (error) {
        console.error('Error fetching today opening cash:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch opening cash status' });
    }
});
exports.getTodayOpeningCash = getTodayOpeningCash;
const getOpeningCashHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let history = [];
        try {
            history = yield db_1.prisma.openingCash.findMany({
                orderBy: { date: 'desc' },
                take: 30
            });
        }
        catch (e) {
            const db = yield (0, db_1.getDb)();
            history = yield db.collection('OpeningCash').find().sort({ date: -1 }).limit(30).toArray();
        }
        res.json({ success: true, data: history });
    }
    catch (error) {
        console.error('Error fetching opening cash history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getOpeningCashHistory = getOpeningCashHistory;
