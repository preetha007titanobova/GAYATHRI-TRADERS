import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, UserCheck, Search, Filter, Fingerprint, Save, BarChart3, CheckCircle2, Clock, XCircle, AlertTriangle, FileText } from 'lucide-react';
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

interface MonthlySummaryItem {
  staffId: string;
  staffCode: string;
  staffName: string;
  role: string;
  totalLogged: number;
  presentDays: number;
  halfDays: number;
  paidLeaves: number;
  leaves: number;
  absents: number;
  lates: number;
  attendancePct: number;
}

// Calculate Work Hours and OT
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

  // View Mode: 'daily' (manual/biometric entry) vs 'monthly' (employee status report)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  // Daily State
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters State
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Monthly State
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummaryItem[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Load Daily Attendance
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
    if (viewMode === 'daily') {
      loadAttendance(dateStr);
    }
  }, [dateStr, viewMode]);

  // Load Monthly Attendance Summary
  const loadMonthlySummary = (monthStr: string) => {
    setLoadingMonthly(true);
    // Fetch all attendance for the given month by querying daily records or fetching dates in month
    // We can fetch attendance for all days in month or calculate client-side if backend is simple
    fetch(`${Api}/staff/attendance?date=${monthStr}-01`)
      .then(() => {
        // Fetch all attendance records or generate mock/aggregated summary across month
        // Let's query days in the month or aggregate active staff
        return fetch(`${Api}/staff/search?status=Active`);
      })
      .then(res => res.json())
      .then(async (staffList: any[]) => {
        if (!Array.isArray(staffList)) return;

        // Fetch attendance records for each day of the month or query month
        const daysInMonth = new Date(Number(monthStr.substring(0, 4)), Number(monthStr.substring(5, 7)), 0).getDate();
        const datePromises = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const dStr = `${monthStr}-${day < 10 ? '0' + day : day}`;
          datePromises.push(fetch(`${Api}/staff/attendance?date=${dStr}`).then(r => r.json()).catch(() => []));
        }

        const monthResults = await Promise.all(datePromises);
        const allMonthRecords: AttendanceRecord[] = monthResults.flat();

        const summaries: MonthlySummaryItem[] = staffList.map((s: any) => {
          const sId = (s._id || s.id || '').toString();
          const sRecords = allMonthRecords.filter(r => (r.staffId || '').toString() === sId || r.staffCode === s.staffCode);

          let presentDays = 0;
          let halfDays = 0;
          let paidLeaves = 0;
          let leaves = 0;
          let absents = 0;
          let lates = 0;

          sRecords.forEach(r => {
            if (r.status === 'Present') presentDays++;
            else if (r.status === 'Late') { presentDays++; lates++; }
            else if (r.status === 'Half Day') halfDays++;
            else if (r.status === 'Paid Leave') paidLeaves++;
            else if (r.status === 'Leave') leaves++;
            else if (r.status === 'Absent') absents++;
          });

          const totalLogged = sRecords.length;
          const totalEquivalent = presentDays + (halfDays * 0.5) + paidLeaves;
          const attendancePct = totalLogged > 0 ? Math.round((totalEquivalent / totalLogged) * 100) : 0;

          return {
            staffId: sId,
            staffCode: s.staffCode,
            staffName: s.name,
            role: s.role,
            totalLogged,
            presentDays,
            halfDays,
            paidLeaves,
            leaves,
            absents,
            lates,
            attendancePct
          };
        });

        setMonthlySummaries(summaries);
      })
      .catch(err => console.error("Failed to load monthly attendance", err))
      .finally(() => setLoadingMonthly(false));
  };

  useEffect(() => {
    if (viewMode === 'monthly') {
      loadMonthlySummary(selectedMonth);
    }
  }, [selectedMonth, viewMode]);

  // Handle Manual Status Change for Staff Row
  const handleStatusChange = (staffId: string, newStatus: AttendanceRecord['status']) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.staffId === staffId) {
        let defaultCheckIn = item.checkIn;
        let defaultCheckOut = item.checkOut;
        if (newStatus === 'Present' && (item.checkIn === '-' || !item.checkIn)) defaultCheckIn = item.shiftInTime || '09:00 AM';
        if (newStatus === 'Present' && (item.checkOut === '-' || !item.checkOut)) defaultCheckOut = item.shiftOutTime || '06:00 PM';
        if (['Absent', 'Leave', 'Paid Leave'].includes(newStatus)) {
          defaultCheckIn = '-';
          defaultCheckOut = '-';
        }
        return {
          ...item,
          status: newStatus,
          checkIn: defaultCheckIn,
          checkOut: defaultCheckOut,
          verificationMethod: 'Manual Entry'
        };
      }
      return item;
    }));
  };

  // Handle Manual Field Edit (CheckIn, CheckOut, Remarks)
  const handleRecordFieldChange = (staffId: string, field: 'checkIn' | 'checkOut' | 'remarks', value: string) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.staffId === staffId) {
        return { ...item, [field]: value, verificationMethod: 'Manual Entry' };
      }
      return item;
    }));
  };

  // Batch Mark Status for all staff
  const handleMarkAllStatus = (newStatus: AttendanceRecord['status']) => {
    setAttendanceList(prev => prev.map(item => ({
      ...item,
      status: newStatus,
      checkIn: newStatus === 'Present' ? (item.shiftInTime || '09:00 AM') : '-',
      checkOut: newStatus === 'Present' ? (item.shiftOutTime || '06:00 PM') : '-',
      verificationMethod: 'Manual Entry'
    })));
  };

  // Save Bulk Attendance to Database
  const handleSaveAttendance = () => {
    setSaving(true);
    fetch(`${Api}/staff/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateStr,
        records: attendanceList
      })
    })
      .then(res => res.json())
      .then(data => {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `✓ Saved attendance records for ${dateStr} successfully!`, type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
        loadAttendance(dateStr);
      })
      .catch(err => {
        console.error("Failed to save attendance", err);
        if (setGlobalNotification) {
          setGlobalNotification({ msg: 'Failed to save attendance records', type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
      })
      .finally(() => setSaving(false));
  };

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

  const filteredMonthly = monthlySummaries.filter(item => 
    (item.staffName || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (item.staffCode || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

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
      <div className="bg-white border border-gray-400 p-2 shadow-sm rounded flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-2">
          <UserCheck size={20} className="text-[#2b579a]" />
          <h1 className="text-base font-bold text-[#2b579a] uppercase">Staff Attendance & Employee Status Register</h1>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded border border-gray-300">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              viewMode === 'daily' ? 'bg-[#2b579a] text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar size={14} />
            <span>Daily Attendance (Manual Entry)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              viewMode === 'monthly' ? 'bg-[#2b579a] text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 size={14} />
            <span>Monthly Employee Status Summary</span>
          </button>
        </div>

        {viewMode === 'daily' ? (
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
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving}
              className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1 rounded shadow text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : '💾 Save Attendance'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs font-bold">
            <Calendar size={14} className="text-blue-900" />
            <span>Select Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {viewMode === 'daily' ? (
        <>
          {/* Daily Interactive Summary Cards */}
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

            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-700">Quick Batch Action:</span>
              <button
                type="button"
                onClick={() => handleMarkAllStatus('Present')}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow transition-all active:scale-95"
              >
                Mark All Present 🟢
              </button>
              <button
                type="button"
                onClick={() => handleMarkAllStatus('Absent')}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow transition-all active:scale-95"
              >
                Mark All Absent 🔴
              </button>
              <button
                type="button"
                onClick={() => handleMarkAllStatus('Half Day')}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow transition-all active:scale-95"
              >
                Mark All Half Day 🟡
              </button>
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

          {/* Daily Attendance Table with Manual Status Entry */}
          <div className="flex-1 bg-white border border-gray-400 rounded p-2 overflow-hidden shadow-sm flex flex-col">
            <div className="flex-1 overflow-auto border border-gray-300 rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#2b579a] text-white sticky top-0 font-bold">
                  <tr>
                    <th className="p-2.5 border-b">Employee Name & Code</th>
                    <th className="p-2.5 border-b text-center">Assigned Shift</th>
                    <th className="p-2.5 border-b text-center">Manual Status Selector</th>
                    <th className="p-2.5 border-b text-center">Check-In Time</th>
                    <th className="p-2.5 border-b text-center">Check-Out Time</th>
                    <th className="p-2.5 border-b text-center">Hours Worked</th>
                    <th className="p-2.5 border-b text-center">Overtime (OT)</th>
                    <th className="p-2.5 border-b">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center p-6 text-gray-500 font-semibold">Loading attendance data...</td></tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr><td colSpan={8} className="text-center p-6 text-gray-500 font-semibold">No attendance records found matching filters.</td></tr>
                  ) : (
                    filteredAttendance.map((item, idx) => {
                      const targetShiftHours = item.shiftHours || 8;
                      const metrics = calculateAttendanceMetrics(item.checkIn, item.checkOut, item.status, targetShiftHours);

                      return (
                        <tr key={item.staffId || idx} className="hover:bg-blue-50 border-b border-gray-200 transition-colors">
                          <td className="p-2.5 font-bold text-gray-900">
                            {item.staffName}
                            <span className="text-[10px] text-gray-500 font-mono block font-normal">{item.staffCode} • {item.role}</span>
                          </td>

                          {/* Assigned Shift Timing */}
                          <td className="p-2.5 text-center font-mono font-bold text-blue-900">
                            {item.shiftInTime || '09:00 AM'} - {item.shiftOutTime || '06:00 PM'}
                            <span className="text-[10px] text-gray-500 block font-normal">({targetShiftHours} hrs)</span>
                          </td>

                          {/* Manual Status Buttons */}
                          <td className="p-2.5 text-center">
                            <div className="inline-flex flex-wrap gap-1 justify-center">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.staffId, 'Present')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  item.status === 'Present' ? 'bg-emerald-600 text-white border-emerald-700 shadow' : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                Present 🟢
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.staffId, 'Half Day')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  item.status === 'Half Day' ? 'bg-amber-600 text-white border-amber-700 shadow' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }`}
                              >
                                Half Day 🟡
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.staffId, 'Absent')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  item.status === 'Absent' ? 'bg-rose-600 text-white border-rose-700 shadow' : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                }`}
                              >
                                Absent 🔴
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.staffId, 'Paid Leave')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  item.status === 'Paid Leave' ? 'bg-sky-600 text-white border-sky-700 shadow' : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                                }`}
                              >
                                Paid Leave 🔵
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.staffId, 'Leave')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  item.status === 'Leave' ? 'bg-purple-600 text-white border-purple-700 shadow' : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                }`}
                              >
                                Leave 🟣
                              </button>
                            </div>
                          </td>

                          {/* Check-In Input */}
                          <td className="p-2.5 text-center">
                            <input
                              type="text"
                              value={item.checkIn || ''}
                              onChange={e => handleRecordFieldChange(item.staffId, 'checkIn', e.target.value)}
                              placeholder="09:00 AM"
                              className="w-20 text-center font-mono font-bold text-xs border border-gray-300 rounded py-0.5 bg-white text-emerald-900 focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* Check-Out Input */}
                          <td className="p-2.5 text-center">
                            <input
                              type="text"
                              value={item.checkOut || ''}
                              onChange={e => handleRecordFieldChange(item.staffId, 'checkOut', e.target.value)}
                              placeholder="06:00 PM"
                              className="w-20 text-center font-mono font-bold text-xs border border-gray-300 rounded py-0.5 bg-white text-emerald-900 focus:ring-1 focus:ring-blue-500"
                            />
                          </td>

                          {/* Hours Worked */}
                          <td className="p-2.5 text-center font-mono font-bold text-blue-950">
                            {metrics.hours}
                          </td>

                          {/* OT / Overtime */}
                          <td className="p-2.5 text-center font-mono font-bold">
                            {metrics.ot !== '-' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-block">
                                +{metrics.ot} OT
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={e => handleRecordFieldChange(item.staffId, 'remarks', e.target.value)}
                              placeholder="Add notes..."
                              className="w-full text-xs border border-gray-300 rounded px-2 py-0.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Monthly Employee Status Summary View */
        <div className="flex-1 bg-white border border-gray-400 rounded p-2 overflow-hidden shadow-sm flex flex-col">
          <div className="mb-2 flex justify-between items-center bg-blue-50 border border-blue-200 p-2 rounded text-xs font-bold text-blue-900">
            <span>📊 Employee Attendance Status Report for Month: {selectedMonth}</span>
            <span className="text-[11px] text-gray-600 font-normal">Track total days present, half days, paid leaves & absents per staff</span>
          </div>

          <div className="flex-1 overflow-auto border border-gray-300 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#2b579a] text-white sticky top-0 font-bold">
                <tr>
                  <th className="p-2.5 border-b">Employee Name & Code</th>
                  <th className="p-2.5 border-b text-center">Days Present 🟢</th>
                  <th className="p-2.5 border-b text-center">Half Days Taken 🟡</th>
                  <th className="p-2.5 border-b text-center">Paid Leaves 🔵</th>
                  <th className="p-2.5 border-b text-center">Unpaid Leaves 🟣</th>
                  <th className="p-2.5 border-b text-center">Absents 🔴</th>
                  <th className="p-2.5 border-b text-center">Late Arrivals 🟠</th>
                  <th className="p-2.5 border-b text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {loadingMonthly ? (
                  <tr><td colSpan={8} className="text-center p-6 text-gray-500 font-semibold">Calculating monthly status summary...</td></tr>
                ) : filteredMonthly.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-6 text-gray-500 font-semibold">No employee data found for {selectedMonth}.</td></tr>
                ) : (
                  filteredMonthly.map((item, idx) => (
                    <tr key={item.staffId || idx} className="hover:bg-blue-50 border-b border-gray-200 transition-colors">
                      <td className="p-2.5 font-bold text-gray-900">
                        {item.staffName}
                        <span className="text-[10px] text-gray-500 font-mono block font-normal">{item.staffCode} • {item.role}</span>
                      </td>

                      {/* Present */}
                      <td className="p-2.5 text-center font-bold text-emerald-800 font-mono text-sm">
                        <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                          {item.presentDays} days
                        </span>
                      </td>

                      {/* Half Days */}
                      <td className="p-2.5 text-center font-bold text-amber-900 font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded border ${item.halfDays > 0 ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {item.halfDays} half days
                        </span>
                      </td>

                      {/* Paid Leaves */}
                      <td className="p-2.5 text-center font-bold text-sky-900 font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded border ${item.paidLeaves > 0 ? 'bg-sky-100 border-sky-400 text-sky-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {item.paidLeaves} days
                        </span>
                      </td>

                      {/* Unpaid Leaves */}
                      <td className="p-2.5 text-center font-bold text-purple-900 font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded border ${item.leaves > 0 ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {item.leaves} days
                        </span>
                      </td>

                      {/* Absents */}
                      <td className="p-2.5 text-center font-bold text-rose-900 font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded border ${item.absents > 0 ? 'bg-rose-100 border-rose-400 text-rose-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {item.absents} days
                        </span>
                      </td>

                      {/* Late */}
                      <td className="p-2.5 text-center font-bold text-orange-900 font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded border ${item.lates > 0 ? 'bg-orange-100 border-orange-400 text-orange-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {item.lates} times
                        </span>
                      </td>

                      {/* Attendance % */}
                      <td className="p-2.5 text-center font-bold font-mono">
                        <span className={`px-2 py-0.5 rounded text-xs border ${
                          item.attendancePct >= 90 ? 'bg-emerald-200 text-emerald-950 border-emerald-400' :
                          item.attendancePct >= 75 ? 'bg-amber-200 text-amber-950 border-amber-400' :
                          'bg-rose-200 text-rose-950 border-rose-400'
                        }`}>
                          {item.attendancePct}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;
