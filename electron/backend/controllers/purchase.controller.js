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
exports.deletePurchaseReturn = exports.updatePurchaseReturn = exports.searchPurchaseReturns = exports.createPurchaseReturn = exports.getNextPurchaseReturnVoucher = exports.deletePurchaseBill = exports.updatePurchaseBill = exports.searchPurchaseBills = exports.createPurchaseBill = exports.getNextPurchaseVoucher = void 0;
const purchaseService = __importStar(require("../services/purchase.service"));
const getNextPurchaseVoucher = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const voucherNo = yield purchaseService.getNextPurchaseVoucher();
        res.json({ voucherNo });
    }
    catch (error) {
        console.error("Error generating purchase voucher:", error);
        res.status(500).json({ error: 'Failed to generate voucher sequence', details: error.message });
    }
});
exports.getNextPurchaseVoucher = getNextPurchaseVoucher;
const createPurchaseBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bill = yield purchaseService.createPurchaseBill(req.body);
        res.json({ success: true, bill });
    }
    catch (error) {
        console.error("Error saving purchase bill:", error);
        res.status(500).json({ error: 'Failed to save purchase bill', details: error.message });
    }
});
exports.createPurchaseBill = createPurchaseBill;
const searchPurchaseBills = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const bills = yield purchaseService.searchPurchaseBills(q);
        res.json(bills);
    }
    catch (error) {
        console.error("Error searching purchase bills:", error);
        res.status(500).json({ error: 'Failed to search purchase bills', details: error.message });
    }
});
exports.searchPurchaseBills = searchPurchaseBills;
const updatePurchaseBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield purchaseService.updatePurchaseBill(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Purchase bill not found' });
        }
        res.json({ success: true, message: 'Purchase bill updated successfully' });
    }
    catch (error) {
        console.error("Error updating purchase bill:", error);
        res.status(500).json({ error: 'Failed to update purchase bill', details: error.message });
    }
});
exports.updatePurchaseBill = updatePurchaseBill;
const deletePurchaseBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield purchaseService.deletePurchaseBill(id);
        if (!success) {
            return res.status(404).json({ error: 'Purchase bill not found' });
        }
        res.json({ success: true, message: 'Purchase bill deleted successfully' });
    }
    catch (error) {
        console.error("Error deleting purchase bill:", error);
        res.status(500).json({ error: 'Failed to delete purchase bill', details: error.message });
    }
});
exports.deletePurchaseBill = deletePurchaseBill;
const getNextPurchaseReturnVoucher = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const returnNo = yield purchaseService.getNextPurchaseReturnVoucher();
        res.json({ returnNo });
    }
    catch (error) {
        console.error("Error generating purchase return voucher:", error);
        res.status(500).json({ error: 'Failed to generate return voucher sequence', details: error.message });
    }
});
exports.getNextPurchaseReturnVoucher = getNextPurchaseReturnVoucher;
const createPurchaseReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ret = yield purchaseService.createPurchaseReturn(req.body);
        res.json({ success: true, return: ret });
    }
    catch (error) {
        console.error("Error saving purchase return:", error);
        res.status(500).json({ error: 'Failed to save purchase return', details: error.message });
    }
});
exports.createPurchaseReturn = createPurchaseReturn;
const searchPurchaseReturns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const returns = yield purchaseService.searchPurchaseReturns(q);
        res.json(returns);
    }
    catch (error) {
        console.error("Error searching purchase returns:", error);
        res.status(500).json({ error: 'Failed to search purchase returns', details: error.message });
    }
});
exports.searchPurchaseReturns = searchPurchaseReturns;
const updatePurchaseReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield purchaseService.updatePurchaseReturn(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Purchase return not found' });
        }
        res.json({ success: true, message: 'Purchase return updated successfully' });
    }
    catch (error) {
        console.error("Error updating purchase return:", error);
        res.status(500).json({ error: 'Failed to update purchase return', details: error.message });
    }
});
exports.updatePurchaseReturn = updatePurchaseReturn;
const deletePurchaseReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield purchaseService.deletePurchaseReturn(id);
        if (!success) {
            return res.status(404).json({ error: 'Purchase return not found' });
        }
        res.json({ success: true, message: 'Purchase return deleted successfully' });
    }
    catch (error) {
        console.error("Error deleting purchase return:", error);
        res.status(500).json({ error: 'Failed to delete purchase return', details: error.message });
    }
});
exports.deletePurchaseReturn = deletePurchaseReturn;
