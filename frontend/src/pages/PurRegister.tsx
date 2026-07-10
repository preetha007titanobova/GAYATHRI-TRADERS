import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar, Filter, FileText, AlertCircle, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- DATA STRUCTURES ---
interface LineItem {
  itemCode: string;
  itemDesc: string;
  qty: number;
  rate: number;
  taxPercent: number;
  total: number;
}

interface PurchaseRecord {
  id: string;
  date: string;
  voucherNo: string;
  supplierInvoiceNo: string;
  supplierName: string;
  supplierGstin: string;
  taxableAmt: number;
  cgst: number;
  sgst: number;
  igst: number;
  otherCharges: number;
  netPayable: number;
  status: 'Paid' | 'Partial' | 'Credit';
  type: 'Local' | 'Central';
  paymentMode: 'Cash' | 'Credit';
  items: LineItem[];
}

const PurRegister = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  // --- STATE ---
  const [allData, setAllData] = useState<PurchaseRecord[]>([]);
  const [displayedData, setDisplayedData] = useState<PurchaseRecord[]>([]);
  const [suppliersList, setSuppliersList] = useState<string[]>(['All']);
  
  // Filter Draft State
  const [filters, setFilters] = useState({
    fromDate: '2026-04-01', // Default to FY start
    toDate: '2027-03-31',
    supplier: 'All',
    purchaseType: 'All',
    query: ''
  });

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<PurchaseRecord | null>(null);

  // Load Data on Mount
  useEffect(() => {
    // Load Bills
    const storedBills = localStorage.getItem('billing_purchase_bills');
    if (storedBills) {
      const parsed = JSON.parse(storedBills);
      setAllData(parsed);
      setDisplayedData(parsed); // Show all initially or let user fetch
    }

    // Load Suppliers for dropdown
    const storedVendors = localStorage.getItem('billing_vendors');
    if (storedVendors) {
      const parsedVendors = JSON.parse(storedVendors);
      setSuppliersList(['All', ...parsedVendors.map((v: any) => v.name)]);
    }
  }, []);

  // --- ACTIONS ---
  const handleFetchReport = () => {
    let filtered = allData.filter(record => {
      const recDate = new Date(record.date);
      const from = new Date(filters.fromDate);
      const to = new Date(filters.toDate);
      if (recDate < from || recDate > to) return false;

      if (filters.supplier !== 'All' && record.supplierName !== filters.supplier) return false;
      
      if (filters.purchaseType === 'Cash' && record.paymentMode !== 'Cash') return false;
      if (filters.purchaseType === 'Credit' && record.paymentMode !== 'Credit') return false;
      if (filters.purchaseType === 'Local' && record.type !== 'Local') return false;
      if (filters.purchaseType === 'Central' && record.type !== 'Central') return false;

      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!record.voucherNo.toLowerCase().includes(q) && !(record.supplierInvoiceNo || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
    setDisplayedData(filtered);
    setGlobalNotification({ msg: `Fetched ${filtered.length} records successfully.`, type: 'success' });
  };

  const setQuickDate = (type: 'Today' | 'ThisMonth' | 'ThisFY') => {
    const today = new Date();
    if (type === 'Today') {
      const ds = today.toISOString().split('T')[0];
      setFilters(prev => ({...prev, fromDate: ds, toDate: ds}));
    } else if (type === 'ThisMonth') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
      setFilters(prev => ({...prev, fromDate: `${y}-${m}-01`, toDate: `${y}-${m}-${lastDay}`}));
    } else {
      setFilters(prev => ({...prev, fromDate: '2026-04-01', toDate: '2027-03-31'}));
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Purchase Register Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${filters.fromDate} to ${filters.toDate} | Supplier: ${filters.supplier}`, 14, 22);

    const headers = ["Vch No", "Inv No", "Date", "Supplier Name", "Taxable Amt", "CGST", "SGST", "IGST", "Net Payable"];
    const rows = displayedData.map(rec => [
      rec.voucherNo,
      rec.supplierInvoiceNo || '-',
      rec.date,
      rec.supplierName,
      `₹${rec.taxableAmt.toFixed(2)}`,
      `₹${rec.cgst.toFixed(2)}`,
      `₹${rec.sgst.toFixed(2)}`,
      `₹${rec.igst.toFixed(2)}`,
      `₹${rec.netPayable.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
    });

    doc.save(`Purchase_Register_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Bind Print functionality to global toolbar
  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Preparing print layout...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  // --- AGGREGATES ---
  const totals = useMemo(() => {
    return displayedData.reduce((acc, curr) => ({
      taxable: acc.taxable + curr.taxableAmt,
      cgst: acc.cgst + curr.cgst,
      sgst: acc.sgst + curr.sgst,
      igst: acc.igst + curr.igst,
      net: acc.net + curr.netPayable,
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });
  }, [displayedData]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] overflow-hidden p-2">
      
      {/* FILTER BAR */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 print:hidden">
        <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Purchase Register
          </h2>
          <div className="flex space-x-2">
            <button onClick={() => setQuickDate('Today')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">Today</button>
            <button onClick={() => setQuickDate('ThisMonth')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">This Month</button>
            <button onClick={() => setQuickDate('ThisFY')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">This FY</button>
            <button onClick={downloadPDF} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded shadow border border-emerald-800 transition-colors">Download PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center"><Calendar size={12} className="mr-1"/> From Date</label>
            <input type="date" value={filters.fromDate} onChange={e => setFilters({...filters, fromDate: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center"><Calendar size={12} className="mr-1"/> To Date</label>
            <input type="date" value={filters.toDate} onChange={e => setFilters({...filters, toDate: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-bold text-gray-700 mb-1">Supplier Search</label>
            <select value={filters.supplier} onChange={e => setFilters({...filters, supplier: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              {suppliersList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center"><Filter size={12} className="mr-1"/> Purchase Type</label>
            <select value={filters.purchaseType} onChange={e => setFilters({...filters, purchaseType: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              <option value="All">All Transactions</option>
              <option value="Cash">Cash Purchases</option>
              <option value="Credit">Credit Purchases</option>
              <option value="Local">Local (CGST/SGST)</option>
              <option value="Central">Central (IGST)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Search Vch / Inv No.</label>
            <div className="relative">
              <input type="text" value={filters.query} onChange={e => setFilters({...filters, query: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleFetchReport()} placeholder="Search..." className="w-full border border-gray-400 p-1.5 pl-7 rounded text-sm focus:border-blue-500" />
              <Search size={14} className="absolute left-2 top-2 text-gray-400" />
            </div>
          </div>
          <div className="col-span-1">
            <button onClick={handleFetchReport} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded text-sm shadow flex items-center justify-center transition-colors">
              Fetch
            </button>
          </div>
        </div>
      </div>

      {/* DATA GRID */}
      <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm relative overflow-hidden rounded">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-[#2b579a] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#1e3f70] p-2 w-12 text-center text-xs font-semibold">S.No</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold">Date</th>
                <th className="border-r border-[#1e3f70] p-2 w-28 text-xs font-semibold">Voucher No</th>
                <th className="border-r border-[#1e3f70] p-2 w-28 text-xs font-semibold">Inv No</th>
                <th className="border-r border-[#1e3f70] p-2 text-xs font-semibold">Supplier Name & GSTIN</th>
                <th className="border-r border-[#1e3f70] p-2 w-28 text-xs font-semibold text-right">Taxable Amt</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">CGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">SGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">IGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">Round Off</th>
                <th className="border-r border-[#1e3f70] p-2 w-32 text-xs font-semibold text-right bg-blue-700">Net Payable</th>
                <th className="p-2 w-24 text-center text-xs font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-16 text-center text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                       <FileText className="w-12 h-12 text-gray-300 mb-3" />
                       <p className="text-xl font-medium text-gray-400">No purchase records found</p>
                       <p className="text-sm mt-1">Add a new purchase bill, or adjust your date range/filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedData.map((row, idx) => (
                  <tr 
                    key={row.id} 
                    onClick={() => setSelectedRecord(row)}
                    className="border-b border-gray-300 hover:bg-yellow-50 cursor-pointer transition-colors even:bg-gray-50"
                    title="Click to view line items"
                  >
                    <td className="border-r border-gray-300 p-2 text-center text-gray-500">{idx + 1}</td>
                    <td className="border-r border-gray-300 p-2 font-medium text-gray-700">{row.date.split('-').reverse().join('-')}</td>
                    <td className="border-r border-gray-300 p-2 font-mono text-blue-700">{row.voucherNo}</td>
                    <td className="border-r border-gray-300 p-2 text-gray-600">{row.supplierInvoiceNo}</td>
                    <td className="border-r border-gray-300 p-2">
                      <div className="font-semibold text-gray-800">{row.supplierName}</div>
                      <div className="text-[10px] text-gray-500">{row.supplierGstin}</div>
                    </td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-700">{row.taxableAmt.toFixed(2)}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.cgst > 0 ? row.cgst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.sgst > 0 ? row.sgst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.igst > 0 ? row.igst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-400">{row.otherCharges > 0 ? row.otherCharges.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono font-bold text-gray-900 bg-blue-50/50">{row.netPayable.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm
                        ${row.status === 'Paid' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          row.status === 'Partial' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                          'bg-red-100 text-red-700 border border-red-200'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* STICKY FOOTER TOTALS */}
        <div className="bg-[#1e3f70] text-white border-t border-[#142d54] flex-shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <table className="w-full text-right text-sm border-collapse whitespace-nowrap min-w-max">
             <tbody>
               <tr>
                 <td className="p-2 text-blue-200 font-bold uppercase tracking-widest text-xs text-left pl-4">Page Totals</td>
                 <td className="p-2 w-28 text-yellow-200 font-bold font-mono">₹ {totals.taxable.toFixed(2)}</td>
                 <td className="p-2 w-24 font-bold font-mono">₹ {totals.cgst.toFixed(2)}</td>
                 <td className="p-2 w-24 font-bold font-mono">₹ {totals.sgst.toFixed(2)}</td>
                 <td className="p-2 w-24 font-bold font-mono">₹ {totals.igst.toFixed(2)}</td>
                 <td className="p-2 w-24 text-gray-400 font-mono">-</td>
                 <td className="p-2 w-32 font-black text-lg text-white font-mono bg-blue-800">₹ {totals.net.toFixed(2)}</td>
                 <td className="p-2 w-24"></td>
               </tr>
             </tbody>
          </table>
        </div>
      </div>

      {/* DRILL-DOWN MODAL */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Voucher Details: ${selectedRecord?.voucherNo}`}
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="flex justify-between bg-gray-50 p-3 border border-gray-200 rounded text-sm">
               <div>
                 <p className="text-gray-500 text-xs">Supplier</p>
                 <p className="font-bold text-gray-800">{selectedRecord.supplierName}</p>
                 <p className="text-gray-500 text-xs mt-1">Invoice: {selectedRecord.supplierInvoiceNo}</p>
               </div>
               <div className="text-right">
                 <p className="text-gray-500 text-xs">Date</p>
                 <p className="font-bold text-gray-800">{selectedRecord.date}</p>
                 <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                        ${selectedRecord.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                          selectedRecord.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'}`}
                      >
                        {selectedRecord.status}
                </span>
               </div>
            </div>

            <div className="border border-gray-300 rounded overflow-hidden">
               <table className="w-full text-left text-xs">
                 <thead className="bg-gray-100 border-b border-gray-300">
                   <tr>
                     <th className="p-2 font-semibold text-gray-700">Item</th>
                     <th className="p-2 font-semibold text-gray-700 text-right">Qty</th>
                     <th className="p-2 font-semibold text-gray-700 text-right">Rate</th>
                     <th className="p-2 font-semibold text-gray-700 text-right">Tax %</th>
                     <th className="p-2 font-semibold text-gray-700 text-right">Total</th>
                   </tr>
                 </thead>
                 <tbody>
                   {selectedRecord.items.map((it, i) => (
                     <tr key={i} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                       <td className="p-2">
                         <div className="font-semibold text-gray-800">{it.itemCode}</div>
                         <div className="text-gray-500">{it.itemDesc}</div>
                       </td>
                       <td className="p-2 text-right font-mono">{it.qty}</td>
                       <td className="p-2 text-right font-mono">{it.rate.toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{it.taxPercent}%</td>
                       <td className="p-2 text-right font-mono font-bold text-gray-700">{it.total.toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            <div className="flex justify-end pt-2">
               <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold transition-colors">
                 Close
               </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default PurRegister;