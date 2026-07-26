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
exports.uploadPdfToTmpFiles = exports.sendCloseDayEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendCloseDayEmail = (dateStr, base64Pdf, ownerEmail) => __awaiter(void 0, void 0, void 0, function* () {
    const transporter = nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    // Strip potential data URL scheme
    const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '');
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: ownerEmail || 'titanobovapvt@gmail.com',
        subject: `Ithu Namma Kada - Daily Stock Status Report (${dateStr})`,
        text: `Hello,\n\nPlease find attached the Daily Stock Status Report for ${dateStr}.\n\nBest Regards,\nIthu Namma Kada Billing System`,
        attachments: [
            {
                filename: `Daily_Stock_Status_${dateStr}.pdf`,
                content: base64Data,
                encoding: 'base64'
            }
        ]
    };
    yield transporter.sendMail(mailOptions);
    return true;
});
exports.sendCloseDayEmail = sendCloseDayEmail;
const uploadPdfToTmpFiles = (base64Pdf, filename) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const formData = new FormData();
        const fileBlob = new Blob([buffer], { type: 'application/pdf' });
        formData.append('file', fileBlob, filename);
        const response = yield fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            const resJson = yield response.json();
            let url = (_a = resJson === null || resJson === void 0 ? void 0 : resJson.data) === null || _a === void 0 ? void 0 : _a.url;
            if (url) {
                url = url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
            }
            return url;
        }
        else {
            console.error("tmpfiles.org upload failed:", response.status, yield response.text());
        }
    }
    catch (error) {
        console.error("Failed to upload PDF:", error);
    }
    return null;
});
exports.uploadPdfToTmpFiles = uploadPdfToTmpFiles;
