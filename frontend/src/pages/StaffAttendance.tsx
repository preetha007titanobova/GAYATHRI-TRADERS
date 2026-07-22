import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, UserCheck, Search, Filter, Fingerprint, Clock, AlertCircle } from 'lucide-react';
import Api from '../Api';

interface AttendanceRecord {
  staffId: string;
  staffCode: string;
  staffName: string;
  role: string;
  shiftInTime?: string;
  shiftOutTime?: string;
  shiftHours?: number;
  biometricId?: string;
  biometricEnrolled?: boolean;
  biometricId2?: string;
  biometricEnrolled2?: boolean;
  dateStr: string;
  status: 'Present' | 'Late' | 'Half Day' | 'Paid Leave' | 'Absent' | 'Leave';
  checkIn: string;
  checkOut: string;
  workHours?: string;
  ot?: string;
  remarks: string;
  verificationMethod?: string;
  attendanceId?: string | null;
}

// Calculate Work Hours and OT (OT is calculated ONLY IF extra hours >= 1 hour / 60 mins)
const calculateAttendanceMetrics = (checkInStr: string, checkOutStr: string, statusStr: string, shiftHours = 8) => {
  if (['Paid Leave', 'Leave', 'Absent'].includes(statusStr) || !checkInStr || !checkOutStr || checkInStr === '-' || checkOutStr === '-') {
    return { hours: '-', ot: '-' };
  }

  const parseToMinutes = (str: string) => {
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

  const startMins = parseToMinutes(checkInStr);
  const endMins = parseToMinutes(checkOutStr);

  if (startMins === null || endMins === null || endMins <= startMins) {
    return { hours: '-', ot: '-' };
  }

  const diffMins = endMins - startMins;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  const hoursStr = m > 0 ? `${h}h ${m}m` : `${h}h`;

  // Compare against specified shift hours (e.g. 8 hours = 480 mins)
  // OT is noted ONLY IF extra worked duration is >= 60 minutes (1 hour)
  const targetMins = shiftHours * 60;
  let otStr = '-';
  if (diffMins >= targetMins + 60) {
    const otMins = diffMins - targetMins;
    const otH = Math.floor(otMins / 60);
    const otM = otMins % 60;
    otStr = otM > 0 ? `${otH}h ${otM}m` : `${otH}h`;
  }

  return { hours: hoursStr, ot: otStr };
};

const StaffAttendance = () => {
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: any }>() || {};

  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const loadAttendance = (selectedDate: string) => {
    setLoading(true);
    fetch(`${Api}/staff/attendance?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAttendanceList(data);
      })
      .catch(err => console.error("Failed to load attendance", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAttendance(dateStr);
  }, [dateStr]);

  // Filter staff by Employee Search and Status Filter
  const filteredAttendance = attendanceList.filter(item => {
    const matchesEmployee = (item.staffName || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
                            (item.staffCode || '').toLowerCase().includes(employeeSearch.toLowerCase());
    
    let matchesStatus = true;
    if (selectedStatusFilter !== 'ALL') {
      if (selectedStatusFilter === 'Present') {
        matchesStatus = item.status === 'Present' || item.status === 'Late';
      } else if (selectedStatusFilter === 'Absent') {
        matchesStatus = item.status === 'Absent' || item.status === 'Leave';
      } else {
        matchesStatus = item.status === selectedStatusFilter;
      }
    }

    return matchesEmployee && matchesStatus;
  });

  const summary = {
    total: attendanceList.length,
    present: attendanceList.filter(a => a.status === 'Present' || a.status === 'Late').length,
    paidLeave: attendanceList.filter(a => a.status === 'Paid Leave').length,
    halfDay: attendanceList.filter(a => a.status === 'Half Day').length,
    absent: attendanceList.filter(a => a.status === 'Absent' || a.status === 'Leave').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Present 🟢</span>;
      case 'Paid Leave':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">Paid Leave 🔵</span>;
      case 'Late':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">Late 🟠</span>;
      case 'Half Day':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Half Day 🟡</span>;
      case 'Leave':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">Leave 🟣</span>;
      case 'Absent':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Absent 🔴</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-300">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#d1e8e2] p-2 space-y-2 text-black select-none">
      {/* Title Header Bar */}
      <div className="bg-white border border-gray-400 p-2 shadow-sm rounded flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <UserCheck size={20} className="text-[#2b579a]" />
          <h1 className="text-base font-bold text-[#2b579a] uppercase">Staff Attendance & Biometric Register</h1>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 font-bold">
            <Calendar size={14} className="text-blue-900" />
            <span>Select Date:</span>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Interactive Summary & Filter Cards */}
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div 
          onClick={() => setSelectedStatusFilter('ALL')}
          className={`border p-2 rounded shadow-sm text-center cursor-pointer transition-all ${
            selectedStatusFilter === 'ALL' ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400 font-bold' : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span className="text-gray-600 font-bold block uppercase text-[10px]">Total Staff</span>
          <span className="text-lg font-bold text-gray-900">{summary.total}</span>
        </div>

        <div 
          onClick={() => setSelectedStatusFilter('Present')}
          className={`border p-2 rounded shadow-sm text-center cursor-pointer transition-all ${
            selectedStatusFilter === 'Present' ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400 font-bold' : 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-100/50'
          }`}
        >
          <span className="text-emerald-800 font-bold block uppercase text-[10px]">Present</span>
          <span className="text-lg font-bold text-emerald-900">{summary.present}</span>
        </div>

        <div 
          onClick={() => setSelectedStatusFilter('Paid Leave')}
          className={`border p-2 rounded shadow-sm text-center cursor-pointer transition-all ${
            selectedStatusFilter === 'Paid Leave' ? 'bg-sky-100 border-sky-500 ring-2 ring-sky-400 font-bold' : 'bg-sky-50/70 border-sky-300 hover:bg-sky-100/50'
          }`}
        >
          <span className="text-sky-800 font-bold block uppercase text-[10px]">Paid Leave</span>
          <span className="text-lg font-bold text-sky-900">{summary.paidLeave}</span>
        </div>

        <div 
          onClick={() => setSelectedStatusFilter('Half Day')}
          className={`border p-2 rounded shadow-sm text-center cursor-pointer transition-all ${
            selectedStatusFilter === 'Half Day' ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 font-bold' : 'bg-amber-50/70 border-amber-300 hover:bg-amber-100/50'
          }`}
        >
          <span className="text-amber-800 font-bold block uppercase text-[10px]">Half Day</span>
          <span className="text-lg font-bold text-amber-900">{summary.halfDay}</span>
        </div>

        <div 
          onClick={() => setSelectedStatusFilter('Absent')}
          className={`border p-2 rounded shadow-sm text-center cursor-pointer transition-all ${
            selectedStatusFilter === 'Absent' ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-400 font-bold' : 'bg-rose-50/70 border-rose-300 hover:bg-rose-100/50'
          }`}
        >
          <span className="text-rose-800 font-bold block uppercase text-[10px]">Absent</span>
          <span className="text-lg font-bold text-rose-900">{summary.absent}</span>
        </div>
      </div>

      {/* Search & Filter Control Bar */}
      <div className="bg-white border border-gray-300 p-2 rounded flex flex-wrap justify-between items-center gap-2 text-xs">
        <div className="relative w-72">
          <input
            type="text"
            placeholder="Filter by employee name or staff code..."
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-black"
          />
          <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
        </div>

        <div className="flex items-center space-x-2 font-bold">
          <Filter size={14} className="text-blue-900" />
          <span>Status Filter:</span>
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1 bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Show All ({summary.total})</option>
            <option value="Present">Present ({summary.present})</option>
            <option value="Paid Leave">Paid Leave ({summary.paidLeave})</option>
            <option value="Half Day">Half Day ({summary.halfDay})</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent ({summary.absent})</option>
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="flex-1 bg-white border border-gray-400 rounded p-2 overflow-hidden shadow-sm flex flex-col">
        <div className="flex-1 overflow-auto border border-gray-300 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#2b579a] text-white sticky top-0 font-bold">
              <tr>
                <th className="p-2.5 border-b">Employee</th>
                <th className="p-2.5 border-b text-center">Assigned Shift Timing</th>
                <th className="p-2.5 border-b text-center">Biometric Inward</th>
                <th className="p-2.5 border-b text-center">Biometric Outward</th>
                <th className="p-2.5 border-b text-center">Hours Worked</th>
                <th className="p-2.5 border-b text-center">Status</th>
                <th className="p-2.5 border-b text-center">Overtime (OT)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center p-6 text-gray-500 font-semibold">Loading attendance data...</td></tr>
              ) : filteredAttendance.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-6 text-gray-500 font-semibold">No attendance records found matching filters.</td></tr>
              ) : (
                filteredAttendance.map((item, idx) => {
                  const targetShiftHours = item.shiftHours || 8;
                  const metrics = calculateAttendanceMetrics(item.checkIn, item.checkOut, item.status, targetShiftHours);
                  const displayHours = metrics.hours;
                  const displayOt = metrics.ot;

                  return (
                    <tr key={item.staffId || idx} className="hover:bg-blue-50 border-b border-gray-200 transition-colors">
                      <td className="p-2.5 font-bold text-gray-900">
                        {item.staffName}
                        <span className="text-[10px] text-gray-500 font-mono block font-normal">{item.staffCode} • {item.role}</span>
                      </td>

                      {/* Assigned Shift Timing */}
                      <td className="p-2.5 text-center font-mono font-bold text-blue-900">
                        {item.shiftInTime || '09:00 AM'} - {item.shiftOutTime || '06:00 PM'}
                        <span className="text-[10px] text-gray-500 block font-normal">({targetShiftHours} hrs shift)</span>
                      </td>

                      {/* Biometric Inward */}
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-800">
                        {item.checkIn && item.checkIn !== '-' ? (
                          <span className="inline-flex items-center space-x-1">
                            <span>{item.checkIn}</span>
                            <Fingerprint size={12} className="text-emerald-600" />
                          </span>
                        ) : '-'}
                      </td>

                      {/* Biometric Outward */}
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-800">
                        {item.checkOut && item.checkOut !== '-' ? (
                          <span className="inline-flex items-center space-x-1">
                            <span>{item.checkOut}</span>
                            <Fingerprint size={12} className="text-emerald-600" />
                          </span>
                        ) : '-'}
                      </td>

                      {/* Hours Worked */}
                      <td className="p-2.5 text-center font-mono font-bold text-blue-950">
                        {displayHours}
                      </td>

                      {/* Status */}
                      <td className="p-2.5 text-center">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* OT / Overtime */}
                      <td className="p-2.5 text-center font-mono font-bold">
                        {displayOt !== '-' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-block">
                            +{displayOt} OT
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendance;
