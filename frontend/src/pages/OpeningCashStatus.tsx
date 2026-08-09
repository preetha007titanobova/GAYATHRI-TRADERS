import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, Save, Calendar, User, Clock, Monitor, RefreshCw, CheckCircle2, History, AlertCircle } from 'lucide-react';
import Api from '../Api';

interface DenominationRow {
  value: number;
  label: string;
  count: number;
}

const DEFAULT_DENOMINATIONS: number[] = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export const OpeningCashStatus: React.FC = () => {
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: (notif: { msg: string; type: string }) => void }>() || {};

  const todayDateStr = new Date().toISOString().split('T')[0];
  const [businessDate, setBusinessDate] = useState(todayDateStr);
  const [counter, setCounter] = useState('Counter 1');
  const [shift, setShift] = useState('Morning');
  const [cashier, setCashier] = useState('Admin');
  const [remarks, setRemarks] = useState('');

  const [counts, setCounts] = useState<{ [key: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);

  // Fetch today's record & past records on mount
  useEffect(() => {
    fetchTodayOpeningCash();
    fetchHistory();
  }, []);

  const fetchTodayOpeningCash = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${Api}/cash-drawer/opening/today?date=${businessDate}`);
      const data = await res.json();
      if (data.success && data.hasOpeningCash && data.data) {
        setIsAlreadySaved(true);
        const record = data.data;
        if (record.counter) setCounter(record.counter);
        if (record.shift) setShift(record.shift);
        if (record.cashier) setCashier(record.cashier);
        if (record.remarks) setRemarks(record.remarks);
        if (record.denominations) {
          setCounts(record.denominations);
        }
      } else {
        setIsAlreadySaved(false);
      }
    } catch (err) {
      console.error('Error fetching today opening cash:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${Api}/cash-drawer/opening/history`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleCountChange = (val: number, countStr: string) => {
    const parsed = parseInt(countStr, 10);
    const newCount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setCounts(prev => ({
      ...prev,
      [val]: newCount
    }));
  };

  const handleClear = () => {
    setCounts({
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      2: 0,
      1: 0
    });
    setRemarks('');
  };

  // Compute subtotal for each row and grand total
  const calculatedRows = useMemo(() => {
    return DEFAULT_DENOMINATIONS.map(val => {
      const count = counts[val] || 0;
      return {
        value: val,
        label: `₹${val}`,
        count,
        amount: val * count
      };
    });
  }, [counts]);

  const totalOpeningAmount = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.amount, 0);
  }, [calculatedRows]);

  const totalCountOfNotes = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.count, 0);
  }, [calculatedRows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        date: businessDate,
        counter,
        shift,
        cashier,
        denominations: counts,
        totalOpeningCash: totalOpeningAmount,
        remarks
      };

      const res = await fetch(`${Api}/cash-drawer/opening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setIsAlreadySaved(true);
        // Save to localStorage as quick cache for startup check
        localStorage.setItem(`opening_cash_${businessDate}`, String(totalOpeningAmount));
        if (setGlobalNotification) {
          setGlobalNotification({
            msg: `Opening Cash Status ₹${totalOpeningAmount.toLocaleString()} saved successfully!`,
            type: 'success'
          });
        }
        fetchHistory();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: 'Error saving opening cash: ' + data.error, type: 'error' });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: 'Network error saving opening cash status.', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-300" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Opening Cash Status</h1>
          </div>
          <p className="text-emerald-100 text-xs pl-10">
            Record physical cash drawer denominations at the beginning of the business day.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20">
          <div className="text-right">
            <span className="text-xs text-emerald-200 block">Today's Opening Cash</span>
            <span className="text-2xl font-extrabold text-white">₹{totalOpeningAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {isAlreadySaved && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <strong>Opening Cash Status Recorded:</strong> Today's opening cash entry of <strong>₹{totalOpeningAmount.toLocaleString('en-IN')}</strong> has already been saved. You can modify counts below if required.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Entry Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-6">
          
          {/* Metadata Controls Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            
            <div>
              <label className="text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Business Date
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={e => setBusinessDate(e.target.value)}
                className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5 text-slate-400" /> Counter
              </label>
              <select
                value={counter}
                onChange={e => setCounter(e.target.value)}
                className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Counter 1">Counter 1</option>
                <option value="Counter 2">Counter 2</option>
                <option value="Express Counter">Express Counter</option>
              </select>
            </div>

            <div>
              <label className="text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Shift
              </label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value)}
                className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Full Day">Full Day</option>
              </select>
            </div>

            <div>
              <label className="text-slate-500 font-semibold mb-1 block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> Cashier
              </label>
              <input
                type="text"
                value={cashier}
                onChange={e => setCashier(e.target.value)}
                className="w-full font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Cashier Name"
              />
            </div>

          </div>

          {/* Denominations Table */}
          <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-1/3">Denomination</th>
                  <th className="py-3 px-4 w-1/3 text-center">Count (Notes/Coins)</th>
                  <th className="py-3 px-4 w-1/3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {calculatedRows.map(row => (
                  <tr key={row.value} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-extrabold text-slate-800 flex items-center gap-2">
                      <span className="inline-block w-14 text-center py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-xs border border-emerald-200">
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.count === 0 ? '' : row.count}
                        onChange={e => handleCountChange(row.value, e.target.value)}
                        placeholder="0"
                        className="w-24 text-center font-bold text-slate-900 bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-lg p-1.5 outline-none transition-all"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-extrabold text-slate-900">
                      ₹{row.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-extrabold text-slate-900">
                <tr>
                  <td className="py-3.5 px-4 uppercase text-xs text-slate-600">Total Notes: {totalCountOfNotes}</td>
                  <td className="py-3.5 px-4 text-center uppercase text-xs text-slate-600">Total Opening Cash</td>
                  <td className="py-3.5 px-4 text-right text-lg text-emerald-700 font-black">
                    ₹{totalOpeningAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Remarks input & Action buttons */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Remarks / Cash Drawer Notes</label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Optional notes e.g., Initial float received from manager"
                className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear Counts
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving Opening Cash...' : (isAlreadySaved ? 'Update Opening Cash Status' : 'Save Opening Cash Status')}
              </button>
            </div>
          </div>

        </div>

        {/* History & Info Side Panel */}
        <div className="space-y-6">
          
          {/* Summary Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Cash Drawer Summary
            </h3>
            
            <div className="space-y-2 text-xs border-t border-slate-700/80 pt-3">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Selected Date:</span>
                <span className="font-bold text-slate-200">{businessDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Assigned Counter:</span>
                <span className="font-bold text-slate-200">{counter}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Working Shift:</span>
                <span className="font-bold text-slate-200">{shift}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Responsible Cashier:</span>
                <span className="font-bold text-slate-200">{cashier}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-center">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">Total Opening Balance</span>
              <span className="text-2xl font-black text-emerald-300">₹{totalOpeningAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Past History Log */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" /> Recent Opening Records
              </h3>
              <button onClick={fetchHistory} className="text-emerald-600 hover:text-emerald-700 text-[11px] font-bold">
                Refresh
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No historical opening records found.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div key={item.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{item.dateStr || item.date?.split('T')[0]}</span>
                      <span className="font-extrabold text-emerald-700">₹{item.totalOpeningCash?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>{item.counter} ({item.shift})</span>
                      <span>By: {item.cashier}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
