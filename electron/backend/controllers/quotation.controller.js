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
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") Object.defineProperty(result, k[i], { enumerable: true, get: function() { return mod[k[i]]; } });
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuotation = exports.getQuotationById = exports.getQuotations = exports.createQuotation = exports.getNextSequence = exports.sendEmail = void 0;
const quotationService = __importStar(require("../services/quotation.service"));

const sendEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield quotationService.sendQuotationEmail(req.body);
        res.json({ success: true, message: 'Email sent successfully' });
    }
    catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});
exports.sendEmail = sendEmail;

const getNextSequence = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quoteNo = yield quotationService.getNextSequence();
        res.json({ quoteNo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate quotation sequence' });
    }
});
exports.getNextSequence = getNextSequence;

const createQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quote = yield quotationService.createQuotation(req.body);
        res.json({ success: true, quotation: quote });
    }
    catch (error) {
        console.error('Create Quotation Error:', error);
        res.status(500).json({ error: 'Failed to save quotation', details: error.message });
    }
});
exports.createQuotation = createQuotation;

const getQuotations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, q } = req.query;
        const quotes = yield quotationService.getQuotations({ startDate, endDate, q });
        res.json(quotes);
    }
    catch (error) {
        console.error('Get Quotations Error:', error);
        res.status(500).json({ error: 'Failed to fetch quotations', details: error.message });
    }
});
exports.getQuotations = getQuotations;

const getQuotationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quote = yield quotationService.getQuotationById(req.params.id);
        if (!quote) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        res.json(quote);
    }
    catch (error) {
        console.error('Get Quotation By Id Error:', error);
        res.status(500).json({ error: 'Failed to fetch quotation', details: error.message });
    }
});
exports.getQuotationById = getQuotationById;

const deleteQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const success = yield quotationService.deleteQuotation(req.params.id);
        if (success) {
            res.json({ success: true, message: 'Quotation deleted successfully' });
        }
        else {
            res.status(404).json({ error: 'Quotation not found or already deleted' });
        }
    }
    catch (error) {
        console.error('Delete Quotation Error:', error);
        res.status(500).json({ error: 'Failed to delete quotation', details: error.message });
    }
});
exports.deleteQuotation = deleteQuotation;
