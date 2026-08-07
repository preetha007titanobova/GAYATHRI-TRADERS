import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLicense } from '../context/LicenseContext';
import type { ToolbarActions } from '../components/Layout';
import { Trash2, AlertCircle } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';
import Api from '../Api';

// Models
interface ReturnItem {
  id: string;
  itemCode: string;
  itemDesc: string;
  batchNo: string;
  purchasedQty: number;
  returnQty: number;
  unitPrice: number;
  discPercent: number;
  taxPercent: number;
  taxableAmt: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  totalAmt: number;
  error?: string;
}

const REASONS = [
  'Damaged Items',
  'Incorrect Items Delivered',
  'Quality Not Up to Standard',
  'Excess Quantity',
  'Price Difference',
  'Others'
];

const SETTLEMENT_MODES = [
  'Adjust in Supplier Ledger (Credit Note)',
  'Cash Refund',
  'Bank Transfer'
];

const COMPANY_STATE = 'Tamil Nadu';

const PurReturn = () => {
  const { shopName } = useLicense();
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
  }>();

  // Invoices & Saved Returns
  const [invoices, setInvoices] = useState<any[]>([]);
  const [savedReturns, setSavedReturns] = useState<any[]>([]);

  // Selection/Edit State
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  // Header State
  const [returnNo, setReturnNo] = useState('PR-1001');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState(REASONS[0]);

  // Vendor State (Derived from Invoice)
  const [vendorDetails, setVendorDetails] = useState({ name: '', gstin: '', state: '' });

  // Grid State
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = React.useRef<HTMLInputElement>(null);

  // Footer State
  const [settlementMode, setSettlementMode] = useState(SETTLEMENT_MODES[0]);

  // Load Invoices from database
  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${Api}/purchase-bills`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error("Error loading invoices", err);
    }
  };

  // Load Saved Returns from database
  const fetchSavedReturns = async () => {
    try {
      const res = await fetch(`${Api}/purchase-bills/returns`);
      if (res.ok) {
        const data = await res.json();
        setSavedReturns(data);
      }
    } catch (err) {
      console.error("Error loading purchase returns", err);
    }
  };

  // Fetch next Debit Note number from database
  const fetchNextReturnVoucher = async () => {
    try {
      const res = await fetch(`${Api}/purchase-bills/returns/next-voucher`);
      if (res.ok) {
        const data = await res.json();
        if (data.returnNo) {
          setReturnNo(data.returnNo);
        }
      }
    } catch (err) {
      console.error("Error loading next return voucher", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchSavedReturns();
    fetchNextReturnVoucher();
  }, []);

  useEffect(() => {
    if (selectedInvoiceId) {
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  }, [selectedInvoiceId]);

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInput.trim();
      if (!code) return;

      try {
        const res = await fetch(`${Api}/products/barcode/${encodeURIComponent(code)}`);
        if (!res.ok) {
          setGlobalNotification({ msg: "Product not registered in database.", type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
          setScanInput('');
          return;
        }
        const product = await res.json();
        if (product) {
          const itemIndex = items.findIndex(item =>
            item.itemCode.toUpperCase() === product.itemCode.toUpperCase()
          );

          if (itemIndex > -1) {
            const currentItem = items[itemIndex];
            if (currentItem.returnQty >= currentItem.purchasedQty) {
              setGlobalNotification({
                msg: `Cannot return more than purchased quantity (${currentItem.purchasedQty}) for ${currentItem.itemDesc}.`,
                type: 'error'
              });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
            } else {
              setItems(prev => prev.map((it, idx) => {
                if (idx === itemIndex) {
                  const updatedQty = it.returnQty + 1;
                  return calculateReturnItem({ ...it, returnQty: updatedQty }, vendorDetails.state);
                }
                return it;
              }));
              setGlobalNotification({ msg: `Scanned return item: ${product.name}`, type: 'success' });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
            }
          } else {
            setGlobalNotification({ msg: "This product was not purchased under the selected invoice.", type: 'error' });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
          }
        }
      } catch (err) {
        console.error(err);
        setGlobalNotification({ msg: "Error searching return barcode.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      } finally {
        setScanInput('');
        setTimeout(() => {
          scanInputRef.current?.focus();
        }, 100);
      }
    }
  };

  // Row Calculation Helper
  const calculateReturnItem = (item: ReturnItem, supplierState: string) => {
    const qtyToCalc = isNaN(item.returnQty) ? 0 : item.returnQty;
    const rate = isNaN(item.unitPrice) ? 0 : item.unitPrice;

    const baseVal = qtyToCalc * rate;
    const afterDisc = baseVal - (baseVal * (item.discPercent / 100));

    const isInterstate = supplierState.toLowerCase() !== COMPANY_STATE.toLowerCase();

    let igstAmt = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;

    if (isInterstate) {
      igstAmt = afterDisc * (item.taxPercent / 100);
    } else {
      cgstAmt = afterDisc * ((item.taxPercent / 2) / 100);
      sgstAmt = afterDisc * ((item.taxPercent / 2) / 100);
    }

    return {
      ...item,
      taxableAmt: afterDisc,
      cgstAmt,
      sgstAmt,
      igstAmt,
      totalAmt: afterDisc + cgstAmt + sgstAmt + igstAmt
    };
  };

  // Load items when invoice changes or when entering edit mode
  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId || inv.voucherNo === selectedInvoiceId);
      if (invoice) {
        const supplierState = invoice.type === 'Local' ? COMPANY_STATE : 'Other State';
        setVendorDetails({
          name: invoice.supplierName,
          gstin: invoice.supplierGstin || '',
          state: supplierState
        });

        const initialItems: ReturnItem[] = (invoice.items || []).map((item: any) => {
          let initialReturnQty = 0;
          if (editingReturnId) {
            const activeReturn = savedReturns.find(r => r.id === editingReturnId);
            if (activeReturn && activeReturn.items) {
              const matchedItem = activeReturn.items.find((i: any) => i.itemCode?.toLowerCase() === item.itemCode?.toLowerCase());
              if (matchedItem) {
                initialReturnQty = matchedItem.returnQty;
              }
            }
          }

          const rawItem: ReturnItem = {
            id: Math.random().toString(),
            itemCode: item.itemCode,
            itemDesc: item.itemName || item.itemDesc || '',
            batchNo: item.batchNo || 'N/A',
            purchasedQty: item.purchasedQty || item.qty || 0,
            unitPrice: item.unitPrice || item.rate || 0,
            discPercent: item.discPercent || 0,
            taxPercent: item.taxPercent || 18,
            returnQty: initialReturnQty,
            taxableAmt: 0,
            cgstAmt: 0,
            sgstAmt: 0,
            igstAmt: 0,
            totalAmt: 0
          };
          return calculateReturnItem(rawItem, supplierState);
        });
        setItems(initialItems);
      }
    } else {
      setVendorDetails({ name: '', gstin: '', state: '' });
      setItems([]);
    }
  }, [selectedInvoiceId, invoices, editingReturnId, savedReturns]);

  // Handle Return Quantities or Price changes in the grid
  const updateItem = (id: string, field: keyof ReturnItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // Validation
      if (field === 'returnQty') {
        if (value > updated.purchasedQty) {
          updated.error = 'Qty exceeds purchase';
        } else if (value < 0) {
          updated.error = 'Invalid Qty';
        } else {
          updated.error = undefined;
        }
      }

      return calculateReturnItem(updated, vendorDetails.state);
    }));
  };

  const removeRow = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Totals
  const grossTotal = items.reduce((acc, curr) => acc + curr.taxableAmt, 0);
  const totalCgst = items.reduce((acc, curr) => acc + curr.cgstAmt, 0);
  const totalSgst = items.reduce((acc, curr) => acc + curr.sgstAmt, 0);
  const totalIgst = items.reduce((acc, curr) => acc + curr.igstAmt, 0);

  const rawTotal = grossTotal + totalCgst + totalSgst + totalIgst;
  const roundedOff = Math.round(rawTotal) - rawTotal;
  const netReturnAmount = Math.round(rawTotal);

  const clearForm = () => {
    fetchNextReturnVoucher();
    setSelectedReturnId('');
    setEditingReturnId(null);
    setSelectedInvoiceId('');
    setReason(REASONS[0]);
    setSettlementMode(SETTLEMENT_MODES[0]);
  };

  // Handle Return select for editing
  const handleSelectReturn = (id: string) => {
    setSelectedReturnId(id);
    if (!id) {
      clearForm();
      return;
    }

    const ret = savedReturns.find(r => r.id === id);
    if (ret) {
      setEditingReturnId(ret.id);
      setReturnNo(ret.returnNo);
      setReturnDate(ret.returnDate ? ret.returnDate.split('T')[0] : '');
      setReason(ret.reason);
      setSettlementMode(ret.settlementMode);

      // Select the original invoice
      const matchingInv = invoices.find(inv => inv.voucherNo === ret.originalInvoice || inv.id === ret.originalInvoice);
      if (matchingInv) {
        setSelectedInvoiceId(matchingInv.id || matchingInv.voucherNo);
      }
    }
  };

  // Save/Update Return handler
  const handleSaveReturn = async () => {
    if (!selectedInvoiceId) {
      return setGlobalNotification({ msg: 'Please select an Original Purchase Invoice.', type: 'error' });
    }

    const hasErrors = items.some(i => i.error);
    if (hasErrors) {
      return setGlobalNotification({ msg: 'Please fix validation errors in the item grid before saving.', type: 'error' });
    }

    const validReturnItems = items.filter(i => i.returnQty > 0);
    if (validReturnItems.length === 0) {
      return setGlobalNotification({ msg: 'Please enter a valid return quantity for at least one item.', type: 'error' });
    }

    const invoice = invoices.find(inv => inv.id === selectedInvoiceId || inv.voucherNo === selectedInvoiceId);

    const payload = {
      returnNo,
      returnDate,
      originalInvoice: invoice?.voucherNo || selectedInvoiceId,
      customerName: vendorDetails.name,
      reason,
      settlementMode,
      grossTotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      roundOff: roundedOff,
      netReturnAmount,
      items: validReturnItems.map(i => ({
        itemCode: i.itemCode,
        itemName: i.itemDesc,
        itemDesc: i.itemDesc,
        batchNo: i.batchNo,
        purchasedQty: i.purchasedQty,
        returnQty: i.returnQty,
        unitPrice: i.unitPrice,
        taxPercent: i.taxPercent,
        discPercent: i.discPercent,
        totalAmt: i.totalAmt
      }))
    };

    try {
      const url = editingReturnId
        ? `${Api}/purchase-bills/returns/${editingReturnId}`
        : `${Api}/purchase-bills/returns`;
      const method = editingReturnId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: `Debit Note ${returnNo} saved to database successfully and stock reduced!`, type: 'success' });
        clearForm();
        fetchSavedReturns();
      } else {
        setGlobalNotification({ msg: 'Error saving purchase return: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error saving purchase return.', type: 'error' });
    }
  };

  // Delete Return Handler
  const handleDeleteReturn = async () => {
    if (!editingReturnId) {
      return setGlobalNotification({ msg: 'Please select an existing Debit Note to delete.', type: 'error' });
    }
    if (!window.confirm("Are you sure you want to delete this purchase return? This will restore the product stock.")) return;

    try {
      const res = await fetch(`${Api}/purchase-bills/returns/${editingReturnId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: 'Purchase return deleted successfully and stock restored.', type: 'success' });
        clearForm();
        fetchSavedReturns();
      } else {
        setGlobalNotification({ msg: 'Failed to delete: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error deleting purchase return.', type: 'error' });
    }
  };

  useEffect(() => {
    setToolbarActions({
      onAdd: () => {
        clearForm();
        setGlobalNotification({ msg: 'Ready for new Purchase Return.', type: 'info' });
      },
      onSave: handleSaveReturn,
      onDelete: handleDeleteReturn,
      onPrint: () => {
        setGlobalNotification({ msg: 'Printing Debit Note...', type: 'info' });
        const formattedItems = items.map(item => ({
          itemCode: item.itemCode,
          itemDesc: item.itemDesc,
          qty: item.returnQty,
          rate: item.unitPrice,
          totalAmt: item.totalAmt
        }));
        const storePhone = localStorage.getItem('close_day_whatsapp') || '';

        printReceipt({
          gridData: formattedItems,
          invoiceNo: returnNo,
          date: returnDate,
          customerName: vendorDetails.name,
          paymentMode: settlementMode,
          totalQty: items.reduce((acc, i) => acc + (i.returnQty || 0), 0),
          subTotal: grossTotal,
          cgst: totalCgst,
          sgst: totalSgst,
          totalAmount: netReturnAmount,
          storeName: shopName,
          storePhone
        });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, returnNo, selectedInvoiceId, items, editingReturnId, returnDate, vendorDetails, settlementMode, grossTotal, totalCgst, totalSgst, netReturnAmount, roundedOff]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] p-3 overflow-hidden">

      {/* Selection row for edit/delete */}
      <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-l-4 border-blue-500 p-2 shadow-md rounded-xl mb-3 flex-shrink-0 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center space-x-3 w-1/2">
          <label className="text-xs font-extrabold text-blue-900 uppercase tracking-wider whitespace-nowrap">Edit Saved Return:</label>
          <select
            value={selectedReturnId}
            onChange={e => handleSelectReturn(e.target.value)}
            className="w-full border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-1.5 rounded-lg text-sm bg-white font-bold text-gray-700 shadow-sm transition-all outline-none"
          >
            <option value="">-- New Purchase Return (Create Mode) --</option>
            {savedReturns.map(ret => (
              <option key={ret.id} value={ret.id}>{ret.returnNo} - {ret.customerName} (Refund: ₹{ret.netReturnAmount})</option>
            ))}
          </select>
        </div>
        {editingReturnId && (
          <div className="text-xs font-bold text-blue-700 bg-blue-100/85 border border-blue-200 px-3 py-1 rounded-lg animate-pulse">
            Editing Mode: {returnNo}
          </div>
        )}
      </div>

      {/* Top Metadata Header */}
      <div className="bg-white p-4 border border-gray-200 shadow-md rounded-xl mb-3 flex-shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-700 flex items-center">
            <span className="bg-gradient-to-b from-blue-500 to-indigo-600 w-2.5 h-6 mr-2.5 rounded-full block"></span>
            Purchase Return (Debit Note)
          </h2>
        </div>

        <div className="grid grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Pur Return No</label>
            <input type="text" value={returnNo} readOnly className="w-full border border-gray-200 focus:outline-none p-2 rounded-lg text-sm bg-gray-50 font-bold text-gray-700 shadow-inner" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Return Date</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-2 rounded-lg text-sm bg-white font-medium text-gray-700 shadow-sm transition-all outline-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-600 mb-1">Original Purchase Invoice No</label>
            <select value={selectedInvoiceId} onChange={e => setSelectedInvoiceId(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-2 rounded-lg text-sm bg-white font-semibold text-gray-700 shadow-sm transition-all outline-none">
              <option value="">-- Select Original Invoice --</option>
              {invoices.length === 0 ? (
                <option disabled>No saved purchase bills found</option>
              ) : (
                invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.voucherNo} (Dated: {inv.date ? inv.date.split('T')[0] : ''}) - {inv.supplierName}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Supplier Name & GSTIN</label>
            <div className="border border-gray-200 p-2 rounded-lg text-xs bg-gray-50 h-[38px] flex items-center overflow-hidden truncate font-semibold text-gray-750 shadow-inner">
              {vendorDetails.name ? (
                <span className="font-semibold text-gray-800">{vendorDetails.name} <span className="text-gray-500 font-normal ml-1">({vendorDetails.gstin})</span></span>
              ) : (
                <span className="text-gray-450">Select Invoice...</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Reason for Return</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-2 rounded-lg text-sm bg-white font-semibold text-gray-700 shadow-sm transition-all outline-none">
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Area (Flex-1 stretches to take all remaining height) */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 shadow-md relative overflow-hidden mb-3 rounded-xl">
        <div className="bg-gradient-to-r from-teal-50/80 to-emerald-50/80 p-2 border-b border-gray-200 flex items-center justify-between gap-4">
          <span className="text-xs font-extrabold text-teal-800 tracking-wider uppercase pl-2 flex items-center whitespace-nowrap">
            <span className="bg-teal-500 w-1.5 h-3.5 mr-2 rounded-full block"></span>
            Return Items
          </span>
          {selectedInvoiceId && (
            <div className="flex items-center space-x-2 flex-1 max-w-md mx-4">
              <label className="text-[11px] font-bold text-teal-900 uppercase whitespace-nowrap">Scan Return Item:</label>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Scan barcode to increment return qty..."
                className="flex-1 border border-teal-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 px-2 py-1 rounded text-xs font-mono font-bold bg-white focus:outline-none placeholder:font-sans placeholder:font-normal shadow-sm"
              />
            </div>
          )}
          {items.length > 0 && <span className="text-xs text-indigo-650 font-semibold pr-2 hidden md:block">Modifying return quantities updates totals automatically.</span>}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-blue-400/30 p-2.5 w-10 text-center text-xs font-semibold">S.No</th>
                <th className="border-r border-blue-400/30 p-2.5 w-24 text-xs font-semibold">Item Code</th>
                <th className="border-r border-blue-400/30 p-2.5 text-xs font-semibold">Item Description</th>
                <th className="border-r border-blue-400/30 p-2.5 w-20 text-xs font-semibold">Batch No</th>
                <th className="border-r border-blue-400/30 p-2.5 w-20 text-xs font-semibold text-right">Purchased<br />Qty</th>
                <th className="border-r border-blue-400/30 p-2.5 w-24 text-xs font-semibold text-right bg-blue-700/60">Return Qty</th>
                <th className="border-r border-blue-400/30 p-2.5 w-24 text-xs font-semibold text-right">Purchase Rate</th>
                <th className="border-r border-blue-400/30 p-2.5 w-16 text-xs font-semibold text-right">Disc %</th>
                <th className="border-r border-blue-400/30 p-2.5 w-16 text-xs font-semibold text-right">Tax %</th>
                <th className="border-r border-blue-400/30 p-2.5 w-24 text-xs font-semibold text-right">Taxable Amt</th>
                <th className="border-r border-blue-400/30 p-2.5 w-28 text-xs font-semibold text-right">Total Amt</th>
                <th className="p-2.5 w-10 text-center text-xs font-semibold">Del</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-16 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-blue-200 mb-3" />
                      <p className="text-lg font-bold text-gray-400">No Invoice Selected</p>
                      <p className="text-sm text-gray-400 mt-1">Please select an Original Purchase Invoice to view and return items.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-slate-50 focus-within:bg-blue-50/50 transition-colors">
                    <td className="border-r border-gray-200 p-2 text-center text-gray-400 bg-gray-50/50 font-medium">{idx + 1}</td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-50/50 text-gray-700 font-mono text-xs">{item.itemCode}</td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-50/50 text-gray-800 font-semibold">{item.itemDesc}</td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-50/50 text-gray-600 text-center font-medium">{item.batchNo}</td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-100/50 text-right font-extrabold text-gray-600">{item.purchasedQty}</td>
                    <td className={`border-r p-0 relative ${item.error ? 'border-red-500 border-2' : 'border-gray-200'}`}>
                      <input
                        type="number"
                        value={item.returnQty === 0 && !item.error ? '' : item.returnQty}
                        onChange={e => updateItem(item.id, 'returnQty', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full p-2.5 bg-yellow-50 focus:bg-white focus:outline-none text-right font-extrabold text-red-650 h-full placeholder:text-gray-300 transition-colors"
                        placeholder="0"
                        min="0"
                        max={item.purchasedQty}
                      />
                      {item.error && <span className="absolute -bottom-4 right-0 text-[9px] text-red-650 font-bold bg-white px-1 shadow rounded z-20">{item.error}</span>}
                    </td>
                    <td className="border-r border-gray-200 p-0">
                      <input
                        type="number"
                        value={item.unitPrice || ''}
                        onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-full p-2.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono font-medium"
                      />
                    </td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-50/50 text-right text-gray-500 font-medium">{item.discPercent}%</td>
                    <td className="border-r border-gray-200 p-2.5 bg-gray-50/50 text-right text-gray-500 font-medium">{item.taxPercent}%</td>
                    <td className="border-r border-gray-200 p-2.5 text-right font-mono text-gray-750 bg-gray-50/50">{item.taxableAmt.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2.5 text-right font-mono font-extrabold text-emerald-700 bg-gray-50/50">{item.totalAmt.toFixed(2)}</td>
                    <td className="p-2 text-center bg-gray-50/50">
                      <button onClick={() => removeRow(item.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remove Item">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ultra-Compact Bottom Panel (Decreased heights to maximize table area) */}
      <div className="flex space-x-3 flex-shrink-0 items-center">
        {/* Compact Settlement Mode Card */}
        <div className="flex-1 bg-white border border-gray-200 py-2 px-4 rounded-xl shadow-md flex items-center justify-between h-[52px]">
          <div className="flex items-center space-x-2 flex-1 mr-4">
            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider whitespace-nowrap">Settlement:</label>
            <select value={settlementMode} onChange={e => setSettlementMode(e.target.value)} className="w-full max-w-xs border border-gray-200 p-1 rounded-lg text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white font-bold text-gray-700 shadow-sm transition-all outline-none">
              {SETTLEMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSaveReturn}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold rounded-lg shadow-md hover:shadow-lg text-xs transition-all duration-200 transform hover:-translate-y-0.5 flex items-center space-x-1 border border-emerald-600/10"
            >
              <span>{editingReturnId ? '✓ Update' : '💾 Save'}</span>
            </button>

            <button
              onClick={clearForm}
              className="px-3.5 py-1.5 bg-white border border-gray-300 text-gray-650 hover:text-gray-900 hover:bg-gray-50 font-bold rounded-lg shadow-sm text-xs transition-all duration-200 transform hover:-translate-y-0.5"
            >
              Clear
            </button>

            {editingReturnId && (
              <button
                onClick={handleDeleteReturn}
                className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg text-xs transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Compact Net Return Card */}
        <div className="w-[450px] bg-gradient-to-br from-[#1e3f70] to-[#112647] text-white py-2 px-4 border border-[#0d1e37] shadow-lg rounded-xl flex items-center justify-between relative overflow-hidden h-[52px]">
          {/* Background shapes */}
          <div className="absolute -right-16 -top-16 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>

          {/* Mini Horizontal Totals */}
          <div className="text-[10px] flex space-x-3 font-semibold text-blue-200 mr-3">
            <div>
              <span>Gross: </span>
              <span className="font-mono text-white">₹{grossTotal.toFixed(0)}</span>
            </div>
            {(totalCgst > 0 || totalSgst > 0) && (
              <div>
                <span>CGST/SGST: </span>
                <span className="font-mono text-white">₹{(totalCgst + totalSgst).toFixed(0)}</span>
              </div>
            )}
            {totalIgst > 0 && (
              <div>
                <span>IGST: </span>
                <span className="font-mono text-white">₹{totalIgst.toFixed(0)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 relative z-10 flex-shrink-0">
            <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Net Return</span>
            <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
              ₹ {netReturnAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurReturn;