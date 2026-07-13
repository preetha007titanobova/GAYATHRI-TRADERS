import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Calendar, Package, FileText } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockMove {
  id: string;
  date: string;
  vchType: string;
  vchNo: string;
  particulars: string;
  inward: number;
  outward: number;
}

interface Product {
  id: string;
  _id?: string;
  name: string;
  itemCode: string;
}

const StockRegister = () => {
  const { 
    setToolbarActions, 
    setGlobalNotification, 
    ownerWhatsApp
  } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
    ownerWhatsApp: string;
  }>();

  const [items, setItems] = useState<Product[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  const [preset, setPreset] = useState('fin-year');

  const handlePresetChange = (val: string) => {
    setPreset(val);
    const today = new Date();
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (val === 'today') {
      const dStr = formatDate(today);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (val === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dStr = formatDate(yesterday);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (val === 'this-week') {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      setFromDate(formatDate(startOfWeek));
      setToDate(formatDate(endOfWeek));
    } else if (val === 'this-month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(formatDate(startOfMonth));
      setToDate(formatDate(endOfMonth));
    } else if (val === 'fin-year') {
      const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setFromDate(`${year}-04-01`);
      setToDate(`${year + 1}-03-31`);
    }
  };

  const [movements, setMovements] = useState<StockMove[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Fetch Items for Dropdown
  useEffect(() => {
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const res = await fetch(`${Api}/products/search?q=`);
        if (res.ok) {
          const data = await res.json();
          setItems(data);
          if (data.length > 0) {
            setSelectedItem(data[0].id || data[0]._id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch items", err);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchItems();
  }, []);

  // Fetch Ledger when Item changes
  useEffect(() => {
    const fetchLedger = async () => {
      if (!selectedItem) return;
      setLoadingLedger(true);
      try {
        const res = await fetch(`${Api}/sales/stock-ledger/${selectedItem}`);
        if (res.ok) {
          const data = await res.json();
          setMovements(data.movements || []);
          setOpeningBalance(data.openingBalance || 0);
        } else {
          setMovements([]);
          setOpeningBalance(0);
        }
      } catch (err) {
        console.error("Failed to fetch ledger", err);
      } finally {
        setLoadingLedger(false);
      }
    };
    fetchLedger();
  }, [selectedItem]);

  const downloadPDF = () => {
    if (!activeItem) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Stock Register Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Item: [${activeItem.itemCode}] ${activeItem.name} | Period: ${fromDate} to ${toDate}`, 14, 22);

    const headers = ["Date", "Vch Type", "Vch No.", "Particulars", "Inward Qty", "Outward Qty", "Running Bal."];
    const rows = ledgerRows.rows.map(row => {
      const dateObj = new Date(row.date);
      const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0].split('-').reverse().join('-') : row.date;
      return [
        formattedDate,
        row.vchType,
        row.vchNo,
        row.particulars,
        row.inward > 0 ? row.inward.toString() : '',
        row.outward > 0 ? row.outward.toString() : '',
        row.balance.toString()
      ];
    });

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
    });

    doc.save(`Stock_Register_${activeItem.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // WhatsApp Share State
  const [sharing, setSharing] = useState(false);

  const handleShareWhatsApp = async () => {
    if (sharing) return;
    if (!activeItem) return;
    setSharing(true);
    setGlobalNotification({ msg: 'Generating PDF and preparing WhatsApp share...', type: 'info' });
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Stock Register Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Item: [${activeItem.itemCode}] ${activeItem.name} | Period: ${fromDate} to ${toDate}`, 14, 22);

      const headers = ["Date", "Vch Type", "Vch No.", "Particulars", "Inward Qty", "Outward Qty", "Running Bal."];
      const rows = ledgerRows.rows.map(row => {
        const dateObj = new Date(row.date);
        const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0].split('-').reverse().join('-') : row.date;
        return [
          formattedDate,
          row.vchType,
          row.vchNo,
          row.particulars,
          row.inward > 0 ? row.inward.toString() : '',
          row.outward > 0 ? row.outward.toString() : '',
          row.balance.toString()
        ];
      });

      autoTable(doc, {
        startY: 26,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8 },
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Stock_Register_${activeItem.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const res = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: pdfBase64, filename })
      });

      if (!res.ok) throw new Error('Failed to upload PDF report');
      const resData = await res.json();
      if (!resData.success || !resData.pdfUrl) throw new Error('PDF upload returned unsuccessful');

      const whatsappText = `*Sri Gayathri Traders - Stock Register Report*\n` +
                           `*Item:* [${activeItem.itemCode}] ${activeItem.name}\n` +
                           `*Period:* ${fromDate} to ${toDate}\n` +
                           `*Closing Stock:* ${ledgerRows.closingBalance}\n\n` +
                           `*Download PDF:* ${resData.pdfUrl}\n\n` +
                           `Generated automatically via Sri Gayathri Traders Billing System.`;

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, '_blank');
      setGlobalNotification({ msg: 'WhatsApp Web/API link opened successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: err.message || 'Failed to share on WhatsApp.', type: 'error' });
    } finally {
      setSharing(false);
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 5000);
    }
  };

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Stock Register...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const activeItem = items.find(i => (i.id || i._id) === selectedItem);

  const ledgerRows = useMemo(() => {
    const filtered = movements.filter(m => m.date >= fromDate && m.date <= toDate).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate opening balance based on moves before fromDate
    const priorMoves = movements.filter(m => m.date < fromDate);
    let currentBal = openingBalance;
    priorMoves.forEach(m => {
      currentBal += m.inward;
      currentBal -= m.outward;
    });

    const calculatedOpeningBalance = currentBal;

    const rowsWithBal = filtered.map(m => {
      currentBal += m.inward;
      currentBal -= m.outward;
      return { ...m, balance: currentBal };
    });

    return { openingBalance: calculatedOpeningBalance, rows: rowsWithBal, closingBalance: currentBal };
  }, [movements, openingBalance, fromDate, toDate]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
       

          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1 rounded-md shadow-sm">
             <div className="bg-[#2b579a] p-1.5 rounded text-white">
               <Package size={14} />
             </div>
             {loadingItems ? (
               <span className="text-sm font-medium text-gray-500 px-2 w-64">Loading items...</span>
             ) : (
               <select 
                 value={selectedItem} 
                 onChange={e => setSelectedItem(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none w-64 pr-2 cursor-pointer"
               >
                 {items.map(i => <option key={i.id || i._id} value={i.id || i._id}>[{i.itemCode}] {i.name}</option>)}
               </select>
             )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-1.5 rounded-md">
             <span className="font-bold text-[#2b579a] flex items-center text-sm mr-2 pl-2"><Calendar size={16} className="mr-1.5"/> Period:</span>
             <select 
               value={preset} 
               onChange={e => handlePresetChange(e.target.value)}
               className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer mr-2"
             >
               <option value="custom">Custom (Wish)</option>
               <option value="today">Today (Daily)</option>
               <option value="yesterday">Yesterday</option>
               <option value="this-week">This Week</option>
               <option value="this-month">This Month</option>
               <option value="fin-year">Financial Year</option>
             </select>
             <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
               <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPreset('custom'); }} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
               <span className="text-gray-400 text-sm font-medium">to</span>
               <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPreset('custom'); }} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
             </div>
          </div>
<button
  onClick={downloadPDF}
  className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium rounded-md hover:bg-emerald-700 shadow border border-emerald-700 transition-colors mr-2"
>
  Download PDF
</button>
<button
  onClick={handleShareWhatsApp}
  disabled={sharing}
  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1.5 text-xs font-medium rounded-md shadow border border-green-700 transition-colors flex items-center"
>
  <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.079-2.865-6.93C16.368 2.025 13.91 1.006 11.298 1.006c-5.408 0-9.81 4.398-9.813 9.802-.002 1.83.479 3.618 1.393 5.17l-.997 3.642 3.734-.978zM17.15 13.563c-.3-.15-1.771-.875-2.04-.972-.269-.099-.465-.148-.659.15-.195.297-.753.971-.922 1.168-.169.197-.337.221-.637.072-.3-.15-1.264-.467-2.408-1.486-.89-.794-1.49-1.775-1.665-2.072-.175-.297-.019-.458.131-.606.134-.133.3-.347.449-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.659-1.591-.903-2.176-.237-.573-.478-.495-.659-.504-.17-.008-.365-.01-.56-.01s-.51.074-.777.363c-.266.289-1.016.992-1.016 2.42 0 1.427 1.039 2.805 1.182 2.996.143.19 2.043 3.12 4.949 4.377.691.299 1.23.478 1.651.611.693.22 1.325.189 1.822.115.556-.083 1.771-.724 2.019-1.422.25-.698.25-1.299.176-1.422-.075-.123-.269-.197-.569-.347z"/>
  </svg>
  {sharing ? 'Sharing...' : 'Share'}
</button>
        </div>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="bg-[#f8f9fa] border-b border-gray-300 p-2 flex justify-between items-center px-6 shadow-sm z-10">
           <div className="font-bold text-gray-700 text-sm uppercase tracking-wider">
             Ledger: <span className="text-blue-700">{activeItem?.name || '...'}</span>
           </div>
           <div className="bg-white border border-gray-300 px-4 py-1 rounded shadow-inner text-sm font-bold">
             Opening Stock: <span className="font-mono text-lg ml-2">{ledgerRows.openingBalance}</span>
           </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Date</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32">Vch Type</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32">Vch No.</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Particulars</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-green-300">Inward Qty</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-red-300">Outward Qty</th>
                <th className="p-2 text-xs font-semibold w-32 text-right text-yellow-300">Running Bal.</th>
              </tr>
            </thead>
            <tbody>
              {loadingLedger ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    Loading stock movements...
                  </td>
                </tr>
              ) : ledgerRows.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <FileText size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No stock movements found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                ledgerRows.rows.map((row, idx) => {
                  const dateObj = new Date(row.date);
                  const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0].split('-').reverse().join('-') : row.date;
                  return (
                    <tr key={row.id} className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'}`}>
                      <td className="border-r border-gray-200 p-2 text-xs font-medium text-gray-600">{formattedDate}</td>
                      <td className="border-r border-gray-200 p-2 text-xs font-bold text-gray-700 bg-gray-50/50">{row.vchType}</td>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs text-blue-700">{row.vchNo}</td>
                      <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{row.particulars}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-green-600 bg-green-50/30">{row.inward > 0 ? row.inward : ''}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-red-600 bg-red-50/30">{row.outward > 0 ? row.outward : ''}</td>
                      <td className="p-2 text-right font-mono font-black text-gray-900 bg-yellow-50/20">{row.balance}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-end items-center text-white flex-shrink-0 z-20">
          <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
             <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Closing Stock</span>
             <span className="font-mono text-2xl font-black text-yellow-300 drop-shadow-md">{ledgerRows.closingBalance}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StockRegister;