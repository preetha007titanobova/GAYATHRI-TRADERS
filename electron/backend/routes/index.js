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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../config/db");
const ledger_route_1 = __importDefault(require("./ledger.route"));
const product_route_1 = __importDefault(require("./product.route"));
const sales_route_1 = __importDefault(require("./sales.route"));
const quotation_route_1 = __importDefault(require("./quotation.route"));
const backup_route_1 = __importDefault(require("./backup.route"));
const statistics_route_1 = __importDefault(require("./statistics.route"));
const purchase_route_1 = __importDefault(require("./purchase.route"));
const staff_route_1 = __importDefault(require("./staff.route"));
const shopSales_route_1 = __importDefault(require("./shopSales.route"));
const cashDrawer_route_1 = __importDefault(require("./cashDrawer.route"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, db_1.getDb)();
        yield db.command({ ping: 1 });
        res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
    }
    catch (err) {
        res.status(503).json({ status: 'starting', db: 'connecting', error: err.message });
    }
}));
router.get('/rupee-font', (req, res) => {
    try {
        const windowsFontPath = 'C:\\Windows\\Fonts\\arial.ttf';
        if (fs_1.default.existsSync(windowsFontPath)) {
            res.setHeader('Content-Type', 'font/ttf');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(windowsFontPath);
        }
    }
    catch (err) {
        console.error('Error sending font file:', err);
    }
    res.status(404).json({ error: 'Font not found' });
});
router.use('/ledgers', ledger_route_1.default);
router.use('/products', product_route_1.default);
router.use('/sales', sales_route_1.default);
router.use('/quotations', quotation_route_1.default);
router.use('/backup', backup_route_1.default);
router.use('/statistics', statistics_route_1.default);
router.use('/purchase-bills', purchase_route_1.default);
router.use('/staff', staff_route_1.default);
router.use('/shop-sales-bills', shopSales_route_1.default);
router.use('/cash-drawer', cashDrawer_route_1.default);
exports.default = router;
