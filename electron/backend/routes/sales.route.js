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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const salesController = __importStar(require("../controllers/sales.controller"));
const router = (0, express_1.Router)();
// Sales Bills
router.get('/next-invoice', salesController.getNextInvoice);
router.post('/', salesController.createSalesBill);
router.put('/:id', salesController.updateSalesBill);
router.delete('/:id', salesController.deleteSalesBill);
router.get('/search', salesController.searchSalesBills);
router.get('/bills/search', salesController.searchSalesBills);
router.get('/bills/:invoiceNo', salesController.getSalesBillByInvoiceNo);
// Sales Orders
router.get('/orders/next-sequence', salesController.getNextSalesOrderSequence);
router.post('/orders', salesController.createSalesOrder);
router.get('/orders/search', salesController.searchSalesOrders);
router.get('/orders/:id', salesController.getSalesOrderDetails);
router.put('/orders/:id', salesController.updateSalesOrder);
router.put('/orders/:id/cancel', salesController.cancelSalesOrder);
router.delete('/orders/:id', salesController.deleteSalesOrder);
// Sales Returns
router.get('/returns/next-sequence', salesController.getNextSalesReturnSequence);
router.post('/returns', salesController.createSalesReturn);
router.get('/returns/search', salesController.searchSalesReturns);
router.get('/returns/:id', salesController.getSalesReturnDetails);
router.put('/returns/:id', salesController.updateSalesReturn);
router.delete('/returns/:id', salesController.deleteSalesReturn);
router.get('/returns/invoice/:invoiceNo', salesController.getReturnsByInvoice);
// Sales Status Report
router.get('/status/report', salesController.getSalesStatusReport);
// Stock Ledger
router.get('/stock-ledger/:productId', salesController.getStockLedger);
exports.default = router;
