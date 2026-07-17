import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
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
              const matchedItem = activeReturn.items.find((i: any) => i.itemCode === item.itemCode);
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

  useEffect(() => {
    setToolbarActions({
      onAdd: () => {
        clearForm();
        setGlobalNotification({ msg: 'Ready for new Purchase Return.', type: 'info' });
      },
      onSave: async () => {
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
            setGlobalNotification({ msg: `Debit Note ${returnNo} saved to database successfully!`, type: 'success' });
            clearForm();
            fetchSavedReturns();
          } else {
            setGlobalNotification({ msg: 'Error saving purchase return: ' + data.error, type: 'error' });
          }
        } catch (err) {
          console.error(err);
          setGlobalNotification({ msg: 'Network error saving purchase return.', type: 'error' });
        }
      },
      onDelete: async () => {
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
            setGlobalNotification({ msg: 'Purchase return deleted successfully.', type: 'success' });
            clearForm();
            fetchSavedReturns();
          } else {
            setGlobalNotification({ msg: 'Failed to delete: ' + data.error, type: 'error' });
          }
        } catch (err) {
          console.error(err);
          setGlobalNotification({ msg: 'Network error deleting purchase return.', type: 'error' });
        }
      },
      onPrint: () => {
        setGlobalNotification({ msg: 'Printing Debit Note...', type: 'info' });
        const formattedItems = items.map(item => ({
          itemCode: item.itemCode,
          itemDesc: item.itemDesc,
          qty: item.returnQty,
          rate: item.unitPrice,
          totalAmt: item.totalAmt
        }));
        printReceipt(formattedItems, {
          invoiceNo: returnNo,
          date: returnDate,
          customerName: vendorDetails.name,
          paymentMode: settlementMode,
          totalQty: items.reduce((acc, i) => acc + (i.returnQty || 0), 0),
          subTotal: grossTotal,
          cgst: totalCgst,
          sgst: totalSgst,
          totalAmount: netReturnAmount
        });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, returnNo, selectedInvoiceId, items, editingReturnId, returnDate, vendorDetails, settlementMode, grossTotal, totalCgst, totalSgst, netReturnAmount, roundedOff]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* Selection row for edit/delete */}
      <div className="bg-blue-50 border border-blue-200 p-2 shadow-sm rounded mb-2 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-3 w-1/2">
          <label className="text-xs font-bold text-[#1e3f70] whitespace-nowrap">Edit Saved Return:</label>
          <select 
            value={selectedReturnId} 
            onChange={e => handleSelectReturn(e.target.value)} 
            className="w-full border border-blue-400 p-1 rounded text-sm focus:border-blue-500 bg-white font-semibold text-gray-700"
          >
            <option value="">-- New Purchase Return (Create Mode) --</option>
            {savedReturns.map(ret => (
              <option key={ret.id} value={ret.id}>{ret.returnNo} - {ret.customerName} (Refund: ₹{ret.netReturnAmount})</option>
            ))}
          </select>
        </div>
        {editingReturnId && (
          <div className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-3 py-1 rounded">
            Editing Mode: {returnNo}
          </div>
        )}
      </div>

      {/* Top Metadata Header */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0">
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Purchase Return (Debit Note)
          </h2>
        </div>
        
        <div className="grid grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Pur Return No</label>
            <input type="text" value={returnNo} readOnly className="w-full border border-gray-400 p-1 rounded text-sm bg-gray-100 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Return Date</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full border border-gray-400 p-1 rounded text-sm focus:border-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Original Purchase Invoice No</label>
            <select value={selectedInvoiceId} onChange={e => setSelectedInvoiceId(e.target.value)} className="w-full border border-gray-400 p-1 rounded text-sm focus:border-blue-500 bg-white">
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
            <label className="block text-xs font-bold text-gray-700 mb-1">Supplier Name & GSTIN</label>
            <div className="border border-gray-300 p-1 rounded text-xs bg-gray-50 h-[28px] overflow-hidden truncate">
              {vendorDetails.name ? (
                <span className="font-semibold text-gray-800">{vendorDetails.name} <span className="text-gray-500 font-normal ml-1">({vendorDetails.gstin})</span></span>
              ) : (
                <span className="text-gray-400">Select Invoice...</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Return</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-400 p-1 rounded text-sm focus:border-blue-500 bg-white">
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm relative overflow-hidden mb-2 rounded">
        {/* Grid Sub-Toolbar */}
        <div className="bg-[#d1e8e2] p-1.5 border-b border-gray-400 flex items-center justify-between">
           <span className="text-xs font-bold text-gray-700 pl-2">Return Items</span>
           {items.length > 0 && <span className="text-xs text-blue-600 font-semibold pr-2">Modifying return quantities updates totals automatically.</span>}
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-[#2b579a] text-white sticky top-0 z-10">
              <tr>
                <th className="border-r border-gray-400 p-1.5 w-10 text-center text-xs font-semibold">S.No</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold">Item Code</th>
                <th className="border-r border-gray-400 p-1.5 text-xs font-semibold">Item Description</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold">Batch No</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold text-right">Purchased<br/>Qty</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold text-right bg-blue-600">Return Qty</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold text-right">Purchase Rate</th>
                <th className="border-r border-gray-400 p-1.5 w-16 text-xs font-semibold text-right">Disc %</th>
                <th className="border-r border-gray-400 p-1.5 w-16 text-xs font-semibold text-right">Tax %</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold text-right">Taxable Amt</th>
                <th className="border-r border-gray-400 p-1.5 w-28 text-xs font-semibold text-right">Total Amt</th>
                <th className="p-1.5 w-10 text-center text-xs font-semibold">Del</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                       <AlertCircle className="w-10 h-10 text-gray-300 mb-2" />
                       <p className="text-lg font-medium text-gray-400">No Invoice Selected</p>
                       <p className="text-sm">Please select an Original Purchase Invoice to view and return items.</p>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-300 hover:bg-yellow-50 focus-within:bg-blue-50 transition-colors">
                  <td className="border-r border-gray-300 p-1 text-center text-gray-500 bg-gray-50">{idx + 1}</td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-50 text-gray-700">{item.itemCode}</td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-50 text-gray-700">{item.itemDesc}</td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-50 text-gray-700 text-center">{item.batchNo}</td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-100 text-right font-bold text-gray-600">{item.purchasedQty}</td>
                  <td className={`border-r p-0 relative ${item.error ? 'border-red-500 border-2' : 'border-gray-300'}`}>
                    <input 
                      type="number" 
                      value={item.returnQty === 0 && !item.error ? '' : item.returnQty} 
                      onChange={e => updateItem(item.id, 'returnQty', e.target.value === '' ? 0 : Number(e.target.value))} 
                      className="w-full p-1.5 bg-yellow-100 focus:bg-white focus:outline-none text-right font-bold text-red-700 h-full placeholder:text-gray-300" 
                      placeholder="0"
                      min="0"
                      max={item.purchasedQty}
                    />
                    {item.error && <span className="absolute -bottom-4 right-0 text-[9px] text-red-600 font-bold bg-white px-1 shadow rounded z-20">{item.error}</span>}
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="number" 
                      value={item.unitPrice || ''} 
                      onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} 
                      className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-50 text-right text-gray-600">{item.discPercent}%</td>
                  <td className="border-r border-gray-300 p-1.5 bg-gray-50 text-right text-gray-600">{item.taxPercent}%</td>
                  <td className="border-r border-gray-300 p-1.5 text-right font-mono text-gray-700 bg-gray-50">{item.taxableAmt.toFixed(2)}</td>
                  <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700 bg-gray-50">{item.totalAmt.toFixed(2)}</td>
                  <td className="p-1 text-center bg-gray-50">
                    <button onClick={() => removeRow(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100" title="Remove Item">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary Card (Bottom Panel) */}
      <div className="flex space-x-2 flex-shrink-0">
         <div className="flex-1 bg-white border border-gray-400 p-3 rounded shadow-sm flex flex-col justify-center">
             <label className="block text-xs font-bold text-gray-700 mb-1">Settlement Mode</label>
             <select value={settlementMode} onChange={e => setSettlementMode(e.target.value)} className="w-full max-w-xs border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-gray-50 font-semibold text-gray-700">
               {SETTLEMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <p className="text-[11px] text-gray-500 mt-2">Adjusted in Accounts Payable automatically on Save if 'Adjust in Supplier Ledger' is chosen.</p>
         </div>

         <div className="w-[600px] bg-[#1e3f70] text-white p-3 border border-[#142d54] shadow-md rounded flex flex-col justify-between">
           <div className="grid grid-cols-5 gap-4 text-sm font-bold text-right border-b border-[#2b579a] pb-2 mb-2">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">Gross Total</span>
              ₹{grossTotal.toFixed(2)}
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">CGST</span>
              ₹{totalCgst.toFixed(2)}
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">SGST</span>
              ₹{totalSgst.toFixed(2)}
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">IGST</span>
              ₹{totalIgst.toFixed(2)}
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">Round Off</span>
              {roundedOff > 0 ? '+' : ''}{roundedOff.toFixed(2)}
            </div>
          </div>
          
          <div className="flex justify-between items-center px-2">
            <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Net Return Amount</span>
            <div className="text-3xl font-black text-yellow-300 drop-shadow-md">
              ₹ {netReturnAmount.toFixed(2)}
            </div>
          </div>
         </div>
      </div>
    </div>
  );
};

export default PurReturn;