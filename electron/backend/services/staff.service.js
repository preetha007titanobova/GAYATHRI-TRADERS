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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBiometricPunch = exports.saveBulkAttendance = exports.getAttendanceByDate = exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.searchStaff = exports.getNextStaffCode = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const getNextStaffCode = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const lastStaff = yield db.collection('Staff').find().sort({ staffCode: -1 }).limit(1).toArray();
    let nextNum = 1;
    if (lastStaff && lastStaff.length > 0 && lastStaff[0].staffCode) {
        const parts = lastStaff[0].staffCode.split('-');
        const currentNum = parseInt(parts[1] || '0');
        if (!isNaN(currentNum)) {
            nextNum = currentNum + 1;
        }
    }
    return `STF-${nextNum.toString().padStart(3, '0')}`;
});
exports.getNextStaffCode = getNextStaffCode;
const searchStaff = (q, status) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let query = {};
    if (q) {
        query.$or = [
            { name: { $regex: q, $options: 'i' } },
            { staffCode: { $regex: q, $options: 'i' } },
            { mobileNo: { $regex: q, $options: 'i' } },
            { role: { $regex: q, $options: 'i' } },
            { biometricId: { $regex: q, $options: 'i' } },
            { biometricId2: { $regex: q, $options: 'i' } }
        ];
    }
    if (status) {
        query.status = status;
    }
    return (yield db.collection('Staff').find(query).sort({ createdAt: -1 }).toArray());
});
exports.searchStaff = searchStaff;
const createStaff = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const result = yield db.collection('Staff').insertOne({
        staffCode: data.staffCode,
        name: data.name,
        role: data.role || 'Salesman',
        mobileNo: data.mobileNo || '',
        email: data.email || '',
        salary: Number(data.salary) || 0,
        dailyRate: Number(data.dailyRate) || 0,
        shiftInTime: data.shiftInTime || '09:00 AM',
        shiftOutTime: data.shiftOutTime || '06:00 PM',
        shiftHours: Number(data.shiftHours) || 8,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
        status: data.status || 'Active',
        biometricId: data.biometricId || `FP1-${data.staffCode}`,
        biometricCredentialId: data.biometricCredentialId || '',
        biometricEnrolled: !!data.biometricId || !!data.biometricCredentialId,
        biometricId2: data.biometricId2 || `FP2-${data.staffCode}`,
        biometricCredentialId2: data.biometricCredentialId2 || '',
        biometricEnrolled2: !!data.biometricId2 || !!data.biometricCredentialId2,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return result;
});
exports.createStaff = createStaff;
const updateStaff = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const result = yield db.collection('Staff').updateOne({ _id: new mongodb_1.ObjectId(id) }, {
        $set: {
            staffCode: data.staffCode,
            name: data.name,
            role: data.role,
            mobileNo: data.mobileNo,
            email: data.email,
            salary: Number(data.salary) || 0,
            dailyRate: Number(data.dailyRate) || 0,
            shiftInTime: data.shiftInTime || '09:00 AM',
            shiftOutTime: data.shiftOutTime || '06:00 PM',
            shiftHours: Number(data.shiftHours) || 8,
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
            status: data.status,
            biometricId: data.biometricId || `FP1-${data.staffCode}`,
            biometricCredentialId: data.biometricCredentialId || '',
            biometricEnrolled: !!data.biometricId || !!data.biometricCredentialId,
            biometricId2: data.biometricId2 || `FP2-${data.staffCode}`,
            biometricCredentialId2: data.biometricCredentialId2 || '',
            biometricEnrolled2: !!data.biometricId2 || !!data.biometricCredentialId2,
            updatedAt: new Date()
        }
    });
    return result.matchedCount > 0;
});
exports.updateStaff = updateStaff;
const deleteStaff = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const result = yield db.collection('Staff').deleteOne({ _id: new mongodb_1.ObjectId(id) });
    return result.deletedCount > 0;
});
exports.deleteStaff = deleteStaff;
// --- Attendance Services ---
const getAttendanceByDate = (dateStr) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const activeStaff = yield db.collection('Staff').find({ status: 'Active' }).sort({ name: 1 }).toArray();
    const records = yield db.collection('StaffAttendance').find({ dateStr: dateStr }).toArray();
    const attendanceMap = new Map();
    records.forEach(r => {
        attendanceMap.set(r.staffId.toString(), r);
    });
    return activeStaff.map(s => {
        const sId = s._id.toString();
        const existing = attendanceMap.get(sId);
        return {
            staffId: sId,
            staffCode: s.staffCode,
            staffName: s.name,
            role: s.role,
            shiftInTime: s.shiftInTime || '09:00 AM',
            shiftOutTime: s.shiftOutTime || '06:00 PM',
            shiftHours: s.shiftHours || 8,
            biometricId: s.biometricId || `FP1-${s.staffCode}`,
            biometricEnrolled: !!s.biometricEnrolled || !!s.biometricId,
            biometricId2: s.biometricId2 || `FP2-${s.staffCode}`,
            biometricEnrolled2: !!s.biometricEnrolled2 || !!s.biometricId2,
            dateStr,
            status: existing ? existing.status : 'Absent',
            checkIn: existing ? (existing.checkIn !== undefined ? existing.checkIn : '-') : '-',
            checkOut: existing ? (existing.checkOut !== undefined ? existing.checkOut : '-') : '-',
            workHours: existing ? existing.workHours || '' : '',
            ot: existing ? existing.ot || '' : '',
            remarks: existing ? existing.remarks || '' : '',
            verificationMethod: existing ? existing.verificationMethod || 'Biometric' : 'Biometric',
            attendanceId: existing ? existing._id.toString() : null
        };
    });
});
exports.getAttendanceByDate = getAttendanceByDate;
const saveBulkAttendance = (dateStr, records) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    for (const rec of records) {
        const filter = { staffId: new mongodb_1.ObjectId(rec.staffId), dateStr: dateStr };
        const update = {
            $set: {
                staffId: new mongodb_1.ObjectId(rec.staffId),
                staffName: rec.staffName,
                staffCode: rec.staffCode,
                dateStr: dateStr,
                date: new Date(`${dateStr}T00:00:00.000Z`),
                status: rec.status,
                checkIn: rec.checkIn || '',
                checkOut: rec.checkOut || '',
                workHours: rec.workHours || '',
                ot: rec.ot || '',
                remarks: rec.remarks || '',
                verificationMethod: rec.verificationMethod || 'Biometric',
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        };
        yield db.collection('StaffAttendance').updateOne(filter, update, { upsert: true });
    }
    return true;
});
exports.saveBulkAttendance = saveBulkAttendance;
// Helper to calculate hours, OT, and status from Biometric In & Out times
// OT Rule: OT is calculated ONLY IF extra worked duration is >= 1 full hour (60 mins) beyond shiftHours!
const calculateBiometricMetrics = (checkInStr, checkOutStr, shiftInTime = '09:00 AM', shiftHours = 8) => {
    const parseToMinutes = (str) => {
        if (!str)
            return null;
        let s = str.trim().toUpperCase();
        const isPM = s.includes('PM');
        const isAM = s.includes('AM');
        s = s.replace(/AM|PM/g, '').trim();
        const parts = s.split(':');
        if (parts.length < 2)
            return null;
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m))
            return null;
        if (isPM && h < 12)
            h += 12;
        if (isAM && h === 12)
            h = 0;
        return h * 60 + m;
    };
    const checkInMins = parseToMinutes(checkInStr);
    const checkOutMins = parseToMinutes(checkOutStr);
    const shiftInMins = parseToMinutes(shiftInTime) || 540;
    let status = 'Present';
    if (checkInMins !== null && checkInMins > shiftInMins + 15) {
        status = 'Late';
    }
    if (checkInMins === null || checkOutMins === null || checkOutMins <= checkInMins) {
        return { workHours: '-', ot: '-', status };
    }
    const diffMins = checkOutMins - checkInMins;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    const workHours = m > 0 ? `${h}h ${m}m` : `${h}h`;
    const targetMins = shiftHours * 60;
    let ot = '-';
    // OT is calculated ONLY IF extra worked time is >= 60 minutes (1 hour)
    if (diffMins >= targetMins + 60) {
        const otMins = diffMins - targetMins;
        const otH = Math.floor(otMins / 60);
        const otM = otMins % 60;
        ot = otM > 0 ? `${otH}h ${otM}m` : `${otH}h`;
    }
    if (diffMins < 240) {
        status = 'Half Day';
    }
    return { workHours, ot, status };
};
const processBiometricPunch = (identifier, dateStr) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let staff = yield db.collection('Staff').findOne({
        $or: [
            { staffCode: identifier },
            { biometricId: identifier },
            { biometricId2: identifier },
            { _id: mongodb_1.ObjectId.isValid(identifier) ? new mongodb_1.ObjectId(identifier) : null }
        ],
        status: 'Active'
    });
    if (!staff) {
        return { success: false, message: `No active staff record found matching fingerprint scan / ID: "${identifier}"` };
    }
    const staffIdObj = staff._id;
    const staffIdStr = staffIdObj.toString();
    const filter = { staffId: staffIdObj, dateStr };
    const existing = yield db.collection('StaffAttendance').findOne(filter);
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    let action = 'check-in';
    let checkIn = formattedTime;
    let checkOut = '';
    if (existing && existing.checkIn && !existing.checkOut) {
        action = 'check-out';
        checkIn = existing.checkIn;
        checkOut = formattedTime;
    }
    else if (existing && existing.checkIn && existing.checkOut) {
        action = 'check-in';
        checkIn = formattedTime;
        checkOut = '';
    }
    const metrics = calculateBiometricMetrics(checkIn, checkOut, staff.shiftInTime || '09:00 AM', staff.shiftHours || 8);
    const update = {
        $set: {
            staffId: staffIdObj,
            staffName: staff.name,
            staffCode: staff.staffCode,
            dateStr: dateStr,
            date: new Date(`${dateStr}T00:00:00.000Z`),
            status: metrics.status,
            checkIn,
            checkOut,
            workHours: metrics.workHours,
            ot: metrics.ot,
            verificationMethod: 'Biometric',
            updatedAt: new Date()
        },
        $setOnInsert: {
            createdAt: new Date()
        }
    };
    yield db.collection('StaffAttendance').updateOne(filter, update, { upsert: true });
    return {
        success: true,
        action,
        time: formattedTime,
        workHours: metrics.workHours,
        ot: metrics.ot,
        status: metrics.status,
        staff: {
            id: staffIdStr,
            staffCode: staff.staffCode,
            name: staff.name,
            role: staff.role
        },
        message: action === 'check-in'
            ? `Biometric Entry Recorded! ${staff.name} Checked IN at ${formattedTime} (${metrics.status})`
            : `Biometric Exit Recorded! ${staff.name} Checked OUT at ${formattedTime} (Total Hours: ${metrics.workHours}${metrics.ot !== '-' ? `, OT: +${metrics.ot}` : ''})`
    };
});
exports.processBiometricPunch = processBiometricPunch;
