export interface Staff {
  _id?: string;
  id?: string;
  staffCode: string;
  name: string;
  role: string;
  mobileNo?: string;
  email?: string;
  salary: number;
  dailyRate: number;
  shiftInTime?: string;
  shiftOutTime?: string;
  shiftHours?: number;
  joiningDate?: Date | string;
  status: 'Active' | 'Inactive';
  biometricId?: string;       // Fingerprint 1 ID
  biometricCredentialId?: string;
  biometricEnrolled?: boolean;
  biometricId2?: string;      // Fingerprint 2 ID
  biometricCredentialId2?: string;
  biometricEnrolled2?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StaffAttendance {
  _id?: string;
  id?: string;
  staffId: string;
  staffName?: string;
  staffCode?: string;
  shiftInTime?: string;
  shiftOutTime?: string;
  dateStr?: string;
  date: Date | string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Late' | 'Paid Leave' | 'Leave';
  checkIn?: string;
  checkOut?: string;
  workHours?: string;
  ot?: string;
  remarks?: string;
  verificationMethod?: 'Biometric' | 'Manual';
  createdAt?: Date;
  updatedAt?: Date;
}
