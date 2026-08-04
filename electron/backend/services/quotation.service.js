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
exports.deleteQuotation = exports.getQuotationById = exports.getQuotations = exports.createQuotation = exports.getNextSequence = exports.sendQuotationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");

const sendQuotationEmail = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const { quoteNo, quoteDate, customer, totalAmount, items } = data;
    const transporter = nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    const itemsHtml = (items || []).map((item) => `<tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.itemCode || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.itemDescription || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity || 0}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">₹${item.unitPrice || 0}</td>
    </tr>`).join('');
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'titanobovapvt@gmail.com',
        subject: `Quotation ${quoteNo || 'New'} from Billing System`,
        html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Quotation Details</h1>
        </div>
        <div style="padding: 20px;">
          <p><strong>Quote No:</strong> ${quoteNo || 'N/A'}</p>
          <p><strong>Date:</strong> ${quoteDate || 'N/A'}</p>
          <p><strong>Customer:</strong> ${customer || 'N/A'}</p>
          
          <h3 style="margin-top: 30px; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item Code</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: right; background-color: #f9fafb; padding: 15px; border-radius: 6px;">
            <h2 style="margin: 0; color: #4f46e5;">Grand Total: ₹${totalAmount || 0}</h2>
          </div>
        </div>
      </div>
    `,
    };
    yield transporter.sendMail(mailOptions);
    return true;
});
exports.sendQuotationEmail = sendQuotationEmail;

const getNextSequence = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const lastQuote = yield db.collection('Quotation').find().sort({ createdAt: -1 }).limit(1).toArray();
    let nextNum = 1;
    if (lastQuote && lastQuote.length > 0 && lastQuote[0].quoteNo && lastQuote[0].quoteNo.startsWith('QT-')) {
        const parts = lastQuote[0].quoteNo.split('-');
        const numPart = parts[parts.length - 1];
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const today = new Date();
    const month = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    return `QT-${fy}-${nextNum.toString().padStart(3, '0')}`;
});
exports.getNextSequence = getNextSequence;

const createQuotation = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const newQuote = Object.assign(Object.assign({}, data), {
        quoteNo: data.quoteNo || (yield getNextSequence()),
        quoteDate: data.quoteDate ? new Date(data.quoteDate) : new Date(),
        validityDate: data.validityDate ? new Date(data.validityDate) : null,
        customer: data.customer || 'CASH CUSTOMER',
        mobileNo: data.mobileNo || '',
        paymentTerms: data.paymentTerms || '',
        isInterstate: !!data.isInterstate,
        status: data.status || 'SAVED',
        totalQty: Number(data.totalQty) || 0,
        totalTaxable: Number(data.totalTaxable) || 0,
        totalCgst: Number(data.totalCgst) || 0,
        totalSgst: Number(data.totalSgst) || 0,
        totalIgst: Number(data.totalIgst) || 0,
        roundedGrandTotal: Number(data.roundedGrandTotal) || 0,
        items: Array.isArray(data.items) ? data.items : [],
        createdAt: new Date(),
        updatedAt: new Date()
    });
    const result = yield db.collection('Quotation').insertOne(newQuote);
    return Object.assign(Object.assign({}, newQuote), { _id: result.insertedId });
});
exports.createQuotation = createQuotation;

const getQuotations = (filters = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const query = {};
    if (filters.startDate || filters.endDate) {
        query.quoteDate = {};
        if (filters.startDate) {
            query.quoteDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            query.quoteDate.$lte = end;
        }
    }
    if (filters.q) {
        const regex = new RegExp(filters.q, 'i');
        query.$or = [
            { quoteNo: regex },
            { customer: regex },
            { mobileNo: regex }
        ];
    }
    const quotes = yield db.collection('Quotation').find(query).sort({ quoteDate: -1, createdAt: -1 }).toArray();
    return quotes;
});
exports.getQuotations = getQuotations;

const getQuotationById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let objId;
    try { objId = new mongodb_1.ObjectId(id); } catch (e) { objId = id; }
    return yield db.collection('Quotation').findOne({ $or: [{ _id: objId }, { quoteNo: id }] });
});
exports.getQuotationById = getQuotationById;

const deleteQuotation = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let objId;
    try { objId = new mongodb_1.ObjectId(id); } catch (e) { objId = id; }
    const res = yield db.collection('Quotation').deleteOne({ _id: objId });
    return res.deletedCount > 0;
});
exports.deleteQuotation = deleteQuotation;
