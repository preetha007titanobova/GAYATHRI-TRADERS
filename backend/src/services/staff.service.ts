import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { Staff } from '../models/staff.model';

export const getNextStaffCode = async (): Promise<string> => {
  const db = await getDb();
  const lastStaff = await db.collection('Staff').find().sort({ staffCode: -1 }).limit(1).toArray();
  
  let nextNum = 1;
  if (lastStaff && lastStaff.length > 0 && lastStaff[0].staffCode) {
    const parts = lastStaff[0].staffCode.split('-');
    const currentNum = parseInt(parts[1] || '0');
    if (!isNaN(currentNum)) {
      nextNum = currentNum + 1;
    }
  }
  return `STF-${nextNum.toString().padStart(3, '0')}`;
};

export const searchStaff = async (q?: string, status?: string): Promise<Staff[]> => {
  const db = await getDb();
  let query: any = {};
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
  return (await db.collection('Staff').find(query).sort({ createdAt: -1 }).toArray()) as unknown as Staff[];
};

export const createStaff = async (data: Staff): Promise<any> => {
  const db = await getDb();
  const result = await db.collection('Staff').insertOne({
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
};

export const updateStaff = async (id: string, data: Staff): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Staff').updateOne(
    { _id: new ObjectId(id as string) },
    {
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
    }
  );
  return result.matchedCount > 0;
};

export const deleteStaff = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db.collection('Staff').deleteOne({ _id: new ObjectId(id as string) });
  return result.deletedCount > 0;
};

// --- Attendance Services ---

export const getAttendanceByDate = async (dateStr: string): Promise<any[]> => {
  const db = await getDb();
  const activeStaff = await db.collection('Staff').find({ status: 'Active' }).sort({ name: 1 }).toArray();
  const records = await db.collection('StaffAttendance').find({ dateStr: dateStr }).toArray();

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
};

export const saveBulkAttendance = async (dateStr: string, records: any[]): Promise<boolean> => {
  const db = await getDb();
  
  for (const rec of records) {
    const filter = { staffId: new ObjectId(rec.staffId as string), dateStr: dateStr };
    const update = {
      $set: {
        staffId: new ObjectId(rec.staffId as string),
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
    await db.collection('StaffAttendance').updateOne(filter, update, { upsert: true });
  }
  return true;
};

// Helper to calculate hours, OT, and status from Biometric In & Out times
// OT Rule: OT is calculated ONLY IF extra worked duration is >= 1 full hour (60 mins) beyond shiftHours!
const calculateBiometricMetrics = (
  checkInStr: string,
  checkOutStr: string,
  shiftInTime = '09:00 AM',
  shiftHours = 8
) => {
  const parseToMinutes = (str: string) => {
    if (!str) return null;
    let s = str.trim().toUpperCase();
    const isPM = s.includes('PM');
    const isAM = s.includes('AM');
    s = s.replace(/AM|PM/g, '').trim();

    const parts = s.split(':');
    if (parts.length < 2) return null;

    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

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

export const processBiometricPunch = async (identifier: string, dateStr: string): Promise<any> => {
  const db = await getDb();
  
  const orConditions: any[] = [
    { staffCode: identifier },
    { biometricId: identifier },
    { biometricId2: identifier }
  ];
  if (ObjectId.isValid(identifier)) {
    orConditions.push({ _id: new ObjectId(identifier) });
  }

  let staff = await db.collection('Staff').findOne({
    $or: orConditions,
    status: 'Active'
  });

  if (!staff) {
    return { success: false, message: `No active staff record found matching fingerprint scan / ID: "${identifier}"` };
  }

  const staffIdObj = staff._id;
  const staffIdStr = staffIdObj.toString();
  const filter = { staffId: staffIdObj, dateStr };
  
  const existing = await db.collection('StaffAttendance').findOne(filter);

  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  let action: 'check-in' | 'check-out' = 'check-in';
  let checkIn = formattedTime;
  let checkOut = '';

  if (existing && existing.checkIn && !existing.checkOut) {
    action = 'check-out';
    checkIn = existing.checkIn;
    checkOut = formattedTime;
  } else if (existing && existing.checkIn && existing.checkOut) {
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

  await db.collection('StaffAttendance').updateOne(filter, update, { upsert: true });

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
};
