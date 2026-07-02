import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { TrendingUp, Calendar } from 'lucide-react';

const PLStatement = () => {
  const { setToolbarActions } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
  }>();

  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');

  useEffect(() => {
    setToolbarActions({
      onPrint: () => window.print()
    });
    return () => setToolbarActions({});
  }, [setToolbarActions]);

  // Abstract Mock Data Math
  const openingStock = 0;
  const purchases = 0;
  const directExp = 0;
  
  const sales = 0;
  const closingStock = 0;

  const grossProfit = (sales + closingStock) - (openingStock + purchases + directExp);

  const indirectInc = 0;
  const indirectExp = 0;

  const netProfit = (grossProfit + indirectInc) - indirectExp;

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-4 overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-4 border border-gray-400 shadow-sm rounded mb-4 flex-shrink-0 flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#2b579a] flex items-center">
          <TrendingUp size={24} className="mr-3" />
          Profit & Loss A/c
        </h2>

        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded shadow-sm">
           <Calendar size={16} className="text-gray-500" />
           <span className="text-sm font-bold text-gray-700">Period:</span>
           <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer" />
           <span className="text-sm text-gray-400 mx-1">to</span>
           <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer" />
        </div>
      </div>

      {/* VERTICAL REPORT */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-auto max-w-4xl mx-auto w-full p-8">
        
        <div className="text-center mb-8">
           <h3 className="text-2xl font-black uppercase tracking-widest text-gray-800">Profit & Loss Statement</h3>
           <p className="font-bold text-gray-500 mt-1">For the period {fromDate.split('-').reverse().join('-')} to {toDate.split('-').reverse().join('-')}</p>
        </div>

        <table className="w-full text-sm border-collapse">
           <tbody>
              {/* TRADING ACCOUNT TIER */}
              <tr className="bg-gray-100 border-y-2 border-gray-400"><td colSpan={2} className="p-2 font-black uppercase text-gray-700 tracking-wider">Trading Account</td></tr>
              
              {/* Incomes (Sales/Closing) */}
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Sales Accounts</td><td className="p-2 text-right font-mono text-gray-800">{sales.toFixed(2)}</td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Closing Stock</td><td className="p-2 text-right font-mono text-gray-800">{closingStock.toFixed(2)}</td></tr>
              <tr className="border-t border-dashed border-gray-300"><td className="p-2 pl-12 font-bold italic text-gray-600">Total Trading Income (A)</td><td className="p-2 text-right font-mono font-bold text-gray-800">{(sales + closingStock).toFixed(2)}</td></tr>
              
              {/* Expenses (Op/Pur/Dir) */}
              <tr><td colSpan={2} className="h-4"></td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Less: Opening Stock</td><td className="p-2 text-right font-mono text-gray-800">{openingStock.toFixed(2)}</td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Less: Purchase Accounts</td><td className="p-2 text-right font-mono text-gray-800">{purchases.toFixed(2)}</td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Less: Direct Expenses</td><td className="p-2 text-right font-mono text-gray-800">{directExp.toFixed(2)}</td></tr>
              <tr className="border-t border-dashed border-gray-300"><td className="p-2 pl-12 font-bold italic text-gray-600">Total Trading Expense (B)</td><td className="p-2 text-right font-mono font-bold text-gray-800">{(openingStock + purchases + directExp).toFixed(2)}</td></tr>

              {/* Gross Profit */}
              <tr className="bg-blue-50 border-y border-gray-300">
                <td className="p-3 pl-4 font-black uppercase text-[#2b579a]">Gross Profit (A - B)</td>
                <td className="p-3 text-right font-mono font-black text-xl text-[#2b579a]">{grossProfit.toFixed(2)}</td>
              </tr>

              {/* P&L ACCOUNT TIER */}
              <tr><td colSpan={2} className="h-8"></td></tr>
              <tr className="bg-gray-100 border-y-2 border-gray-400"><td colSpan={2} className="p-2 font-black uppercase text-gray-700 tracking-wider">Profit & Loss Account</td></tr>
              
              {/* Indirect Incomes */}
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Gross Profit b/d</td><td className="p-2 text-right font-mono text-gray-800">{grossProfit.toFixed(2)}</td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Indirect Incomes</td><td className="p-2 text-right font-mono text-gray-800">{indirectInc.toFixed(2)}</td></tr>
              <tr className="border-t border-dashed border-gray-300"><td className="p-2 pl-12 font-bold italic text-gray-600">Total Income (C)</td><td className="p-2 text-right font-mono font-bold text-gray-800">{(grossProfit + indirectInc).toFixed(2)}</td></tr>

              {/* Indirect Expenses */}
              <tr><td colSpan={2} className="h-4"></td></tr>
              <tr><td className="p-2 pl-4 font-bold text-gray-800">Less: Indirect Expenses</td><td className="p-2 text-right font-mono text-gray-800">{indirectExp.toFixed(2)}</td></tr>
              <tr className="border-t border-dashed border-gray-300"><td className="p-2 pl-12 font-bold italic text-gray-600">Total Expense (D)</td><td className="p-2 text-right font-mono font-bold text-gray-800">{indirectExp.toFixed(2)}</td></tr>

           </tbody>
        </table>

        {/* NET PROFIT HIGHLIGHT */}
        <div className="mt-8 bg-[#1e3f70] text-white p-6 rounded-lg shadow-lg flex justify-between items-center border-4 border-double border-[#142d54]">
           <div className="font-black uppercase tracking-widest text-xl">Net Profit</div>
           <div className="font-mono font-black text-4xl text-green-400">{netProfit.toFixed(2)}</div>
        </div>

      </div>
    </div>
  );
};

export default PLStatement;