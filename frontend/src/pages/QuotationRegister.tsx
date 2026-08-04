import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar, Eye, Trash2, CheckSquare, MessageCircle, Printer, RefreshCcw, FileText } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printReceipt } from '../utils/printReceipt';
import { sendWhatsAppTextMessage } from '../utils/whatsappHelper';
import { useLicense } from '../context/LicenseContext';

const QuotationRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shopName } = useLicense();
  const {
    setToolbarActions,
    setGlobalNotification,
    ownerWhatsApp
  } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
    ownerWhatsApp: string;
  }>() || {};

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => location.state?.selectedCustomerName || '');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('all');

  // Multi-select & Delete States
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [singleDeleteModalOpen, setSingleDeleteModalOpen] = useState(false);
  const [deletingSingle, setDeletingSingle] = useState(false);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState<any | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let endpoint = `${Api}/quotations`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchQuery) params.append('q', searchQuery);

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setRecords(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch quotation register data:', error);
      if (setGlobalNotification) setGlobalNotification({ msg: 'Failed to load quotation data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [startDate, endDate, searchQuery]);

  const handlePresetChange = (val: string) => {
    setPreset(val);
    const today = new Date();
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (val === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (val === 'today') {
      const dStr = formatDate(today);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (val === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dStr = formatDate(yesterday);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (val === 'this-month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date();
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    } else if (val === 'fin-year') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const startYr = currentMonth >= 4 ? currentYear : currentYear - 1;
      setStartDate(`${startYr}-04-01`);
      setEndDate(`${startYr + 1}-03-31`);
    }
  };

  // Client-side text filter
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const qNo = (rec.quoteNo || '').toLowerCase();
        const cust = (rec.customer || '').toLowerCase();
        const mob = (rec.mobileNo || '').toLowerCase();

        return qNo.includes(q) || cust.includes(q) || mob.includes(q);
      }
      return true;
    });
  }, [records, searchQuery]);

  const isAllSelected = useMemo(() => {
    return filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.includes(r._id));
  }, [filteredRecords, selectedIds]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r._id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Delete Single Quotation
  const handleConfirmSingleDelete = async () => {
    if (!itemToDelete) return;
    setDeletingSingle(true);
    try {
      const res = await fetch(`${Api}/quotations/${itemToDelete._id}`, { method: 'DELETE' });
      if (res.ok) {
        if (setGlobalNotification) setGlobalNotification({ msg: 'Quotation deleted successfully.', type: 'success' });
        fetchRecords();
      } else {
        const data = await res.json();
        if (setGlobalNotification) setGlobalNotification({ msg: data.error || 'Failed to delete quotation.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) setGlobalNotification({ msg: 'Error deleting quotation.', type: 'error' });
    } finally {
      setDeletingSingle(false);
      setSingleDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  // Action Handlers for a Row
  const handleWhatsAppShare = (quote: any) => {
    let mob = (quote.mobileNo || '').replace(/\D/g, '');
    if (!mob) {
      if (setGlobalNotification) setGlobalNotification({ msg: 'Customer mobile number is missing.', type: 'error' });
      return;
    }
    if (mob.length === 10) mob = `91${mob}`;

    const itemsSummary = (quote.items || []).map((it: any, idx: number) =>
      `${idx + 1}. ${it.itemDescription || it.itemCode} x ${it.quantity || 1} = ₹${(Number(it.unitPrice || 0) * Number(it.quantity || 1)).toFixed(2)}`
    ).join('\n');

    const msg = `*🧾 QUOTATION ESTIMATE - ${shopName || 'STORE'}*\n` +
      `----------------------------------------\n` +
      `📌 *Quote No:* ${quote.quoteNo}\n` +
      `📅 *Date:* ${new Date(quote.quoteDate).toLocaleDateString('en-IN')}\n` +
      `👤 *Customer:* ${quote.customer}\n` +
      `----------------------------------------\n` +
      `*ITEMS:*\n${itemsSummary}\n` +
      `----------------------------------------\n` +
      `💰 *GRAND TOTAL:* ₹${Number(quote.roundedGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `----------------------------------------\n` +
      `Thank you for your business!`;

    sendWhatsAppTextMessage(mob, msg);
    if (setGlobalNotification) setGlobalNotification({ msg: `WhatsApp share opened for ${quote.customer}`, type: 'success' });
  };

  const handlePrintQuote = (quote: any) => {
    const formattedItems = (quote.items || []).map((item: any) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discountPercent) || 0;
      const taxable = (qty * price) * (1 - disc / 100);
      const taxRate = Number(item.taxRate) || 0;
      const total = taxable * (1 + taxRate / 100);

      return {
        itemCode: item.itemCode,
        itemDesc: item.itemDescription || item.itemCode,
        qty: qty,
        rate: price,
        totalAmt: total
      };
    });

    const storePhone = localStorage.getItem('close_day_whatsapp') || ownerWhatsApp || '+919698819482';

    printReceipt({
      gridData: formattedItems,
      invoiceNo: quote.quoteNo,
      date: new Date(quote.quoteDate).toLocaleDateString('en-IN'),
      customerName: quote.customer || 'VALUED CUSTOMER',
      paymentMode: quote.paymentTerms || 'N/A',
      totalQty: quote.totalQty || formattedItems.reduce((a: number, c: any) => a + c.qty, 0),
      subTotal: quote.totalTaxable || 0,
      cgst: quote.totalCgst || 0,
      sgst: quote.totalSgst || 0,
      totalAmount: quote.roundedGrandTotal || 0,
      storeName: shopName,
      storePhone: storePhone,
      receiptTitle: 'QUOTATION'
    });
  };

  const handleConvertToTaxBill = (quote: any) => {
    const validItems = (quote.items || []).map((item: any) => ({
      itemName: item.itemDescription || item.itemCode,
      itemDesc: item.itemCode,
      qty: Number(item.quantity) || 0,
      rate: Number(item.unitPrice) || 0,
      discPercent: Number(item.discountPercent) || 0,
      taxPercent: Number(item.taxRate) || 0
    }));

    const quotationPayload = {
      invoiceNo: 'AUTO',
      buyerName: quote.customer || 'Cash Sale',
      items: validItems,
      isInterstate: !!quote.isInterstate
    };

    if (setGlobalNotification) setGlobalNotification({ msg: `Converting ${quote.quoteNo} to Tax Bill...`, type: 'success' });
    navigate('/sales-bill', { state: { quotationPayload } });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Quotations Register', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 22);

    const headers = ["Quote No", "Date", "Customer Name", "Mobile No", "Items Qty", "Grand Total (Rs)", "Status"];
    const rows = filteredRecords.map(rec => [
      rec.quoteNo,
      new Date(rec.quoteDate).toLocaleDateString('en-IN'),
      rec.customer || 'CASH CUSTOMER',
      rec.mobileNo || '-',
      rec.totalQty || 0,
      `Rs. ${(rec.roundedGrandTotal || 0).toFixed(2)}`,
      rec.status || 'SAVED'
    ]);

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 }
    });

    doc.save(`Quotations_Register_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => navigate('/quotation'),
        onFind: () => searchInputRef.current?.focus(),
        onPrint: downloadPDF
      });
    }
    return () => setToolbarActions && setToolbarActions({});
  }, [setToolbarActions, navigate, filteredRecords]);

  const totalAmountSum = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + Number(curr.roundedGrandTotal || 0), 0);
  }, [filteredRecords]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 relative">
      {/* Page Heading & Tabs */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center">
          <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
          <h2 className="text-xl font-bold text-gray-700 m-0">Quotation Register & History</h2>
        </div>
        <button
          onClick={() => navigate('/quotation')}
          className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold shadow flex items-center space-x-1"
        >
          <span>+ Create New Quotation</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 bg-white p-2 border border-gray-300 shadow-sm rounded">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-gray-300 p-1 rounded-md shadow-sm">
            <span className="font-bold text-[#2b579a] flex items-center pl-1"><Calendar size={12} className="mr-1" /> Filter Period:</span>
            <select
              value={preset}
              onChange={e => handlePresetChange(e.target.value)}
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-700 focus:outline-none cursor-pointer mr-1"
            >
              <option value="all">All Period</option>
              <option value="today">Daily (Today)</option>
              <option value="yesterday">Yesterday</option>
              <option value="this-month">Monthly (This Month)</option>
              <option value="fin-year">Yearly (Financial Year)</option>
            </select>
            <input
              type="date"
              className="border-none bg-transparent font-medium focus:outline-none"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
            />
            <span className="text-gray-400 font-medium">to</span>
            <input
              type="date"
              className="border-none bg-transparent font-medium focus:outline-none"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
            />
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search Quote No, Customer, Mobile...`}
              className="border border-gray-400 pl-8 pr-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-500 w-64 shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-2 top-2 text-gray-500" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold bg-blue-50 text-blue-900 px-2.5 py-1.5 rounded border border-blue-200 shadow-sm">
            Total Quotes: {filteredRecords.length} | Val: ₹{totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold rounded hover:bg-emerald-700 shadow border border-emerald-800 transition-colors">
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm overflow-auto rounded">
        <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
          <thead className="bg-[#2b579a] text-white sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">S.No</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Quote No</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Mobile No</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Total Qty</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Grand Total (₹)</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Status</th>
              <th className="border-b border-gray-400 p-2 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((rec, index) => (
              <tr
                key={rec._id || index}
                className={`hover:bg-blue-50 border-b border-gray-200 transition-colors ${selectedRowId === rec._id ? 'bg-blue-100 font-medium' : ''}`}
                onClick={() => setSelectedRowId(rec._id)}
              >
                <td className="border-r border-gray-300 p-2 text-center font-bold text-gray-600 bg-gray-50">{index + 1}</td>
                <td 
                  className="border-r border-gray-300 p-2 font-mono font-bold text-blue-600 hover:text-blue-900 hover:underline cursor-pointer bg-blue-50/40 hover:bg-blue-100 transition-colors"
                  title="Click to view quotation products"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailModalData(rec);
                    setDetailModalOpen(true);
                  }}
                >
                  {rec.quoteNo}
                </td>
                <td className="border-r border-gray-300 p-2 font-semibold text-gray-700">{new Date(rec.quoteDate).toLocaleDateString('en-IN')}</td>
                <td className="border-r border-gray-300 p-2 font-bold text-gray-900">{rec.customer}</td>
                <td className="border-r border-gray-300 p-2 font-mono font-semibold text-gray-700">{rec.mobileNo || '-'}</td>
                <td className="border-r border-gray-300 p-2 text-center font-bold text-gray-800">{rec.totalQty || 0}</td>
                <td className="border-r border-gray-300 p-2 text-right font-mono font-extrabold text-emerald-700">
                  ₹{Number(rec.roundedGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-gray-300 p-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    rec.status === 'CONVERTED' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                    rec.status === 'SENT' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {rec.status || 'SAVED'}
                  </span>
                </td>
                <td className="p-1 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailModalData(rec); setDetailModalOpen(true); }}
                      className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(rec); }}
                      className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-colors"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrintQuote(rec); }}
                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors"
                      title="Print Quotation"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConvertToTaxBill(rec); }}
                      className="p-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition-colors"
                      title="Convert to Sales Tax Bill"
                    >
                      <RefreshCcw size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemToDelete(rec); setSingleDeleteModalOpen(true); }}
                      className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                      title="Delete Quotation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500 italic">
                  No saved quotations found for selected filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Single Delete Confirmation Modal */}
      {singleDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border border-gray-300">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Quotation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete quotation <strong className="text-black font-mono">{itemToDelete.quoteNo}</strong> for <strong>{itemToDelete.customer}</strong>?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSingleDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded text-xs hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                disabled={deletingSingle}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded text-xs hover:bg-red-700"
              >
                {deletingSingle ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModalOpen && detailModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setDetailModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2b579a] text-white p-3 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">Quotation Details - {detailModalData.quoteNo}</h3>
              <button onClick={() => setDetailModalOpen(false)} className="text-white hover:text-red-200 font-bold">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 font-semibold">
                <div><span className="text-gray-500">Customer:</span> <strong className="text-blue-900">{detailModalData.customer}</strong></div>
                <div><span className="text-gray-500">Mobile No:</span> <strong className="text-blue-900">{detailModalData.mobileNo || '-'}</strong></div>
                <div><span className="text-gray-500">Quote Date:</span> <strong>{new Date(detailModalData.quoteDate).toLocaleDateString('en-IN')}</strong></div>
                <div><span className="text-gray-500">Validity Date:</span> <strong>{detailModalData.validityDate ? new Date(detailModalData.validityDate).toLocaleDateString('en-IN') : '-'}</strong></div>
                <div><span className="text-gray-500">Payment Terms:</span> <strong>{detailModalData.paymentTerms || '-'}</strong></div>
                <div><span className="text-gray-500">Type:</span> <strong>{detailModalData.isInterstate ? 'Interstate' : 'Local'}</strong></div>
              </div>

              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2">Item Code</th>
                    <th className="border p-2">Description</th>
                    <th className="border p-2 text-center">Qty</th>
                    <th className="border p-2 text-right">Price</th>
                    <th className="border p-2 text-center">Disc %</th>
                    <th className="border p-2 text-center">Tax %</th>
                    <th className="border p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailModalData.items || []).map((it: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="border p-2 font-mono font-bold text-blue-800">{it.itemCode}</td>
                      <td className="border p-2">{it.itemDescription || '-'}</td>
                      <td className="border p-2 text-center font-bold">{it.quantity}</td>
                      <td className="border p-2 text-right font-mono">₹{Number(it.unitPrice || 0).toFixed(2)}</td>
                      <td className="border p-2 text-center">{it.discountPercent || 0}%</td>
                      <td className="border p-2 text-center font-bold text-amber-700">{it.taxRate || 0}%</td>
                      <td className="border p-2 text-right font-mono font-bold">₹{Number((Number(it.quantity || 0) * Number(it.unitPrice || 0)) * (1 - (Number(it.discountPercent || 0)/100)) * (1 + (Number(it.taxRate || 0)/100))).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end space-x-6 text-sm font-bold bg-blue-50 p-3 rounded border border-blue-200">
                <div>Total Qty: {detailModalData.totalQty || 0}</div>
                <div>Total Taxable: ₹{(detailModalData.totalTaxable || 0).toFixed(2)}</div>
                <div className="text-blue-900 font-extrabold text-base">Grand Total: ₹{Number(detailModalData.roundedGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div className="p-3 bg-gray-100 flex justify-end space-x-2">
              <button onClick={() => handleWhatsAppShare(detailModalData)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-bold text-xs">Share WhatsApp</button>
              <button onClick={() => handlePrintQuote(detailModalData)} className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded font-bold text-xs">Print</button>
              <button onClick={() => handleConvertToTaxBill(detailModalData)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded font-bold text-xs">Convert to Tax Bill</button>
              <button onClick={() => setDetailModalOpen(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1.5 rounded font-bold text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationRegister;
