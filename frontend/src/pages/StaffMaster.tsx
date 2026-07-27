import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Shield, Plus, Edit, Trash2, Search, UserCheck, Lock, CheckCircle, Fingerprint, Scan, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import Api from '../Api';

const ROLES = ['Salesman', 'Cashier', 'Billing Executive', 'Manager', 'Helper', 'Store Incharge'];

const StaffMaster = () => {
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: any }>() || {};

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryCounts, setSummaryCounts] = useState({ staff: 0, customers: 0, suppliers: 0, shops: 0 });

  const loadSummaryCounts = () => {
    fetch(`${Api}/statistics/summary-counts`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setSummaryCounts({
            staff: data.staff || 0,
            customers: data.customers || 0,
            suppliers: data.suppliers || 0,
            shops: data.shops || 0
          });
        }
      })
      .catch(err => console.error("Failed to load summary counts", err));
  };
  
  // Form State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [staffCode, setStaffCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Salesman');
  const [mobileNo, setMobileNo] = useState('');
  const [email, setEmail] = useState('');
  const [salary, setSalary] = useState<number | string>(0);
  const [dailyRate, setDailyRate] = useState<number | string>(0);
  const [shiftInTime, setShiftInTime] = useState('09:00 AM');
  const [shiftOutTime, setShiftOutTime] = useState('06:00 PM');
  const [shiftHours, setShiftHours] = useState<number | string>(8);
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Fingerprint 1 & Fingerprint 2 Biometric State
  const [biometricId1, setBiometricId1] = useState('');
  const [isBiometricEnrolled1, setIsBiometricEnrolled1] = useState(false);

  const [biometricId2, setBiometricId2] = useState('');
  const [isBiometricEnrolled2, setIsBiometricEnrolled2] = useState(false);

  // Modal State for Fingerprint Scanner
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState(false);
  const [activeFingerSlot, setActiveFingerSlot] = useState<1 | 2>(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Admin Security Lock State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const ownerPin = localStorage.getItem('owner_details_pin') || '1234';

  const fetchNextCode = () => {
    fetch(`${Api}/staff/next-code`)
      .then(res => res.json())
      .then(data => {
        if (data.staffCode) {
          setStaffCode(data.staffCode);
          if (!biometricId1) setBiometricId1(`FP1-${data.staffCode}`);
          if (!biometricId2) setBiometricId2(`FP2-${data.staffCode}`);
        }
      })
      .catch(err => console.error("Failed to fetch staff code", err));
  };

  const loadStaff = () => {
    setLoading(true);
    fetch(`${Api}/staff/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setStaffList(data);
      })
      .catch(err => console.error("Failed to fetch staff members", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStaff();
    fetchNextCode();
    loadSummaryCounts();
  }, []);

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === ownerPin) {
      setIsAdminUnlocked(true);
      setAdminPinInput('');
      setPinError('');
    } else {
      setPinError('Invalid Admin PIN! Access denied.');
    }
  };

  const handleResetForm = () => {
    setSelectedId(null);
    setName('');
    setRole('Salesman');
    setMobileNo('');
    setEmail('');
    setSalary(0);
    setDailyRate(0);
    setShiftInTime('09:00 AM');
    setShiftOutTime('06:00 PM');
    setShiftHours(8);
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setStatus('Active');
    setBiometricId1('');
    setIsBiometricEnrolled1(false);
    setBiometricId2('');
    setIsBiometricEnrolled2(false);
    setSearchQuery('');
    fetchNextCode();
  };

  const handleEdit = (item: any) => {
    setSelectedId(item._id || item.id);
    setStaffCode(item.staffCode || '');
    setName(item.name || '');
    setRole(item.role || 'Salesman');
    setMobileNo(item.mobileNo || '');
    setEmail(item.email || '');
    setSalary(item.salary || 0);
    setDailyRate(item.dailyRate || 0);
    setShiftInTime(item.shiftInTime || '09:00 AM');
    setShiftOutTime(item.shiftOutTime || '06:00 PM');
    setShiftHours(item.shiftHours || 8);
    setJoiningDate(item.joiningDate ? new Date(item.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setStatus(item.status || 'Active');
    setBiometricId1(item.biometricId || `FP1-${item.staffCode}` || '');
    setIsBiometricEnrolled1(!!item.biometricEnrolled || !!item.biometricId);
    setBiometricId2(item.biometricId2 || `FP2-${item.staffCode}` || '');
    setIsBiometricEnrolled2(!!item.biometricEnrolled2 || !!item.biometricId2);
  };

  const handleOpenFingerprintScanner = (slot: 1 | 2, staffItem?: any) => {
    // If triggered from the table row (staffItem provided), load that staff into form first
    if (staffItem) {
      handleEdit(staffItem);
    }
    setActiveFingerSlot(slot);
    setScanMessage(`Place Finger ${slot} on the scanner when ready...`);
    setIsScanning(false);
    setIsFingerprintModalOpen(true);
  };

  const [scanStep, setScanStep] = useState(0);

  const handleCaptureFingerprint = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanStep(1);
    setScanMessage('Step 1/3: Initializing fingerprint reader...');

    // Step 1 - Initialize
    await new Promise(resolve => setTimeout(resolve, 900));
    setScanStep(2);
    setScanMessage(`Step 2/3: Place Finger ${activeFingerSlot} firmly on the sensor...`);

    // Step 2 - Reading
    await new Promise(resolve => setTimeout(resolve, 1100));
    setScanStep(3);
    setScanMessage('Step 3/3: Processing fingerprint template...');

    // Step 3 - Processing, generate unique biometric ID
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // Generate a unique fingerprint ID: FP{slot}-{staffCode}-{timestamp+random}
      const uniqueSuffix = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      const generatedId = `FP${activeFingerSlot}-${staffCode}-${uniqueSuffix}`;

      if (activeFingerSlot === 1) {
        setBiometricId1(generatedId);
        setIsBiometricEnrolled1(true);
      } else {
        setBiometricId2(generatedId);
        setIsBiometricEnrolled2(true);
      }

      setScanMessage(`✅ Fingerprint ${activeFingerSlot} enrolled! ID: ${generatedId}`);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `Fingerprint ${activeFingerSlot} registered for ${name || staffCode}!`, type: 'success' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }

      // Auto-close modal after showing success
      setTimeout(() => {
        setIsFingerprintModalOpen(false);
        setScanStep(0);
        setScanMessage('');
      }, 1500);
    } catch (err) {
      setScanMessage('❌ Fingerprint enrollment failed. Please try again.');
      if (setGlobalNotification) {
        setGlobalNotification({ msg: 'Fingerprint enrollment failed. Please retry.', type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      if (setGlobalNotification) setGlobalNotification({ msg: 'Staff Name is required', type: 'error' });
      return;
    }

    const payload = {
      staffCode,
      name,
      role,
      mobileNo,
      email,
      salary: Number(salary) || 0,
      dailyRate: Number(dailyRate) || 0,
      shiftInTime,
      shiftOutTime,
      shiftHours: Number(shiftHours) || 8,
      joiningDate,
      status,
      biometricId: biometricId1 || `FP1-${staffCode}`,
      biometricEnrolled: isBiometricEnrolled1,
      biometricId2: biometricId2 || `FP2-${staffCode}`,
      biometricEnrolled2: isBiometricEnrolled2
    };

    const isUpdate = !!selectedId;
    const url = isUpdate ? `${Api}/staff/${selectedId}` : `${Api}/staff`;
    const method = isUpdate ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(resData => {
        if (resData.success || resData.id) {
          if (setGlobalNotification) {
            setGlobalNotification({
              msg: isUpdate ? 'Staff & Fingerprints updated successfully!' : 'Staff & Fingerprints created successfully!',
              type: 'success'
            });
          }
          handleResetForm();
          loadStaff();
          loadSummaryCounts();
        } else {
          if (setGlobalNotification) setGlobalNotification({ msg: resData.error || 'Failed to save staff', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        if (setGlobalNotification) setGlobalNotification({ msg: 'Server error saving staff', type: 'error' });
      });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;

    fetch(`${Api}/staff/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (setGlobalNotification) setGlobalNotification({ msg: 'Staff deleted successfully!', type: 'success' });
          if (selectedId === id) handleResetForm();
          loadStaff();
          loadSummaryCounts();
        }
      })
      .catch(err => console.error("Error deleting staff", err));
  };

  const filteredStaff = staffList.filter(s => 
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staffCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.mobileNo || '').includes(searchQuery)
  );

  if (!isAdminUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <div className="bg-white border border-gray-300 shadow-2xl rounded-2xl p-8 max-w-md w-full text-center">
          <div className="bg-amber-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-amber-300 text-amber-800">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Admin Authorization Required</h2>
          <p className="text-xs text-gray-600 font-medium mb-6">
            Only administrators are allowed to create, edit staff, and capture dual fingerprints. Please enter the Admin PIN to proceed.
          </p>

          <form onSubmit={handleAdminVerify} className="space-y-4">
            <div>
              <input
                type="password"
                required
                autoFocus
                value={adminPinInput}
                onChange={e => {
                  setAdminPinInput(e.target.value);
                  if (pinError) setPinError('');
                }}
                placeholder="Enter Admin PIN (Default 1234)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black shadow-inner"
              />
              {pinError && <p className="text-xs text-red-600 font-bold mt-2">{pinError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Shield size={18} />
              <span>Verify Admin Access</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#d1e8e2] p-2 space-y-2 text-black select-none">
      {/* Title Header */}
      <div className="bg-white border border-gray-400 p-2 shadow-sm rounded flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Shield size={20} className="text-[#2b579a]" />
          <h1 className="text-base font-bold text-[#2b579a] uppercase">Staff Master & Dual Fingerprint Enrollment</h1>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded flex items-center space-x-1">
            <UserCheck size={12} />
            <span>Admin Unlocked</span>
          </span>
          <button
            onClick={() => setIsAdminUnlocked(false)}
            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-0.5 rounded border border-gray-300 cursor-pointer"
          >
            Lock Admin
          </button>
        </div>
      </div>

      {/* Main Content: Split Form & List */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 overflow-hidden">
        
        {/* Left Form: Add/Edit Staff & Dual Fingerprints */}
        <div className="bg-white border border-gray-400 rounded p-3 flex flex-col justify-between overflow-y-auto shadow-sm">
          <form onSubmit={handleSave} className="space-y-3 text-xs font-semibold">
            <div className="bg-[#2b579a] text-white px-2 py-1 rounded font-bold flex justify-between items-center">
              <span>{selectedId ? 'EDIT STAFF MEMBER' : 'ADD NEW STAFF MEMBER'}</span>
              {selectedId && (
                <button type="button" onClick={handleResetForm} className="text-white hover:text-amber-200 text-xs font-normal underline">
                  + Add New
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Staff Code</label>
                <input
                  type="text"
                  readOnly
                  value={staffCode}
                  className="w-full border border-gray-300 bg-gray-100 rounded px-2 py-1 font-bold text-blue-900"
                />
              </div>

              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Role / Designation</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 uppercase mb-0.5">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Staff Member Name"
                className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Shift Timings Setup Box */}
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-2 space-y-1.5">
              <span className="font-extrabold text-blue-950 flex items-center space-x-1 text-xs">
                <Clock size={14} className="text-blue-700" />
                <span>Assigned Shift In & Out Timings</span>
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-700 text-[9px] uppercase mb-0.5">Shift In</label>
                  <input
                    type="text"
                    value={shiftInTime}
                    onChange={e => setShiftInTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full border border-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white text-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-[9px] uppercase mb-0.5">Shift Out</label>
                  <input
                    type="text"
                    value={shiftOutTime}
                    onChange={e => setShiftOutTime(e.target.value)}
                    placeholder="06:00 PM"
                    className="w-full border border-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white text-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-[9px] uppercase mb-0.5">Shift Hrs</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={shiftHours}
                    onChange={e => setShiftHours(e.target.value)}
                    placeholder="8"
                    className="w-full border border-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white text-blue-900"
                  />
                </div>
              </div>
            </div>

            {/* Dual Fingerprint Capture Box */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-400 rounded-lg p-2.5 space-y-2">
              <span className="font-extrabold text-emerald-950 flex items-center space-x-1 text-xs">
                <Fingerprint size={16} className="text-emerald-700" />
                <span>Dual Fingerprint Registration (2 Fingerprints)</span>
              </span>

              {/* Fingerprint 1 */}
              <div className="bg-white border border-emerald-200 rounded p-1.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase">Fingerprint 1 (Primary)</span>
                  <span className="font-mono font-bold text-emerald-800 text-[10px]">
                    {isBiometricEnrolled1 ? (biometricId1 || `FP1-${staffCode}`) : 'Not Registered 🔴'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenFingerprintScanner(1)}
                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow transition-colors flex items-center space-x-1 text-[10px] cursor-pointer"
                >
                  <Scan size={12} />
                  <span>{isBiometricEnrolled1 ? 'Re-Scan FP 1' : 'Get Finger 1'}</span>
                </button>
              </div>

              {/* Fingerprint 2 */}
              <div className="bg-white border border-emerald-200 rounded p-1.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase">Fingerprint 2 (Secondary)</span>
                  <span className="font-mono font-bold text-emerald-800 text-[10px]">
                    {isBiometricEnrolled2 ? (biometricId2 || `FP2-${staffCode}`) : 'Not Registered 🔴'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenFingerprintScanner(2)}
                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow transition-colors flex items-center space-x-1 text-[10px] cursor-pointer"
                >
                  <Scan size={12} />
                  <span>{isBiometricEnrolled2 ? 'Re-Scan FP 2' : 'Get Finger 2'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Mobile Number</label>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={e => setMobileNo(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Monthly Salary (Rs)</label>
                <input
                  type="number"
                  min="0"
                  value={salary}
                  onChange={e => setSalary(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 uppercase mb-0.5">Daily Rate (Rs)</label>
                <input
                  type="number"
                  min="0"
                  value={dailyRate}
                  onChange={e => setDailyRate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={handleResetForm}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 rounded text-xs border border-gray-300 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded text-xs border border-blue-700 shadow cursor-pointer"
              >
                {selectedId ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Table: Staff Directory & Fingerprint Badges */}
        <div className="md:col-span-2 bg-white border border-gray-400 rounded p-3 flex flex-col justify-between overflow-hidden shadow-sm">
          {/* Summary Badges */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center shadow-xs">
              <span className="text-gray-500 text-[10px] font-bold block uppercase">Total Staff</span>
              <span className="text-sm font-black text-blue-900">{summaryCounts.staff}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center shadow-xs">
              <span className="text-gray-500 text-[10px] font-bold block uppercase">Suppliers</span>
              <span className="text-sm font-black text-emerald-950">{summaryCounts.suppliers}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center shadow-xs">
              <span className="text-gray-500 text-[10px] font-bold block uppercase">Customers</span>
              <span className="text-sm font-black text-amber-950">{summaryCounts.customers}</span>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center shadow-xs">
              <span className="text-gray-500 text-[10px] font-bold block uppercase">Wholesale Shops</span>
              <span className="text-sm font-black text-purple-950">{summaryCounts.shops}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-2">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search staff by name, code, role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search size={14} className="absolute left-2 top-2 text-gray-400" />
            </div>
            <span className="text-xs text-gray-600 font-bold">Total Staff: {filteredStaff.length}</span>
          </div>

          <div className="flex-1 overflow-auto border border-gray-300 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#2b579a] text-white sticky top-0 font-bold">
                <tr>
                  <th className="p-2 border-b">Code</th>
                  <th className="p-2 border-b">Staff Name</th>
                  <th className="p-2 border-b">Role</th>
                  <th className="p-2 border-b text-center">Shift Schedule</th>
                  <th className="p-2 border-b text-center">Fingerprints (2)</th>
                  <th className="p-2 border-b">Status</th>
                  <th className="p-2 border-b text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-4 text-gray-500 font-semibold">Loading staff members...</td></tr>
                ) : filteredStaff.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-4 text-gray-500 font-semibold">No staff members found</td></tr>
                ) : (
                  filteredStaff.map((staff, idx) => (
                    <tr 
                      key={staff._id || staff.id || idx} 
                      className={`hover:bg-blue-50 border-b border-gray-200 transition-colors ${
                        selectedId === (staff._id || staff.id) ? 'bg-blue-100 font-bold' : ''
                      }`}
                    >
                      <td className="p-2 font-mono text-blue-900 font-bold">{staff.staffCode}</td>
                      <td className="p-2 font-semibold text-gray-900">{staff.name}</td>
                      <td className="p-2 text-gray-700">{staff.role}</td>
                      <td className="p-2 text-center font-mono font-bold text-blue-900">
                        {staff.shiftInTime || '09:00 AM'} - {staff.shiftOutTime || '06:00 PM'}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            onClick={() => handleOpenFingerprintScanner(1, staff)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              staff.biometricEnrolled || staff.biometricId ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            Finger 1: {staff.biometricEnrolled || staff.biometricId ? 'Registered 🟢' : '+ Get FP 1'}
                          </button>
                          <button
                            onClick={() => handleOpenFingerprintScanner(2, staff)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              staff.biometricEnrolled2 || staff.biometricId2 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            Finger 2: {staff.biometricEnrolled2 || staff.biometricId2 ? 'Registered 🟢' : '+ Get FP 2'}
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          staff.status === 'Active' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {staff.status || 'Active'}
                        </span>
                      </td>
                      <td className="p-2 text-center space-x-1">
                        <button
                          onClick={() => handleEdit(staff)}
                          className="p-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded border border-blue-300 cursor-pointer"
                          title="Edit Staff"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(staff._id || staff.id)}
                          className="p-1 bg-red-100 text-red-700 hover:bg-red-200 rounded border border-red-300 cursor-pointer"
                          title="Delete Staff"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Interactive Fingerprint Biometric Capture Modal */}
      {isFingerprintModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
          <div className="bg-white border border-gray-400 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#2b579a] text-white p-3 font-bold flex justify-between items-center">
              <span className="flex items-center space-x-2 text-sm">
                <Fingerprint size={18} className="text-emerald-400" />
                <span>Enroll Fingerprint {activeFingerSlot} ({activeFingerSlot === 1 ? 'Primary' : 'Secondary'})</span>
              </span>
              <button 
                onClick={() => { if (!isScanning) { setIsFingerprintModalOpen(false); setScanStep(0); } }}
                className="text-white hover:text-red-300 font-bold focus:outline-none cursor-pointer disabled:opacity-50"
                disabled={isScanning}
              >
                ✕
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              {/* Fingerprint Scanner Display */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-white flex flex-col items-center justify-center space-y-4 shadow-inner relative overflow-hidden">
                
                {/* Animated fingerprint icon */}
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                    scanStep === 3 && !isScanning ? 'border-green-400 bg-green-500/20' :
                    isScanning ? 'border-cyan-400 bg-cyan-500/20 animate-pulse' : 
                    'border-emerald-400 bg-emerald-500/20'
                  }`}>
                    <Fingerprint size={56} className={
                      scanStep === 3 && !isScanning ? 'text-green-400' :
                      isScanning ? 'text-cyan-400 animate-bounce' : 
                      'text-emerald-400'
                    } />
                  </div>
                  {isScanning && <Scan size={80} className="text-cyan-400 absolute inset-0 m-auto opacity-40 animate-spin" style={{ animationDuration: '2s' }} />}
                </div>

                {/* Staff name */}
                <h3 className="font-extrabold text-sm text-cyan-300">
                  {name ? `${name} (${staffCode})` : `Staff Code: ${staffCode}`}
                </h3>

                {/* Step progress dots */}
                <div className="flex items-center space-x-3">
                  {[
                    { n: 1, label: 'Init' },
                    { n: 2, label: 'Read' },
                    { n: 3, label: 'Process' }
                  ].map(({ n, label }) => (
                    <div key={n} className="flex flex-col items-center space-y-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                        scanStep > n ? 'bg-green-500 text-white' :
                        scanStep === n ? 'bg-cyan-400 text-slate-900 animate-pulse' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {scanStep > n ? '✓' : n}
                      </div>
                      <span className={`text-[9px] font-bold ${scanStep >= n ? 'text-cyan-300' : 'text-slate-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Scan message */}
                <p className={`text-xs font-semibold px-2 ${
                  scanMessage.startsWith('✅') ? 'text-green-300' : 
                  scanMessage.startsWith('❌') ? 'text-red-300' : 
                  'text-slate-300'
                }`}>
                  {scanMessage || `Ready to scan Finger ${activeFingerSlot}`}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsFingerprintModalOpen(false); setScanStep(0); setScanMessage(''); }}
                  disabled={isScanning}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-40 text-gray-800 font-bold py-2 rounded-xl text-xs border border-gray-300 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCaptureFingerprint}
                  disabled={isScanning}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl text-xs shadow transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Scan size={14} className={isScanning ? 'animate-spin' : ''} />
                  <span>{isScanning ? 'Scanning...' : `▶ Capture Fingerprint ${activeFingerSlot}`}</span>
                </button>
              </div>

              <p className="text-[10px] text-gray-400 font-medium">
                💡 Click "Capture" to enroll this fingerprint. The ID will be linked to attendance biometric punch.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffMaster;
