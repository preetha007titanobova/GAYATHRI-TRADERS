import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search, Calendar, Filter, FileText, AlertCircle, Eye, Edit, Trash2, CheckSquare } from 'lucide-react';
import Modal from '../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Api from '../Api';
import { applyRupeeFont } from '../utils/pdfFontLoader';
import { sendWhatsAppTextMessage, getRegisteredShopName } from '../utils/whatsappHelper';

// --- INDIAN TIME FORMATTING HELPERS ---
const formatIndianDateTime = (dateInput?: string | Date) => {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const second = parts.find(p => p.type === 'second')?.value || '';
    
    return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
  } catch (e) {
    return String(dateInput);
  }
};

const formatIndianDate = (dateInput?: string | Date) => {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    
    return `${day}-${month}-${year}`;
  } catch (e) {
    return String(dateInput);
  }
};

const parseMeasurement = (weightStr?: string, unitStr?: string) => {
  if (!weightStr) return { val: 0, category: 'none', unit: '' };
  const str = String(weightStr).trim().toLowerCase();
  let numVal = parseFloat(str.replace(/[^\d.]/g, ''));
  if (isNaN(numVal) || numVal <= 0) return { val: 0, category: 'none', unit: '' };

  let unit = (unitStr || '').trim().toLowerCase();
  
  if (!unit) {
    if (str.includes('quintal')) unit = 'quintal';
    else if (str.includes('kilolitre') || str.includes('kl')) unit = 'kilolitre';
    else if (str.includes('litre') || str.includes('liter')) unit = 'litre';
    else if (str.includes('ml')) unit = 'ml';
    else if (str.includes('metre') || str.includes('meter')) unit = 'metre';
    else if (str.includes('cm')) unit = 'cm';
    else if (str.includes('mm')) unit = 'mm';
    else if (str.includes('ton')) unit = 'ton';
    else if (str.includes('kg')) unit = 'kg';
    else if (str.includes('mg')) unit = 'mg';
    else if (str.includes('g') && !str.includes('kg')) unit = 'g';
    else if (str.includes('piece') || str.includes('pcs')) unit = 'piece';
    else if (str.includes('box')) unit = 'box';
    else if (str.includes('packet')) unit = 'packet';
    else if (str.includes('bottle')) unit = 'bottle';
    else if (str.includes('can')) unit = 'can';
    else if (str.includes('dozen')) unit = 'dozen';
    else if (str.includes('pair')) unit = 'pair';
    else unit = 'g';
  }

  // Weight Category (base: grams)
  if (['mg', 'g', 'kg', 'quintal', 'ton'].includes(unit)) {
    let grams = numVal;
    if (unit === 'mg') grams = numVal / 1000;
    else if (unit === 'g') grams = numVal;
    else if (unit === 'kg') grams = numVal * 1000;
    else if (unit === 'quintal') grams = numVal * 100000;
    else if (unit === 'ton') grams = numVal * 1000000;
    return { val: grams, category: 'weight', unit };
  }

  // Volume Category (base: ml)
  if (['ml', 'litre', 'kilolitre'].includes(unit)) {
    let ml = numVal;
    if (unit === 'ml') ml = numVal;
    else if (unit === 'litre') ml = numVal * 1000;
    else if (unit === 'kilolitre') ml = numVal * 1000000;
    return { val: ml, category: 'volume', unit };
  }

  // Length Category (base: mm)
  if (['mm', 'cm', 'metre'].includes(unit)) {
    let mm = numVal;
    if (unit === 'mm') mm = numVal;
    else if (unit === 'cm') mm = numVal * 10;
    else if (unit === 'metre') mm = numVal * 1000;
    return { val: mm, category: 'length', unit };
  }

  // Count Category
  if (['piece', 'box', 'packet', 'bottle', 'can', 'dozen', 'pair'].includes(unit)) {
    let count = numVal;
    if (unit === 'dozen') count = numVal * 12;
    else if (unit === 'pair') count = numVal * 2;
    return { val: count, category: 'count', unit };
  }

  return { val: numVal, category: 'weight', unit: 'g' };
};

