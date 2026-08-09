import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Save, X, AlertCircle } from 'lucide-react';
import Api from '../Api';

interface OpeningCashModalProps {
  onSuccess?: (total: number) => void;
}

const DEFAULT_DENOMINATIONS: number[] = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export const OpeningCashModal: React.FC<OpeningCashModalProps> = ({ onSuccess }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
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

  useEffect(() => {
    // Check if opening cash is already entered for today
    const checkTodayOpening = async () => {
      // First check local storage cache for instant UI
      const cached = localStorage.getItem(`opening_cash_${todayStr}`);
      if (cached) {
        return; // Already completed today
      }

      try {
        const res = await fetch(`${Api}/cash-drawer/opening/today?date=${todayStr}`);
        const data = await res.json();
        if (data.success) {
          if (!data.hasOpeningCash) {
            setIsOpen(true); // Open prompt modal if not completed today
          } else if (data.data?.totalOpeningCash !== undefined) {
            localStorage.setItem(`opening_cash_${todayStr}`, String(data.data.totalOpeningCash));
          }
        }
      } catch (err) {
        console.log('Backend sync offline for opening cash check');
      }
    };

    checkTodayOpening();
  }, [todayStr]);

  const handleCountChange = (val: number, countStr: string) => {
    const parsed = parseInt(countStr, 10);
    setCounts(prev => ({
      ...prev,
      [val]: isNaN(parsed) || parsed < 0 ? 0 : parsed
    }));
  };

  const calculatedRows = useMemo(() => {
    return DEFAULT_DENOMINATIONS.map(val => {
      const count = counts[val] || 0;
      return { value: val, count, amount: val * count };
    });
  }, [counts]);

  const totalOpeningAmount = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.amount, 0);
  }, [calculatedRows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        date: todayStr,
        counter: 'Counter 1',
        shift: 'Morning',
        cashier: 'Admin',
        denominations: counts,
        totalOpeningCash: totalOpeningAmount
      };

      const res = await fetch(`${Api}/cash-drawer/opening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(`opening_cash_${todayStr}`, String(totalOpeningAmount));
        setIsOpen(false);
        if (onSuccess) onSuccess(totalOpeningAmount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Daily Opening Cash Status</h3>
              <p className="text-xs text-slate-500">Business Date: {todayStr} (Counter 1)</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt Alert */}
        <div className="flex items-center gap-2.5 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
          <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Please record the physical cash drawer opening count for today.</span>
        </div>

        {/* Denominations Quick Table */}
        <div className="max-h-64 overflow-y-auto pr-1 border border-slate-200 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left">Denomination</th>
                <th className="py-2 px-3 text-center">Count</th>
                <th className="py-2 px-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedRows.map(row => (
                <tr key={row.value}>
                  <td className="py-1.5 px-3 font-bold text-slate-800">₹{row.value}</td>
                  <td className="py-1.5 px-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={row.count === 0 ? '' : row.count}
                      onChange={e => handleCountChange(row.value, e.target.value)}
                      placeholder="0"
                      className="w-16 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right font-extrabold text-slate-900">
                    ₹{row.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className="flex items-center justify-between p-3.5 bg-slate-900 text-white rounded-2xl">
          <span className="text-xs text-slate-300 font-bold uppercase">Total Opening Cash Amount</span>
          <span className="text-xl font-black text-emerald-400">₹{totalOpeningAmount.toLocaleString('en-IN')}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
          >
            Remind Me Later
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Opening Amount'}
          </button>
        </div>

      </div>
    </div>
  );
};
