"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getStockRegisterReport = exports.uploadPdf = exports.closeDay = exports.getDailyStockStatus = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getNextProductCode = exports.seedMockItems = exports.searchItems = exports.getByBarcode = void 0;
const db_1 = require("../config/db");
const productService = __importStar(require("../services/product.service"));
const notificationService = __importStar(require("../services/notification.service"));
const getByBarcode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const code = req.params.code;
        const product = yield productService.getProductByBarcode(code);
        if (!product) {
            return res.status(404).json({ error: 'Barcode not found' });
        }
        res.json(product);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to find product by barcode' });
    }
});
exports.getByBarcode = getByBarcode;
const searchItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const products = yield productService.searchItems(q);
        res.json(products);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search items' });
    }
});
exports.searchItems = searchItems;
const seedMockItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const items = [
            { itemCode: 'ITM-100002', name: "Men's Shirt", price: 799, mrp: 799, stock: 50, barcode: '100002', size: 'L', department: 'Mens', uom: 'PCS' },
            { name: 'Almonds Premium 1kg', price: 15.99, stock: 100, barcode: 'A123' },
            { name: 'Walnuts Organic 500g', price: 12.50, stock: 50, barcode: 'W456' },
            { name: 'Cashews Roasted 250g', price: 8.00, stock: 200, barcode: 'C789' }
        ];
        for (const item of items) {
            yield db_1.prisma.product.upsert({
                where: { barcode: item.barcode },
                update: {},
                create: {
                    name: item.name,
                    price: item.price,
                    stock: item.stock,
                    barcode: item.barcode,
                    size: item.size
                }
            });
        }
        res.json({ success: true, message: 'Mock data seeded' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Seeding failed', details: error.message });
    }
});
exports.seedMockItems = seedMockItems;
const getNextProductCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const itemCode = yield productService.getNextProductCode();
        res.json({ itemCode });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate item code' });
    }
});
exports.getNextProductCode = getNextProductCode;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield productService.createProduct(req.body);
        res.json({
            success: true,
            product: {
                id: result.insertedId.toString(),
                itemCode: req.body.itemCode,
                name: req.body.name
            }
        });
    }
    catch (error) {
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
exports.createProduct = createProduct;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield productService.updateProduct(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true, message: 'Product updated successfully' });
    }
    catch (error) {
        console.error("Update Product Error:", error);
        if (error.code === 11000) {
            if (error.message.includes('barcode')) {
                return res.status(400).json({ error: 'A product with this barcode already exists.', details: error.message });
            }
            if (error.message.includes('itemCode')) {
                return res.status(400).json({ error: 'Item Code already exists. Please refresh the page to get the next available code.', details: error.message });
            }
        }
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield productService.deleteProduct(id);
        if (!success) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true, message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error("Delete Product Error:", error);
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
});
exports.deleteProduct = deleteProduct;
const getDailyStockStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const data = yield productService.getDailyStockStatus(date);
        res.json(data);
    }
    catch (error) {
        console.error("Daily Stock Status Error:", error);
        res.status(500).json({ error: 'Failed to fetch daily stock status', details: error.message });
    }
});
exports.getDailyStockStatus = getDailyStockStatus;
const closeDay = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date, pdf, email } = req.body;
        if (!pdf) {
            return res.status(400).json({ error: 'PDF data is required' });
        }
        const filename = `Daily_Stock_Status_${date === null || date === void 0 ? void 0 : date.replace(/-/g, '_')}.pdf`;
        const pdfUrl = yield notificationService.uploadPdfToTmpFiles(pdf, filename);
        const emailSuccess = yield notificationService.sendCloseDayEmail(date, pdf, email);
        res.json({
            success: true,
            emailSuccess,
            pdfUrl,
            message: 'Close Day completed'
        });
    }
    catch (error) {
        console.error("Close Day Error:", error);
        res.status(500).json({ error: 'Failed to complete Close Day', details: error.message });
    }
});
exports.closeDay = closeDay;
const uploadPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pdf, filename } = req.body;
        if (!pdf) {
            return res.status(400).json({ error: 'PDF data is required' });
        }
        const pdfUrl = yield notificationService.uploadPdfToTmpFiles(pdf, filename || 'report.pdf');
        res.json({ success: true, pdfUrl });
    }
    catch (error) {
        console.error("Upload PDF Error:", error);
        res.status(500).json({ error: 'Failed to upload PDF', details: error.message });
    }
});
exports.uploadPdf = uploadPdf;
const getStockRegisterReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield productService.getStockRegisterReport();
        res.json(data);
    }
    catch (error) {
        console.error("Stock Register Report Error:", error);
        res.status(500).json({ error: 'Failed to fetch stock register report', details: error.message });
    }
});
exports.getStockRegisterReport = getStockRegisterReport;
