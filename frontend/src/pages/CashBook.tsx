import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PlusCircle, MinusCircle, FileText, Trash2, Calendar } from 'lucide-react';
import Modal from '../components/Modal';

// --- DATA MODELS ---
type VoucherType = 'Receipt' | 'Payment';

interface CashVoucher {
  id: string;
  type: VoucherType;
  time: string;
  voucherNo: string;
  particulars: string;
  amount: number;
}

// --- MOCK DATA INITIALIZATION ---
const MOCK_OPENING_BALANCE = 15000.00;

const CashBook = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  // --- STATE ---
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [vouchers, setVouchers] = useState<CashVoucher[]>([]);
  
  // Load from Local Storage
  useEffect(() => {
    const stored = localStorage.getItem('billing_cash_vouchers');
    if (stored) {
      setVouchers(JSON.parse(stored));
    }
  }, []);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<VoucherType>('Receipt');
  const [formData, setFormData] = useState({
    particulars: '',
    amount: ''
  });

  // --- CALCULATIONS (LIVE ENGINE) ---
  const receipts = useMemo(() => vouchers.filter(v => v.type === 'Receipt'), [vouchers]);
  const payments = useMemo(() => vouchers.filter(v => v.type === 'Payment'), [vouchers]);

  const totalReceipts = useMemo(() => receipts.reduce((sum, v) => sum + v.amount, 0), [receipts]);
  const totalPayments = useMemo(() => payments.reduce((sum, v) => sum + v.amount, 0), [payments]);
  
  const closingBalance = MOCK_OPENING_BALANCE + totalReceipts - totalPayments;

  // --- ACTIONS ---
  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Cash Book Ledger...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const openModal = (type: VoucherType) => {
    setModalType(type);
    setFormData({ particulars: '', amount: '' });
    setIsModalOpen(true);
  };

  const handleSaveVoucher = () => {
    if (!formData.particulars.trim() || !formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setGlobalNotification({ msg: 'Please enter valid particulars and amount.', type: 'error' });
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const prefix = modalType === 'Receipt' ? 'CR-' : 'CP-';
    
    const newVoucher: CashVoucher = {
      id: Math.random().toString(),
      type: modalType,
      time: timeString,
      voucherNo: prefix + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      particulars: formData.particulars,
      amount: Number(formData.amount)
    };

    const updatedVouchers = [...vouchers, newVoucher];
    setVouchers(updatedVouchers);
    localStorage.setItem('billing_cash_vouchers', JSON.stringify(updatedVouchers));
    
    setIsModalOpen(false);
    setGlobalNotification({ msg: `${modalType} Voucher ${newVoucher.voucherNo} added successfully.`, type: 'success' });
  };

  const deleteVoucher = (id: string, vType: string) => {
    if(window.confirm(`Are you sure you want to delete this ${vType} Voucher?`)) {
      const updatedVouchers = vouchers.filter(v => v.id !== id);
      setVouchers(updatedVouchers);
      localStorage.setItem('billing_cash_vouchers', JSON.stringify(updatedVouchers));
      setGlobalNotification({ msg: 'Voucher deleted and balances updated.', type: 'info' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER METRICS RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
          <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Daily Cash Book
          </h2>

          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1.5 rounded">
             <Calendar size={16} className="text-gray-500" />
             <input 
               type="date" 
               value={selectedDate} 
               onChange={e => setSelectedDate(e.target.value)} 
               className="bg-transparent text-sm font-semibold focus:outline-none text-gray-700" 
             />
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {/* Opening Balance Card */}
          <div className="bg-[#e8ecef] border border-[#d1d9e0] px-4 py-2 rounded flex flex-col items-end shadow-inner">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Opening Balance</span>
             <span className="text-lg font-black text-gray-800 font-mono">₹ {MOCK_OPENING_BALANCE.toFixed(2)}</span>
          </div>

          <div className="flex space-x-2 border-l border-gray-300 pl-6">
            <button 
              onClick={() => openModal('Receipt')}
              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-semibold shadow transition-colors"
            >
              <PlusCircle size={16} /> <span>Receipt (In)</span>
            </button>
            <button 
              onClick={() => openModal('Payment')}
              className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-semibold shadow transition-colors"
            >
              <MinusCircle size={16} /> <span>Payment (Out)</span>
            </button>
          </div>
        </div>

      </div>

      {/* DUAL-LEDGER GRID PANE */}
      <div className="flex-1 flex space-x-2 overflow-hidden mb-2">
        
        {/* LEFT COLUMN: RECEIPTS */}
        <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm rounded overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 p-2 text-center shadow-sm z-10">
            <h3 className="font-bold text-green-800 tracking-wide uppercase text-sm">Receipts (Cash In)</h3>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-20 text-center">Time</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-24">Voucher No</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600">Particulars / Ledger</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-28 text-right">Amount (₹)</th>
                  <th className="border-b border-gray-300 p-2 w-10 text-center print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">No receipts recorded today.</td>
                  </tr>
                ) : (
                  receipts.map(rec => (
                    <tr key={rec.id} className="border-b border-gray-200 hover:bg-green-50/50 transition-colors group">
                      <td className="border-r border-gray-200 p-2 text-xs text-gray-500 text-center">{rec.time}</td>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs text-blue-700">{rec.voucherNo}</td>
                      <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{rec.particulars}</td>
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

        {/* RIGHT COLUMN: PAYMENTS */}
        <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm rounded overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 p-2 text-center shadow-sm z-10">
            <h3 className="font-bold text-red-800 tracking-wide uppercase text-sm">Payments (Cash Out)</h3>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-20 text-center">Time</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-24">Voucher No</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600">Particulars / Ledger</th>
                  <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-600 w-28 text-right">Amount (₹)</th>
                  <th className="border-b border-gray-300 p-2 w-10 text-center print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">No payments recorded today.</td>
                  </tr>
                ) : (
                  payments.map(pay => (
                    <tr key={pay.id} className="border-b border-gray-200 hover:bg-red-50/50 transition-colors group">
                      <td className="border-r border-gray-200 p-2 text-xs text-gray-500 text-center">{pay.time}</td>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs text-blue-700">{pay.voucherNo}</td>
                      <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{pay.particulars}</td>
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
              <span className="text-[10px] text-green-300 font-bold uppercase tracking-widest">Total Receipts</span>
              <span className="font-mono text-xl font-bold text-green-400">₹ {totalReceipts.toFixed(2)}</span>
            </div>
            <div className="w-px bg-[#2b579a]"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Total Payments</span>
              <span className="font-mono text-xl font-bold text-red-400">₹ {totalPayments.toFixed(2)}</span>
            </div>
         </div>

         <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
            <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Net Closing Balance</span>
            <span className={`font-mono text-3xl font-black drop-shadow-md ${closingBalance < 0 ? 'text-red-500' : 'text-yellow-300'}`}>
              ₹ {closingBalance.toFixed(2)}
            </span>
         </div>
      </div>

      {/* VOUCHER ENTRY MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Cash ${modalType}`}
      >
        <div className="space-y-4">
          <div className={`p-3 rounded border ${modalType === 'Receipt' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} text-sm font-semibold`}>
             Creating a new Cash {modalType} Voucher for {selectedDate.split('-').reverse().join('-')}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Particulars / Ledger <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={formData.particulars}
              onChange={e => setFormData({...formData, particulars: e.target.value})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder={modalType === 'Receipt' ? 'e.g., Cash Sales, Advance Received...' : 'e.g., Supplier Payment, Office Expense...'}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-lg"
              placeholder="0.00"
              min="1"
            />
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

export default CashBook;