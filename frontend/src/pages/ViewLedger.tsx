import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { BookOpen, Calendar, Filter } from 'lucide-react';

interface LedgerMove {
  id: string;
  date: string;
  particulars: string;
  vchType: string;
  vchNo: string;
  dr: number;
  cr: number;
}

const LEDGERS: { id: string, name: string, opBal: number, opType: string }[] = [];
const MOCK_DATA: Record<string, LedgerMove[]> = {};

const ViewLedger = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const [selectedLedger, setSelectedLedger] = useState(LEDGERS[0]?.id || '');
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState('2026-06-30');
  
  const [filters, setFilters] = useState({ challan: true, taxBill: true, retail: true });

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Ledger Statement...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const activeLedger = LEDGERS.find(l => l.id === selectedLedger);

  const statement = useMemo(() => {
    const moves = MOCK_DATA[selectedLedger] || [];
    const filtered = moves.filter(m => m.date >= fromDate && m.date <= toDate).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Base Op Bal (Signed: Dr is positive, Cr is negative)
    let runningBal = activeLedger ? (activeLedger.opType === 'Dr' ? activeLedger.opBal : -activeLedger.opBal) : 0;

    // Adjust for prior moves
    const priorMoves = moves.filter(m => m.date < fromDate);
    priorMoves.forEach(m => {
      runningBal += m.dr;
      runningBal -= m.cr;
    });

    const opBalDisplay = {
      amount: Math.abs(runningBal),
      type: runningBal >= 0 ? 'Dr' : 'Cr'
    };

    let totalDr = 0;
    let totalCr = 0;

    const rows = filtered.map(m => {
      runningBal += m.dr;
      runningBal -= m.cr;
      totalDr += m.dr;
      totalCr += m.cr;
      
      return { 
        ...m, 
        balAmt: Math.abs(runningBal), 
        balType: runningBal >= 0 ? 'Dr' : 'Cr' 
      };
    });

    const clBalDisplay = {
      amount: Math.abs(runningBal),
      type: runningBal >= 0 ? 'Dr' : 'Cr'
    };

    return { opBalDisplay, rows, totalDr, totalCr, clBalDisplay };
  }, [selectedLedger, fromDate, toDate, activeLedger]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            View Ledger
          </h2>

          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1 rounded-md shadow-sm">
             <div className="bg-[#2b579a] p-1.5 rounded text-white">
               <BookOpen size={14} />
             </div>
             <select 
               value={selectedLedger} 
               onChange={e => setSelectedLedger(e.target.value)}
               className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none w-64 pr-2 cursor-pointer"
             >
               {LEDGERS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
             </select>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-4 border-r border-gray-300 pr-4">
             <div className="flex items-center space-x-1">
               <input type="checkbox" id="f1" checked={filters.challan} onChange={e => setFilters({...filters, challan: e.target.checked})} className="w-3 h-3 text-blue-600"/>
               <label htmlFor="f1" className="text-xs font-bold text-gray-600">Challan</label>
             </div>
             <div className="flex items-center space-x-1">
               <input type="checkbox" id="f2" checked={filters.taxBill} onChange={e => setFilters({...filters, taxBill: e.target.checked})} className="w-3 h-3 text-blue-600"/>
               <label htmlFor="f2" className="text-xs font-bold text-gray-600">Tax Bill</label>
             </div>
             <div className="flex items-center space-x-1">
               <input type="checkbox" id="f3" checked={filters.retail} onChange={e => setFilters({...filters, retail: e.target.checked})} className="w-3 h-3 text-blue-600"/>
               <label htmlFor="f3" className="text-xs font-bold text-gray-600">Retail</label>
             </div>
          </div>

          <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-1.5 rounded-md">
             <span className="font-bold text-[#2b579a] flex items-center text-sm mr-3 pl-2"><Calendar size={16} className="mr-1.5"/> Period:</span>
             <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
               <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
               <span className="text-gray-400 text-sm font-medium">to</span>
               <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
             </div>
          </div>
        </div>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Date</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Particulars</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Vch Type</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Vch No.</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right">Debit (₹)</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right">Credit (₹)</th>
                <th className="p-2 text-xs font-semibold w-36 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr className="bg-[#f8f9fa] border-b border-gray-300">
                 <td colSpan={4} className="p-2 text-right font-bold text-gray-700 italic">Opening Balance as on {fromDate.split('-').reverse().join('-')} :</td>
                 <td className="p-2"></td>
                 <td className="p-2"></td>
                 <td className="p-2 text-right font-mono font-black text-gray-900 bg-gray-200/50">
                    {statement.opBalDisplay.amount.toFixed(2)} <span className={`text-[10px] ml-1 ${statement.opBalDisplay.type === 'Dr' ? 'text-green-700' : 'text-red-700'}`}>{statement.opBalDisplay.type}</span>
                 </td>
              </tr>

              {statement.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <p className="italic text-sm">No transactions found for this period.</p>
                  </td>
                </tr>
              ) : (
                statement.rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'}`}>
                    <td className="border-r border-gray-200 p-2 text-xs font-medium text-gray-600">{row.date.split('-').reverse().join('-')}</td>
                    <td className="border-r border-gray-200 p-2 font-bold text-gray-800">{row.particulars}</td>
                    <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500 bg-gray-50/50">{row.vchType}</td>
                    <td className="border-r border-gray-200 p-2 text-xs text-center font-mono text-blue-700">{row.vchNo}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-green-700 bg-green-50/10">{row.dr > 0 ? row.dr.toFixed(2) : ''}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-red-700 bg-red-50/10">{row.cr > 0 ? row.cr.toFixed(2) : ''}</td>
                    <td className="p-2 text-right font-mono font-bold text-gray-900 bg-gray-50/50">
                      {row.balAmt.toFixed(2)} <span className={`text-[10px] ml-1 ${row.balType === 'Dr' ? 'text-green-700' : 'text-red-700'}`}>{row.balType}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
          <div className="flex items-center space-x-12">
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-green-300 font-bold uppercase tracking-widest">Period Total Debit</span>
               <span className="font-mono text-xl font-bold text-green-400">₹ {statement.totalDr.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Period Total Credit</span>
               <span className="font-mono text-xl font-bold text-red-400">₹ {statement.totalCr.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
             <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Closing Balance</span>
             <span className="font-mono text-2xl font-black text-yellow-300 drop-shadow-md">
               {statement.clBalDisplay.amount.toFixed(2)} <span className={`text-sm ml-1 ${statement.clBalDisplay.type === 'Dr' ? 'text-green-400' : 'text-red-400'}`}>{statement.clBalDisplay.type}</span>
             </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ViewLedger;