import React, { useState } from 'react';
import { X, User, Phone, MapPin, Shield, CheckCircle2, Lock, Package, AlertTriangle, Calendar, Printer, DollarSign } from 'lucide-react';

interface OwnerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName?: string;
}

export const OwnerDetailsModal: React.FC<OwnerDetailsModalProps> = ({ isOpen, onClose, shopName = 'Namma Kada Store' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" />
      
      <div className="relative w-full max-w-md apple-glass-card rounded-2xl p-6 shadow-2xl z-10 space-y-4 border border-white/80 animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Owner & Business Details</h3>
              <p className="text-xs text-slate-400">Merchant Profile & License Info</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 space-y-2">
            <div className="flex justify-between"><span className="text-slate-500 font-medium">Business Name:</span><span className="font-semibold text-slate-900">{shopName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 font-medium">Proprietor:</span><span className="font-semibold text-slate-900">Preetha T / Management</span></div>
            <div className="flex justify-between"><span className="text-slate-500 font-medium">Contact Mobile:</span><span className="font-semibold text-slate-900">+91 98765 43210</span></div>
            <div className="flex justify-between"><span className="text-slate-500 font-medium">GSTIN Number:</span><span className="font-mono font-semibold text-slate-900">33AAAAA0000A1Z5</span></div>
          </div>

          <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-emerald-600" />
              <div>
                <span className="font-semibold text-emerald-900 text-xs block">Active Desktop / SPA License</span>
                <span className="text-[10px] text-emerald-700">Valid until Dec 2028</span>
              </div>
            </div>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
        </div>

        <div className="pt-2">
          <button onClick={onClose} className="apple-button-secondary w-full">Close Window</button>
        </div>
      </div>
    </div>
  );
};

interface DailyStockStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyStockStatusModal: React.FC<DailyStockStatusModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const mockStockList = [
    { code: 'ACC-001', name: 'Wireless Mouse (Logitech)', current: 45, status: 'In Stock' },
    { code: 'ACC-002', name: 'USB-C Hub (Anker)', current: 5, status: 'Low Stock' },
    { code: 'ACC-003', name: 'Mechanical Keyboard (Keychron)', current: 0, status: 'Out of Stock' },
    { code: 'ACC-004', name: 'Laptop Sleeve 14"', current: 22, status: 'In Stock' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" />
      
      <div className="relative w-full max-w-lg apple-glass-card rounded-2xl p-6 shadow-2xl z-10 space-y-4 border border-white/80">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Daily Stock Status</h3>
              <p className="text-xs text-slate-400">Inventory Level Real-Time Summary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
          {mockStockList.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-800 block">{item.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-slate-900 block">{item.current} PCS</span>
                <span className={`text-[10px] font-semibold ${
                  item.status === 'In Stock' ? 'text-emerald-600' :
                  item.status === 'Low Stock' ? 'text-amber-600' : 'text-rose-600'
                }`}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="apple-button-secondary w-full text-xs">Done</button>
      </div>
    </div>
  );
};

interface CloseDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCloseDay: () => void;
  totalSalesToday?: number;
  totalBillsToday?: number;
}

export const CloseDayModal: React.FC<CloseDayModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirmCloseDay,
  totalSalesToday = 14580.00,
  totalBillsToday = 18 
}) => {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" />
      
      <div className="relative w-full max-w-md apple-glass-card rounded-2xl p-6 shadow-2xl z-10 space-y-4 border border-white/80">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Close Billing Register</h3>
              <p className="text-xs text-slate-400">End of Day Counter Settlement</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200/60 space-y-2">
            <div className="flex justify-between">
              <span className="text-rose-700 font-medium">Total Bills Today:</span>
              <span className="font-mono font-bold text-rose-950">{totalBillsToday} Transactions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-700 font-medium">Today's Revenue:</span>
              <span className="font-mono font-bold text-rose-950 text-sm">₹{totalSalesToday.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Closing Remarks / Cash Tally Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash handed over to owner, UPI reconciled..."
              className="apple-input w-full h-20 text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="apple-button-secondary flex-1">Cancel</button>
          <button 
            onClick={() => {
              onConfirmCloseDay();
              onClose();
            }} 
            className="apple-button-primary bg-rose-600 hover:bg-rose-700 text-white flex-1"
          >
            Confirm & Close Day
          </button>
        </div>
      </div>
    </div>
  );
};
