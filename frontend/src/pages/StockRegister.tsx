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
  department?: string;
  variety?: string;
  size?: string;
}

const StockRegister = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const [items, setItems] = useState<Product[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');

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
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Stock Register Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Product: ${activeItem?.name || ''} | Period: ${fromDate} to ${toDate}`, 14, 22);
    doc.text(`Opening Stock: ${ledgerRows.openingBalance} | Closing Stock: ${ledgerRows.closingBalance}`, 14, 27);

    const headers = ["Date", "Vch Type", "Vch No.", "Particulars", "Inward Qty", "Outward Qty", "Running Bal."];
    const rows = ledgerRows.rows.map(rec => {
      const dateObj = new Date(rec.date);
      const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : rec.date;
      return [
        formattedDate,
        rec.vchType,
        rec.vchNo,
        rec.particulars,
        rec.inward || '',
        rec.outward || '',
        rec.balance
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
    });

    doc.save(`Stock_Register_${activeItem?.name?.replace(/\s+/g, '_') || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`);
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
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Stock Register
          </h2>

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
                 {items.map(i => {
                   const variantLabel = [
                     i.department ? i.department : '',
                     i.variety ? i.variety : '',
                     i.size ? `Size ${i.size}` : ''
                   ].filter(Boolean).join(' - ');
                   return (
                     <option key={i.id || i._id} value={i.id || i._id}>
                       [{i.itemCode}] {i.name} {variantLabel ? `(${variantLabel})` : ''}
                     </option>
                   );
                 })}
               </select>
             )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-1.5 rounded-md">
             <span className="font-bold text-[#2b579a] flex items-center text-sm mr-3 pl-2"><Calendar size={16} className="mr-1.5"/> Period:</span>
             <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
               <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
               <span className="text-gray-400 text-sm font-medium">to</span>
               <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
             </div>
          </div>
          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-4 py-2 text-sm font-semibold rounded hover:bg-emerald-700 shadow border border-emerald-800 transition-colors">
            Download PDF
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