"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
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
