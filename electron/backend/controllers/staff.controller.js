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
exports.processBiometricPunch = exports.saveBulkAttendance = exports.getAttendanceByDate = exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.searchStaff = exports.getNextStaffCode = void 0;
const staffService = __importStar(require("../services/staff.service"));
const getNextStaffCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const staffCode = yield staffService.getNextStaffCode();
        res.json({ staffCode });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate staff code', details: error.message });
    }
});
exports.getNextStaffCode = getNextStaffCode;
const searchStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const q = req.query.q || '';
        const status = req.query.status || '';
        const staffList = yield staffService.searchStaff(q, status);
        res.json(staffList);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff members', details: error.message });
    }
});
exports.searchStaff = searchStaff;
const createStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield staffService.createStaff(req.body);
        res.json({ success: true, id: result.insertedId.toString(), message: 'Staff created successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create staff', details: error.message });
    }
});
exports.createStaff = createStaff;
const updateStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield staffService.updateStaff(id, req.body);
        if (!success)
            return res.status(404).json({ error: 'Staff member not found' });
        res.json({ success: true, message: 'Staff updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update staff', details: error.message });
    }
});
exports.updateStaff = updateStaff;
const deleteStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const success = yield staffService.deleteStaff(id);
        if (!success)
            return res.status(404).json({ error: 'Staff member not found' });
        res.json({ success: true, message: 'Staff deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete staff', details: error.message });
    }
});
exports.deleteStaff = deleteStaff;
const getAttendanceByDate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        const data = yield staffService.getAttendanceByDate(dateStr);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch attendance', details: error.message });
    }
});
exports.getAttendanceByDate = getAttendanceByDate;
const saveBulkAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { dateStr, records } = req.body;
        yield staffService.saveBulkAttendance(dateStr, records);
        res.json({ success: true, message: 'Attendance saved successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to save attendance', details: error.message });
    }
});
exports.saveBulkAttendance = saveBulkAttendance;
const processBiometricPunch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { identifier, dateStr } = req.body;
        if (!identifier) {
            return res.status(400).json({ error: 'Biometric identifier is required' });
        }
        const todayStr = dateStr || new Date().toISOString().split('T')[0];
        const result = yield staffService.processBiometricPunch(identifier, todayStr);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Biometric punch processing failed', details: error.message });
    }
});
exports.processBiometricPunch = processBiometricPunch;