const formatTotalMeasurement = (items?: any[]): string => {
  if (!items || items.length === 0) return '-';

  const categoryTotals: { [key: string]: number } = {
    weight: 0,
    volume: 0,
    length: 0,
    count: 0
  };

  for (const item of items) {
    const qty = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
    const parsed = parseMeasurement(item.weight, item.unit);
    if (parsed.category !== 'none' && parsed.val > 0) {
      categoryTotals[parsed.category] += parsed.val * (qty || 1);
    }
  }

  const parts: string[] = [];

  if (categoryTotals.weight > 0) {
    const g = categoryTotals.weight;
    if (g >= 1000000) {
      const ton = g / 1000000;
      parts.push(Number.isInteger(ton) ? `${ton} ton` : `${ton.toFixed(2)} ton`);
    } else if (g >= 100000) {
      const q = g / 100000;
      parts.push(Number.isInteger(q) ? `${q} quintal` : `${q.toFixed(2)} quintal`);
    } else if (g >= 1000) {
      const kg = g / 1000;
      parts.push(Number.isInteger(kg) ? `${kg} Kg` : `${kg.toFixed(2)} Kg`);
    } else if (g >= 1) {
      parts.push(`${Math.round(g)} g`);
    } else {
      parts.push(`${(g * 1000).toFixed(1)} mg`);
    }
  }

  if (categoryTotals.volume > 0) {
    const ml = categoryTotals.volume;
    if (ml >= 1000000) {
      const kl = ml / 1000000;
      parts.push(Number.isInteger(kl) ? `${kl} kilolitre` : `${kl.toFixed(2)} kilolitre`);
    } else if (ml >= 1000) {
      const l = ml / 1000;
      parts.push(Number.isInteger(l) ? `${l} litre` : `${l.toFixed(2)} litre`);
    } else {
      parts.push(`${Math.round(ml)} ml`);
    }
  }

  if (categoryTotals.length > 0) {
    const mm = categoryTotals.length;
    if (mm >= 1000) {
      const m = mm / 1000;
      parts.push(Number.isInteger(m) ? `${m} metre` : `${m.toFixed(2)} metre`);
    } else if (mm >= 10) {
      const cm = mm / 10;
      parts.push(Number.isInteger(cm) ? `${cm} cm` : `${cm.toFixed(1)} cm`);
    } else {
      parts.push(`${Math.round(mm)} mm`);
    }
  }

  if (categoryTotals.count > 0) {
    parts.push(`${categoryTotals.count} Pcs`);
  }

  return parts.length > 0 ? parts.join(', ') : '-';
};

// --- DATA STRUCTURES ---
interface LineItem {
  itemCode: string;
  itemName?: string;
  itemDesc: string;
  qty: number;
  freeQty?: number;
  unit?: string;
  baseUnit?: string;
  unitsPerPack?: number;
  conversionFactor?: number;
  totalBaseQty?: number;
  rate: number;
  taxPercent: number;
  total: number;
  weight?: string;
  color?: string;
  category?: string;
  vendorItemCode?: string;
  mrp?: number;
  sellingPrice?: number;
  discount?: number;
  barcode?: string;
  discPercent?: number;
  returnedQty?: number;
  netQty?: number;
}

interface PurchaseRecord {
  id: string;
  date: string;
  voucherNo: string;
  isReturn?: boolean;
  supplierInvoiceNo: string;
  supplierInvoiceDate?: string;
  supplierName: string;
  supplierGstin: string;
  taxableAmt: number;
  cgst: number;
  sgst: number;
  igst: number;
  otherCharges: number;
  discount?: number;
  roundOff?: number;
  netPayable: number;
  status: 'Paid' | 'Partial' | 'Credit';
  type: 'Local' | 'Central';
  paymentMode: 'Cash' | 'Credit';
  items: LineItem[];
  totalQty?: number;
  returnedQty?: number;
  netQty?: number;
  returnedAmt?: number;
  returnStatus?: 'None' | 'Partially Returned' | 'Fully Returned';
  returns?: Array<{
    id: string;
    returnNo: string;
    returnDate: string;
    reason?: string;
    netReturnAmount: number;
    itemsCount: number;
  }>;
}

