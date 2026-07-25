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
exports.getReturnsByInvoice = exports.getSalesStatusReport = exports.getStockLedger = exports.deleteSalesReturn = exports.updateSalesReturn = exports.getSalesReturnDetails = exports.searchSalesReturns = exports.createSalesReturn = exports.getNextSalesReturnSequence = exports.deleteSalesOrder = exports.cancelSalesOrder = exports.updateSalesOrder = exports.getSalesOrderDetails = exports.searchSalesOrders = exports.createSalesOrder = exports.getNextSalesOrderSequence = exports.getSalesBillByInvoiceNo = exports.searchSalesBills = exports.deleteSalesBill = exports.updateSalesBill = exports.createSalesBill = exports.getNextInvoice = void 0;
const salesService = __importStar(require("../services/sales.service"));
const getNextInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const invoiceNo = yield salesService.getNextInvoice();
        res.json({ invoiceNo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate invoice sequence' });
    }
});
exports.getNextInvoice = getNextInvoice;
const createSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bill = yield salesService.createSalesBill(req.body);
        res.json({ success: true, bill });
    }
    catch (error) {
        console.error("Sales Bill Error:", error);
        res.status(500).json({ error: 'Failed to save sales bill', details: error.message });
    }
});
exports.createSalesBill = createSalesBill;
const updateSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.updateSalesBill(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Sales bill not found' });
        }
        res.json({ success: true, message: 'Sales Bill updated successfully' });
    }
    catch (error) {
        console.error("Update Sales Bill Error:", error);
        res.status(500).json({ error: 'Failed to update sales bill', details: error.message });
    }
});
exports.updateSalesBill = updateSalesBill;
const deleteSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.deleteSalesBill(id);
        if (!success) {
            return res.status(404).json({ error: 'Sales bill not found' });
        }
        res.json({ success: true, message: 'Sales Bill deleted successfully' });
    }
    catch (error) {
        console.error("Delete Sales Bill Error:", error);
        res.status(500).json({ error: 'Failed to delete sales bill', details: error.message });
    }
});
exports.deleteSalesBill = deleteSalesBill;
const searchSalesBills = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const bills = yield salesService.searchSalesBills(q);
        res.json(bills);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search sales bills' });
    }
});
exports.searchSalesBills = searchSalesBills;
const getSalesBillByInvoiceNo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { invoiceNo } = req.params;
        const bill = yield salesService.getSalesBillByInvoiceNo(invoiceNo);
        if (!bill) {
            return res.status(404).json({ error: 'Sales bill not found' });
        }
        res.json(bill);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch sales bill details' });
    }
});
exports.getSalesBillByInvoiceNo = getSalesBillByInvoiceNo;
const getNextSalesOrderSequence = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderNo = yield salesService.getNextSalesOrderSequence();
        res.json({ orderNo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate order sequence' });
    }
});
exports.getNextSalesOrderSequence = getNextSalesOrderSequence;
const createSalesOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const order = yield salesService.createSalesOrder(req.body);
        res.json({ success: true, order });
    }
    catch (error) {
        console.error("Sales Order Error:", error);
        res.status(500).json({ error: 'Failed to save sales order', details: error.message });
    }
});
exports.createSalesOrder = createSalesOrder;
const searchSalesOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const orders = yield salesService.searchSalesOrders(q);
        res.json(orders);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search sales orders' });
    }
});
exports.searchSalesOrders = searchSalesOrders;
const getSalesOrderDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const order = yield salesService.getSalesOrderDetails(id);
        if (!order) {
            return res.status(404).json({ error: 'Sales order not found' });
        }
        res.json(order);
    }
    catch (error) {
        console.error("Get Sales Order Details Error:", error);
        res.status(500).json({ error: 'Failed to fetch sales order details' });
    }
});
exports.getSalesOrderDetails = getSalesOrderDetails;
const updateSalesOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.updateSalesOrder(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Sales order not found' });
        }
        res.json({ success: true, message: 'Sales Order updated successfully' });
    }
    catch (error) {
        console.error("Update Sales Order Error:", error);
        res.status(500).json({ error: 'Failed to update sales order', details: error.message });
    }
});
exports.updateSalesOrder = updateSalesOrder;
const cancelSalesOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.cancelSalesOrder(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Sales order not found' });
        }
        res.json({ success: true, message: 'Sales Order cancelled successfully' });
    }
    catch (error) {
        console.error("Cancel Sales Order Error:", error);
        res.status(500).json({ error: 'Failed to cancel sales order', details: error.message });
    }
});
exports.cancelSalesOrder = cancelSalesOrder;
const deleteSalesOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.deleteSalesOrder(id);
        if (!success) {
            return res.status(404).json({ error: 'Sales order not found' });
        }
        res.json({ success: true, message: 'Sales Order deleted successfully' });
    }
    catch (error) {
        console.error("Delete Sales Order Error:", error);
        res.status(500).json({ error: 'Failed to delete sales order', details: error.message });
    }
});
exports.deleteSalesOrder = deleteSalesOrder;
const getNextSalesReturnSequence = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const returnNo = yield salesService.getNextSalesReturnSequence();
        res.json({ returnNo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate return sequence' });
    }
});
exports.getNextSalesReturnSequence = getNextSalesReturnSequence;
const createSalesReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const returnNote = yield salesService.createSalesReturn(req.body);
        res.json({ success: true, returnNote });
    }
    catch (error) {
        console.error("Sales Return Error:", error);
        res.status(500).json({ error: 'Failed to save sales return', details: error.message });
    }
});
exports.createSalesReturn = createSalesReturn;
const searchSalesReturns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const returns = yield salesService.searchSalesReturns(q);
        res.json(returns);
    }
    catch (error) {
        console.error("Search Sales Returns Error:", error);
        res.status(500).json({ error: 'Failed to search sales returns' });
    }
});
exports.searchSalesReturns = searchSalesReturns;
const getSalesReturnDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const salesReturn = yield salesService.getSalesReturnDetails(id);
        if (!salesReturn) {
            return res.status(404).json({ error: 'Sales return not found' });
        }
        res.json(salesReturn);
    }
    catch (error) {
        console.error("Get Sales Return Details Error:", error);
        res.status(500).json({ error: 'Failed to fetch sales return details' });
    }
});
exports.getSalesReturnDetails = getSalesReturnDetails;
const updateSalesReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.updateSalesReturn(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Sales return not found' });
        }
        res.json({ success: true, message: 'Sales Return updated successfully' });
    }
    catch (error) {
        console.error("Update Sales Return Error:", error);
        res.status(500).json({ error: 'Failed to update sales return', details: error.message });
    }
});
exports.updateSalesReturn = updateSalesReturn;
const deleteSalesReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield salesService.deleteSalesReturn(id);
        if (!success) {
            return res.status(404).json({ error: 'Sales return not found' });
        }
        res.json({ success: true, message: 'Sales Return deleted successfully' });
    }
    catch (error) {
        console.error("Delete Sales Return Error:", error);
        res.status(500).json({ error: 'Failed to delete sales return', details: error.message });
    }
});
exports.deleteSalesReturn = deleteSalesReturn;
const getStockLedger = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const data = yield salesService.getStockLedger(productId);
        if (!data) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(data);
    }
    catch (error) {
        console.error('Stock Ledger Error:', error);
        res.status(500).json({ error: 'Failed to fetch stock ledger' });
    }
});
exports.getStockLedger = getStockLedger;
const getSalesStatusReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const report = yield salesService.getSalesStatusReport();
        res.json(report);
    }
    catch (error) {
        console.error("Sales Status Report Error:", error);
        res.status(500).json({ error: 'Failed to fetch sales status report', details: error.message });
    }
});
exports.getSalesStatusReport = getSalesStatusReport;
const getReturnsByInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { invoiceNo } = req.params;
        const data = yield salesService.getReturnsByInvoice(invoiceNo);
        res.json(data);
    }
    catch (error) {
        console.error("Get Returns By Invoice Error:", error);
        res.status(500).json({ error: 'Failed to fetch returns by invoice', details: error.message });
    }
});
exports.getReturnsByInvoice = getReturnsByInvoice;
