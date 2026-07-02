import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PlusCircle, Trash2, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface JournalRow {
  id: string;
  type: 'Dr' | 'Cr';
  ledgerId: string;
  debit: number | '';
  credit: number | '';
}

const LEDGERS: { id: string, name: string }[] = [];

const JournalEntry = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNo] = useState('JV-26-' + Math.floor(1000 + Math.random() * 9000));
  const [narration, setNarration] = useState('');
  
  const [rows, setRows] = useState<JournalRow[]>([
    { id: '1', type: 'Dr', ledgerId: '', debit: '', credit: '' },
    { id: '2', type: 'Cr', ledgerId: '', debit: '', credit: '' }
  ]);

  const addRow = () => {
    setRows([...rows, { id: Math.random().toString(), type: 'Dr', ledgerId: '', debit: '', credit: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) {
      setGlobalNotification({ msg: 'A journal entry must have at least 2 rows.', type: 'error' });
      return;
    }
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof JournalRow, value: any) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Auto clear opposite amount
        if (field === 'type') {
          updated.debit = '';
          updated.credit = '';
        } else if (field === 'debit' && value !== '') {
          updated.credit = '';
          updated.type = 'Dr';
        } else if (field === 'credit' && value !== '') {
          updated.debit = '';
          updated.type = 'Cr';
        }
        return updated;
      }
      return r;
    }));
  };

  const totalDebit = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0), [rows]);
  
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const isValid = isBalanced && rows.every(r => r.ledgerId !== '' && (r.debit !== '' || r.credit !== ''));

  useEffect(() => {
    setToolbarActions({
      onSave: () => {
        if (!isValid) {
          setGlobalNotification({ msg: 'Cannot save. Journal is not balanced or rows are incomplete.', type: 'error' });
          return;
        }
        setGlobalNotification({ msg: `Journal Voucher ${voucherNo} saved successfully.`, type: 'success' });
        // Reset form
        setRows([
          { id: Math.random().toString(), type: 'Dr', ledgerId: '', debit: '', credit: '' },
          { id: Math.random().toString(), type: 'Cr', ledgerId: '', debit: '', credit: '' }
        ]);
        setNarration('');
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, isValid, voucherNo]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-4">
      
      {/* Header Form */}
      <div className="bg-white p-4 border border-gray-400 shadow-sm rounded mb-4 flex-shrink-0">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Journal Entry
          </h2>
          <div className="text-right">
             <div className="text-sm font-bold text-gray-500 uppercase">Voucher No.</div>
             <div className="text-xl font-black text-gray-800">{voucherNo}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
           <div className="col-span-1">
             <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none" />
           </div>
           <div className="col-span-3">
             <label className="block text-sm font-bold text-gray-700 mb-1">Narration (Remarks)</label>
             <textarea 
               value={narration} 
               onChange={e => setNarration(e.target.value)} 
               className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none resize-none h-10" 
               placeholder="Being the amount adjusted for..."
             />
           </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#e8ecef] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-700 w-24 text-center">Dr / Cr</th>
                <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-700">Ledger Account</th>
                <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-700 w-40 text-right">Debit (₹)</th>
                <th className="border-b border-r border-gray-300 p-2 text-xs font-semibold text-gray-700 w-40 text-right">Credit (₹)</th>
                <th className="border-b border-gray-300 p-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                  <td className="border-r border-gray-200 p-1">
                     <select 
                       value={row.type} 
                       onChange={e => updateRow(row.id, 'type', e.target.value)}
                       className="w-full bg-transparent p-1 border-none focus:ring-0 font-bold text-center text-gray-700"
                     >
                       <option value="Dr">Dr</option>
                       <option value="Cr">Cr</option>
                     </select>
                  </td>
                  <td className="border-r border-gray-200 p-1">
                     <select 
                       value={row.ledgerId} 
                       onChange={e => updateRow(row.id, 'ledgerId', e.target.value)}
                       className="w-full bg-transparent p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none font-medium"
                     >
                       <option value="">-- Select Ledger --</option>
                       {LEDGERS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                     </select>
                  </td>
                  <td className="border-r border-gray-200 p-1 bg-[#f8fcf8]">
                     <input 
                       type="number" 
                       value={row.debit} 
                       onChange={e => updateRow(row.id, 'debit', e.target.value)}
                       disabled={row.type === 'Cr'}
                       className="w-full text-right bg-transparent p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none font-mono font-bold text-green-700 disabled:opacity-30 disabled:bg-gray-100"
                       placeholder="0.00"
                     />
                  </td>
                  <td className="border-r border-gray-200 p-1 bg-[#fff8f8]">
                     <input 
                       type="number" 
                       value={row.credit} 
                       onChange={e => updateRow(row.id, 'credit', e.target.value)}
                       disabled={row.type === 'Dr'}
                       className="w-full text-right bg-transparent p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none font-mono font-bold text-red-600 disabled:opacity-30 disabled:bg-gray-100"
                       placeholder="0.00"
                     />
                  </td>
                  <td className="p-1 text-center">
                    <button onClick={() => removeRow(row.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Remove Row">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2">
            <button onClick={addRow} className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors">
              <PlusCircle size={16} /> <span>Add Row</span>
            </button>
          </div>
        </div>

        {/* Footer Totals */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0">
          <div className="flex items-center space-x-2">
            {isBalanced ? (
               <div className="flex items-center text-green-400 font-bold text-sm bg-green-900/50 px-3 py-1.5 rounded-full border border-green-500/30">
                 <CheckCircle size={16} className="mr-1.5" /> Journal is Balanced
               </div>
            ) : (
               <div className="flex items-center text-yellow-400 font-bold text-sm bg-yellow-900/50 px-3 py-1.5 rounded-full border border-yellow-500/30">
                 <AlertCircle size={16} className="mr-1.5" /> Difference: ₹ {Math.abs(totalDebit - totalCredit).toFixed(2)}
               </div>
            )}
          </div>

          <div className="flex items-center space-x-8">
             <div className="flex flex-col items-end">
                <span className="text-[10px] text-green-300 font-bold uppercase tracking-widest">Total Debit</span>
                <span className="font-mono text-xl font-bold text-green-400">₹ {totalDebit.toFixed(2)}</span>
             </div>
             <div className="w-px h-8 bg-[#2b579a]"></div>
             <div className="flex flex-col items-end mr-12">
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Total Credit</span>
                <span className="font-mono text-xl font-bold text-red-400">₹ {totalCredit.toFixed(2)}</span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default JournalEntry;