const PurRegister = () => {
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

  // Multi-Select & Bulk Delete State
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [deletingBulk, setDeletingBulk] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === displayedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedData.map(d => d.id));
    }
  };

  const toggleMultiSelectMode = () => {
    if (isMultiSelectMode) {
      setIsMultiSelectMode(false);
      setSelectedIds([]);
    } else {
      setIsMultiSelectMode(true);
    }
  };

  const fetchAllPurchaseRecords = async () => {
    try {
      const [billsRes, returnsRes] = await Promise.all([
        fetch(`${Api}/purchase-bills`),
        fetch(`${Api}/purchase-bills/returns`)
      ]);

      const billsData = billsRes.ok ? await billsRes.json() : [];
      const returnsData = returnsRes.ok ? await returnsRes.json() : [];

      let combined: PurchaseRecord[] = [];
      if (Array.isArray(billsData)) {
        combined = [...billsData];
      }

      if (Array.isArray(returnsData)) {
        const mappedReturns: PurchaseRecord[] = returnsData.map((ret: any) => ({
          id: ret.id || ret._id,
          isReturn: true,
          date: ret.returnDate || ret.createdAt,
          voucherNo: ret.returnNo,
          supplierInvoiceNo: ret.originalInvoice || 'N/A',
          supplierInvoiceDate: ret.returnDate,
          supplierName: ret.customerName || 'General Supplier',
          supplierGstin: ret.gstin || '',
          taxableAmt: Number(ret.grossTotal) || 0,
          cgst: Number(ret.cgst) || 0,
          sgst: Number(ret.sgst) || 0,
          igst: Number(ret.igst) || 0,
          otherCharges: Number(ret.roundOff) || 0,
          discount: 0,
          roundOff: Number(ret.roundOff) || 0,
          netPayable: -Math.abs(Number(ret.netReturnAmount) || 0),
          status: 'Paid',
          type: 'Local',
          paymentMode: ret.settlementMode || 'Cash',
          items: (ret.items || []).map((it: any) => ({
            itemCode: it.itemCode || '',
            itemName: it.itemName || it.itemDesc || it.itemCode || '',
            itemDesc: it.itemDesc || it.itemName || '',
            qty: -Math.abs(Number(it.returnQty) || 0),
            freeQty: 0,
            rate: Number(it.unitPrice) || 0,
            taxPercent: Number(it.taxPercent) || 0,
            total: -Math.abs(Number(it.totalAmt) || 0)
          })),
          totalQty: -(ret.items ? ret.items.reduce((a: number, c: any) => a + (Number(c.returnQty) || 0), 0) : 0),
          returnedQty: ret.items ? ret.items.reduce((a: number, c: any) => a + (Number(c.returnQty) || 0), 0) : 0,
          netQty: 0,
          returnedAmt: Number(ret.netReturnAmount) || 0,
          returnStatus: 'Fully Returned'
        }));
        combined = [...combined, ...mappedReturns];
      }

      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllData(combined);
      setDisplayedData(combined);
    } catch (err) {
      console.error("Error loading purchase register data:", err);
    }
  };

  const handleEditBill = (record: PurchaseRecord) => {
    setSelectedRecord(null);
    navigate('/purchase-bill', { state: { editBill: record } });
  };

  const handleDeleteBill = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this purchase bill? This will revert the physical stock of all items.")) return;
    try {
      const record = allData.find(r => r.id === id);
      const url = record?.isReturn ? `${Api}/purchase-bills/returns/${id}` : `${Api}/purchase-bills/${id}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: "Purchase Bill deleted successfully!", type: 'success' });
        setSelectedRecord(null);
        setSelectedIds(prev => prev.filter(i => i !== id));
        await fetchAllPurchaseRecords();
      } else {
        setGlobalNotification({ msg: "Failed to delete: " + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: "Network error deleting purchase bill.", type: 'error' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (bulkConfirmText.trim().toUpperCase() !== 'CONFIRM DELETE') return;
    setDeletingBulk(true);
    try {
      const deletePromises = selectedIds.map(id => {
        const record = allData.find(r => r.id === id);
        const url = record?.isReturn ? `${Api}/purchase-bills/returns/${id}` : `${Api}/purchase-bills/${id}`;
        return fetch(url, { method: 'DELETE' });
      });
      await Promise.all(deletePromises);
      setGlobalNotification({ msg: `Successfully deleted ${selectedIds.length} purchase record(s). Stock levels updated.`, type: 'success' });
      setSelectedIds([]);
      setIsMultiSelectMode(false);
      await fetchAllPurchaseRecords();
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Error performing bulk deletion.', type: 'error' });
    } finally {
      setDeletingBulk(false);
      setBulkDeleteModalOpen(false);
      setBulkConfirmText('');
    }
  };

  // Load Data on Mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [billsRes, returnsRes, suppliersRes] = await Promise.all([
          fetch(`${Api}/purchase-bills`),
          fetch(`${Api}/purchase-bills/returns`),
          fetch(`${Api}/ledgers/search?group=Suppliers`)
        ]);

        const billsData = billsRes.ok ? await billsRes.json() : [];
        const returnsData = returnsRes.ok ? await returnsRes.json() : [];
        const suppliersData = suppliersRes.ok ? await suppliersRes.json() : [];

        if (Array.isArray(suppliersData)) {
          setSuppliersList(['All', ...suppliersData.map((v: any) => v.accountName)]);
        }

        let combined: PurchaseRecord[] = [];
        if (Array.isArray(billsData)) {
          combined = [...billsData];
        }

        if (Array.isArray(returnsData)) {
          const mappedReturns: PurchaseRecord[] = returnsData.map((ret: any) => ({
            id: ret.id || ret._id,
            isReturn: true,
            date: ret.returnDate || ret.createdAt,
            voucherNo: ret.returnNo,
            supplierInvoiceNo: ret.originalInvoice || 'N/A',
            supplierInvoiceDate: ret.returnDate,
            supplierName: ret.customerName || 'General Supplier',
            supplierGstin: ret.gstin || '',
            taxableAmt: Number(ret.grossTotal) || 0,
            cgst: Number(ret.cgst) || 0,
            sgst: Number(ret.sgst) || 0,
            igst: Number(ret.igst) || 0,
            otherCharges: Number(ret.roundOff) || 0,
            discount: 0,
            roundOff: Number(ret.roundOff) || 0,
            netPayable: -Math.abs(Number(ret.netReturnAmount) || 0),
            status: 'Paid',
            type: 'Local',
            paymentMode: ret.settlementMode || 'Cash',
            items: (ret.items || []).map((it: any) => ({
              itemCode: it.itemCode || '',
              itemName: it.itemName || it.itemDesc || it.itemCode || '',
              itemDesc: it.itemDesc || it.itemName || '',
              qty: -Math.abs(Number(it.returnQty) || 0),
              freeQty: 0,
              rate: Number(it.unitPrice) || 0,
              taxPercent: Number(it.taxPercent) || 0,
              total: -Math.abs(Number(it.totalAmt) || 0)
            })),
            totalQty: -(ret.items ? ret.items.reduce((a: number, c: any) => a + (Number(c.returnQty) || 0), 0) : 0),
            returnedQty: ret.items ? ret.items.reduce((a: number, c: any) => a + (Number(c.returnQty) || 0), 0) : 0,
            netQty: 0,
            returnedAmt: Number(ret.netReturnAmount) || 0,
            returnStatus: 'Fully Returned'
          }));
          combined = [...combined, ...mappedReturns];
        }

        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAllData(combined);
        setDisplayedData(combined);
      } catch (err) {
        console.error("Error loading purchase register data:", err);
      }
    };

    fetchAllData();
  }, []);

  // --- ACTIONS ---
  useEffect(() => {
    let filtered = allData.filter(record => {
      const recDateStr = record.date ? record.date.split('T')[0] : '';
      if (recDateStr) {
        if (recDateStr < filters.fromDate || recDateStr > filters.toDate) return false;
      } else {
        const recDate = new Date(record.date);
        const from = new Date(filters.fromDate);
        const to = new Date(filters.toDate);
        if (recDate < from || recDate > to) return false;
      }

      if (filters.supplier !== 'All' && (record.supplierName || '').trim().toLowerCase() !== filters.supplier.trim().toLowerCase()) return false;
      
      if (filters.purchaseType === 'Cash' && record.paymentMode !== 'Cash') return false;
      if (filters.purchaseType === 'Credit' && record.paymentMode !== 'Credit') return false;
      if (filters.purchaseType === 'Local' && record.type !== 'Local') return false;
      if (filters.purchaseType === 'Central' && record.type !== 'Central') return false;
      if (filters.purchaseType === 'WithReturns' && (record.returnedQty || 0) <= 0) return false;
      if (filters.purchaseType === 'ReturnsOnly' && !record.isReturn) return false;

      if (filters.query) {
        const q = filters.query.toLowerCase().trim();
        const vchMatch = (record.voucherNo || '').toLowerCase().includes(q);
        const invMatch = (record.supplierInvoiceNo || '').toLowerCase().includes(q);
        const supplierMatch = (record.supplierName || '').toLowerCase().includes(q);
        const itemMatch = record.items && record.items.some(item => 
          (item.itemName || '').toLowerCase().includes(q) ||
          (item.itemCode || '').toLowerCase().includes(q) ||
          (item.itemDesc || '').toLowerCase().includes(q)
        );
        if (!vchMatch && !invMatch && !supplierMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
    setDisplayedData(filtered);
  }, [filters, allData]);

  const handleFetchReport = () => {
    setGlobalNotification({ msg: `Report updated. Displaying ${displayedData.length} records.`, type: 'success' });
    setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
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
      headStyles: { fillColor: [43, 87, 154], font: fontName },
      styles: { fontSize: 8, font: fontName },
    });

    doc.save(`Purchase_Register_${new Date().toISOString().split('T')[0]}.pdf`);
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
        headStyles: { fillColor: [43, 87, 154], font: fontName },
        styles: { fontSize: 8, font: fontName },
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Purchase_Register_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const res = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: pdfBase64, filename })
      });

      if (!res.ok) throw new Error('Failed to upload PDF report');
      const resData = await res.json();
      if (!resData.success || !resData.pdfUrl) throw new Error('PDF upload returned unsuccessful');

      const activeShopName = getRegisteredShopName();
      const whatsappText = `*${activeShopName} - Purchase Register Report*\n` +
                           `*Period:* ${filters.fromDate} to ${filters.toDate}\n` +
                           `*Supplier:* ${filters.supplier}\n` +
                           `*Total Net Payable:* ₹${totals.net.toFixed(2)}\n\n` +
                           `*Download PDF:* ${resData.pdfUrl}\n\n` +
                           `Generated automatically via ${activeShopName} Billing System.`;

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


  const downloadSingleBillPDF = async (record: PurchaseRecord) => {
    const doc = new jsPDF();
    const fontName = await applyRupeeFont(doc);
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text(`Purchase Voucher: ${record.voucherNo}`, 14, 15);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Voucher Date: ${formatIndianDateTime(record.date)}`, 14, 21);
    doc.text(`Supplier: ${record.supplierName} | GSTIN: ${record.supplierGstin || 'N/A'}`, 14, 26);
    doc.text(`Invoice No: ${record.supplierInvoiceNo || 'N/A'} | Invoice Date: ${record.supplierInvoiceDate ? formatIndianDate(record.supplierInvoiceDate) : 'N/A'}`, 14, 31);
    doc.text(`Place of Supply: ${record.type === 'Local' ? 'Tamil Nadu' : 'Interstate'}`, 14, 36);

    const headers = ["S.No", "Barcode", "Product Name", "Weight", "Qty", "Free Qty", "Rate", "GST", "Amount"];
    const rows = record.items.map((it, idx) => [
      idx + 1,
      it.itemCode || '-',
      it.itemName || it.itemDesc || '-',
      it.weight || '-',
      it.qty,
      it.freeQty || 0,
      `₹${it.rate.toFixed(2)}`,
      `${it.taxPercent}%`,
      `₹${it.total.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154], font: fontName },
      styles: { fontSize: 7.5, font: fontName },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Sub Total: ₹${record.taxableAmt.toFixed(2)}`, 135, finalY);
    doc.text(`Discount: -₹${(record.discount || 0).toFixed(2)}`, 135, finalY + 4);
    doc.text(`CGST: ₹${record.cgst.toFixed(2)}`, 135, finalY + 8);
    doc.text(`SGST: ₹${record.sgst.toFixed(2)}`, 135, finalY + 12);
    doc.text(`IGST: ₹${record.igst.toFixed(2)}`, 135, finalY + 16);
    doc.text(`Round Off: ₹${(record.roundOff || record.otherCharges || 0).toFixed(2)}`, 135, finalY + 20);
    doc.setFontSize(10.5);
    doc.setTextColor(0);
    doc.text(`Grand Total: ₹${record.netPayable.toFixed(2)}`, 135, finalY + 26);

    doc.save(`Voucher_${record.voucherNo}.pdf`);
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
            <button onClick={() => setQuickDate('Today')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded cursor-pointer">Today</button>
            <button onClick={() => setQuickDate('ThisMonth')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded cursor-pointer">This Month</button>
            <button onClick={() => setQuickDate('ThisFY')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded cursor-pointer">This FY</button>
            
            <button
              onClick={toggleMultiSelectMode}
              className={`text-xs px-2.5 py-1 rounded shadow border transition-colors flex items-center gap-1 font-bold cursor-pointer ${
                isMultiSelectMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                  : 'bg-[#2b579a] hover:bg-[#1f3f6f] text-white border-blue-900'
              }`}
            >
              <CheckSquare size={13} />
              <span>{isMultiSelectMode ? 'Cancel Selection' : 'Select Multiple'}</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  setBulkConfirmText('');
                  setBulkDeleteModalOpen(true);
                }}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded shadow border border-red-800 transition-colors flex items-center gap-1 cursor-pointer animate-in fade-in duration-150"
              >
                <Trash2 size={13} />
                <span>Bulk Delete ({selectedIds.length})</span>
              </button>
            )}

            <button onClick={downloadPDF} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded shadow border border-emerald-800 transition-colors cursor-pointer">Download PDF</button>
            <button 
              onClick={handleShareWhatsApp} 
              disabled={sharing}
              className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold px-3 py-1 rounded shadow border border-green-800 transition-colors flex items-center cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.079-2.865-6.93C16.368 2.025 13.91 1.006 11.298 1.006c-5.408 0-9.81 4.398-9.813 9.802-.002 1.83.479 3.618 1.393 5.17l-.997 3.642 3.734-.978zM17.15 13.563c-.3-.15-1.771-.875-2.04-.972-.269-.099-.465-.148-.659.15-.195.297-.753.971-.922 1.168-.169.197-.337.221-.637.072-.3-.15-1.264-.467-2.408-1.486-.89-.794-1.49-1.775-1.665-2.072-.175-.297-.019-.458.131-.606.134-.133.3-.347.449-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.659-1.591-.903-2.176-.237-.573-.478-.495-.659-.504-.17-.008-.365-.01-.56-.01s-.51.074-.777.363c-.266.289-1.016.992-1.016 2.42 0 1.427 1.039 2.805 1.182 2.996.143.19 2.043 3.12 4.949 4.377.691.299 1.23.478 1.651.611.693.22 1.325.189 1.822.115.556-.083 1.771-.724 2.019-1.422.25-.698.25-1.299.176-1.422-.075-.123-.269-.197-.569-.347z"/>
              </svg>
              {sharing ? 'Sharing...' : 'Share'}
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
            <label className="block text-xs font-bold text-gray-700 mb-1">Supplier Search</label>
            <select value={filters.supplier} onChange={e => setFilters({...filters, supplier: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              {suppliersList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center"><Filter size={12} className="mr-1"/> Purchase Type</label>
            <select value={filters.purchaseType} onChange={e => setFilters({...filters, purchaseType: e.target.value})} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white">
              <option value="All">All Transactions</option>
              <option value="WithReturns">Bills With Returns</option>
              <option value="ReturnsOnly">Debit Notes / Returns Only</option>
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
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
          <div className="col-span-1">
            <button onClick={handleFetchReport} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-sm shadow flex items-center justify-center transition-colors">
              Fetch
            </button>
          </div>
        </div>
      </div>

      {/* DATA GRID */}
      <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm relative overflow-hidden rounded">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-[#2b579a] text-white sticky top-0 z-10 shadow-sm text-xs font-semibold">
              <tr>
                {isMultiSelectMode && (
                  <th className="border-r border-[#1e3f70] p-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={displayedData.length > 0 && selectedIds.length === displayedData.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer accent-blue-400"
                      title="Select / Deselect All"
                    />
                  </th>
                )}
                <th className="border-r border-[#1e3f70] p-2.5 w-12 text-center">S.No</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-36">Voucher No</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-28 text-center">Date</th>
                <th className="border-r border-[#1e3f70] p-2.5">Vendor Name</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-24 text-center bg-indigo-800">Total Weight</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-24 text-center bg-blue-800">Purchased Qty</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-28 text-center bg-amber-700">Returned Qty</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-28 text-center bg-emerald-700 font-bold">Net Stock Qty</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-36 text-center">Return Status</th>
                <th className="border-r border-[#1e3f70] p-2.5 w-32 text-right">Net Payable</th>
                <th className="p-2.5 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan={isMultiSelectMode ? 12 : 11} className="p-16 text-center text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                       <FileText className="w-12 h-12 text-gray-300 mb-3" />
                       <p className="text-xl font-medium text-gray-400">No purchase records found</p>
                       <p className="text-sm mt-1">Add a new purchase bill, or adjust your date range/filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedData.map((row, idx) => {
                  const purchasedQty = row.items && row.items.length > 0 
                    ? row.items.reduce((acc, curr) => acc + (Number(curr.qty) || 0) + (Number(curr.freeQty) || 0), 0)
                    : (row.totalQty || 0);
                  const retQty = row.returnedQty || 0;
                  const netStockQty = row.netQty ?? Math.max(0, purchasedQty - retQty);
                  const rStatus = row.returnStatus || (retQty > 0 ? (netStockQty <= 0 ? 'Fully Returned' : 'Partially Returned') : 'None');
                  const formattedWeight = formatTotalMeasurement(row.items);
                  const isSelected = selectedIds.includes(row.id);

                  const purchasedBaseTotal = row.items && row.items.length > 0
                    ? row.items.reduce((acc, curr) => {
                        const conv = Number(curr.unitsPerPack || curr.conversionFactor) > 0 ? Number(curr.unitsPerPack || curr.conversionFactor) : 1;
                        return acc + (curr.totalBaseQty || (((Number(curr.qty) || 0) + (Number(curr.freeQty) || 0)) * conv));
                      }, 0)
                    : purchasedQty;

                  const retBaseTotal = row.items && row.items.length > 0
                    ? row.items.reduce((acc, curr) => {
                        const conv = Number(curr.unitsPerPack || curr.conversionFactor) > 0 ? Number(curr.unitsPerPack || curr.conversionFactor) : 1;
                        return acc + ((curr.returnedQty || 0) * conv);
                      }, 0)
                    : retQty;

                  const netStockBaseQty = Math.max(0, purchasedBaseTotal - retBaseTotal);
                  const firstItem = row.items && row.items[0];
                  const pUnit = firstItem?.unit || 'box';
                  const bUnit = firstItem?.baseUnit || 'packet';
                  const isConverted = purchasedBaseTotal !== purchasedQty;

                  return (
                    <tr 
                      key={row.id} 
                      className={`border-b border-gray-300 transition-colors text-xs ${
                        isSelected ? 'bg-blue-50/90 font-medium' : 'hover:bg-slate-50 even:bg-gray-50/30'
                      }`}
                    >
                      {isMultiSelectMode && (
                        <td className="border-r border-gray-300 p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(row.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                          />
                        </td>
                      )}
                      <td className="border-r border-gray-300 p-2 text-center text-gray-500">{idx + 1}</td>
                      <td 
                        className="border-r border-gray-300 p-2 font-mono text-blue-700 font-bold hover:underline cursor-pointer"
                        onClick={() => setSelectedRecord(row)}
                        title="Click to view details modal"
                      >
                        {row.voucherNo}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center text-gray-600 font-mono">
                        {formatIndianDate(row.date)}
                      </td>
                      <td className="border-r border-gray-300 p-2">
                        <div className="font-bold text-gray-800 text-xs">{row.supplierName}</div>
                        {row.supplierGstin && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{row.supplierGstin}</div>}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-bold text-indigo-700 bg-indigo-50/20">
                        {formattedWeight}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-bold text-blue-700 bg-blue-50/20">
                        {isConverted ? `${purchasedQty} ${pUnit} (${purchasedBaseTotal} ${bUnit})` : `${purchasedQty} ${pUnit}`}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-bold text-amber-700 bg-amber-50/30">
                        {retQty > 0 ? (isConverted ? `-${retQty} ${pUnit} (-${retBaseTotal} ${bUnit})` : `-${retQty} ${pUnit}`) : `0 ${pUnit}`}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-extrabold text-emerald-800 bg-emerald-50/40 text-xs">
                        {isConverted ? `${netStockBaseQty} ${bUnit}` : `${netStockQty} ${pUnit}`}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center">
                        {rStatus === 'Fully Returned' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                            Fully Returned
                          </span>
                        ) : rStatus === 'Partially Returned' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                            Partially Returned
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-right font-mono font-bold text-slate-800">
                        ₹{row.netPayable.toFixed(2)}
                      </td>
                      <td className="p-2 text-center flex items-center justify-center space-x-1.5">
                        <button 
                          onClick={() => setSelectedRecord(row)}
                          className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => handleEditBill(row)}
                          className="text-indigo-600 hover:text-indigo-850 hover:bg-indigo-50 p-1 rounded transition-colors"
                          title="Edit Voucher"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteBill(row.id)}
                          className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors"
                          title="Delete Voucher"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* STICKY FOOTER TOTALS */}
        <div className="bg-[#1e3f70] text-white border-t border-[#142d54] flex-shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <table className="w-full text-right text-xs border-collapse whitespace-nowrap min-w-max">
             <tbody>
               <tr>
                 <td className="p-2 text-blue-200 font-bold uppercase tracking-widest text-xs text-left pl-4">Page Totals</td>
                 <td className="p-2 w-28 text-center font-bold text-blue-100">
                   Purchased: {displayedData.reduce((acc, curr) => acc + (curr.totalQty ?? (curr.items ? curr.items.reduce((a, c) => a + (c.qty || 0) + (c.freeQty || 0), 0) : 0)), 0)} Pcs
                 </td>
                 <td className="p-2 w-28 text-center font-bold text-amber-300">
                   Returned: -{displayedData.reduce((acc, curr) => acc + (curr.returnedQty || 0), 0)} Pcs
                 </td>
                 <td className="p-2 w-32 text-center font-black text-sm text-yellow-300 font-mono bg-blue-800">
                   Net Stock: {displayedData.reduce((acc, curr) => acc + (curr.netQty ?? ((curr.totalQty || 0) - (curr.returnedQty || 0))), 0)} Pcs
                 </td>
                 <td className="p-2 w-36 text-right font-mono font-extrabold text-sm text-white">
                   Total: ₹{totals.net.toFixed(2)}
                 </td>
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
        size="full"
      >
        {selectedRecord && (
          <div className="space-y-5 text-slate-800">
            {/* Header info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-black uppercase tracking-wider mb-0.5">Supplier Name</p>
                <p className="font-bold text-sm text-slate-800">{selectedRecord.supplierName}</p>
                {selectedRecord.supplierGstin && (
                  <p className="text-slate-500 font-mono mt-1">GSTIN: {selectedRecord.supplierGstin}</p>
                )}
              </div>
              <div>
                <p className="text-slate-400 font-black uppercase tracking-wider mb-0.5">Voucher Date</p>
                <p className="font-semibold text-slate-800">{formatIndianDateTime(selectedRecord.date)}</p>
                <p className="text-slate-400 font-black uppercase tracking-wider mt-2.5 mb-0.5">Place of Supply</p>
                <p className="font-semibold text-slate-800">{selectedRecord.type === 'Local' ? 'Tamil Nadu (Local)' : 'Central (Interstate)'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-black uppercase tracking-wider mb-0.5">Supplier Invoice No</p>
                <p className="font-bold text-slate-800 text-sm">{selectedRecord.supplierInvoiceNo || 'N/A'}</p>
                {selectedRecord.supplierInvoiceDate && (
                  <>
                    <p className="text-slate-400 font-black uppercase tracking-wider mt-2.5 mb-0.5">Invoice Date</p>
                    <p className="font-semibold text-slate-800">{formatIndianDate(selectedRecord.supplierInvoiceDate)}</p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-black uppercase tracking-wider mb-0.5">Payment Status</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm
                  ${selectedRecord.status === 'Paid' ? 'bg-green-100 text-green-700 border border-green-200' : 
                    selectedRecord.status === 'Partial' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                    'bg-red-100 text-red-700 border border-red-200'}`}
                >
                  {selectedRecord.status}
                </span>
                <p className="text-slate-400 font-black uppercase tracking-wider mt-4 mb-0.5">Payment Mode</p>
                <p className="font-bold text-indigo-700">{selectedRecord.paymentMode || 'Cash'}</p>
              </div>
            </div>

            {/* Modal Product Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead className="bg-slate-900 text-white border-b border-slate-800">
                  <tr>
                    <th className="p-2 w-8 text-center font-bold">S.No</th>
                    <th className="p-2 w-24 font-bold">Barcode</th>
                    <th className="p-2 font-bold">Product</th>
                    <th className="p-2 w-24 font-bold">Vendor Code</th>
                    <th className="p-2 w-20 font-bold text-center">Weight / Val</th>
                    <th className="p-2 w-16 font-bold text-center">Unit</th>
                    <th className="p-2 w-20 text-right font-bold bg-blue-900">Purchased</th>
                    <th className="p-2 w-20 text-right font-bold bg-amber-900">Returned</th>
                    <th className="p-2 w-20 text-right font-bold bg-emerald-900">Net Stock</th>
                    <th className="p-2 w-20 text-right font-bold">Rate</th>
                    <th className="p-2 w-20 text-right font-bold">Selling Price</th>
                    <th className="p-2 w-16 text-right font-bold">GST</th>
                    <th className="p-2 w-24 text-right font-bold bg-slate-850">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecord.items.map((it, i) => {
                    const retQty = it.returnedQty || 0;
                    const unitStr = it.unit || 'box';
                    const baseUnitStr = it.baseUnit || 'packet';
                    const convFactor = Number(it.unitsPerPack || it.conversionFactor) > 0 ? Number(it.unitsPerPack || it.conversionFactor) : 1;
                    const purchasedBase = it.totalBaseQty || (((Number(it.qty) || 0) + (Number(it.freeQty) || 0)) * convFactor);
                    const retBase = retQty * convFactor;
                    const netBaseRemaining = Math.max(0, purchasedBase - retBase);
                    const isConverted = convFactor > 1;

                    return (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-center text-slate-450">{i + 1}</td>
                        <td className="p-2 font-mono font-bold text-slate-600">{it.itemCode}</td>
                        <td className="p-2 font-semibold text-slate-800 max-w-[150px] truncate" title={it.itemName || it.itemDesc}>
                          {it.itemName || it.itemDesc || it.itemCode}
                        </td>
                        <td className="p-2 font-mono text-slate-650">{it.vendorItemCode || '-'}</td>
                        <td className="p-2 text-center font-mono font-bold text-slate-700">{it.weight || '-'}</td>
                        <td className="p-2 text-center font-semibold text-indigo-700 bg-indigo-50/30">
                          {isConverted ? `${unitStr} (${convFactor} ${baseUnitStr}/${unitStr})` : unitStr}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                          {isConverted ? `${it.qty} ${unitStr} (${purchasedBase} ${baseUnitStr})` : `${it.qty} ${unitStr}`}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                          {retQty > 0 ? (isConverted ? `-${retQty} ${unitStr} (-${retBase} ${baseUnitStr})` : `-${retQty} ${unitStr}`) : `0 ${unitStr}`}
                        </td>
                        <td className="p-2 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/40">
                          {isConverted ? `${netBaseRemaining} ${baseUnitStr}` : `${it.netQty ?? Math.max(0, it.qty - retQty)} ${unitStr}`}
                        </td>
                        <td className="p-2 text-right font-mono">₹{it.rate.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">₹{(it.sellingPrice || 0).toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{it.taxPercent}%</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 bg-slate-50/30">₹{it.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Linked Purchase Returns (Debit Notes) Panel */}
            {selectedRecord.returns && selectedRecord.returns.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-600 mr-2"></span>
                    Linked Purchase Returns (Debit Notes)
                  </h4>
                  <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    Total Refunded: ₹{(selectedRecord.returnedAmt || 0).toFixed(2)}
                  </span>
                </div>
                <div className="divide-y divide-amber-200/60 text-xs">
                  {selectedRecord.returns.map(ret => (
                    <div key={ret.id} className="py-2 flex justify-between items-center font-mono">
                      <div>
                        <span className="font-bold text-amber-950 mr-2">{ret.returnNo}</span>
                        <span className="text-amber-700 text-[11px] mr-3">({formatIndianDate(ret.returnDate)})</span>
                        <span className="text-slate-600 text-[11px] font-sans">{ret.reason ? `Reason: ${ret.reason}` : ''}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-900">₹{ret.netReturnAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals Summary Panel inside Modal */}
            <div className="flex justify-end">
              <div className="w-80 bg-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sub Total:</span>
                  <span className="font-mono font-semibold">₹ {selectedRecord.taxableAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount:</span>
                  <span className="font-mono font-semibold text-red-400">- ₹ {(selectedRecord.discount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CGST:</span>
                  <span className="font-mono font-semibold">₹ {selectedRecord.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SGST:</span>
                  <span className="font-mono font-semibold">₹ {selectedRecord.sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">IGST:</span>
                  <span className="font-mono font-semibold">₹ {selectedRecord.igst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Round Off:</span>
                  <span className="font-mono font-semibold">₹ {(selectedRecord.roundOff || selectedRecord.otherCharges || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-bold">
                  <span className="text-indigo-300 uppercase tracking-wider">Grand Total:</span>
                  <span className="text-lg text-yellow-400 font-mono">₹ {selectedRecord.netPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-4">
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleEditBill(selectedRecord)} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all text-xs active:scale-95 shadow-sm"
                >
                  Edit Purchase
                </button>
                <button 
                  onClick={() => window.print()} 
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold transition-all text-xs active:scale-95 shadow-sm"
                >
                  Print
                </button>
                <button 
                  onClick={() => downloadSingleBillPDF(selectedRecord)} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all text-xs active:scale-95 shadow-sm"
                >
                  Download PDF
                </button>
                <button 
                  onClick={() => handleDeleteBill(selectedRecord.id)} 
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-all text-xs active:scale-95 shadow-sm"
                >
                  Delete
                </button>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)} 
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-all text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* BULK DELETE CONFIRMATION MODAL */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }}>
          <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white px-4 py-3 flex justify-between items-center font-bold">
              <span className="flex items-center gap-2">
                <Trash2 size={18} />
                Bulk Delete Confirmation ({selectedIds.length} Selected)
              </span>
              <button onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }} className="text-white hover:text-red-200 text-lg font-bold leading-none cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-xs rounded">
                <p className="font-bold mb-1">⚠️ Warning: Irreversible Action!</p>
                <p>You are about to delete <strong>{selectedIds.length}</strong> purchase record(s). This will automatically adjust physical stock levels and ledger balances for all items in these vouchers.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Type <span className="font-mono text-red-600 bg-red-100 px-1 py-0.5 rounded">CONFIRM DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={bulkConfirmText}
                  onChange={(e) => setBulkConfirmText(e.target.value)}
                  placeholder="CONFIRM DELETE"
                  className="w-full border border-gray-300 p-2 rounded text-sm font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }}
                  className="px-4 py-1.5 text-xs font-bold border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={bulkConfirmText.trim().toUpperCase() !== 'CONFIRM DELETE' || deletingBulk}
                  onClick={handleConfirmBulkDelete}
                  className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded transition-colors shadow flex items-center gap-1 cursor-pointer"
                >
                  {deletingBulk ? 'Deleting...' : `Confirm Bulk Delete (${selectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurRegister;