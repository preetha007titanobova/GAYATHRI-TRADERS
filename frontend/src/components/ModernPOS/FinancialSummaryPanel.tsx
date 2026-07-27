import React from 'react';
import { Calculator, IndianRupee, Percent, ArrowRightLeft, DollarSign, Wallet } from 'lucide-react';

interface FinancialSummaryPanelProps {
  totalQty: number;
  totalAmount: number;
  favourDiscount: number;
  setFavourDiscount: (val: number) => void;
  cgstPercent: number;
  setCgstPercent: (val: number) => void;
  sgstPercent: number;
  setSgstPercent: (val: number) => void;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  netAmount: number;
  amountTendered: number;
  setAmountTendered: (val: number) => void;
  changeReturn: number;
  paymentMode: string;
  setPaymentMode: (mode: string) => void;
}

export const FinancialSummaryPanel: React.FC<FinancialSummaryPanelProps> = ({
  totalQty,
  totalAmount,
  favourDiscount,
  setFavourDiscount,
  cgstPercent,
  setCgstPercent,
  sgstPercent,
  setSgstPercent,
  cgstAmount,
  sgstAmount,
  roundOff,
  netAmount,
  amountTendered,
  setAmountTendered,
  changeReturn,
  paymentMode,
  setPaymentMode
}) => {
  const paymentModes = ['Cash', 'UPI', 'Card', 'Credit'];

  return (
    <div className="apple-glass-card rounded-2xl p-5 space-y-4 shadow-xl border border-slate-200/90 flex flex-col justify-between h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Calculation Summary</h3>
            <p className="text-[11px] text-slate-400">Real-time financial tally</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 font-mono text-xs font-semibold">
          {totalQty} PCS
        </span>
      </div>

      {/* Main Breakdown List */}
      <div className="space-y-3 text-xs">
        
        {/* Total Quantity */}
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 font-medium">Total Qty (PCS)</span>
          <span className="font-semibold text-slate-900 font-mono text-sm">{totalQty}</span>
        </div>

        {/* Total Gross Amount */}
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 font-medium">Total Amount</span>
          <span className="font-semibold text-slate-900 font-mono text-sm">
            ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Favour Discount (₹ input) */}
        <div className="flex items-center justify-between gap-3 py-1">
          <label className="text-slate-600 font-medium flex items-center gap-1">
            <IndianRupee size={13} className="text-slate-400" />
            Favour Disc (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={favourDiscount || ''}
            onChange={(e) => setFavourDiscount(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-28 apple-input text-right font-mono font-semibold text-blue-600 py-1"
          />
        </div>

        {/* CGST (%) Input & Calculated Value */}
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">CGST</span>
            <div className="flex items-center bg-slate-100 rounded-lg px-2 py-0.5 border border-slate-200">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={cgstPercent}
                onChange={(e) => setCgstPercent(Number(e.target.value) || 0)}
                className="w-10 bg-transparent text-right font-mono text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 ml-0.5">%</span>
            </div>
          </div>
          <span className="font-mono text-slate-700">
            ₹{cgstAmount.toFixed(2)}
          </span>
        </div>

        {/* SGST (%) Input & Calculated Value */}
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">SGST</span>
            <div className="flex items-center bg-slate-100 rounded-lg px-2 py-0.5 border border-slate-200">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={sgstPercent}
                onChange={(e) => setSgstPercent(Number(e.target.value) || 0)}
                className="w-10 bg-transparent text-right font-mono text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 ml-0.5">%</span>
            </div>
          </div>
          <span className="font-mono text-slate-700">
            ₹{sgstAmount.toFixed(2)}
          </span>
        </div>

        {/* Round Off */}
        <div className="flex items-center justify-between py-1 text-slate-500">
          <span>Round Off</span>
          <span className="font-mono font-medium">{roundOff >= 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200/80 my-1" />

        {/* Net Amount Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Net Payable</span>
            <span className="text-xs text-indigo-300">Incl. Taxes & Discounts</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-bold text-emerald-400 tracking-tight">
              ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Payment Mode Toggle */}
        <div className="pt-2">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Payment Mode</label>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {paymentModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  paymentMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Tendered (Editable) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="text-slate-700 font-semibold flex items-center gap-1">
            <Wallet size={14} className="text-blue-500" />
            Amount Tendered
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={amountTendered || ''}
            onChange={(e) => setAmountTendered(Number(e.target.value) || 0)}
            placeholder="₹ 0"
            className="w-32 apple-input text-right font-mono font-bold text-slate-900 py-1.5"
          />
        </div>

        {/* Change Return */}
        <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
          changeReturn >= 0 
            ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-800' 
            : 'bg-rose-50/70 border-rose-200/60 text-rose-800'
        }`}>
          <span className="font-semibold text-xs flex items-center gap-1">
            <ArrowRightLeft size={14} />
            Change Return
          </span>
          <span className="font-mono font-bold text-base">
            ₹{Math.max(0, changeReturn).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

      </div>
    </div>
  );
};
