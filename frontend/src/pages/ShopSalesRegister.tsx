import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar, Filter, FileText, Eye, Edit, Trash2, MessageCircle } from 'lucide-react';
import Modal from '../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Api from '../Api';
import { sendWhatsAppBill, sendWhatsAppTextMessage } from '../utils/whatsappHelper';
import { applyRupeeFont } from '../utils/pdfFontLoader';

// --- DATA STRUCTURES ---
interface LineItem {
  itemCode: string;
  itemName: string;
  qty: number;
  rate: number;
  taxPercent: number;
  total: number;
  size?: string;
  variety?: string;
  category?: string;
}

interface ShopSalesRecord {
  id: string;
  _id?: string;
  date: string;
  voucherNo: string;
  shopName: string;
  shopGstin: string;
  taxableAmt: number;
  cgst: number;
  sgst: number;
  igst: number;
  otherCharges: number;
  netPayable: number;
  status: string;
  type: string;
  paymentMode: string;
  items: LineItem[];
}

const ShopSalesRegister = () => {
  const navigate = useNavigate();
  const { 
    setToolbarActions, 
    setGlobalNotification, 
    ownerWhatsApp
  } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
    ownerWhatsApp: string;
  }>();

  // --- STATE ---
  const [allData, setAllData] = useState<ShopSalesRecord[]>([]);
  const [displayedData, setDisplayedData] = useState<ShopSalesRecord[]>([]);
  const [shopsList, setShopsList] = useState<string[]>(['All']);
  const [shopsData, setShopsData] = useState<any[]>([]);
  
  // Filter Draft State
  const [filters, setFilters] = useState({
    fromDate: '2026-04-01', // Default to FY start
    toDate: '2027-03-31',
    shop: 'All',
    saleType: 'All',
    query: ''
  });

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<ShopSalesRecord | null>(null);

  const handleEditBill = (record: ShopSalesRecord) => {
    setSelectedRecord(null);
    navigate('/shop-sales-bill', { state: { editBill: record } });
  };

  const handleDeleteBill = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this wholesale sales bill? This will revert the physical stock of all items.")) return;
    try {
      const res = await fetch(`${Api}/shop-sales-bills/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: "Wholesale Sales Bill deleted successfully!", type: 'success' });
        setSelectedRecord(null);
        // Reload bills
        fetchData();
      } else {
        setGlobalNotification({ msg: "Failed to delete: " + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: "Network error deleting wholesale sales bill.", type: 'error' });
    }
  };

  const fetchData = () => {
    // Load Bills from DB
    fetch(`${Api}/shop-sales-bills`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllData(data);
          setDisplayedData(data);
        }
      })
      .catch(err => console.error("Error loading wholesale sales bills", err));
  };

  // Load Data on Mount
  useEffect(() => {
    fetchData();

    // Load Shops for dropdown from DB Ledgers
    fetch(`${Api}/ledgers/search?group=Shops`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setShopsData(data);
          setShopsList(['All', ...data.map((v: any) => v.accountName)]);
        }
      })
      .catch(err => console.error("Error loading shops list", err));
  }, []);

  // --- ACTIONS ---
  const handleFetchReport = () => {
    let filtered = allData.filter(record => {
      const recDate = new Date(record.date);
      const from = new Date(filters.fromDate);
      const to = new Date(filters.toDate);
      if (recDate < from || recDate > to) return false;

      if (filters.shop !== 'All' && record.shopName !== filters.shop) return false;
      
      if (filters.saleType === 'Cash' && record.paymentMode !== 'Cash') return false;
      if (filters.saleType === 'Credit' && record.paymentMode !== 'Credit') return false;
      if (filters.saleType === 'Local' && record.type !== 'Local') return false;
      if (filters.saleType === 'Central' && record.type !== 'Central') return false;

      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!record.voucherNo.toLowerCase().includes(q) && !(record.shopName || '').toLowerCase().includes(q)) {
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

  const downloadPDF = async () => {
    const doc = new jsPDF();
    const fontName = await applyRupeeFont(doc);
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Wholesale Sales Register Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${filters.fromDate} to ${filters.toDate} | Shop: ${filters.shop}`, 14, 22);

    const headers = ["Vch No", "Date", "Shop Name", "Taxable Amt", "CGST", "SGST", "IGST", "Net Payable"];
    const rows = displayedData.map(rec => [
      rec.voucherNo,
      rec.date ? rec.date.split('T')[0] : '',
      rec.shopName,
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
      headStyles: { fillColor: [43, 87, 154], font: fontName },
      styles: { fontSize: 8, font: fontName },
    });

    doc.save(`Shop_Sales_Register_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // WhatsApp Share State
  const [sharing, setSharing] = useState(false);

  const handleShareWhatsApp = async () => {
    if (sharing) return;
    setSharing(true);
    setGlobalNotification({ msg: 'Generating PDF and preparing WhatsApp share...', type: 'info' });
    try {
      const doc = new jsPDF();
      const fontName = await applyRupeeFont(doc);
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Wholesale Sales Register Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${filters.fromDate} to ${filters.toDate} | Shop: ${filters.shop}`, 14, 22);

      const headers = ["Vch No", "Date", "Shop Name", "Taxable Amt", "CGST", "SGST", "IGST", "Net Payable"];
      const rows = displayedData.map(rec => [
        rec.voucherNo,
        rec.date ? rec.date.split('T')[0] : '',
        rec.shopName,
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
        headStyles: { fillColor: [43, 87, 154], font: fontName },
        styles: { fontSize: 8, font: fontName },
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Wholesale_Sales_Register_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const res = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: pdfBase64, filename })
      });

      if (!res.ok) throw new Error('Failed to upload PDF report');
      const resData = await res.json();
      if (!resData.success || !resData.pdfUrl) throw new Error('PDF upload returned unsuccessful');

      const whatsappText = `*Ithu Namma Kada - Wholesale Sales Register Report*\n` +
                           `*Period:* ${filters.fromDate} to ${filters.toDate}\n` +
                           `*Shop:* ${filters.shop}\n` +
                           `*Total Net Payable:* ₹${totals.net.toFixed(2)}\n\n` +
                           `*Download PDF:* ${resData.pdfUrl}\n\n` +
                           `Generated automatically via Ithu Namma Kada Billing System.`;

      sendWhatsAppTextMessage(ownerWhatsApp, whatsappText);
      setGlobalNotification({ msg: 'WhatsApp share triggered successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: err.message || 'Failed to share on WhatsApp.', type: 'error' });
    } finally {
      setSharing(false);
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 5000);
    }
  };

  const shareBillWhatsApp = (record: ShopSalesRecord) => {
    const foundShop = shopsData.find(s => s.accountName === record.shopName);
    let targetPhone = foundShop?.mobileNo || '';

    if (!targetPhone && record.shopGstin && record.shopGstin.replace(/\D/g, '').length >= 10) {
      targetPhone = record.shopGstin;
    }

    if (!targetPhone) {
      const inputPhone = window.prompt(`Please enter the WhatsApp mobile number for ${record.shopName}:`);
      if (inputPhone === null) return;
      targetPhone = inputPhone.trim();
    }

    if (!targetPhone) {
      setGlobalNotification({ msg: 'A valid WhatsApp phone number is required.', type: 'error' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      return;
    }

    const cartItems = (record.items || []).map((it: any) => ({
      itemName: it.itemName || (it as any).itemDesc || 'Item',
      qty: it.qty || 1,
      rate: it.rate || 0,
      amount: it.total || 0,
      size: it.size || '',
      uom: 'PCS'
    }));

    const totalQty = cartItems.reduce((acc, curr) => acc + curr.qty, 0);

    try {
      const result = sendWhatsAppBill({
        invoiceNo: record.voucherNo,
        invDate: record.date ? record.date.split('T')[0].split('-').reverse().join('-') : '',
        buyerName: record.shopName,
        mobileNo: targetPhone,
        paymentMode: record.paymentMode || 'Cash',
        items: cartItems,
        totalQty: totalQty,
        totalAmount: record.taxableAmt,
        cgst: record.cgst,
        sgst: record.sgst,
        netAmount: record.netPayable
      });

      if (result && !result.success) {
        setGlobalNotification({ msg: result.error || 'Failed to share on WhatsApp.', type: 'error' });
      } else {
        setGlobalNotification({ msg: `WhatsApp share triggered for ${record.shopName} [${targetPhone}]!`, type: 'success' });
      }
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: 'Error launching WhatsApp: ' + err.message, type: 'error' });
    }
    setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
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
      {/* Page Heading */}
      <div className="flex items-center mb-2 px-1">
        <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
        <h2 className="text-xl font-bold text-gray-700 m-0">Wholesale Sales Register (Outward)</h2>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-gray-200 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-600">Quick Filters:</span>
            <button onClick={() => setQuickDate('Today')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">Today</button>
            <button onClick={() => setQuickDate('ThisMonth')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">This Month</button>
            <button onClick={() => setQuickDate('ThisFY')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded">This FY</button>
          </div>
          <div className="flex space-x-2">
            <button onClick={downloadPDF} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow border border-emerald-800 transition-colors">Download PDF</button>
            <button 
              onClick={handleShareWhatsApp} 
              disabled={sharing}
              className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold px-3 py-1.5 rounded shadow border border-green-800 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.079-2.865-6.93C16.368 2.025 13.91 1.006 11.298 1.006c-5.408 0-9.81 4.398-9.813 9.802-.002 1.83.479 3.618 1.393 5.17l-.997 3.642 3.734-.978zM17.15 13.563c-.3-.15-1.771-.875-2.04-.972-.269-.099-.465-.148-.659.15-.195.297-.753.971-.922 1.168-.169.197-.337.221-.637.072-.3-.15-1.264-.467-2.408-1.486-.89-.794-1.49-1.775-1.665-2.072-.175-.297-.019-.458.131-.606.134-.133.3-.347.449-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.659-1.591-.903-2.176-.237-.573-.478-.495-.659-.504-.17-.008-.365-.01-.56-.01s-.51.074-.777.363c-.266.289-1.016.992-1.016 2.42 0 1.427 1.039 2.805 1.182 2.996.143.19 2.043 3.12 4.949 4.377.691.299 1.23.478 1.651.611.693.22 1.325.189 1.822.115.556-.083 1.771-.724 2.019-1.422.25-.698.25-1.299.176-1.422-.075-.123-.269-.197-.569-.347z" />
              </svg>
              <span>Share</span>
            </button>
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
            <label className="block text-xs font-bold text-gray-700 mb-1">Shop Ledger Search</label>
            <select value={filters.shop} onChange={e => setFilters({...filters, shop: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              {shopsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center"><Filter size={12} className="mr-1"/> Sale Type</label>
            <select value={filters.saleType} onChange={e => setFilters({...filters, saleType: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              <option value="All">All Transactions</option>
              <option value="Cash">Cash Sales</option>
              <option value="Credit">Credit Sales</option>
              <option value="Local">Local (CGST/SGST)</option>
              <option value="Central">Central (IGST)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Search Vch No / Shop</label>
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
                <th className="border-r border-[#1e3f70] p-2 text-xs font-semibold">Shop Name & GSTIN</th>
                <th className="border-r border-[#1e3f70] p-2 w-28 text-xs font-semibold text-right">Taxable Amt</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">CGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">SGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">IGST</th>
                <th className="border-r border-[#1e3f70] p-2 w-24 text-xs font-semibold text-right">Round Off</th>
                <th className="border-r border-[#1e3f70] p-2 w-32 text-xs font-semibold text-right bg-blue-700">Net Receivable</th>
                <th className="p-2 w-24 text-center text-xs font-semibold">Status</th>
                <th className="p-2 w-16 text-center text-xs font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-16 text-center text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                       <FileText className="w-12 h-12 text-gray-300 mb-3" />
                       <p className="text-xl font-medium text-gray-400">No wholesale sales records found</p>
                       <p className="text-sm mt-1">Add a new wholesale sales bill, or adjust your date range/filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedData.map((row, idx) => (
                  <tr 
                    key={row.id} 
                    onClick={() => setSelectedRecord(row)}
                    className="border-b border-gray-300 hover:bg-yellow-50 cursor-pointer transition-colors even:bg-gray-50"
                    title="Click to view details"
                  >
                    <td className="border-r border-gray-300 p-2 text-center text-gray-500">{idx + 1}</td>
                    <td className="border-r border-gray-300 p-2 font-medium text-gray-700">{row.date ? row.date.split('T')[0].split('-').reverse().join('-') : ''}</td>
                    <td className="border-r border-gray-300 p-2 font-mono text-blue-700">{row.voucherNo}</td>
                    <td className="border-r border-gray-300 p-2">
                      <div className="font-semibold text-gray-800">{row.shopName}</div>
                      <div className="text-[10px] text-gray-500">{row.shopGstin}</div>
                    </td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-700">{row.taxableAmt.toFixed(2)}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.cgst > 0 ? row.cgst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.sgst > 0 ? row.sgst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-500">{row.igst > 0 ? row.igst.toFixed(2) : '-'}</td>
                    <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-400">{row.otherCharges !== 0 ? row.otherCharges.toFixed(2) : '-'}</td>
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
                    <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => shareBillWhatsApp(row)}
                        className="inline-flex items-center justify-center p-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 rounded transition-colors"
                        title="Share on WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
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
                 <td className="p-2 w-16"></td>
               </tr>
             </tbody>
          </table>
        </div>
      </div>

      {/* DRILL-DOWN MODAL */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Wholesale Sales Details: ${selectedRecord?.voucherNo}`}
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="flex justify-between bg-gray-50 p-3 border border-gray-200 rounded text-sm text-slate-700">
               <div>
                 <p className="text-gray-500 text-xs font-bold">Buyer Shop</p>
                 <p className="font-bold text-gray-800">{selectedRecord.shopName}</p>
                 <p className="text-gray-500 text-xs mt-1">GSTIN: {selectedRecord.shopGstin || 'N/A'}</p>
               </div>
               <div className="text-right">
                 <p className="text-gray-500 text-xs font-bold">Date</p>
                 <p className="font-bold text-gray-800">{selectedRecord.date ? selectedRecord.date.split('T')[0] : ''}</p>
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
                 <thead className="bg-gray-100 border-b border-gray-300 text-slate-700">
                   <tr>
                     <th className="p-2 font-semibold">Our Item Code</th>
                     <th className="p-2 font-semibold">Vendor Item Code</th>
                     <th className="p-2 font-semibold">Item Name</th>
                     <th className="p-2 font-semibold text-right">Qty</th>
                     <th className="p-2 font-semibold text-right">Rate</th>
                     <th className="p-2 font-semibold text-right">Tax %</th>
                     <th className="p-2 font-semibold text-right">Total</th>
                   </tr>
                 </thead>
                 <tbody className="text-slate-600">
                   {selectedRecord.items.map((it, i) => (
                     <tr key={i} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                       <td className="p-2 font-mono">{it.itemCode}</td>
                       <td className="p-2 font-mono">{(it as any).vendorItemCode || '-'}</td>
                       <td className="p-2">
                         <div className="font-semibold text-gray-800">{it.itemName || (it as any).itemDesc}</div>
                       </td>
                       <td className="p-2 text-right font-mono font-bold">{it.qty}</td>
                       <td className="p-2 text-right font-mono">{it.rate.toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{it.taxPercent}%</td>
                       <td className="p-2 text-right font-mono font-bold text-gray-700">{it.total.toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

             <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
               <div className="flex space-x-2">
                 <button 
                   onClick={() => handleDeleteBill(selectedRecord.id || (selectedRecord as any)._id)} 
                   className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors text-xs flex items-center space-x-1"
                 >
                   <Trash2 size={12} />
                   <span>Delete Bill</span>
                 </button>
                 <button 
                   onClick={() => handleEditBill(selectedRecord)} 
                   className="px-3 py-1.5 bg-[#2b579a] hover:bg-blue-800 text-white rounded font-semibold transition-colors text-xs flex items-center space-x-1"
                 >
                   <Edit size={12} />
                   <span>Edit Bill</span>
                 </button>
                 <button 
                   onClick={() => shareBillWhatsApp(selectedRecord)} 
                   className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors text-xs flex items-center space-x-1"
                 >
                   <MessageCircle size={12} />
                   <span>WhatsApp Share</span>
                 </button>
               </div>
               <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold transition-colors text-xs">
                 Close
               </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ShopSalesRegister;
