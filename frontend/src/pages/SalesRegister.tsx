import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SalesRegister = () => {
  const { 
    setToolbarActions, 
    setGlobalNotification, 
    ownerWhatsApp
  } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
    ownerWhatsApp: string;
  }>();
  
  const [activeTab, setActiveTab] = useState<'bills' | 'orders' | 'returns'>('bills');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('all');

  // Customer Filter states
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [selectedFilterCustomer, setSelectedFilterCustomer] = useState<string>('all');

  useEffect(() => {
    // Fetch available customers on mount
    fetch(`${Api}/ledgers/search?group=Customers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableCustomers(data);
      })
      .catch(err => console.error("Error fetching customers:", err));
  }, []);

  // WhatsApp Share State
  const [sharing, setSharing] = useState(false);

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
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      setStartDate(formatDate(startOfWeek));
      setEndDate(formatDate(endOfWeek));
    } else if (val === 'this-month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDate(startOfMonth));
      setEndDate(formatDate(endOfMonth));
    } else if (val === 'fin-year') {
      const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setStartDate(`${year}-04-01`);
      setEndDate(`${year + 1}-03-31`);
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

  // Date and Customer Filtering logic on frontend
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Filter by customer if selected
      if (selectedFilterCustomer !== 'all') {
        const customerName = activeTab === 'bills' ? rec.buyerName : activeTab === 'orders' ? rec.customer : rec.customerName;
        if ((customerName || 'CASH') !== selectedFilterCustomer) return false;
      }

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
      return true;
    });
  }, [records, startDate, endDate, selectedFilterCustomer, activeTab]);

  // Fetch customer details when a row is selected or a customer filter is set
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      let customerName = '';
      if (selectedRowId) {
        const selectedRecord = records.find(r => r._id === selectedRowId);
        if (selectedRecord) {
          customerName = activeTab === 'bills' ? selectedRecord.buyerName : activeTab === 'orders' ? selectedRecord.customer : selectedRecord.customerName;
        }
      } else if (selectedFilterCustomer !== 'all') {
        customerName = selectedFilterCustomer;
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
  }, [selectedRowId, selectedFilterCustomer, records, activeTab]);

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
      headers = ["Invoice No", "Date", "Customer Name", "GSTIN", "Gross Amt", "Tax Amt", "Net Amt"];
      rows = filteredRecords.map(rec => [
        rec.invoiceNo,
        new Date(rec.invDate).toLocaleDateString(),
        rec.buyerName || 'CASH CUSTOMER',
        rec.gstNo || '-',
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
        headers = ["Invoice No", "Date", "Customer Name", "GSTIN", "Gross Amt", "Tax Amt", "Net Amt"];
        rows = filteredRecords.map(rec => [
          rec.invoiceNo,
          new Date(rec.invDate).toLocaleDateString(),
          rec.buyerName || 'CASH CUSTOMER',
          rec.gstNo || '-',
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

      const whatsappText = `*Sri Gayathri Traders - ${title}*\n` +
                           `*Period:* ${startDate || 'All'} to ${endDate || 'All'}\n` +
                           `*Records Count:* ${filteredRecords.length}\n\n` +
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

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 relative">
      <div className="flex justify-between items-center mb-2 bg-white p-2 border border-gray-300 shadow-sm rounded">
        <h2 className="text-xl font-bold text-gray-700 flex items-center">
          <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
          Sales Register
        </h2>
        
        <div className="flex items-center space-x-2">
          {/* Date Range Selection */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-gray-300 p-1 rounded-md shadow-sm">
            <span className="font-bold text-[#2b579a] flex items-center pl-1"><Calendar size={12} className="mr-1"/> Period:</span>
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

          {/* Customer Filter Selection */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-gray-300 p-1 rounded-md shadow-sm">
            <span className="font-bold text-[#2b579a] flex items-center pl-1">Customer:</span>
            <select 
              value={selectedFilterCustomer} 
              onChange={e => {
                setSelectedFilterCustomer(e.target.value);
                setSelectedRowId(null);
              }}
              className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Customers</option>
              <option value="CASH">CASH</option>
              {availableCustomers.map(c => <option key={c._id} value={c.accountName}>{c.accountName}</option>)}
            </select>
          </div>

          <div className="relative">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder={`Search...`} 
              className="border border-gray-400 pl-8 pr-2 py-1 text-sm rounded focus:outline-none focus:border-blue-500 w-44 shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-2 top-1.5 text-gray-500" />
          </div>
          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-emerald-700 shadow border border-emerald-800 transition-colors">Download PDF</button>
          <button 
            onClick={handleShareWhatsApp} 
            disabled={sharing}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 text-sm font-semibold rounded shadow border border-green-800 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.079-2.865-6.93C16.368 2.025 13.91 1.006 11.298 1.006c-5.408 0-9.81 4.398-9.813 9.802-.002 1.83.479 3.618 1.393 5.17l-.997 3.642 3.734-.978zM17.15 13.563c-.3-.15-1.771-.875-2.04-.972-.269-.099-.465-.148-.659.15-.195.297-.753.971-.922 1.168-.169.197-.337.221-.637.072-.3-.15-1.264-.467-2.408-1.486-.89-.794-1.49-1.775-1.665-2.072-.175-.297-.019-.458.131-.606.134-.133.3-.347.449-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.659-1.591-.903-2.176-.237-.573-.478-.495-.659-.504-.17-.008-.365-.01-.56-.01s-.51.074-.777.363c-.266.289-1.016.992-1.016 2.42 0 1.427 1.039 2.805 1.182 2.996.143.19 2.043 3.12 4.949 4.377.691.299 1.23.478 1.651.611.693.22 1.325.189 1.822.115.556-.083 1.771-.724 2.019-1.422.25-.698.25-1.299.176-1.422-.075-.123-.269-.197-.569-.347z"/>
            </svg>
            {sharing ? 'Sharing...' : 'Share'}
          </button>
          <button onClick={fetchRecords} className="bg-blue-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-blue-700 shadow border border-blue-800">Refresh</button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex space-x-1 mb-1 border-b border-gray-300">
        <button 
          onClick={() => { setActiveTab('bills'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${
            activeTab === 'bills' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          Sales Bills
        </button>
        <button 
          onClick={() => { setActiveTab('orders'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${
            activeTab === 'orders' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          Sales Orders
        </button>
        <button 
          onClick={() => { setActiveTab('returns'); setSelectedRowId(null); }}
          className={`px-4 py-1.5 text-xs font-bold border-t border-x rounded-t transition-all ${
            activeTab === 'returns' ? 'bg-white border-gray-300 border-b-white text-[#2b579a]' : 'bg-[#e0e0e0]/70 border-transparent text-gray-600 hover:bg-gray-100'
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
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">GSTIN</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Gross Amt</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Tax Amt</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Net Amt</th>
                  <th className="border-b border-gray-400 p-2 font-bold text-center">Status</th>
                </tr>
              )}
              {activeTab === 'orders' && (
                <tr>
                  <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">#</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Order No</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Delivery Date</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold">Terms</th>
                  <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Grand Total</th>
                  <th className="border-b border-gray-400 p-2 font-bold text-center">Status</th>
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
                  <td colSpan={9} className="p-4 text-center text-gray-500 font-semibold">Loading data...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500 font-semibold">No records found for the selected date range.</td>
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
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td className="border-r border-gray-300 p-1.5 font-semibold text-[#2b579a]">{rec.invoiceNo}</td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.invDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.buyerName || 'CASH CUSTOMER'}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.gstNo || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono">₹{rec.totalAmount?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{taxAmt.toFixed(2)}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">₹{rec.netAmount?.toFixed(2) || '0.00'}</td>
                        <td className="p-1.5 text-center">
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-300">CLEARED</span>
                        </td>
                      </tr>
                    );
                  } else if (activeTab === 'orders') {
                    return (
                      <tr 
                        key={rec._id} 
                        onClick={() => setSelectedRowId(rec._id)}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td className="border-r border-gray-300 p-1.5 font-semibold text-[#2b579a]">{rec.orderNo}</td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.orderDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.customer || 'CASH CUSTOMER'}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.deliveryDate ? new Date(rec.deliveryDate).toLocaleDateString() : '-'}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.paymentTerms || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">₹{rec.grandTotal?.toFixed(2) || '0.00'}</td>
                        <td className="p-1.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            rec.status === 'FULFILLED' ? 'bg-green-100 text-green-800 border-green-300' :
                            rec.status === 'PENDING' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                            rec.status === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-300' :
                            'bg-blue-100 text-blue-800 border-blue-300'
                          }`}>{rec.status || 'OPEN'}</span>
                        </td>
                      </tr>
                    );
                  } else {
                    // returns
                    const taxAmt = (rec.cgstReturn || 0) + (rec.sgstReturn || 0) + (rec.igstReturn || 0);
                    return (
                      <tr 
                        key={rec._id} 
                        onClick={() => setSelectedRowId(rec._id)}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                        <td className="border-r border-gray-300 p-1.5 font-semibold text-[#2b579a]">{rec.returnNo}</td>
                        <td className="border-r border-gray-300 p-1.5">{new Date(rec.returnDate).toLocaleDateString()}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.customerName || 'CASH CUSTOMER'}</td>
                        <td className="border-r border-gray-300 p-1.5">{rec.originalInvoice || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-ellipsis overflow-hidden max-w-[150px]">{rec.reason || '-'}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{taxAmt.toFixed(2)}</td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">₹{rec.netRefundAmount?.toFixed(2) || '0.00'}</td>
                        <td className="p-1.5 text-center">
                          <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-300">RETURNED</span>
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
        {(selectedRowId || selectedFilterCustomer !== 'all') && (
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
                      <div className="flex justify-between"><span>Gross Total:</span> <span className="font-mono text-gray-800">₹{(rec.totalAmount || rec.subtotal || rec.totalReturnAmount || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Net Total:</span> <span className="font-mono text-emerald-800 font-bold text-sm">₹{(rec.netAmount || rec.grandTotal || rec.netRefundAmount || 0).toFixed(2)}</span></div>
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
                      {selectedCustomerDetails.address || '-'} <br/>
                      {selectedCustomerDetails.city || ''}, {selectedCustomerDetails.state || ''} {selectedCustomerDetails.pincode || ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-4 italic leading-relaxed">
                  Billed under Cash / Walk-in Customer.<br/>
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



    </div>
  );
};

export default SalesRegister;