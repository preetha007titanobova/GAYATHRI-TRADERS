import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Calendar, Package, FileText, Search, ArrowLeft, Eye } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from '../components/Modal';

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
  uom?: string;
  purchaseRate?: number;
  price?: number;
  stock?: number;
  openingBalance?: number;
  movements?: StockMove[];
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

  // View state: 'summary' shows all products table, 'ledger' shows selected product details
  const [viewMode, setViewMode] = useState<'summary' | 'ledger'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [reportData, setReportData] = useState<Product[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedItem, setSelectedItem] = useState('');
  
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  const [preset, setPreset] = useState('fin-year');

  // Local storage state
  const [localPurchaseBills, setLocalPurchaseBills] = useState<any[]>([]);
  const [damages, setDamages] = useState<Record<string, { qty: number, reason: string }>>({});
  
  // Damages modal state
  const [isDmgModalOpen, setIsDmgModalOpen] = useState(false);
  const [selectedRowForDmg, setSelectedRowForDmg] = useState<StockMove | null>(null);
  const [tempDmgQty, setTempDmgQty] = useState(0);
  const [tempDmgReason, setTempDmgReason] = useState('');

  const activeItem = useMemo(() => {
    return reportData.find(i => (i.id || i._id) === selectedItem);
  }, [reportData, selectedItem]);

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

  // Fetch report data on mount
  const fetchReportData = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch(`${Api}/products/stock-register-report`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        if (data.length > 0 && !selectedItem) {
          setSelectedItem(data[0].id || data[0]._id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch stock register report", err);
      setGlobalNotification({ msg: 'Failed to retrieve stock data.', type: 'error' });
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Sync damages and local purchase bills from localStorage
  const syncLocalStorage = () => {
    const storedDmg = localStorage.getItem('billing_damages');
    if (storedDmg) {
      try {
        setDamages(JSON.parse(storedDmg));
      } catch (e) {
        console.error("Error parsing billing_damages", e);
      }
    }
    const storedBills = localStorage.getItem('billing_purchase_bills');
    if (storedBills) {
      try {
        setLocalPurchaseBills(JSON.parse(storedBills));
      } catch (e) {
        console.error("Error parsing billing_purchase_bills", e);
      }
    }
  };

  useEffect(() => {
    syncLocalStorage();
    // Add event listener for updates across tabs
    window.addEventListener('storage', syncLocalStorage);
    return () => window.removeEventListener('storage', syncLocalStorage);
  }, []);

  // Safe date helper to format movements date reliably
  const getMoveDateStr = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Compute calculated metrics (opening, inward, outward, damages, closing, rows) for a product
  const getProductLedgerData = (product: Product) => {
    const itemCode = product.itemCode;
    const name = product.name;

    // Get local purchase bills
    const localPurchaseMovements: StockMove[] = [];
    if (localPurchaseBills.length > 0) {
      localPurchaseBills.forEach((bill: any) => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((pItem: any) => {
            const isMatch = (itemCode && pItem.itemCode === itemCode) ||
                            (name && pItem.itemDesc?.toLowerCase() === name.toLowerCase());
            if (isMatch) {
              localPurchaseMovements.push({
                id: `local-pb-${bill.voucherNo}-${pItem.itemCode || pItem.itemDesc}`,
                date: bill.date,
                vchType: 'Purchase',
                vchNo: bill.voucherNo,
                particulars: bill.supplierName || 'Supplier',
                inward: Number(pItem.qty) || 0,
                outward: 0
              });
            }
          });
        }
      });
    }

    const dbMovements = product.movements || [];
    const combinedMovements = [...dbMovements, ...localPurchaseMovements];
    combinedMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter movements by date safely
    const priorMoves = combinedMovements.filter(m => {
      const mDateStr = getMoveDateStr(m.date);
      return mDateStr && mDateStr < fromDate;
    });

    const periodMoves = combinedMovements.filter(m => {
      const mDateStr = getMoveDateStr(m.date);
      return mDateStr && mDateStr >= fromDate && mDateStr <= toDate;
    });

    // Opening stock calculation
    let currentBal = product.openingBalance || 0;
    priorMoves.forEach(m => {
      const dmg = damages[m.id]?.qty || 0;
      currentBal += m.inward;
      currentBal -= m.outward;
      currentBal -= dmg;
    });
    const openingStock = currentBal;

    // Period calculations
    let inward = 0;
    let outward = 0;
    let damagesQty = 0;

    const rowsWithBal = periodMoves.map(m => {
      const dmg = damages[m.id]?.qty || 0;
      currentBal += m.inward;
      currentBal -= m.outward;
      currentBal -= dmg;

      inward += m.inward;
      outward += m.outward;
      damagesQty += dmg;

      return {
        ...m,
        balance: currentBal,
        damageQty: dmg,
        damageReason: damages[m.id]?.reason || ''
      };
    });

    return {
      openingStock,
      inward,
      outward,
      damages: damagesQty,
      closingStock: currentBal,
      rows: rowsWithBal
    };
  };

  // Compile calculations for all products matching search criteria
  const processedProducts = useMemo(() => {
    return reportData.map(product => {
      const ledger = getProductLedgerData(product);
      return {
        ...product,
        ...ledger
      };
    });
  }, [reportData, localPurchaseBills, damages, fromDate, toDate]);

  const filteredProducts = useMemo(() => {
    return processedProducts.filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.itemCode?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.department?.toLowerCase().includes(q) ||
        p.variety?.toLowerCase().includes(q) ||
        p.size?.toLowerCase().includes(q)
      );
    });
  }, [processedProducts, searchQuery]);

  // Compute column totals for the summary view footer
  const summaryTotals = useMemo(() => {
    return filteredProducts.reduce((acc, p) => {
      acc.opening += p.openingStock || 0;
      acc.inward += p.inward || 0;
      acc.outward += p.outward || 0;
      acc.damages += p.damages || 0;
      acc.closing += p.closingStock || 0;
      return acc;
    }, { opening: 0, inward: 0, outward: 0, damages: 0, closing: 0 });
  }, [filteredProducts]);

  // Selected product's detailed ledger
  const activeLedger = useMemo(() => {
    if (!activeItem) return { openingStock: 0, inward: 0, outward: 0, damages: 0, closingStock: 0, rows: [] };
    return getProductLedgerData(activeItem);
  }, [activeItem, localPurchaseBills, damages, fromDate, toDate]);

  // PDF Generation & WhatsApp Share Logic
  const downloadSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Stock Register Summary Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22);

    const headers = ["Item Code", "Item Name", "Category", "Variety", "Size", "Opening", "Inward", "Outward", "Damages", "Closing"];
    const rows = filteredProducts.map(p => [
      p.itemCode || '',
      p.name || '',
      p.department || '',
      p.variety || '',
      p.size || '',
      p.openingStock.toString(),
      p.inward.toString(),
      p.outward.toString(),
      p.damages.toString(),
      p.closingStock.toString()
    ]);

    rows.push([
      'TOTAL',
      `${filteredProducts.length} Items`,
      '', '', '',
      summaryTotals.opening.toString(),
      summaryTotals.inward.toString(),
      summaryTotals.outward.toString(),
      summaryTotals.damages.toString(),
      summaryTotals.closing.toString()
    ]);

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    doc.save(`Stock_Register_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadLedgerPDF = () => {
    if (!activeItem) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Product Stock Register Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Item: [${activeItem.itemCode}] ${activeItem.name} | Period: ${fromDate} to ${toDate}`, 14, 22);

    const headers = ["Date", "Vch Type", "Vch No.", "Particulars", "Inward Qty", "Outward Qty", "Running Bal."];
    const rows = activeLedger.rows.map(row => {
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

    doc.save(`Stock_Ledger_${activeItem.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const [sharing, setSharing] = useState(false);

  const handleShareSummaryWhatsApp = async () => {
    if (sharing) return;
    setSharing(true);
    setGlobalNotification({ msg: 'Generating PDF and preparing WhatsApp share...', type: 'info' });
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Stock Register Summary Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22);

      const headers = ["Item Code", "Item Name", "Category", "Variety", "Size", "Opening", "Inward", "Outward", "Damages", "Closing"];
      const rows = filteredProducts.map(p => [
        p.itemCode || '',
        p.name || '',
        p.department || '',
        p.variety || '',
        p.size || '',
        p.openingStock.toString(),
        p.inward.toString(),
        p.outward.toString(),
        p.damages.toString(),
        p.closingStock.toString()
      ]);

      rows.push([
        'TOTAL',
        `${filteredProducts.length} Items`,
        '', '', '',
        summaryTotals.opening.toString(),
        summaryTotals.inward.toString(),
        summaryTotals.outward.toString(),
        summaryTotals.damages.toString(),
        summaryTotals.closing.toString()
      ]);

      autoTable(doc, {
        startY: 26,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Stock_Register_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const res = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: pdfBase64, filename })
      });

      if (!res.ok) throw new Error('Failed to upload PDF report');
      const resData = await res.json();
      if (!resData.success || !resData.pdfUrl) throw new Error('PDF upload returned unsuccessful');

      const whatsappText = `*Sri Gayathri Traders - Stock Register Summary*\n` +
                           `*Period:* ${fromDate} to ${toDate}\n` +
                           `*Total Items:* ${filteredProducts.length}\n` +
                           `*Total Opening:* ${summaryTotals.opening}\n` +
                           `*Total Inward:* ${summaryTotals.inward}\n` +
                           `*Total Outward:* ${summaryTotals.outward}\n` +
                           `*Total Damages:* ${summaryTotals.damages}\n` +
                           `*Total Closing:* ${summaryTotals.closing}\n\n` +
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

  const handleShareLedgerWhatsApp = async () => {
    if (sharing) return;
    if (!activeItem) return;
    setSharing(true);
    setGlobalNotification({ msg: 'Generating PDF and preparing WhatsApp share...', type: 'info' });
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Product Stock Register Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Item: [${activeItem.itemCode}] ${activeItem.name} | Period: ${fromDate} to ${toDate}`, 14, 22);

      const headers = ["Date", "Vch Type", "Vch No.", "Particulars", "Inward Qty", "Outward Qty", "Running Bal."];
      const rows = activeLedger.rows.map(row => {
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
      const filename = `Stock_Ledger_${activeItem.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
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
                           `*Closing Stock:* ${activeLedger.closingStock}\n\n` +
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
      },
      onFind: () => {
        const searchInput = document.getElementById('summary-search-input');
        if (searchInput) searchInput.focus();
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const handleOpenDamagesModal = (row: any) => {
    setSelectedRowForDmg(row);
    const existing = damages[row.id] || { qty: 0, reason: '' };
    setTempDmgQty(existing.qty);
    setTempDmgReason(existing.reason);
    setIsDmgModalOpen(true);
  };

  const handleSaveDamages = async () => {
    if (!selectedRowForDmg || !activeItem) return;

    const prevQty = damages[selectedRowForDmg.id]?.qty || 0;
    const newQty = Number(tempDmgQty) || 0;
    const adjustment = prevQty - newQty;

    const updatedDamages = {
      ...damages,
      [selectedRowForDmg.id]: {
        qty: newQty,
        reason: tempDmgReason,
        productId: activeItem.id || activeItem._id,
        itemCode: activeItem.itemCode
      }
    };

    if (newQty <= 0) {
      delete updatedDamages[selectedRowForDmg.id];
    }

    try {
      const updatedProduct = {
        ...activeItem,
        price: activeItem.price || 0,
        stock: (activeItem.stock || 0) + adjustment
      };

      const res = await fetch(`${Api}/products/${activeItem.id || activeItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });

      if (!res.ok) {
        throw new Error('Failed to update product stock in DB');
      }

      localStorage.setItem('billing_damages', JSON.stringify(updatedDamages));
      setDamages(updatedDamages);
      
      setReportData(prev => prev.map(p => {
        if ((p.id || p._id) === (activeItem.id || activeItem._id)) {
          return { ...p, stock: (p.stock || 0) + adjustment };
        }
        return p;
      }));

      setGlobalNotification({ msg: `Damages of ${newQty} recorded successfully!`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: err.message || 'Failed to update damages.', type: 'error' });
    } finally {
      setIsDmgModalOpen(false);
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded border border-gray-300">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                viewMode === 'summary'
                  ? 'bg-[#2b579a] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              All Products Summary
            </button>
            <button
              onClick={() => {
                if (activeItem) setViewMode('ledger');
              }}
              disabled={!activeItem}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                !activeItem ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                viewMode === 'ledger'
                  ? 'bg-[#2b579a] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Detailed Ledger
            </button>
          </div>

          {/* Common Filter Search Input */}
          {viewMode === 'summary' ? (
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
              <Search size={16} className="text-gray-400" />
              <input
                id="summary-search-input"
                type="text"
                placeholder="Search code, name, category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm focus:outline-none w-64 placeholder-gray-400 font-medium text-gray-700"
              />
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1 rounded-md shadow-sm">
               <div className="bg-[#2b579a] p-1.5 rounded text-white">
                 <Package size={14} />
               </div>
               <select 
                 value={selectedItem} 
                 onChange={e => setSelectedItem(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none w-64 pr-2 cursor-pointer"
               >
                 {reportData.map(i => {
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
            </div>
          )}
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
            onClick={viewMode === 'summary' ? downloadSummaryPDF : downloadLedgerPDF}
            className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium rounded-md hover:bg-emerald-700 shadow border border-emerald-700 transition-colors mr-2"
          >
            Download PDF
          </button>
          <button
            onClick={viewMode === 'summary' ? handleShareSummaryWhatsApp : handleShareLedgerWhatsApp}
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
        
        {viewMode === 'summary' ? (
          /* SUMMARY VIEW: LIST ALL PRODUCTS */
          <>
            <div className="bg-[#f8f9fa] border-b border-gray-300 p-2 flex justify-between items-center px-6 shadow-sm z-10">
               <div className="font-bold text-gray-700 text-sm uppercase tracking-wider">
                 All Products Stock Register Summary
               </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm border-collapse min-w-max">
                <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Item Code</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Item Name</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32">Category</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32">Variety</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-center">Size</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right bg-[#142d54]/25">Opening Stock</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-green-300">Qty In (Inward)</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-red-300">Qty Out (Outward)</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-orange-300">Damages</th>
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right bg-[#142d54]/25">Closing Stock</th>
                    <th className="p-2 text-xs font-semibold w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingReport ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-gray-500 font-bold">
                        Loading products register data...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center">
                          <Package size={32} className="mb-2 opacity-50" />
                          <p className="italic text-sm">No items found matching search criteria.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => (
                      <tr 
                        key={p.id || p._id || idx} 
                        onClick={() => {
                          setSelectedItem(p.id || p._id || '');
                          setViewMode('ledger');
                        }}
                        className={`border-b border-gray-200 transition-colors cursor-pointer ${
                          idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-[#fcfdfd] hover:bg-blue-50/40'
                        }`}
                      >
                        <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{p.itemCode}</td>
                        <td className="border-r border-gray-200 p-2 text-gray-800 font-semibold">{p.name}</td>
                        <td className="border-r border-gray-200 p-2 text-xs text-gray-600 font-medium">{p.department || '-'}</td>
                        <td className="border-r border-gray-200 p-2 text-xs text-gray-600 font-medium">{p.variety || '-'}</td>
                        <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-600 font-medium">{p.size || '-'}</td>
                        
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-gray-700 bg-gray-50/30">{p.openingStock}</td>
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-green-600 bg-green-50/20 font-bold">
                          {p.inward > 0 ? `+${p.inward}` : ''}
                        </td>
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-red-600 bg-red-50/20 font-bold">
                          {p.outward > 0 ? `-${p.outward}` : ''}
                        </td>
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-orange-600 bg-orange-50/15">
                          {p.damages > 0 ? p.damages : ''}
                        </td>
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-blue-700 bg-blue-50/20 font-black">{p.closingStock}</td>
                        
                        <td className="p-2 text-center">
                          <button
                            onClick={() => {
                              setSelectedItem(p.id || p._id || '');
                              setViewMode('ledger');
                            }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-bold inline-flex items-center space-x-1 transition-colors"
                            title="View Detailed Ledger"
                          >
                            <Eye size={12} />
                            <span>Ledger</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SUMMARY FOOTER */}
            <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
              <div className="text-sm font-bold text-blue-200">
                Total Products: {filteredProducts.length}
              </div>

              <div className="flex space-x-4 items-center">
                <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] shadow-inner text-xs font-bold text-blue-200">
                  <span className="uppercase mr-2">Total Op:</span>
                  <span className="font-mono text-sm font-black text-white">{summaryTotals.opening}</span>
                </div>
                <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] shadow-inner text-xs font-bold text-blue-200">
                  <span className="uppercase mr-2">Total In:</span>
                  <span className="font-mono text-sm font-black text-green-300">+{summaryTotals.inward}</span>
                </div>
                <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] shadow-inner text-xs font-bold text-blue-200">
                  <span className="uppercase mr-2">Total Out:</span>
                  <span className="font-mono text-sm font-black text-red-300">-{summaryTotals.outward}</span>
                </div>
                <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] shadow-inner text-xs font-bold text-blue-200">
                  <span className="uppercase mr-2">Total Dmg:</span>
                  <span className="font-mono text-sm font-black text-orange-300">{summaryTotals.damages}</span>
                </div>
                <div className="flex items-center bg-[#142d54] px-5 py-1.5 rounded border border-[#0d1e38] shadow-inner text-xs font-bold text-blue-200">
                  <span className="uppercase mr-2">Total Cl:</span>
                  <span className="font-mono text-sm font-black text-yellow-300">{summaryTotals.closing}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* LEDGER VIEW: DETAILED STOCK MOVEMENTS OF ACTIVE PRODUCT */
          <>
            <div className="bg-[#f8f9fa] border-b border-gray-300 p-2 flex justify-between items-center px-6 shadow-sm z-10">
               <div className="flex items-center space-x-2">
                 <button
                   onClick={() => setViewMode('summary')}
                   className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1 rounded transition-colors mr-2"
                   title="Back to Products List"
                 >
                   <ArrowLeft size={16} />
                 </button>
                 <div className="font-bold text-gray-700 text-sm uppercase tracking-wider">
                   Ledger: <span className="text-blue-700">{activeItem?.name || '...'}</span>
                 </div>
               </div>
               <div className="bg-white border border-gray-300 px-4 py-1 rounded shadow-inner text-sm font-bold">
                 Opening Stock: <span className="font-mono text-lg ml-2">{activeLedger.openingStock}</span>
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
                    <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right text-orange-300">Damages</th>
                    <th className="p-2 text-xs font-semibold w-32 text-right text-yellow-300">Running Bal.</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLedger.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center">
                          <FileText size={32} className="mb-2 opacity-50" />
                          <p className="italic text-sm">No stock movements found for this period.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeLedger.rows.map((row: any, idx) => {
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
                          <td 
                            className="border-r border-gray-200 p-2 text-right font-mono font-bold text-orange-600 bg-orange-50/10 cursor-pointer hover:bg-orange-100/30"
                            onClick={() => handleOpenDamagesModal(row)}
                            title={row.damageReason ? `Reason: ${row.damageReason}` : 'Click to enter damages'}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 italic max-w-[90px] truncate">{row.damageReason}</span>
                              <span>{row.damageQty > 0 ? row.damageQty : '-'}</span>
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono font-black text-gray-900 bg-yellow-50/20">{row.balance}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* LEDGER FOOTER */}
            <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-end items-center text-white flex-shrink-0 z-20">
              <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
                 <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Closing Stock</span>
                 <span className="font-mono text-2xl font-black text-yellow-300 drop-shadow-md">{activeLedger.closingStock}</span>
              </div>
            </div>
          </>
        )}

      </div>

      {/* DAMAGES ENTRY MODAL */}
      <Modal
        isOpen={isDmgModalOpen}
        onClose={() => setIsDmgModalOpen(false)}
        title={`Enter Damages - ${selectedRowForDmg?.vchNo || ''}`}
      >
        <div className="flex flex-col space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-3 rounded text-orange-800 text-xs font-semibold">
            Product: <span className="font-bold">{activeItem?.name}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Damaged Quantity</label>
            <input
              type="number"
              min="0"
              value={tempDmgQty}
              onChange={e => setTempDmgQty(Number(e.target.value) || 0)}
              className="w-full border border-gray-400 p-2 rounded text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Damage</label>
            <textarea
              value={tempDmgReason}
              onChange={e => setTempDmgReason(e.target.value)}
              placeholder="e.g. Expired, mice damage, torn packing..."
              className="w-full border border-gray-400 p-2 rounded text-sm focus:border-blue-500 focus:outline-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setIsDmgModalOpen(false)}
              className="bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDamages}
              className="bg-blue-600 border border-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors shadow font-bold"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default StockRegister;
