import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Printer, Settings2 } from 'lucide-react';

const BANKS: { id: string, name: string }[] = [];

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Only';
};

const ChequePrinting = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const [bank, setBank] = useState('');
  const [payee, setPayee] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [acPayee, setAcPayee] = useState(true);
  
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const amountWords = amount ? numberToWords(Number(amount)) : '';
  const formattedDate = date.split('-').reverse().join(''); // DDMMYYYY

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Sending Cheque to Printer...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  return (
    <div className="flex h-full bg-[#f0f9f4] p-4 space-x-4">
      
      {/* Input Panel (Left) */}
      <div className="w-1/3 bg-white border border-gray-400 shadow-sm rounded flex flex-col print:hidden overflow-y-auto">
        <div className="bg-[#2b579a] p-3 text-white">
          <h2 className="font-bold flex items-center"><Printer size={18} className="mr-2"/> Cheque Details</h2>
        </div>
        
        <div className="p-4 space-y-4 flex-1">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Bank A/c</label>
            <select value={bank} onChange={e => setBank(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none">
              {BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payee Name</label>
            <input type="text" value={payee} onChange={e => setPayee(e.target.value.toUpperCase())} className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none uppercase" placeholder="e.g. SUPPLIER A" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:border-blue-500 outline-none font-mono text-lg" placeholder="0.00" />
            <div className="mt-1 text-xs text-blue-700 font-semibold italic min-h-[32px]">{amountWords}</div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input type="checkbox" id="acpayee" checked={acPayee} onChange={e => setAcPayee(e.target.checked)} className="w-4 h-4 text-blue-600" />
            <label htmlFor="acpayee" className="text-sm font-bold text-gray-700">Cross Cheque (A/C Payee Only)</label>
          </div>
        </div>

        <div className="bg-gray-50 p-4 border-t border-gray-200">
           <h3 className="text-sm font-bold text-gray-600 flex items-center mb-3"><Settings2 size={16} className="mr-1"/> Printer Margins</h3>
           <div className="space-y-3">
              <div>
                 <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Horizontal Offset (X)</span> <span>{offsetX}mm</span></div>
                 <input type="range" min="-50" max="50" value={offsetX} onChange={e => setOffsetX(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                 <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Vertical Offset (Y)</span> <span>{offsetY}mm</span></div>
                 <input type="range" min="-50" max="50" value={offsetY} onChange={e => setOffsetY(Number(e.target.value))} className="w-full" />
              </div>
           </div>
        </div>
      </div>

      {/* Preview Panel (Right) */}
      <div className="flex-1 bg-gray-200 border border-gray-400 shadow-inner rounded overflow-hidden flex flex-col relative print:bg-white print:border-none print:shadow-none">
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-bold print:hidden z-10">PRINT PREVIEW</div>
        
        {/* The Cheque Canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 print:p-0">
           <div 
             className="relative bg-[#f8fbff] shadow-xl border border-gray-300 print:shadow-none print:border-none overflow-hidden"
             style={{ 
               width: '800px', 
               height: '360px',
               backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(43, 87, 154, 0.03) 10px, rgba(43, 87, 154, 0.03) 20px)'
             }}
           >
              {/* Transform wrapper for offsets */}
              <div style={{ transform: `translate(${offsetX}mm, ${offsetY}mm)` }} className="w-full h-full relative font-mono font-bold text-gray-800 text-lg">
                
                {acPayee && (
                  <div className="absolute top-6 left-12 border-t-2 border-b-2 border-gray-800 px-4 py-1 transform -rotate-12 text-sm tracking-widest">
                    A/C PAYEE ONLY
                  </div>
                )}

                {/* Date Boxes */}
                <div className="absolute top-8 right-12 flex space-x-1">
                  {formattedDate.split('').map((char, i) => (
                    <div key={i} className={`w-6 h-8 border border-gray-400 flex items-center justify-center ${i===1 || i===3 ? 'mr-3':''}`}>{char}</div>
                  ))}
                </div>

                <div className="absolute top-24 left-16 flex items-center">
                   <span className="text-gray-500 text-sm mr-2 print:hidden">PAY</span>
                   <span className="border-b border-dashed border-gray-400 w-[580px] pb-1 uppercase">{payee || '____________________'}</span>
                </div>

                <div className="absolute top-36 left-16 flex">
                   <span className="text-gray-500 text-sm mr-2 mt-1 print:hidden">RUPEES</span>
                   <span className="border-b border-dashed border-gray-400 w-[450px] pb-1 leading-relaxed">{amountWords || '____________________'}</span>
                </div>

                <div className="absolute top-36 right-16 border-2 border-gray-500 w-48 h-12 flex items-center px-4 bg-white/50">
                   <span className="mr-2">₹</span>
                   <span>{amount ? Number(amount).toLocaleString('en-IN') + '/-' : ''}</span>
                </div>

                <div className="absolute bottom-12 right-20 text-sm">
                   Signature _________________
                </div>

              </div>
           </div>
        </div>

      </div>

    </div>
  );
};

export default ChequePrinting;