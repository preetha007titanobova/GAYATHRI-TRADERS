import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Scale, Calendar } from 'lucide-react';

const DEBIT_BALANCES: { id: number, group: string, amount: number }[] = [];
const CREDIT_BALANCES: { id: number, group: string, amount: number }[] = [];

const TrialBS = () => {
  const { setToolbarActions } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
  }>();

  const [asOfDate, setAsOfDate] = useState('2026-06-30');

  useEffect(() => {
    setToolbarActions({
      onPrint: () => window.print()
    });
    return () => setToolbarActions({});
  }, [setToolbarActions]);

  const totalDr = DEBIT_BALANCES.reduce((s, b) => s + b.amount, 0);
  const totalCr = CREDIT_BALANCES.reduce((s, b) => s + b.amount, 0);

  // Pad the arrays so the table has equal rows visually
  const maxRows = Math.max(DEBIT_BALANCES.length, CREDIT_BALANCES.length);
  const drRows = [...DEBIT_BALANCES];
  const crRows = [...CREDIT_BALANCES];
  while(drRows.length < maxRows) drRows.push({ id: Math.random(), group: '', amount: 0 });
  while(crRows.length < maxRows) crRows.push({ id: Math.random(), group: '', amount: 0 });

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-4 overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-4 border border-gray-400 shadow-sm rounded mb-4 flex-shrink-0 flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#2b579a] flex items-center">
          <Scale size={24} className="mr-3" />
          Trial Balance
        </h2>

        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded shadow-sm">
           <Calendar size={16} className="text-gray-500" />
           <span className="text-sm font-bold text-gray-700">As of Date:</span>
           <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer" />
        </div>
      </div>

      {/* DUAL PANE T-FORMAT GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden max-w-5xl mx-auto w-full">
        
        <div className="bg-[#1e3f70] text-white p-3 flex justify-center uppercase tracking-widest font-bold text-sm">
           Trial Balance as on {asOfDate.split('-').reverse().join('-')}
        </div>

        <div className="flex-1 flex overflow-auto">
          {/* LEFT: DEBIT */}
          <div className="flex-1 flex flex-col border-r-2 border-gray-400">
             <div className="bg-[#f8f9fa] border-b-2 border-gray-300 p-2 text-center font-black text-gray-700 uppercase tracking-wide flex justify-between px-6">
                <span>Particulars (Debit Balances)</span>
                <span>Amount (₹)</span>
             </div>
             <div className="flex-1 py-2">
                {drRows.map((row, i) => (
                  <div key={row.id} className="flex justify-between px-6 py-1.5 hover:bg-blue-50">
                    <span className="font-semibold text-gray-800">{row.group}</span>
                    <span className="font-mono font-bold text-gray-700">{row.amount > 0 ? row.amount.toFixed(2) : ''}</span>
                  </div>
                ))}
             </div>
          </div>

          {/* RIGHT: CREDIT */}
          <div className="flex-1 flex flex-col">
             <div className="bg-[#f8f9fa] border-b-2 border-gray-300 p-2 text-center font-black text-gray-700 uppercase tracking-wide flex justify-between px-6">
                <span>Particulars (Credit Balances)</span>
                <span>Amount (₹)</span>
             </div>
             <div className="flex-1 py-2">
                {crRows.map((row, i) => (
                  <div key={row.id} className="flex justify-between px-6 py-1.5 hover:bg-blue-50">
                    <span className="font-semibold text-gray-800">{row.group}</span>
                    <span className="font-mono font-bold text-gray-700">{row.amount > 0 ? row.amount.toFixed(2) : ''}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* STICKY TALLY FOOTER */}
        <div className="bg-blue-50 border-t-4 border-double border-gray-500 flex flex-shrink-0">
          <div className="flex-1 flex justify-between px-6 py-3 border-r-2 border-gray-400">
            <span className="font-black text-gray-800 uppercase">Grand Total</span>
            <span className="font-mono font-black text-xl text-[#2b579a]">{totalDr.toFixed(2)}</span>
          </div>
          <div className="flex-1 flex justify-between px-6 py-3">
            <span className="font-black text-gray-800 uppercase">Grand Total</span>
            <span className="font-mono font-black text-xl text-[#2b579a]">{totalCr.toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrialBS;