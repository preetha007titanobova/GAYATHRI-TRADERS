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
exports.deleteShopSalesBill = exports.updateShopSalesBill = exports.searchShopSalesBills = exports.createShopSalesBill = exports.getNextShopSalesVoucher = void 0;
const shopSalesService = __importStar(require("../services/shopSales.service"));
const getNextShopSalesVoucher = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const voucherNo = yield shopSalesService.getNextShopSalesVoucher();
        res.json({ voucherNo });
    }
    catch (error) {
        console.error("Error generating shop sales voucher:", error);
        res.status(500).json({ error: 'Failed to generate voucher sequence', details: error.message });
    }
});
exports.getNextShopSalesVoucher = getNextShopSalesVoucher;
const createShopSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bill = yield shopSalesService.createShopSalesBill(req.body);
        res.json({ success: true, bill });
    }
    catch (error) {
        console.error("Error saving shop sales bill:", error);
        res.status(500).json({ error: 'Failed to save shop sales bill', details: error.message });
    }
});
exports.createShopSalesBill = createShopSalesBill;
const searchShopSalesBills = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const bills = yield shopSalesService.searchShopSalesBills(q);
        res.json(bills);
    }
    catch (error) {
        console.error("Error searching shop sales bills:", error);
        res.status(500).json({ error: 'Failed to search shop sales bills', details: error.message });
    }
});
exports.searchShopSalesBills = searchShopSalesBills;
const updateShopSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield shopSalesService.updateShopSalesBill(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Shop sales bill not found' });
        }
        res.json({ success: true, message: 'Shop sales bill updated successfully' });
    }
    catch (error) {
        console.error("Error updating shop sales bill:", error);
        res.status(500).json({ error: 'Failed to update shop sales bill', details: error.message });
    }
});
exports.updateShopSalesBill = updateShopSalesBill;
const deleteShopSalesBill = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield shopSalesService.deleteShopSalesBill(id);
        if (!success) {
            return res.status(404).json({ error: 'Shop sales bill not found' });
        }
        res.json({ success: true, message: 'Shop sales bill deleted successfully' });
    }
    catch (error) {
        console.error("Error deleting shop sales bill:", error);
        res.status(500).json({ error: 'Failed to delete shop sales bill', details: error.message });
    }
});
exports.deleteShopSalesBill = deleteShopSalesBill;
