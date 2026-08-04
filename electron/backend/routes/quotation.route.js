"use strict";
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
const express_1 = require("express");
const quotationController = __importStar(require("../controllers/quotation.controller"));

const router = (0, express_1.Router)();

router.post('/send-email', quotationController.sendEmail);
router.get('/next-sequence', quotationController.getNextSequence);

router.post('/', quotationController.createQuotation);
router.get('/', quotationController.getQuotations);
router.get('/:id', quotationController.getQuotationById);
router.delete('/:id', quotationController.deleteQuotation);

exports.default = router;
