import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Landmark, Calendar } from 'lucide-react';

const LIABILITIES: { id: number, group: string, items: { name: string, amount: number }[] }[] = [];
const ASSETS: { id: number, group: string, items: { name: string, amount: number }[] }[] = [];

const BalanceSheet = () => {
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

  const totalLiab = LIABILITIES.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0);
  const totalAsset = ASSETS.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-4 overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-4 border border-gray-400 shadow-sm rounded mb-4 flex-shrink-0 flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#2b579a] flex items-center">
          <Landmark size={24} className="mr-3" />
          Balance Sheet
        </h2>

        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded shadow-sm">
           <Calendar size={16} className="text-gray-500" />
           <span className="text-sm font-bold text-gray-700">As on Date:</span>
           <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer" />
        </div>
      </div>

      {/* DUAL PANE T-FORMAT GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden max-w-6xl mx-auto w-full">
        
        <div className="bg-[#1e3f70] text-white p-3 flex justify-center uppercase tracking-widest font-bold text-sm">
           Balance Sheet as on {asOfDate.split('-').reverse().join('-')}
        </div>

        <div className="flex-1 flex overflow-auto">
          {/* LEFT: LIABILITIES */}
          <div className="flex-1 flex flex-col border-r-2 border-gray-400">
             <div className="bg-[#f8f9fa] border-b-2 border-gray-300 p-2 text-center font-black text-gray-700 uppercase tracking-wide flex justify-between px-6">
                <span>Liabilities</span>
                <span>Amount (₹)</span>
             </div>
             <div className="flex-1 py-4 px-6 space-y-4">
                {LIABILITIES.map(g => (
                  <div key={g.id} className="text-sm">
                    <div className="font-black text-gray-800 underline mb-1">{g.group}</div>
                    {g.items.map(item => (
                      <div key={item.name} className="flex justify-between pl-4 py-1 text-gray-700 font-semibold hover:bg-gray-50">
                        <span>{item.name}</span>
                        <span className="font-mono">{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1 border-t border-dashed border-gray-300 font-mono font-bold text-gray-900 mt-1">
                      {g.items.reduce((s,i) => s + i.amount, 0).toFixed(2)}
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* RIGHT: ASSETS */}
          <div className="flex-1 flex flex-col">
             <div className="bg-[#f8f9fa] border-b-2 border-gray-300 p-2 text-center font-black text-gray-700 uppercase tracking-wide flex justify-between px-6">
                <span>Assets</span>
                <span>Amount (₹)</span>
             </div>
             <div className="flex-1 py-4 px-6 space-y-4">
                {ASSETS.map(g => (
                  <div key={g.id} className="text-sm">
                    <div className="font-black text-gray-800 underline mb-1">{g.group}</div>
                    {g.items.map(item => (
                      <div key={item.name} className="flex justify-between pl-4 py-1 text-gray-700 font-semibold hover:bg-gray-50">
                        <span>{item.name}</span>
                        <span className="font-mono">{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1 border-t border-dashed border-gray-300 font-mono font-bold text-gray-900 mt-1">
                      {g.items.reduce((s,i) => s + i.amount, 0).toFixed(2)}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* STICKY TALLY FOOTER */}
        <div className="bg-[#1e3f70] text-white flex flex-shrink-0">
          <div className="flex-1 flex justify-between px-6 py-3 border-r-2 border-[#142d54]">
            <span className="font-black uppercase tracking-widest text-lg">Total</span>
            <span className="font-mono font-black text-2xl text-yellow-400">{totalLiab.toFixed(2)}</span>
          </div>
          <div className="flex-1 flex justify-between px-6 py-3">
            <span className="font-black uppercase tracking-widest text-lg">Total</span>
            <span className="font-mono font-black text-2xl text-yellow-400">{totalAsset.toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BalanceSheet;