import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PlusCircle, MinusCircle, FileText, Trash2, Calendar, Building } from 'lucide-react';
import Modal from '../components/Modal';

// --- DATA MODELS ---
type VoucherType = 'Receipt' | 'Payment';
type TxnType = 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'Cheque' | 'Charges';

interface BankVoucher {
  id: string;
  bankId: string;
  type: VoucherType;
  date: string; // YYYY-MM-DD
  particulars: string;
  txnType: TxnType;
  refNo: string;
  amount: number;
}

const BANK_ACCOUNTS = [
  { id: 'B-001', name: 'SBI Current A/c - XXXX1234' },
  { id: 'B-002', name: 'HDFC CC A/c - XXXX9876' }
];

// --- MOCK DATA INITIALIZATION ---
// In a real app, this would be computed dynamically based on the selected date and account
const MOCK_OPENING_BALANCE = 150000.00;

const today = new Date().toISOString().split('T')[0];

const BankBook = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  // --- FILTER STATE ---
  const [selectedBank, setSelectedBank] = useState(BANK_ACCOUNTS[0].id);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); // Start of month
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]); // Today

  // --- DATA STATE ---
  const [vouchers, setVouchers] = useState<BankVoucher[]>([]);
  
  // Load from Local Storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('billing_bank_vouchers');
    if (stored) {
      setVouchers(JSON.parse(stored));
    }
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<VoucherType>('Receipt');
  const [formData, setFormData] = useState({
    date: today,
    particulars: '',
    txnType: 'UPI' as TxnType,
    refNo: '',
    amount: ''
  });

  // --- FILTER LOGIC ---
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (v.bankId !== selectedBank) return false;
      if (v.date < fromDate || v.date > toDate) return false;
      return true;
    });
  }, [vouchers, selectedBank, fromDate, toDate]);

  const receipts = useMemo(() => filteredVouchers.filter(v => v.type === 'Receipt').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [filteredVouchers]);
  const payments = useMemo(() => filteredVouchers.filter(v => v.type === 'Payment').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [filteredVouchers]);

  // --- CALCULATIONS (LIVE ENGINE) ---
  const totalReceipts = useMemo(() => receipts.reduce((sum, v) => sum + v.amount, 0), [receipts]);
  const totalPayments = useMemo(() => payments.reduce((sum, v) => sum + v.amount, 0), [payments]);
  
  const closingBalance = MOCK_OPENING_BALANCE + totalReceipts - totalPayments;

  // --- ACTIONS ---
  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Bank Book Ledger...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const setQuickDate = (type: 'Today' | 'ThisMonth' | 'ThisFY') => {
    const todayDate = new Date();
    if (type === 'Today') {
      const ds = todayDate.toISOString().split('T')[0];
      setFromDate(ds);
      setToDate(ds);
    } else if (type === 'ThisMonth') {
      const y = todayDate.getFullYear();
      const m = String(todayDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, todayDate.getMonth() + 1, 0).getDate();
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${lastDay}`);
    } else {
      setFromDate('2026-04-01');
      setToDate('2027-03-31');
    }
  };

  const openModal = (type: VoucherType) => {
    setModalType(type);
    setFormData({ 
      date: toDate, // Default to end date of filter
      particulars: '', 
      txnType: type === 'Receipt' ? 'UPI' : 'NEFT',
      refNo: '',
      amount: '' 
    });
    setIsModalOpen(true);
  };

  const handleSaveVoucher = () => {
    if (!formData.particulars.trim() || !formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setGlobalNotification({ msg: 'Please enter valid particulars and amount.', type: 'error' });
      return;
    }

    const newVoucher: BankVoucher = {
      id: Math.random().toString(),
      bankId: selectedBank,
      type: modalType,
      date: formData.date,
      particulars: formData.particulars,
      txnType: formData.txnType,
      refNo: formData.refNo || 'N/A',
      amount: Number(formData.amount)
    };

    const updatedVouchers = [...vouchers, newVoucher];
    setVouchers(updatedVouchers);
    localStorage.setItem('billing_bank_vouchers', JSON.stringify(updatedVouchers));
    
    setIsModalOpen(false);
    setGlobalNotification({ msg: `Bank ${modalType} added successfully.`, type: 'success' });
  };

  const deleteVoucher = (id: string, vType: string) => {
    if(window.confirm(`Are you sure you want to delete this Bank ${vType}?`)) {
      const updatedVouchers = vouchers.filter(v => v.id !== id);
      setVouchers(updatedVouchers);
      localStorage.setItem('billing_bank_vouchers', JSON.stringify(updatedVouchers));
      setGlobalNotification({ msg: 'Transaction deleted and balances updated.', type: 'info' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER METRICS RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex flex-col gap-3 print:hidden">
        
        {/* Top Tier: Title, Account Selector, and Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
             <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
              <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
              Bank Book
            </h2>

            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1 rounded-md shadow-sm">
               <div className="bg-[#2b579a] p-1.5 rounded text-white">
                 <Building size={14} />
               </div>
               <select 
                 value={selectedBank} 
                 onChange={e => setSelectedBank(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none w-64 pr-2 cursor-pointer"
               >
                 {BANK_ACCOUNTS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Opening Balance Card */}
            <div className="bg-[#f8f9fa] border border-[#d1d9e0] px-4 py-1.5 rounded flex items-center space-x-4 shadow-inner">
               <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Opening Balance</span>
               <span className="text-lg font-black text-[#2b579a] font-mono">₹ {MOCK_OPENING_BALANCE.toFixed(2)}</span>
            </div>

            <div className="flex space-x-2 pl-2 border-l border-gray-300">
              <button 
                onClick={() => openModal('Receipt')}
                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold shadow-sm transition-colors text-sm"
              >
                <PlusCircle size={16} /> <span>Bank Receipt (Dr)</span>
              </button>
              <button 
                onClick={() => openModal('Payment')}
                className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold shadow-sm transition-colors text-sm"
              >
                <MinusCircle size={16} /> <span>Bank Payment (Cr)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Date Filters */}
        <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-2 rounded-md">
           <span className="font-bold text-[#2b579a] flex items-center text-sm mr-3"><Calendar size={16} className="mr-1.5"/> Date Filter:</span>
           <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
             <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
             <span className="text-gray-400 text-sm font-medium">to</span>
             <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
           </div>
           
           <div className="flex space-x-2 ml-4">
            <button onClick={() => setQuickDate('Today')} className="text-xs bg-white hover:bg-blue-50 border border-gray-300 px-3 py-1.5 rounded font-semibold text-gray-700 transition-colors shadow-sm">Today</button>
            <button onClick={() => setQuickDate('ThisMonth')} className="text-xs bg-white hover:bg-blue-50 border border-gray-300 px-3 py-1.5 rounded font-semibold text-gray-700 transition-colors shadow-sm">This Month</button>
            <button onClick={() => setQuickDate('ThisFY')} className="text-xs bg-white hover:bg-blue-50 border border-gray-300 px-3 py-1.5 rounded font-semibold text-gray-700 transition-colors shadow-sm">This FY</button>
          </div>
        </div>

      </div>

      {/* DUAL-LEDGER GRID PANE */}
      <div className="flex-1 flex space-x-2 overflow-hidden mb-2">
        
        {/* LEFT COLUMN: RECEIPTS (DEPOSITS/DEBITS) */}
        <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm rounded overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 p-2 flex justify-between items-center shadow-sm z-10 px-4">
            <h3 className="font-bold text-green-800 tracking-wide uppercase text-sm">Receipts (Deposits)</h3>
            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-300">Debit (Dr)</span>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse min-w-max">
              <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-24">Date</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600">Particulars / Ledger</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-20 text-center">Txn Type</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-32">Ref / UTR No.</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-28 text-right">Amount (₹)</th>
                  <th className="border-b border-gray-300 p-2 w-10 text-center print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                      <div className="flex flex-col items-center">
                        <FileText size={32} className="mb-2 opacity-50" />
                        <p className="italic text-sm">No bank receipts found for this period.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  receipts.map(rec => (
                    <tr key={rec.id} className="border-b border-gray-200 hover:bg-green-50/50 transition-colors group">
                      <td className="border-r border-gray-200 p-2 text-xs font-medium text-gray-700">{rec.date.split('-').reverse().join('-')}</td>
                      <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{rec.particulars}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center"><span className="bg-gray-100 text-gray-600 border border-gray-300 px-1.5 py-0.5 rounded font-bold">{rec.txnType}</span></td>
                      <td className="border-r border-gray-200 p-2 font-mono text-[11px] text-blue-700 truncate max-w-[120px]" title={rec.refNo}>{rec.refNo}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-green-700 bg-green-50/30">{rec.amount.toFixed(2)}</td>
                      <td className="p-1 text-center print:hidden">
                        <button onClick={() => deleteVoucher(rec.id, 'Receipt')} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENTS (WITHDRAWALS/CREDITS) */}
        <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm rounded overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 p-2 flex justify-between items-center shadow-sm z-10 px-4">
            <h3 className="font-bold text-red-800 tracking-wide uppercase text-sm">Payments (Withdrawals)</h3>
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300">Credit (Cr)</span>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse min-w-max">
              <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-24">Date</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600">Particulars / Ledger</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-20 text-center">Txn Type</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-32">Ref / UTR No.</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-28 text-right">Amount (₹)</th>
                  <th className="border-b border-gray-300 p-2 w-10 text-center print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                      <div className="flex flex-col items-center">
                        <FileText size={32} className="mb-2 opacity-50" />
                        <p className="italic text-sm">No bank payments found for this period.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map(pay => (
                    <tr key={pay.id} className="border-b border-gray-200 hover:bg-red-50/50 transition-colors group">
                      <td className="border-r border-gray-200 p-2 text-xs font-medium text-gray-700">{pay.date.split('-').reverse().join('-')}</td>
                      <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{pay.particulars}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center"><span className="bg-gray-100 text-gray-600 border border-gray-300 px-1.5 py-0.5 rounded font-bold">{pay.txnType}</span></td>
                      <td className="border-r border-gray-200 p-2 font-mono text-[11px] text-blue-700 truncate max-w-[120px]" title={pay.refNo}>{pay.refNo}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-red-600 bg-red-50/30">{pay.amount.toFixed(2)}</td>
                      <td className="p-1 text-center print:hidden">
                        <button onClick={() => deleteVoucher(pay.id, 'Payment')} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
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

      {/* LIVE RECONCILIATION BALANCE BAR */}
      <div className="bg-[#1e3f70] border border-[#142d54] text-white p-3 rounded flex-shrink-0 shadow-md flex justify-between items-center z-20">
         <div className="flex space-x-12">
            <div className="flex flex-col">
              <span className="text-[10px] text-green-300 font-bold uppercase tracking-widest">Total Deposits (Dr)</span>
              <span className="font-mono text-xl font-bold text-green-400">₹ {totalReceipts.toFixed(2)}</span>
            </div>
            <div className="w-px bg-[#2b579a]"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Total Withdrawals (Cr)</span>
              <span className="font-mono text-xl font-bold text-red-400">₹ {totalPayments.toFixed(2)}</span>
            </div>
         </div>

         <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
            <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Net Closing Balance</span>
            <span className={`font-mono text-3xl font-black drop-shadow-md ${closingBalance < 0 ? 'text-red-500' : 'text-yellow-300'}`}>
              {closingBalance < 0 ? '-' : ''}₹ {Math.abs(closingBalance).toFixed(2)}
            </span>
         </div>
      </div>

      {/* VOUCHER ENTRY MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Bank ${modalType}`}
      >
        <div className="space-y-4">
          <div className={`p-3 rounded border ${modalType === 'Receipt' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} text-sm font-semibold flex items-center justify-between`}>
             <span>Bank: {BANK_ACCOUNTS.find(b => b.id === selectedBank)?.name}</span>
             <span className="bg-white px-2 py-0.5 rounded border shadow-sm">{modalType === 'Receipt' ? 'Deposit (Dr)' : 'Withdrawal (Cr)'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
               <input 
                 type="date" 
                 value={formData.date}
                 onChange={e => setFormData({...formData, date: e.target.value})}
                 className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
               />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
               <input 
                 type="number" 
                 value={formData.amount}
                 onChange={e => setFormData({...formData, amount: e.target.value})}
                 className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-lg text-right"
                 placeholder="0.00"
                 min="1"
               />
             </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Particulars / Ledger <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={formData.particulars}
              onChange={e => setFormData({...formData, particulars: e.target.value})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder={modalType === 'Receipt' ? 'e.g., Sales, Customer Advance...' : 'e.g., Vendor Payout, Charges...'}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Txn Type</label>
              <select 
                value={formData.txnType}
                onChange={e => setFormData({...formData, txnType: e.target.value as TxnType})}
                className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="UPI">UPI</option>
                <option value="NEFT">NEFT</option>
                <option value="IMPS">IMPS</option>
                <option value="RTGS">RTGS</option>
                <option value="Cheque">Cheque</option>
                <option value="Charges">Bank Charges</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Ref / UTR No.</label>
              <input 
                type="text" 
                value={formData.refNo}
                onChange={e => setFormData({...formData, refNo: e.target.value.toUpperCase()})}
                className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono uppercase"
                placeholder="Optional Ref No."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-semibold"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveVoucher}
              className={`px-4 py-2 text-white rounded font-semibold shadow-sm ${modalType === 'Receipt' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Save {modalType}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default BankBook;