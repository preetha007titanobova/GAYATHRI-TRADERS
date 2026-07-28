"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashDrawer_controller_1 = require("../controllers/cashDrawer.controller");
const router = (0, express_1.Router)();
router.post('/opening', cashDrawer_controller_1.saveOpeningCash);
router.get('/opening/today', cashDrawer_controller_1.getTodayOpeningCash);
router.get('/opening/history', cashDrawer_controller_1.getOpeningCashHistory);
exports.default = router;
