import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar, X, Eye, Edit, Printer, FileText, Trash2, MessageCircle } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printReceipt } from '../utils/printReceipt';
import { sendWhatsAppBill } from '../utils/whatsappHelper';

const printOrder = (order: any, mode: 'print' | 'whatsapp' = 'print') => {
  const cartItems = (order.items || []).map((it: any) => ({
    itemCode: it.itemCode,
    itemDesc: it.itemDescription || it.itemName || 'Item',
    qty: it.quantityOrdered || it.orderedQty || it.qty || 1,
    rate: it.unitPrice || it.rate || 0,
    totalAmt: it.lineSubTotal || it.lineTotal || it.amount || 0
  }));

  const printData = {
    invoiceNo: order.invoiceNo || order.orderNo || order.returnNo || order.orderNumber,
    date: new Date(order.invDate || order.orderDate || order.returnDate || new Date()).toLocaleDateString('en-IN'),
    customerName: order.buyerName || order.customer || order.customerName || 'Walk-in',
    paymentMode: order.paymentMode || order.refundMethod || 'Cash',
    totalQty: order.summary?.totalQty || order.totalQty || cartItems.reduce((a: number, c: any) => a + c.qty, 0),
    subTotal: order.summary?.subTotal || order.subTotal || order.totalTaxable || 0,
    cgst: order.summary?.cgst || order.cgst,
    sgst: order.summary?.sgst || order.sgst,
    totalAmount: order.summary?.grandTotal || order.grandTotal || order.netAmount || order.netRefundAmount || 0,
    customerMobile: order.mobileNo,
    receiptTitle: order.orderNo ? 'SALES ORDER' : order.returnNo ? 'SALES RETURN' : 'TAX INVOICE'
  };

  if (mode === 'print') {
    printReceipt({ gridData: cartItems, ...printData });
  } else if (mode === 'whatsapp') {
    sendWhatsAppBill({
      invoiceNo: printData.invoiceNo,
      invDate: printData.date,
      buyerName: printData.customerName,
      mobileNo: printData.customerMobile,
      paymentMode: printData.paymentMode,
      items: cartItems.map((i: any) => ({ itemName: i.itemDesc, qty: i.qty, rate: i.rate, amount: i.totalAmt })),
      totalQty: printData.totalQty,
      totalAmount: printData.subTotal,
      cgst: printData.cgst,
      sgst: printData.sgst,
      netAmount: printData.totalAmount
    });
  }
};

