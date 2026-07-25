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
exports.getNextSequence = exports.sendQuotationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
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
    const itemsHtml = items.map((item) => `<tr>
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
        nextNum = parseInt(parts[2] || '0') + 1;
    }
    // FY format logic (e.g. 2026-2027)
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    return `QT-${fy}-${nextNum.toString().padStart(3, '0')}`;
});
exports.getNextSequence = getNextSequence;
