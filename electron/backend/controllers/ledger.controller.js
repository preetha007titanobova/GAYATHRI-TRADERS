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
exports.getLedgerStatement = exports.deleteLedger = exports.updateLedger = exports.createLedger = exports.searchLedgers = exports.getNextLedgerCode = void 0;
const ledgerService = __importStar(require("../services/ledger.service"));
const getNextLedgerCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ledgerCode = yield ledgerService.getNextLedgerCode();
        res.json({ ledgerCode });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate ledger code' });
    }
});
exports.getNextLedgerCode = getNextLedgerCode;
const searchLedgers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const group = req.query.group || '';
        const ledgers = yield ledgerService.searchLedgers(q, group);
        res.json(ledgers);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search ledgers' });
    }
});
exports.searchLedgers = searchLedgers;
const createLedger = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield ledgerService.createLedger(req.body);
        res.json({
            success: true,
            ledger: {
                id: result.insertedId.toString(),
                ledgerCode: req.body.ledgerCode,
                accountName: req.body.accountName
            }
        });
    }
    catch (error) {
        console.error("Ledger Error:", error);
        res.status(500).json({ error: 'Failed to save ledger', details: error.message });
    }
});
exports.createLedger = createLedger;
const updateLedger = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield ledgerService.updateLedger(id, req.body);
        if (!success) {
            return res.status(404).json({ error: 'Ledger not found' });
        }
        res.json({ success: true, message: 'Ledger updated successfully' });
    }
    catch (error) {
        console.error("Update Ledger Error:", error);
        res.status(500).json({ error: 'Failed to update ledger', details: error.message });
    }
});
exports.updateLedger = updateLedger;
const deleteLedger = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield ledgerService.deleteLedger(id);
        if (!success) {
            return res.status(404).json({ error: 'Ledger not found' });
        }
        res.json({ success: true, message: 'Ledger deleted successfully' });
    }
    catch (error) {
        console.error("Delete Ledger Error:", error);
        res.status(500).json({ error: 'Failed to delete ledger', details: error.message });
    }
});
exports.deleteLedger = deleteLedger;
const getLedgerStatement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { fromDate, toDate } = req.query;
        const statement = yield ledgerService.getLedgerStatement(id, fromDate || '', toDate || '');
        res.json(statement);
    }
    catch (error) {
        console.error("Ledger Statement Error:", error);
        res.status(500).json({ error: 'Failed to compile ledger statement', details: error.message });
    }
});
exports.getLedgerStatement = getLedgerStatement;