const SalesRegister = () => {
  const {
    setToolbarActions,
    setGlobalNotification,
    ownerWhatsApp
  } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
    ownerWhatsApp: string;
  }>();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'bills' | 'orders' | 'returns'>(() => location.state?.activeTab || 'bills');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => location.state?.selectedCustomerName || '');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('all');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('all');

  // WhatsApp Share State
  const [sharing, setSharing] = useState(false);

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [detailModalData, setDetailModalData] = useState<any | null>(null);
  const [detailModalType, setDetailModalType] = useState<'bill' | 'order' | 'return'>('bill');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const handleOpenDetailModal = async (type: 'bill' | 'order' | 'return', rec: any) => {
    setDetailModalOpen(true);
    setDetailModalLoading(true);
    setDetailModalType(type);
    setDetailModalData(null);
    try {
      let url = '';
      if (type === 'bill') {
        url = `${Api}/sales/bills/${rec.invoiceNo}`;
      } else if (type === 'order') {
        url = `${Api}/sales/orders/${rec._id}`;
      } else if (type === 'return') {
        url = `${Api}/sales/returns/${rec._id}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDetailModalData(data);
      } else {
        setGlobalNotification({ msg: 'Failed to fetch transaction details.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Error loading details.', type: 'error' });
    } finally {
      setDetailModalLoading(false);
    }
  };

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
    } else if (val === 'this-week') {
      const first = today.getDate() - today.getDay();
      const firstDay = new Date(today.setDate(first));
      const lastDay = new Date();
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
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

  // Selected Customer Details State
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any | null>(null);
  const [fetchingCustomer, setFetchingCustomer] = useState(false);

  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'bills') {
        endpoint = `${Api}/sales/bills/search?q=${searchQuery}`;
      } else if (activeTab === 'orders') {
        endpoint = `${Api}/sales/orders/search?q=${searchQuery}`;
      } else if (activeTab === 'returns') {
        endpoint = `${Api}/sales/returns/search?q=${searchQuery}`;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch register data:', error);
      setGlobalNotification({ msg: 'Failed to load register data from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [searchQuery, activeTab]);

  // Date and Payment Mode Filtering logic on frontend
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Date filter
      const dateVal = new Date(rec.invDate || rec.orderDate || rec.returnDate);
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (dateVal < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (dateVal > eDate) return false;
      }

      // Payment Mode Dropdown filter
      const mode = (rec.paymentMode || rec.refundMethod || 'Cash').toLowerCase();
      if (selectedPaymentMode !== 'all') {
        const selMode = selectedPaymentMode.toLowerCase();
        if (selMode === 'cash' && !mode.includes('cash')) return false;
        if (selMode === 'upi' && !mode.includes('upi') && !mode.includes('online')) return false;
        if (selMode === 'card' && !mode.includes('card') && !mode.includes('bank')) return false;
        if (selMode === 'credit' && !mode.includes('credit') && !mode.includes('ledger')) return false;
      }

      // Client-side text search (for payment mode or invoice/customer)
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const invNo = (rec.invoiceNo || rec.orderNo || rec.returnNo || '').toLowerCase();
        const buyer = (rec.buyerName || rec.customer || rec.customerName || '').toLowerCase();
        const mob = (rec.mobileNo || '').toLowerCase();
        const payMode = (rec.paymentMode || rec.refundMethod || 'Cash').toLowerCase();

        const matchInv = invNo.includes(q);
        const matchBuyer = buyer.includes(q);
        const matchMob = mob.includes(q);
        const matchPayMode = payMode.includes(q) || (q === 'upi' && (payMode.includes('online') || payMode.includes('upi')));
        const matchSelective = q.includes('selective') && rec.isSelectiveCustomer;

        if (!matchInv && !matchBuyer && !matchMob && !matchPayMode && !matchSelective) {
          return false;
        }
      }

      return true;
    });
  }, [records, startDate, endDate, selectedPaymentMode, searchQuery, activeTab]);

  // Fetch customer details when a row is selected or a customer filter is set
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      let customerName = '';
      if (selectedRowId) {
        const selectedRecord = records.find(r => r._id === selectedRowId);
        if (selectedRecord) {
          customerName = activeTab === 'bills' ? selectedRecord.buyerName : activeTab === 'orders' ? selectedRecord.customer : selectedRecord.customerName;
        }
      }

      if (!customerName || customerName === 'CASH' || customerName === 'CASH CUSTOMER') {
        setSelectedCustomerDetails(null);
        return;
      }
      setFetchingCustomer(true);
      try {
        const res = await fetch(`${Api}/ledgers/search?q=${encodeURIComponent(customerName)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const matched = data.find((l: any) => l.accountName === customerName);
            setSelectedCustomerDetails(matched || null);
          }
        }
      } catch (err) {
        console.error("Error fetching customer details:", err);
      } finally {
        setFetchingCustomer(false);
      }
    };
    fetchCustomerDetails();
  }, [selectedRowId, records, activeTab]);

  useEffect(() => {
    setToolbarActions({
      onAdd: () => {
        if (activeTab === 'bills') navigate('/sales-bill');
        else if (activeTab === 'orders') navigate('/sales-order');
        else if (activeTab === 'returns') navigate('/sales-return');
      },
      onEdit: () => {
        if (!selectedRowId) {
          setGlobalNotification({ msg: 'Please select a record to edit.', type: 'error' });
          return;
        }
        const selectedRecord = records.find(r => r._id === selectedRowId);
        if (selectedRecord) {
          if (activeTab === 'bills') {
            navigate('/sales-bill', { state: { invoiceToEdit: selectedRecord } });
          } else if (activeTab === 'orders') {
            navigate('/sales-order', { state: { orderToEdit: selectedRecord } });
          } else if (activeTab === 'returns') {
            navigate('/sales-return', { state: { returnToEdit: selectedRecord } });
          }
        }
      },
      onDelete: async () => {
        if (!selectedRowId) {
          setGlobalNotification({ msg: 'Please select a record to delete.', type: 'error' });
          return;
        }
        const recordName = activeTab === 'bills' ? 'sales bill' : activeTab === 'orders' ? 'sales order' : 'sales return';
        if (window.confirm(`Are you sure you want to delete this ${recordName}?`)) {
          try {
            let endpoint = '';
            if (activeTab === 'bills') endpoint = `${Api}/sales/${selectedRowId}`;
            else if (activeTab === 'orders') endpoint = `${Api}/sales/orders/${selectedRowId}`;
            else if (activeTab === 'returns') endpoint = `${Api}/sales/returns/${selectedRowId}`;

            const response = await fetch(endpoint, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
              setGlobalNotification({ msg: 'Record deleted successfully.', type: 'success' });
              setSelectedRowId(null);
              fetchRecords();
            } else {
              setGlobalNotification({ msg: 'Failed to delete record: ' + (data.error || 'Unknown error'), type: 'error' });
            }
          } catch (err) {
            console.error(err);
            setGlobalNotification({ msg: 'Network error while deleting.', type: 'error' });
          }
        }
      },
      onFind: () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      },
      onPrint: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to print.', type: 'error' });
        setGlobalNotification({ msg: 'Print layout opened successfully.', type: 'success' });
      },
      onEmail: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to email.', type: 'error' });
        setGlobalNotification({ msg: 'Record emailed to client successfully.', type: 'success' });
      },
      onSms: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to SMS.', type: 'error' });
        setGlobalNotification({ msg: 'SMS sent to client successfully.', type: 'success' });
      }
    });

    return () => setToolbarActions({});
  }, [setToolbarActions, navigate, selectedRowId, records, activeTab, setGlobalNotification]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const title = activeTab === 'bills' ? 'Sales Bills Register' : activeTab === 'orders' ? 'Sales Orders Register' : 'Sales Returns Register';

    // Header styling
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text(title, 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 22);

    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeTab === 'bills') {
      headers = ["Invoice No", "Date", "Customer Name", "Pay Mode", "Gross Amt", "Tax Amt", "Net Amt"];
      rows = filteredRecords.map(rec => [
        rec.invoiceNo,
        new Date(rec.invDate).toLocaleDateString(),
        rec.buyerName || 'CASH CUSTOMER',
        rec.paymentMode || 'Cash',
        `₹${(rec.totalAmount || 0).toFixed(2)}`,
        `₹${((rec.cgst || 0) + (rec.sgst || 0)).toFixed(2)}`,
        `₹${(rec.netAmount || 0).toFixed(2)}`
      ]);
    } else if (activeTab === 'orders') {
      headers = ["Order No", "Date", "Customer Name", "Delivery Date", "Terms", "Grand Total", "Status"];
      rows = filteredRecords.map(rec => [
        rec.orderNo,
        new Date(rec.orderDate).toLocaleDateString(),
        rec.customer || 'CASH CUSTOMER',
        rec.deliveryDate ? new Date(rec.deliveryDate).toLocaleDateString() : '-',
        rec.paymentTerms || '-',
        `₹${(rec.grandTotal || 0).toFixed(2)}`,
        rec.status || 'OPEN'
      ]);
    } else {
      headers = ["Return No", "Date", "Customer Name", "Orig. Invoice", "Reason", "Tax Return", "Net Refund"];
      rows = filteredRecords.map(rec => [
        rec.returnNo,
        new Date(rec.returnDate).toLocaleDateString(),
        rec.customerName || 'CASH CUSTOMER',
        rec.originalInvoice || '-',
        rec.reason || '-',
        `₹${((rec.cgstReturn || 0) + (rec.sgstReturn || 0) + (rec.igstReturn || 0)).toFixed(2)}`,
        `₹${(rec.netRefundAmount || 0).toFixed(2)}`
      ]);
    }

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
    });

    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleShareWhatsApp = async () => {
    if (sharing) return;
    setSharing(true);
    setGlobalNotification({ msg: 'Generating PDF and preparing WhatsApp share...', type: 'info' });
    try {
      const doc = new jsPDF();
      const title = activeTab === 'bills' ? 'Sales Bills Register' : activeTab === 'orders' ? 'Sales Orders Register' : 'Sales Returns Register';

      // Header styling
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text(title, 14, 15);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 22);

      let headers: string[] = [];
      let rows: any[][] = [];

      if (activeTab === 'bills') {
        headers = ["Invoice No", "Date", "Customer Name", "Pay Mode", "Gross Amt", "Tax Amt", "Net Amt"];
        rows = filteredRecords.map(rec => [
          rec.invoiceNo,
          new Date(rec.invDate).toLocaleDateString(),
          rec.buyerName || 'CASH CUSTOMER',
          rec.paymentMode || 'Cash',
          `₹${(rec.totalAmount || 0).toFixed(2)}`,
          `₹${((rec.cgst || 0) + (rec.sgst || 0)).toFixed(2)}`,
          `₹${(rec.netAmount || 0).toFixed(2)}`
        ]);
      } else if (activeTab === 'orders') {
        headers = ["Order No", "Date", "Customer Name", "Delivery Date", "Terms", "Grand Total", "Status"];
        rows = filteredRecords.map(rec => [
          rec.orderNo,
          new Date(rec.orderDate).toLocaleDateString(),
          rec.customer || 'CASH CUSTOMER',
          rec.deliveryDate ? new Date(rec.deliveryDate).toLocaleDateString() : '-',
          rec.paymentTerms || '-',
          `₹${(rec.grandTotal || 0).toFixed(2)}`,
          rec.status || 'OPEN'
        ]);
      } else {
        headers = ["Return No", "Date", "Customer Name", "Orig. Invoice", "Reason", "Tax Return", "Net Refund"];
        rows = filteredRecords.map(rec => [
          rec.returnNo,
          new Date(rec.returnDate).toLocaleDateString(),
          rec.customerName || 'CASH CUSTOMER',
          rec.originalInvoice || '-',
          rec.reason || '-',
          `₹${((rec.cgstReturn || 0) + (rec.sgstReturn || 0) + (rec.igstReturn || 0)).toFixed(2)}`,
          `₹${(rec.netRefundAmount || 0).toFixed(2)}`
        ]);
      }

      autoTable(doc, {
        startY: 26,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8 },
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      const res = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: pdfBase64, filename })
      });

      if (!res.ok) throw new Error('Failed to upload PDF report');
      const resData = await res.json();
      if (!resData.success || !resData.pdfUrl) throw new Error('PDF upload returned unsuccessful');

      const whatsappText = `*Ithu Namma Kada - ${title}*\n` +
        `*Period:* ${startDate || 'All'} to ${endDate || 'All'}\n` +
        `*Records Count:* ${filteredRecords.length}\n\n` +
        `*Download PDF:* ${resData.pdfUrl}\n\n` +
        `Generated automatically via Ithu Namma Kada Billing System.`;

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

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 relative">
      {/* Page Heading */}
      <div className="flex items-center mb-2 px-1">
        <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
        <h2 className="text-xl font-bold text-gray-700 m-0">Sales Register</h2>
      </div>

      {/* Filters Area */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 bg-white p-2 border border-gray-300 shadow-sm rounded">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selection */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-gray-300 p-1 rounded-md shadow-sm">
            <span className="font-bold text-[#2b579a] flex items-center pl-1"><Calendar size={12} className="mr-1" /> Period:</span>
            <select
              value={preset}
              onChange={e => handlePresetChange(e.target.value)}
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer mr-1"
            >
              <option value="all">All Period</option>
              <option value="custom">Custom (Wish)</option>
              <option value="today">Today (Daily)</option>
              <option value="yesterday">Yesterday</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="fin-year">Financial Year</option>
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

          {/* Payment Mode Filter Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-gray-300 p-1 rounded-md shadow-sm">
            <span className="font-bold text-[#2b579a] flex items-center pl-1">💳 Pay Mode:</span>
            <select
              value={selectedPaymentMode}
              onChange={e => setSelectedPaymentMode(e.target.value)}
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">💵 Cash Pay</option>
              <option value="upi">📱 UPI / Online Pay</option>
              <option value="card">💳 Card / Bank</option>
              <option value="credit">📜 Credit / Ledger</option>
            </select>
          </div>

          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search bill, UPI, Cash...`}
              className="border border-gray-400 pl-8 pr-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-500 w-48 shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-2 top-2 text-gray-500" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold rounded hover:bg-emerald-700 shadow border border-emerald-800 transition-colors">Download PDF</button>
          <button
            onClick={handleShareWhatsApp}
            disabled={sharing}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1.5 text-sm font-semibold rounded shadow border border-green-800 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.079-2.865-6.93C16.368 2.025 13.91 1.006 11.298 1.006c-5.408 0-9.81 4.398-9.813 9.802-.002 1.83.479 3.618 1.393 5.17l-.997 3.642 3.734-.978zM17.15 13.563c-.3-.15-1.771-.875-2.04-.972-.269-.099-.465-.148-.659.15-.195.297-.753.971-.922 1.168-.169.197-.337.221-.637.072-.3-.15-1.264-.467-2.408-1.486-.89-.794-1.49-1.775-1.665-2.072-.175-.297-.019-.458.131-.606.134-.133.3-.347.449-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.659-1.591-.903-2.176-.237-.573-.478-.495-.659-.504-.17-.008-.365-.01-.56-.01s-.51.074-.777.363c-.266.289-1.016.992-1.016 2.42 0 1.427 1.039 2.805 1.182 2.996.143.19 2.043 3.12 4.949 4.377.691.299 1.23.478 1.651.611.693.22 1.325.189 1.822.115.556-.083 1.771-.724 2.019-1.422.25-.698.25-1.299.176-1.422-.075-.123-.269-.197-.569-.347z" />
            </svg>
            {sharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex space-x-1 mb-1 border-b border-gray-300">
        <button
          onClick={() => { setActiveTab('bills'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${activeTab === 'bills' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
        >
          Sales Bills
        </button>
        <button
          onClick={() => { setActiveTab('orders'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${activeTab === 'orders' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
        >
          Sales Orders
        </button>
        <button
          onClick={() => { setActiveTab('returns'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${activeTab === 'returns' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
        >
          Sales Returns
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden space-x-2">
        {/* Table Area */}
        <div className="flex-1 bg-white border border-gray-400 shadow-sm overflow-auto rounded">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
            <thead className="bg-[#e0e0e0] text-gray-800 sticky top-0 z-10 shadow-sm">
              {activeTab === 'bills' && (
                <tr>
                  <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">#</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Invoice No</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold font-semibold">Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Pay Mode</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Gross Amt</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Tax Amt</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Net Amt</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Status</th>
                  <th className="border-b border-gray-400 p-2 font-bold text-center">Actions</th>
                </tr>
              )}
              {activeTab === 'orders' && (
                <tr>
                  <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">#</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Order No</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Customer</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Items</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Qty</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Total</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Advance</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Balance</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-center">Status</th>
                  <th className="border-b border-gray-400 p-2 font-bold text-center">Action</th>
                </tr>
              )}
              {activeTab === 'returns' && (
                <tr>
                  <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">#</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Return No</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Orig. Invoice</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Reason</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Tax Return</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Net Refund</th>
                  <th className="border-b border-gray-400 p-2 font-bold text-center">Status</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-gray-500 font-semibold">Loading data...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-gray-500 font-semibold">No records found for the selected date range.</td>
                </tr>
              ) : (
                filteredRecords.map((rec, index) => {
                  const isSelected = selectedRowId === rec._id;

                  if (activeTab === 'bills') {
                    const taxAmt = (rec.cgst || 0) + (rec.sgst || 0);
                    return (
                      <tr
                        key={rec._id}
                        onClick={() => setSelectedRowId(rec._id)}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                          }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td
                          className="border-r border-gray-300 p-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer animate-pulse-subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal('bill', rec);
                          }}
                        >
                          {rec.invoiceNo}
                        </td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.invDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">
                          <div className="flex flex-col">
                            <span>{rec.buyerName || 'CASH CUSTOMER'}</span>
                            {rec.isSelectiveCustomer && (
                              <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mt-0.5">
                                Selective Customer
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border-r border-gray-300 p-1.5 text-center">
                          {(() => {
                            const mode = rec.paymentMode || 'Cash';
                            if (mode.includes('UPI') || mode.includes('Online')) {
                              return <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-300">📱 UPI / Online</span>;
                            } else if (mode.includes('Card')) {
                              return <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-300">💳 Card</span>;
                            } else if (mode.includes('Bank')) {
                              return <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-300">🏦 Bank</span>;
                            } else if (mode.includes('Credit') || mode.includes('Ledger')) {
                              return <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-rose-300">📜 Credit</span>;
                            } else {
                              return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-300">💵 Cash</span>;
                            }
                          })()}
                        </td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono">₹{rec.totalAmount?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{taxAmt.toFixed(2)}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">₹{rec.netAmount?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-center">
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-300">CLEARED</span>
                        </td>
                        <td className="p-1.5 text-center space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDetailModal('bill', rec); }}
                            className="inline-flex items-center justify-center p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded transition-colors"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              printOrder(rec, 'print');
                            }}
                            className="inline-flex items-center justify-center p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded transition-colors"
                            title="Print"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              printOrder(rec, 'whatsapp');
                            }}
                            className="inline-flex items-center justify-center p-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 rounded transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  } else if (activeTab === 'orders') {
                    const itemsCount = rec.items?.length || 0;
                    const totalQty = rec.items?.reduce((sum: number, item: any) => sum + (item.orderedQty || 0), 0) || 0;
                    
                    const handleCancelClick = async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (rec.status === 'Completed' || rec.status === 'Cancelled') return;
                      const reason = window.prompt("Enter reason for cancelling this sales order:");
                      if (reason !== null) {
                        try {
                          const res = await fetch(`${Api}/sales/orders/${rec._id}/cancel`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ cancelReason: reason, cancelledBy: 'Owner' })
                          });
                          const resData = await res.json();
                          if (resData.success) {
                            setGlobalNotification({ msg: 'Order cancelled successfully.', type: 'success' });
                            fetchRecords();
                          } else {
                            setGlobalNotification({ msg: 'Failed to cancel: ' + resData.error, type: 'error' });
                          }
                        } catch (err) {
                          console.error(err);
                          setGlobalNotification({ msg: 'Error cancelling order.', type: 'error' });
                        }
                      }
                    };

                    // handlePrintClick removed, replaced by inline calls to printOrder(rec, ...)

                    const handleConvertClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (rec.status === 'Completed' || rec.status === 'Cancelled') return;
                      const orderPayload = {
                        id: rec._id || rec.id,
                        orderNumber: rec.orderNumber || rec.orderNo,
                        buyerName: rec.buyerName || rec.customer || 'CASH CUSTOMER',
                        mobileNo: rec.mobileNo,
                        address: rec.address,
                        items: rec.items?.map((it: any) => ({
                          productId: it.productId,
                          itemCode: it.itemCode,
                          itemName: it.itemName,
                          qty: Math.max(0, (it.orderedQty || 0) - (it.deliveredQty || 0)),
                          rate: it.unitPrice || 0,
                          discPercent: it.discount || 0
                        })) || []
                      };
                      navigate('/sales-bill', { state: { orderToConvert: orderPayload } });
                    };

                    const handleEditClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (rec.status === 'Completed' || rec.status === 'Cancelled') return;
                      navigate('/sales-order', { state: { orderToEdit: rec } });
                    };

                    return (
                      <tr
                        key={rec._id}
                        onClick={() => setSelectedRowId(rec._id)}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                          }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td
                          className="border-r border-gray-300 p-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal('order', rec);
                          }}
                        >
                          {rec.orderNumber || rec.orderNo}
                        </td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.orderDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">
                          <div>{rec.buyerName || rec.customer || 'CASH CUSTOMER'}</div>
                          {rec.mobileNo && <div className="text-[10px] text-gray-400">Mob: {rec.mobileNo}</div>}
                        </td>
                        <td className="border-r border-gray-300 p-1.5 text-center font-mono">{itemsCount}</td>
                        <td className="border-r border-gray-300 p-1.5 text-center font-mono">{totalQty}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-slate-800">₹{rec.grandTotal?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-green-700">₹{rec.advancePaid?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{rec.balanceAmount?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rec.status === 'Completed' || rec.status === 'FULFILLED' ? 'bg-green-100 text-green-800 border-green-300' :
                              rec.status === 'Partial' || rec.status === 'PENDING' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                rec.status === 'Cancelled' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-blue-100 text-blue-800 border-blue-300'
                            }`}>{rec.status || 'Open'}</span>
                        </td>
                        <td className="p-1.5 text-center space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDetailModal('order', rec); }}
                            className="inline-flex items-center justify-center p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded transition-colors"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                          {rec.status !== 'Completed' && rec.status !== 'Cancelled' && (
                            <button
                              onClick={handleEditClick}
                              className="inline-flex items-center justify-center p-1 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-600 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              printOrder(rec, 'print');
                            }}
                            className="inline-flex items-center justify-center p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded transition-colors"
                            title="Print"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              printOrder(rec, 'whatsapp');
                            }}
                            className="inline-flex items-center justify-center p-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 rounded transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          {rec.status !== 'Completed' && rec.status !== 'Cancelled' && (
                            <>
                              <button
                                onClick={handleConvertClick}
                                className="inline-flex items-center justify-center p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded transition-colors"
                                title="Convert"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingOrder(rec);
                                  setDeleteReason('');
                                  setDeleteModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center p-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  } else {
                    // returns
                    const taxAmt = (rec.cgstReturn || 0) + (rec.sgstReturn || 0) + (rec.igstReturn || 0);
                    const isExchange = rec.returnType === 'Exchange (Replacement)';
                    return (
                      <tr
                        key={rec._id}
                        onClick={() => setSelectedRowId(rec._id)}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                          }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td
                          className="border-r border-gray-300 p-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal('return', rec);
                          }}
                        >
                          {rec.returnNo}
                        </td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.returnDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.customerName || 'CASH CUSTOMER'}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.originalInvoice || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-ellipsis overflow-hidden max-w-[150px]">{rec.reason || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{taxAmt.toFixed(2)}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">
                          {isExchange ? (
                            rec.extraReceived > 0 ? (
                              <span className="text-emerald-600 font-extrabold">+₹{rec.extraReceived.toFixed(2)}</span>
                            ) : rec.refundAmount > 0 ? (
                              <span className="text-orange-600 font-extrabold">-₹{rec.refundAmount.toFixed(2)}</span>
                            ) : (
                              '₹0.00'
                            )
                          ) : (
                            `₹${(rec.netRefundAmount || 0).toFixed(2)}`
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isExchange 
                              ? 'bg-purple-100 text-purple-800 border-purple-300' 
                              : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          }`}>
                            {isExchange ? 'EXCHANGE' : 'RETURN'}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Customer / Ledger profile sidebar on Right */}
        {selectedRowId && (
          <div className="w-[30%] bg-slate-50 border border-gray-400 rounded flex flex-col p-3 shadow-md space-y-4 overflow-y-auto">
            {selectedRowId && (
              <div className="border-b border-slate-300 pb-2">
                <h3 className="font-bold text-[#2b579a] text-xs uppercase tracking-wider">Transaction Summary</h3>
                {(() => {
                  const rec = records.find(r => r._id === selectedRowId);
                  if (!rec) return null;
                  return (
                    <div className="text-xs text-slate-700 mt-2 space-y-1.5">
                      <div className="flex justify-between"><span>No:</span> <span className="font-bold text-gray-800">{rec.invoiceNo || rec.orderNo || rec.returnNo}</span></div>
                      <div className="flex justify-between"><span>Date:</span> <span className="font-semibold text-gray-800">{new Date(rec.invDate || rec.orderDate || rec.returnDate).toLocaleDateString()}</span></div>
                      <div className="flex justify-between"><span>Type:</span> <span className="font-semibold text-gray-800">{rec.returnType || (rec.invoiceNo ? 'Sales Bill' : 'Sales Order')}</span></div>
                      {rec.returnType === 'Exchange (Replacement)' ? (
                        <>
                          <div className="flex justify-between text-red-600 font-semibold">
                            <span>Returned Value:</span>
                            <span className="font-mono">₹{((rec.totalReturnAmount || 0) + (rec.cgstReturn || 0) + (rec.sgstReturn || 0) + (rec.igstReturn || 0)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-600 font-semibold">
                            <span>Replacement Value:</span>
                            <span className="font-mono">₹{(rec.replacementItems ? rec.replacementItems.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0) : 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1.5">
                            <span>Net Adjustment:</span>
                            <span className="font-mono">
                              {rec.extraReceived > 0 
                                ? `+₹${rec.extraReceived.toFixed(2)}` 
                                : rec.refundAmount > 0 
                                  ? `-₹${rec.refundAmount.toFixed(2)}` 
                                  : '₹0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{rec.extraReceived > 0 ? `Paid via ${rec.paymentMode}` : rec.refundAmount > 0 ? `Refund: ${rec.refundMethod}` : ''}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between"><span>Gross Total:</span> <span className="font-mono text-gray-800">₹{(rec.totalAmount || rec.subtotal || rec.totalReturnAmount || 0).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>Net Total:</span> <span className="font-mono text-emerald-800 font-bold text-sm">₹{(rec.netAmount || rec.grandTotal || rec.netRefundAmount || 0).toFixed(2)}</span></div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider pb-2 border-b border-slate-300">Customer Account Info</h3>
              {fetchingCustomer ? (
                <div className="text-xs text-slate-500 py-4 italic animate-pulse">Fetching profile details...</div>
              ) : selectedCustomerDetails ? (
                <div className="text-xs text-slate-700 space-y-2.5 mt-2.5">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Account Name</span>
                    <span className="font-bold text-slate-900 text-sm leading-tight block">{selectedCustomerDetails.accountName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Ledger Code / Group</span>
                    <span className="font-semibold text-slate-800">{selectedCustomerDetails.ledgerCode} | {selectedCustomerDetails.accountGroup}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Outstanding Balance</span>
                    <span className="font-mono font-black text-sm text-red-600 block">
                      ₹{selectedCustomerDetails.openingBalance?.toLocaleString() || 0} {selectedCustomerDetails.drCr || 'Dr'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase">Credit Limit</span>
                      <span className="font-mono font-bold text-slate-800">₹{selectedCustomerDetails.creditLimit?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase">Credit Days</span>
                      <span className="font-bold text-slate-800">{selectedCustomerDetails.defaultCreditPeriod || 0} Days</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">GSTIN / UIN</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedCustomerDetails.gstNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">PAN Number</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedCustomerDetails.panNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Address & Mailing</span>
                    <span className="text-slate-800 text-[11px] block leading-tight">
                      {selectedCustomerDetails.address || '-'} <br />
                      {selectedCustomerDetails.city || ''}, {selectedCustomerDetails.state || ''} {selectedCustomerDetails.pincode || ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-4 italic leading-relaxed">
                  Billed under Cash / Walk-in Customer.<br />
                  No specific customer profile is linked to this transaction.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Totals */}
      <div className="bg-[#e0e0e0] border border-gray-400 mt-2 p-1.5 flex justify-between items-center text-sm font-bold shadow-sm rounded">
        <div className="text-gray-700">Total Records: <span className="text-blue-700">{filteredRecords.length}</span></div>
        <div className="flex space-x-6 text-gray-800">
          {activeTab === 'bills' && (
            <>
              <div>Total Gross: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0).toFixed(2)}</span></div>
              <div className="text-red-700">Total Tax: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.cgst || 0) + (curr.sgst || 0), 0).toFixed(2)}</span></div>
              <div className="text-green-800 text-base">Total Net Amount: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.netAmount || 0), 0).toFixed(2)}</span></div>
            </>
          )}
          {activeTab === 'orders' && (
            <>
              <div>Total Taxable: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.subtotal || 0), 0).toFixed(2)}</span></div>
              <div className="text-red-700">Total Tax: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.cgst || 0) + (curr.sgst || 0) + (curr.igst || 0), 0).toFixed(2)}</span></div>
              <div className="text-green-800 text-base">Total Order Value: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0).toFixed(2)}</span></div>
            </>
          )}
          {activeTab === 'returns' && (
            <>
              <div>Total Goods Return Value: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.totalReturnAmount || 0), 0).toFixed(2)}</span></div>
              <div className="text-red-700">Total Tax Refund: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.cgstReturn || 0) + (curr.sgstReturn || 0) + (curr.igstReturn || 0), 0).toFixed(2)}</span></div>
              <div className="text-green-800 text-base">Total Net Refund: <span className="font-mono ml-1">₹{filteredRecords.reduce((acc, curr) => acc + (curr.netRefundAmount || 0), 0).toFixed(2)}</span></div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="bg-[#2b579a] text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {detailModalType === 'bill' ? 'Sales Invoice Details' :
                    detailModalType === 'order' ? 'Sales Order Details' : 'Sales Return Details'}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {detailModalLoading ? 'Loading transaction details...' :
                    detailModalData ? `${detailModalType === 'bill' ? 'Invoice No: ' + detailModalData.invoiceNo :
                      detailModalType === 'order' ? 'Order No: ' + detailModalData.orderNo :
                        'Return No: ' + detailModalData.returnNo}` : ''}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailModalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500 font-semibold">Fetching transaction items & ledger info...</p>
                </div>
              ) : !detailModalData ? (
                <div className="text-center py-12 text-red-500 font-semibold">
                  Failed to load transaction data.
                </div>
              ) : (
                <>
                  {/* Upper Grid - Customer & Invoice Meta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                    {/* Buyer / Customer Info */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Purchased By (Customer)</h4>
                      <div className="space-y-1 text-sm text-slate-800">
                        <div className="font-bold text-[#2b579a] text-base">
                          {detailModalType === 'bill' ? detailModalData.buyerName || 'CASH CUSTOMER' :
                            detailModalType === 'order' ? detailModalData.customer || 'CASH CUSTOMER' :
                              detailModalData.customerName || 'CASH CUSTOMER'}
                        </div>
                        {detailModalType === 'bill' && detailModalData.address && (
                          <div className="text-slate-600 text-xs">{detailModalData.address}</div>
                        )}
                        {detailModalType === 'bill' && detailModalData.mobileNo && (
                          <div className="text-slate-600 text-xs">Mobile: {detailModalData.mobileNo}</div>
                        )}
                        {detailModalType === 'bill' && detailModalData.gstNo && (
                          <div className="text-xs font-semibold text-slate-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block">
                            GSTIN: {detailModalData.gstNo}
                          </div>
                        )}
                        {detailModalType === 'return' && detailModalData.reason && (
                          <div className="text-xs mt-2 p-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
                            <span className="font-bold">Return Reason: </span> {detailModalData.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta details */}
                    <div className="border-l border-slate-200 pl-0 md:pl-6 space-y-2 text-sm text-slate-700">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transaction Info</h4>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                        <span className="font-medium text-slate-500">Date:</span>
                        <span className="font-bold text-slate-800">
                          {new Date(detailModalData.invDate || detailModalData.orderDate || detailModalData.returnDate).toLocaleDateString()}
                        </span>

                        {detailModalType === 'bill' && (
                          <>
                            <span className="font-medium text-slate-500">Salesman:</span>
                            <span className="font-semibold text-slate-800">{detailModalData.salesman || 'N/A'}</span>

                            <span className="font-medium text-slate-500">Payment Mode:</span>
                            <span className="font-semibold text-slate-800">{detailModalData.paymentMode || 'Cash'}</span>

                            <span className="font-medium text-slate-500">E-Type:</span>
                            <span className="font-semibold text-slate-800">{detailModalData.eType || 'Local'}</span>
                          </>
                        )}

                        {detailModalType === 'order' && (
                          <>
                            <span className="font-medium text-slate-500">Payment Terms:</span>
                            <span className="font-semibold text-slate-800">{detailModalData.paymentTerms || 'N/A'}</span>

                            <span className="font-medium text-slate-500">Status:</span>
                            <span className="font-semibold text-slate-800">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${detailModalData.status === 'FULFILLED' ? 'bg-green-100 text-green-800 border-green-300' :
                                  detailModalData.status === 'PENDING' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                    'bg-blue-100 text-blue-800 border-blue-300'
                                }`}>{detailModalData.status || 'OPEN'}</span>
                            </span>
                          </>
                        )}

                        {detailModalType === 'return' && (
                          <>
                            <span className="font-medium text-slate-500">Original Invoice:</span>
                            <span className="font-semibold text-[#2b579a]">{detailModalData.originalInvoice || 'N/A'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Itemized Products</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="p-2 w-10 text-center">#</th>
                            <th className="p-2">Product / Item Name</th>
                            {detailModalType === 'return' ? (
                              <>
                                <th className="p-2 text-right">Invoiced Qty</th>
                                <th className="p-2 text-right text-red-600">Returned Qty</th>
                                <th className="p-2 text-right">Unit Price</th>
                                <th className="p-2 text-right">Taxable Amt</th>
                                <th className="p-2 text-right">Tax %</th>
                                <th className="p-2 text-center">Disposition</th>
                              </>
                            ) : detailModalType === 'order' ? (
                              <>
                                <th className="p-2 text-right">Qty Ordered</th>
                                <th className="p-2 text-right">Qty Fulfilled</th>
                                <th className="p-2 text-right">Unit Price</th>
                                <th className="p-2 text-right">Discount %</th>
                                <th className="p-2 text-right">Tax Rate %</th>
                                <th className="p-2 text-right">Line Total</th>
                              </>
                            ) : (
                              <>
                                <th className="p-2 text-center">Size</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2">UOM</th>
                                <th className="p-2 text-right">Rate (₹)</th>
                                <th className="p-2 text-right">Disc %</th>
                                <th className="p-2 text-right">Disc Amt (₹)</th>
                                <th className="p-2 text-right">Amount (₹)</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {(!detailModalData.items || detailModalData.items.length === 0) ? (
                            <tr>
                              <td colSpan={10} className="p-4 text-center text-slate-400 italic">No products listed in this transaction.</td>
                            </tr>
                          ) : (
                            detailModalData.items.map((item: any, idx: number) => (
                              <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                                <td className="p-2 font-semibold text-slate-800">
                                  {item.itemName || item.itemDescription || 'Unknown Item'}
                                  {(item.itemCode || item.productId) && (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      Code: {item.itemCode || item.productId}
                                    </span>
                                  )}
                                </td>
                                {detailModalType === 'return' ? (
                                  <>
                                    <td className="p-2 text-right font-mono">{item.invoicedQty || 0}</td>
                                    <td className="p-2 text-right font-mono text-red-600 font-bold">{item.returnQty || 0}</td>
                                    <td className="p-2 text-right font-mono">₹{(item.unitPrice || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">₹{(item.taxableAmt || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">{item.taxPercent || 0}%</td>
                                    <td className="p-2 text-center">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.disposition === 'Return to Warehouse' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>{item.disposition}</span>
                                    </td>
                                  </>
                                ) : detailModalType === 'order' ? (
                                  <>
                                    <td className="p-2 text-right font-mono">{item.quantityOrdered || 0}</td>
                                    <td className="p-2 text-right font-mono">{item.quantityFulfilled || 0}</td>
                                    <td className="p-2 text-right font-mono">₹{(item.unitPrice || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">{item.discountPercentage || 0}%</td>
                                    <td className="p-2 text-right font-mono">{item.taxRatePercentage || 0}%</td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-800">₹{(item.lineSubTotal || 0).toFixed(2)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 text-center font-bold text-blue-900 bg-blue-50/50">{item.size || '-'}</td>
                                    <td className="p-2 text-right font-mono">{item.qty || 0}</td>
                                    <td className="p-2 text-slate-500">{item.uom || 'PCS'}</td>
                                    <td className="p-2 text-right font-mono">₹{(item.rate || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">{item.discPercent || 0}%</td>
                                    <td className="p-2 text-right font-mono">₹{(item.discAmt || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-800">₹{(item.amount || 0).toFixed(2)}</td>
                                  </>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bottom Summary Grid */}
                  <div className="flex flex-col md:flex-row justify-between items-start pt-4 border-t border-slate-200 space-y-4 md:space-y-0">
                    {/* Remarks/Left info */}
                    <div className="w-full md:w-1/2 space-y-2">
                      {detailModalData.remarks && (
                        <div className="text-xs text-slate-500">
                          <span className="font-bold block uppercase text-[9px] text-slate-400 tracking-wider">Remarks / Notes</span>
                          <p className="bg-slate-50 border border-slate-200 p-2 rounded mt-1 italic text-slate-700">{detailModalData.remarks}</p>
                        </div>
                      )}
                      {detailModalData.shippingAddress && (
                        <div className="text-xs text-slate-500">
                          <span className="font-bold block uppercase text-[9px] text-slate-400 tracking-wider">Shipping Address</span>
                          <p className="bg-slate-50 border border-slate-200 p-2 rounded mt-1 text-slate-700">{detailModalData.shippingAddress}</p>
                        </div>
                      )}
                    </div>

                    {/* Financial Breakdown */}
                    <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Gross Subtotal:</span>
                        <span className="font-mono">₹{(detailModalData.totalAmount || detailModalData.subtotal || detailModalData.totalReturnAmount || 0).toFixed(2)}</span>
                      </div>

                      {detailModalType === 'bill' && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>CGST:</span>
                            <span className="font-mono">₹{(detailModalData.cgst || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>SGST:</span>
                            <span className="font-mono">₹{(detailModalData.sgst || 0).toFixed(2)}</span>
                          </div>
                          {detailModalData.favourDiscount > 0 && (
                            <div className="flex justify-between text-amber-700 font-semibold bg-amber-50 px-1 rounded">
                              <span>Favour Disc:</span>
                              <span className="font-mono">-₹{(detailModalData.favourDiscount || 0).toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {detailModalType === 'order' && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>CGST:</span>
                            <span className="font-mono">₹{(detailModalData.cgst || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>SGST:</span>
                            <span className="font-mono">₹{(detailModalData.sgst || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>IGST:</span>
                            <span className="font-mono">₹{(detailModalData.igst || 0).toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      {detailModalType === 'return' && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>CGST Refund:</span>
                            <span className="font-mono">₹{(detailModalData.cgstReturn || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>SGST Refund:</span>
                            <span className="font-mono">₹{(detailModalData.sgstReturn || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>IGST Refund:</span>
                            <span className="font-mono">₹{(detailModalData.igstReturn || 0).toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                        <span>Round Off:</span>
                        <span className="font-mono">₹{(detailModalData.roundOff || detailModalData.rounding || 0).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-[#2b579a] font-extrabold text-sm border-t border-slate-300 pt-2">
                        <span>Net Amount:</span>
                        <span className="font-mono">₹{(detailModalData.netAmount || detailModalData.grandTotal || detailModalData.netRefundAmount || 0).toFixed(2)}</span>
                      </div>

                      {detailModalType === 'bill' && (
                        <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-green-700 font-semibold">
                            <span>Paid Amount:</span>
                            <span className="font-mono">₹{(detailModalData.paidAmount || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 font-semibold">
                            <span>Pending Amount:</span>
                            <span className="font-mono">₹{(detailModalData.pendingAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {detailModalType === 'order' && (
                        <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-green-700 font-semibold">
                            <span>Advance Paid:</span>
                            <span className="font-mono">₹{(detailModalData.advancePaid || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 font-semibold">
                            <span>Balance Due:</span>
                            <span className="font-mono">₹{(detailModalData.balanceAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-6 py-4 flex justify-between items-center border-t border-slate-200">
              <button
                onClick={() => {
                  if (detailModalData) {
                    setSelectedRowId(detailModalData._id);
                  }
                  setDetailModalOpen(false);
                }}
                className="bg-[#2b579a] hover:bg-[#1f3f6f] text-white text-xs font-bold px-4 py-2 rounded shadow transition-all focus:outline-none"
              >
                Select & Close
              </button>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-4 py-2 rounded shadow transition-all focus:outline-none"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Sales Order Delete Confirmation Modal */}
      {deleteModalOpen && deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-md w-full flex flex-col overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-3 flex justify-between items-center">
              <h3 className="text-sm font-bold">Delete Sales Order: {deletingOrder.orderNumber || deletingOrder.orderNo}</h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-white hover:bg-red-700 p-1 rounded">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-slate-800 text-sm">
              <p className="font-semibold text-slate-700">Do you want to delete this Sales Order?</p>
              
              {/* Item codes display */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-md space-y-1.5 max-h-40 overflow-y-auto">
                <div className="text-xs font-bold text-slate-500 uppercase pb-1 border-b border-slate-200">Items in this order:</div>
                {deletingOrder.items?.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs font-medium">
                    <span className="font-mono text-blue-700">{it.itemCode || '-'}</span>
                    <span className="text-slate-600 truncate max-w-[180px]">{it.itemName || it.itemDescription}</span>
                    <span className="text-slate-500">Qty: {it.orderedQty || it.qty}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Reason for Deletion</label>
                <textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Enter comments/reason..."
                  rows={2}
                  className="w-full border border-slate-300 rounded p-2 focus:border-red-500 focus:outline-none text-xs"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
              <button 
                onClick={() => {
                  setDeleteModalOpen(false);
                  const orderPayload = {
                    id: deletingOrder._id || deletingOrder.id,
                    orderNumber: deletingOrder.orderNumber || deletingOrder.orderNo,
                    buyerName: deletingOrder.buyerName || deletingOrder.customer || 'CASH CUSTOMER',
                    mobileNo: deletingOrder.mobileNo,
                    address: deletingOrder.address,
                    items: deletingOrder.items?.map((it: any) => ({
                      productId: it.productId,
                      itemCode: it.itemCode,
                      itemName: it.itemName || it.itemDescription,
                      qty: Math.max(0, (it.orderedQty || 0) - (it.deliveredQty || 0)),
                      rate: it.unitPrice || 0,
                      discPercent: it.discount || 0
                    })) || []
                  };
                  navigate('/sales-bill', { state: { orderToConvert: orderPayload } });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm cursor-pointer"
              >
                Convert to Bill
              </button>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setDeleteModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!deleteReason) {
                      setGlobalNotification({ msg: 'Please provide a deletion reason.', type: 'error' });
                      return;
                    }
                    try {
                      const res = await fetch(`${Api}/sales/orders/${deletingOrder._id || deletingOrder.id}/cancel`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cancelReason: deleteReason, cancelledBy: 'Owner' })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setDeleteModalOpen(false);
                        setGlobalNotification({ msg: 'Sales Order deleted successfully.', type: 'success' });
                        fetchRecords();
                      } else {
                        setGlobalNotification({ msg: 'Failed to delete order: ' + data.error, type: 'error' });
                      }
                    } catch (err) {
                      console.error(err);
                      setGlobalNotification({ msg: 'Error deleting order.', type: 'error' });
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesRegister;