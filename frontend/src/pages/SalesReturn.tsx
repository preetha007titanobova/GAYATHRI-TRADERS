import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Api from '../Api';

interface ReturnGridRow {
  id: number;
  productId: string | null;
  itemCode: string;
  itemName: string;
  invoicedQty: number;
  returnQty: number;
  unitPrice: number;
  taxableAmt: number;
  taxPercent: number;
  disposition: string;
  subtotal: number;
  _originalTaxable: number;
  isSelected?: boolean;
  barcode?: string;
}

const SalesReturn = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Document State
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [returnNo, setReturnNo] = useState('Loading...');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDetails, setInvoiceDetails] = useState<{invoiceNo: string, buyerName: string, eType: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('Damaged in Transit');
  const [customReason, setCustomReason] = useState('');
  const [returnType, setReturnType] = useState('Credit Note (Refund)');

  // Exchange / Replacement State
  interface ReplacementGridRow {
    id: number;
    productId: string | null;
    itemCode: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    taxPercent: number;
    taxableAmt: number;
    subtotal: number;
  }
  const [replacementItems, setReplacementItems] = useState<ReplacementGridRow[]>([]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [extraReceived, setExtraReceived] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Replacement Totals
  const [totalReplacementAmount, setTotalReplacementAmount] = useState(0);
  const [cgstReplacement, setCgstReplacement] = useState(0);
  const [sgstReplacement, setSgstReplacement] = useState(0);
  const [igstReplacement, setIgstReplacement] = useState(0);
  const [netReplacementAmount, setNetReplacementAmount] = useState(0);

  // Grid State
  const [itemsToReturn, setItemsToReturn] = useState<ReturnGridRow[]>([]);

  // Totals State
  const [totalReturnAmount, setTotalReturnAmount] = useState(0);
  const [cgstReturn, setCgstReturn] = useState(0);
  const [sgstReturn, setSgstReturn] = useState(0);
  const [igstReturn, setIgstReturn] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [netRefundAmount, setNetRefundAmount] = useState(0);

  // Search Modal
  const [isInvoiceSearchOpen, setIsInvoiceSearchOpen] = useState(false);
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<any[]>([]);

  // Global Context
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  useEffect(() => {
    const returnToEdit = location.state?.returnToEdit;
    if (returnToEdit) {
      setEditingReturnId(returnToEdit._id || returnToEdit.id);
      setReturnNo(returnToEdit.returnNo);
      setReturnDate(new Date(returnToEdit.returnDate).toISOString().split('T')[0]);
      setReason(returnToEdit.reason || 'Damaged in Transit');
      
      // Fetch full details with items
      fetch(`${Api}/sales/returns/${returnToEdit._id || returnToEdit.id}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            setInvoiceDetails({
              invoiceNo: data.originalInvoice || '',
              buyerName: data.customerName || '',
              eType: data.igstReturn > 0 ? 'Interstate' : 'Local'
            });
            setReturnType(data.returnType || 'Credit Note (Refund)');
            if (Array.isArray(data.items)) {
              setItemsToReturn(data.items.map((item: any, idx: number) => ({
                id: idx + 1,
                productId: item.productId || null,
                itemCode: item.itemCode || '',
                itemName: item.itemName || '',
                invoicedQty: item.invoicedQty || item.returnQty, // fallback
                returnQty: item.returnQty,
                unitPrice: item.unitPrice,
                taxableAmt: item.taxableAmt || (item.returnQty * item.unitPrice),
                taxPercent: item.taxPercent || 18,
                disposition: item.disposition || 'Return to Warehouse',
                subtotal: item.subtotal,
                _originalTaxable: item.taxableAmt || (item.returnQty * item.unitPrice)
              })));
            }
            if (Array.isArray(data.replacementItems)) {
              setReplacementItems(data.replacementItems.map((item: any, idx: number) => ({
                id: idx + 1,
                productId: item.productId || null,
                itemCode: item.itemCode || '-',
                itemName: item.itemName || '',
                qty: item.qty || 1,
                unitPrice: item.unitPrice || 0,
                taxPercent: item.taxPercent || 0,
                taxableAmt: item.taxableAmt || 0,
                subtotal: item.subtotal || 0
              })));
            }
            setExtraReceived(data.extraReceived || 0);
            setRefundAmount(data.refundAmount || 0);
            setPaymentMode(data.paymentMode || 'Cash');
            setRefundMethod(data.refundMethod || 'Cash');
          }
        })
        .catch(err => console.error("Failed to fetch return details:", err));
    } else {
      fetchNextSequence();
    }
  }, [location.state]);

  const fetchNextSequence = async () => {
    try {
      const res = await fetch(`${Api}/sales/returns/next-sequence`);
      const data = await res.json();
      if (data.returnNo) setReturnNo(data.returnNo);
    } catch (err) {
      console.error("Failed to fetch sequence", err);
    }
  };

  const calculateTotalToReverse = (data: ReturnGridRow[], eTypeVal: string) => {
    let tAmt = 0;
    let tTax = 0;
    let c = 0;
    let s = 0;
    let i = 0;

    data.forEach(row => {
      tAmt += row.taxableAmt;
      const taxAmt = row.taxableAmt * (row.taxPercent / 100);
      tTax += taxAmt;
      
      if (eTypeVal === 'Interstate') {
        i += taxAmt;
      } else {
        c += taxAmt / 2;
        s += taxAmt / 2;
      }
    });

    setTotalReturnAmount(tAmt);
    setCgstReturn(c);
    setSgstReturn(s);
    setIgstReturn(i);

    const rawTotal = tAmt + c + s + i;
    const roundedTotal = Math.round(rawTotal);
    const roundDiff = roundedTotal - rawTotal;

    setRoundOff(roundDiff);
    setNetRefundAmount(roundedTotal);
  };

  // Computations
  useEffect(() => {
    calculateTotalToReverse(itemsToReturn, invoiceDetails?.eType || 'Local');
  }, [itemsToReturn, invoiceDetails]);

  // Auto-load invoice on typing/pasting exact invoice number
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const query = searchQuery.trim();
      if (query.length >= 6 && (!invoiceDetails || invoiceDetails.invoiceNo !== query)) {
        try {
          const res = await fetch(`${Api}/sales/bills/search?q=${query}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const exactMatch = data.find(inv => inv.invoiceNo.toLowerCase() === query.toLowerCase());
            if (exactMatch) {
              loadInvoice(exactMatch.invoiceNo);
            }
          }
        } catch (err) {
          console.error("Auto-load invoice error:", err);
        }
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, invoiceDetails]);

  // Product Search Effect for Exchange Replacement
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const q = productSearchQuery.trim();
      if (q.length >= 1) {
        try {
          const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setProductSearchResults(data);
            setIsProductDropdownOpen(true);
          }
        } catch (err) {
          console.error("Replacement product search error:", err);
        }
      } else {
        setProductSearchResults([]);
        setIsProductDropdownOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [productSearchQuery]);

  // Compute Replacement Totals
  useEffect(() => {
    let tAmt = 0;
    let c = 0;
    let s = 0;
    let i = 0;

    replacementItems.forEach(row => {
      tAmt += row.taxableAmt;
      const taxAmt = row.subtotal - row.taxableAmt;
      if (invoiceDetails?.eType === 'Interstate') {
        i += taxAmt;
      } else {
        c += taxAmt / 2;
        s += taxAmt / 2;
      }
    });

    setTotalReplacementAmount(tAmt);
    setCgstReplacement(c);
    setSgstReplacement(s);
    setIgstReplacement(i);
    const rawTotal = replacementItems.reduce((sum, item) => sum + item.subtotal, 0);
    setNetReplacementAmount(Math.round(rawTotal));
  }, [replacementItems, invoiceDetails]);

  const handleAddReplacementProduct = (product: any) => {
    const nextId = replacementItems.length + 1;
    const taxRate = Number(product.gstPercent) || 0;
    const unitPrice = Number(product.price) || 0;
    const qty = 1;
    const rowTaxable = (unitPrice * qty) / (1 + taxRate / 100);
    const rowSubtotal = unitPrice * qty;

    const newItem: ReplacementGridRow = {
      id: nextId,
      productId: product.id || product._id,
      itemCode: product.itemCode || '-',
      itemName: product.name,
      qty: 1,
      unitPrice: unitPrice,
      taxPercent: taxRate,
      taxableAmt: rowTaxable,
      subtotal: rowSubtotal
    };

    setReplacementItems(prev => [...prev, newItem]);
    setProductSearchQuery('');
    setIsProductDropdownOpen(false);
  };

  const handleReplacementGridChange = (id: number, field: keyof ReplacementGridRow, value: any) => {
    setReplacementItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      const newRow = { ...row, [field]: value };
      if (field === 'qty' || field === 'unitPrice') {
        const qty = field === 'qty' ? Number(value) || 0 : newRow.qty;
        const price = field === 'unitPrice' ? Number(value) || 0 : newRow.unitPrice;
        newRow.qty = qty;
        newRow.unitPrice = price;
        newRow.taxableAmt = (price * qty) / (1 + newRow.taxPercent / 100);
        newRow.subtotal = price * qty;
      }
      return newRow;
    }));
  };

  const handleDeleteReplacementItem = (id: number) => {
    setReplacementItems(prev => prev.filter(row => row.id !== id).map((row, idx) => ({ ...row, id: idx + 1 })));
  };

  const handleSearchInvoice = async () => {
    try {
      const res = await fetch(`${Api}/sales/bills/search?q=${searchQuery}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const trimmedQuery = searchQuery.trim();
        const exactMatch = trimmedQuery ? data.find(inv => inv.invoiceNo.toLowerCase() === trimmedQuery.toLowerCase()) : null;
        if (exactMatch) {
          loadInvoice(exactMatch.invoiceNo);
        } else if (trimmedQuery && data.length === 1) {
          loadInvoice(data[0].invoiceNo);
        } else {
          setInvoiceSearchResults(data);
          setIsInvoiceSearchOpen(true);
        }
      } else {
        setInvoiceSearchResults([]);
        setIsInvoiceSearchOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadInvoice = async (invNo: string) => {
    try {
      const res = await fetch(`${Api}/sales/bills/${invNo}`);
      const data = await res.json();
      
      setInvoiceDetails({
        invoiceNo: data.invoiceNo,
        buyerName: data.buyerName,
        eType: data.eType || 'Local'
      });
      setSearchQuery(data.invoiceNo);

      const mappedItems = data.items.map((item: any, idx: number) => {
        // Calculate original tax percent used
        const baseAmount = item.qty * item.rate;
        const discAmt = (baseAmount * item.discPercent) / 100;
        const taxable = baseAmount - discAmt;
        
        // Approximate tax percent from bill totals if item tax not saved explicitly
        let inferredTaxPercent = 0;
        if (data.totalAmount > 0) {
          const totalTax = data.cgst + data.sgst + (data.igst || 0);
          inferredTaxPercent = (totalTax / data.totalAmount) * 100;
        }

        return {
          id: idx + 1,
          productId: item.productId,
          itemCode: item.itemDesc || '-', // itemDesc was used for barcode/code
          itemName: item.itemName,
          invoicedQty: item.qty,
          returnQty: 0,
          unitPrice: item.rate, // Strictly this should be after discount: taxable / qty. We use precise taxable calculation.
          taxableAmt: 0,
          taxPercent: inferredTaxPercent,
          disposition: 'Return to Warehouse',
          subtotal: 0,
          _originalTaxable: taxable,
          isSelected: false,
          barcode: item.barcode || ''
        };
      });

      setItemsToReturn(mappedItems);
      setIsInvoiceSearchOpen(false);
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) setGlobalNotification({msg: 'Failed to load invoice.', type: 'error'});
    }
  };

  const handleGridChange = (id: number, field: keyof ReturnGridRow, value: any) => {
    setItemsToReturn(prev => prev.map(row => {
      if (row.id !== id) return row;
      
      const newRow = { ...row, [field]: value };
      
      if (field === 'isSelected') {
        const selected = !!value;
        newRow.isSelected = selected;
        if (!selected) {
          newRow.returnQty = 0;
          newRow.taxableAmt = 0;
          newRow.subtotal = 0;
        } else {
          newRow.returnQty = 1;
          const unitPriceAfterDiscount = newRow._originalTaxable / newRow.invoicedQty;
          newRow.taxableAmt = 1 * unitPriceAfterDiscount;
          newRow.subtotal = newRow.taxableAmt + (newRow.taxableAmt * (newRow.taxPercent / 100));
        }
      }
      
      if (field === 'returnQty') {
        const qty = Number(value) || 0;
        // Validation Rule 2: Upper Boundary Check
        if (qty > newRow.invoicedQty) {
          if (setGlobalNotification) {
            setGlobalNotification({msg: "Return quantity cannot exceed original invoiced quantity.", type: 'error'});
            setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
          }
          newRow.returnQty = newRow.invoicedQty;
        } else {
          newRow.returnQty = qty;
        }

        // Calculate taxable based on unit rate * qty (assuming proportional discount if any)
        const unitPriceAfterDiscount = newRow._originalTaxable / newRow.invoicedQty;
        newRow.taxableAmt = newRow.returnQty * unitPriceAfterDiscount;
        newRow.subtotal = newRow.taxableAmt + (newRow.taxableAmt * (newRow.taxPercent / 100));
      }
      
      return newRow;
    }));
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex}-${colIndex + 1}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex}-${colIndex - 1}`)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex + 1}-${colIndex}`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex - 1}-${colIndex}`)?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === 0) {
        document.getElementById(`grid-input-${rowIndex}-1`)?.focus();
      } else {
        const nextInput = document.getElementById(`grid-input-${rowIndex + 1}-0`);
        if (nextInput) {
          nextInput.focus();
        } else {
          // No next row, focus save button
          document.getElementById('save-credit-note-btn')?.focus();
        }
      }
    }
  };

  const handleSaveClick = async () => {
    // Validation Rule 1: Zero-Quantity Exception Guardrail
    const selectedItems = itemsToReturn.filter(row => row.isSelected && row.returnQty > 0);
    if (selectedItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Cannot save: Return quantities must contain at least one selected item with a value greater than zero.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 4000);
      }
      return;
    }

    const diff = netReplacementAmount - netRefundAmount;
    const computedExtraReceived = diff > 0 ? diff : 0;
    const computedRefundAmount = diff < 0 ? -diff : 0;

    const payload = {
      returnNo,
      returnDate,
      originalInvoice: invoiceDetails?.invoiceNo || '',
      customerName: invoiceDetails?.buyerName || '',
      reason: reason === 'Other' ? customReason : reason,
      returnType,
      totalReturnAmount,
      cgstReturn,
      sgstReturn,
      igstReturn,
      roundOff,
      netRefundAmount,
      items: selectedItems,
      extraReceived: computedExtraReceived,
      refundAmount: computedRefundAmount,
      paymentMode: diff > 0 ? paymentMode : 'Cash',
      refundMethod: diff < 0 ? refundMethod : 'Cash',
      replacementItems: returnType === 'Exchange (Replacement)' ? replacementItems : []
    };

    try {
      const url = editingReturnId ? `${Api}/sales/returns/${editingReturnId}` : `${Api}/sales/returns`;
      const method = editingReturnId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) setGlobalNotification({msg: `Transaction ${returnNo} saved successfully!`, type: 'success'});
        if (editingReturnId) {
          setTimeout(() => navigate('/sales-register'), 1500);
        } else {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        if (setGlobalNotification) setGlobalNotification({msg: "Error saving: " + data.error, type: 'error'});
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) setGlobalNotification({msg: "Network error while saving.", type: 'error'});
    }
  };

  const handleCancelClick = () => {
    setInvoiceDetails(null);
    setItemsToReturn([]);
    setReplacementItems([]);
    setExtraReceived(0);
    setRefundAmount(0);
    setPaymentMode('Cash');
    setRefundMethod('Cash');
    setSearchQuery('');
    setProductSearchQuery('');
    setProductSearchResults([]);
    setIsProductDropdownOpen(false);
    fetchNextSequence();
    if (setGlobalNotification) {
      setGlobalNotification({msg: 'Return form cleared.', type: 'success'});
      setTimeout(() => setGlobalNotification({msg: '', type: ''}), 2000);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveClick();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleCancelClick();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelClick();
        setIsInvoiceSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [itemsToReturn, invoiceDetails]); // Dependency array to capture latest state in closure

  // Toolbar Wiring
  const actionHandlers = useRef({
    onAdd: handleCancelClick,
    onSave: handleSaveClick,
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleCancelClick,
      onSave: handleSaveClick,
    };
  });

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        // Mapping save to onPrint tentatively or just relying on keyboard shortcut
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions]);


  return (
    <div className="flex flex-col h-full space-y-2 relative">
      
      {/* 1. Header Area */}
      <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-800 shadow-sm mb-2 flex items-start space-x-3">
        <div className="bg-red-100 p-2 rounded-full">
          <Search size={20} className="text-red-600" />
        </div>
        <div>
          <h2 className="font-bold text-base text-red-900 mb-1 flex items-center space-x-2">
            <span>Sales Return (Credit Note Engine)</span>
            <span className="bg-yellow-200 text-yellow-800 text-[10px] px-2 py-0.5 rounded border border-yellow-400 font-bold uppercase">
              {invoiceDetails ? 'DRAFT' : 'NEW'}
            </span>
          </h2>
          <p className="text-red-700 leading-snug">
            Process customer returns and generate credit notes. Link an original invoice to auto-populate items.
          </p>
        </div>
      </div>
      
      {/* 2. Top Metadata Pane */}
      <div className="flex flex-row gap-4 mb-2">
        <div className="legacy-panel p-4 flex-1 grid grid-cols-2 gap-6 relative shadow-sm">
          <div className="flex flex-col space-y-3">
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-600 mb-1">Return No.</label>
              <input type="text" className="legacy-input font-bold text-blue-900 bg-gray-100" value={returnNo} disabled />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-600 mb-1">Return Date</label>
              <input type="date" className="legacy-input" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-600 mb-1">Reason</label>
              <select className="legacy-input" value={reason} onChange={e => {
                setReason(e.target.value);
                if (e.target.value !== 'Other') setCustomReason('');
              }}>
                <option>Damaged in Transit</option>
                <option>Defective Product</option>
                <option>Customer Dissatisfaction</option>
                <option>Wrong Item Delivered</option>
                <option>Other</option>
              </select>
              {reason === 'Other' && (
                <input 
                  type="text" 
                  placeholder="Specify custom reason..." 
                  className="legacy-input mt-1.5 focus:border-red-500" 
                  value={customReason} 
                  onChange={e => setCustomReason(e.target.value)} 
                />
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="flex flex-col">
              <label className="text-sm font-bold text-red-800 mb-1">Orig. Invoice No.</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="legacy-input flex-1" 
                  placeholder="Search INV-..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearchInvoice();
                  }}
                />
                <button className="bg-blue-600 text-white px-4 rounded text-xs font-bold hover:bg-blue-700 shadow-sm transition-colors" onClick={handleSearchInvoice}>Find</button>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-600 mb-1">Customer Name</label>
              <input type="text" className="legacy-input bg-gray-100" value={invoiceDetails?.buyerName || ''} disabled />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-600 mb-1">Return Type / Action</label>
              <select className="legacy-input font-bold text-slate-800" value={returnType} onChange={e => setReturnType(e.target.value)}>
                <option>Credit Note (Refund)</option>
                <option>Exchange (Replacement)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Highlighted Grand Total Overlay */}
        <div className="w-80 bg-gray-900 rounded-md border border-gray-700 flex flex-col justify-center text-white shadow-md p-4 space-y-2">
          {returnType === 'Exchange (Replacement)' ? (
            <>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase">To Reverse:</span>
                <span className="font-mono text-red-400 font-bold">₹{netRefundAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase">Replacement:</span>
                <span className="font-mono text-green-400 font-bold">₹{netReplacementAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-700 my-1"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase">Net Difference:</span>
                <span className={`text-xl font-mono font-black ${
                  netReplacementAmount - netRefundAmount > 0 
                    ? 'text-emerald-400' 
                    : netReplacementAmount - netRefundAmount < 0 
                      ? 'text-orange-400' 
                      : 'text-white'
                }`}>
                  ₹{(netReplacementAmount - netRefundAmount).toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2 text-center">Grand Total To Reverse</span>
              <span className="text-3xl font-black text-[#ff7f50] tracking-tight">₹ {netRefundAmount.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Data Entry Grid */}
      <div className="flex-1 min-h-[350px] bg-white border border-gray-400 overflow-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#e8ecef] shadow-sm z-10">
            <tr>
              <th className="legacy-grid-header w-12 text-center">SELECT</th>
              <th className="legacy-grid-header w-10 text-center">#</th>
              <th className="legacy-grid-header w-24">ITEM CODE</th>
              <th className="legacy-grid-header w-32">BARCODE</th>
              <th className="legacy-grid-header">DESCRIPTION</th>
              <th className="legacy-grid-header w-24 text-center">INVOICED QTY</th>
              <th className="legacy-grid-header w-24 text-center">RETURN QTY</th>
              <th className="legacy-grid-header w-24 text-right">UNIT PRICE</th>
              <th className="legacy-grid-header w-28 text-right">AMT SPENT</th>
              <th className="legacy-grid-header w-24 text-right">TAXABLE AMT</th>
              <th className="legacy-grid-header w-16 text-center">TAX %</th>
              <th className="legacy-grid-header w-40">DISPOSITION</th>
              <th className="legacy-grid-header w-24 text-right pr-4">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {itemsToReturn.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-gray-400 italic text-sm">
                  Search and select an Original Invoice to populate items...
                </td>
              </tr>
            ) : itemsToReturn.map((row, idx) => (
              <tr key={row.id} className="hover:bg-red-50 border-b border-gray-200">
                <td className="legacy-grid-cell text-center">
                  <input 
                    type="checkbox" 
                    className="form-checkbox h-4.5 w-4.5 text-red-600 rounded cursor-pointer"
                    checked={!!row.isSelected}
                    onChange={e => handleGridChange(row.id, 'isSelected', e.target.checked)}
                  />
                </td>
                <td className="legacy-grid-cell text-center text-gray-500 font-mono text-xs">{row.id}</td>
                <td className="legacy-grid-cell font-mono text-xs text-gray-700">{row.itemCode}</td>
                <td className="legacy-grid-cell font-mono text-xs text-blue-900 bg-slate-50">{row.barcode || '-'}</td>
                <td className="legacy-grid-cell font-semibold text-gray-800 text-xs">{row.itemName}</td>
                <td className="legacy-grid-cell text-center bg-gray-50 font-bold text-gray-600">{row.invoicedQty}</td>
                <td className="legacy-grid-cell p-0 relative">
                  <input 
                    id={`grid-input-${idx}-0`}
                    type="number" 
                    min="0"
                    max={row.invoicedQty}
                    step="1"
                    disabled={!row.isSelected}
                    className={`w-full h-full p-1 text-center font-bold outline-none focus:bg-yellow-100 ${!row.isSelected ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed' : (row.returnQty > row.invoicedQty ? 'border-2 border-red-500 bg-red-100 text-red-700' : 'border-none')}`} 
                    value={row.returnQty || ''} 
                    onChange={e => handleGridChange(row.id, 'returnQty', e.target.value)} 
                    onKeyDown={e => handleGridKeyDown(e, idx, 0)}
                  />
                </td>
                <td className="legacy-grid-cell text-right text-gray-600">{row.unitPrice.toFixed(2)}</td>
                <td className="legacy-grid-cell text-right bg-slate-50 font-mono text-slate-700">
                  ₹{((row._originalTaxable * (1 + row.taxPercent / 100)) || 0).toFixed(2)}
                </td>
                <td className="legacy-grid-cell text-right bg-red-50/50 font-semibold text-red-900">{row.taxableAmt.toFixed(2)}</td>
                <td className="legacy-grid-cell text-center text-gray-600 text-[10px]">{row.taxPercent.toFixed(1)}%</td>
                <td className="legacy-grid-cell p-0">
                  <select 
                    id={`grid-input-${idx}-1`}
                    className="w-full h-full p-1 border-none outline-none text-xs focus:bg-yellow-100" 
                    value={row.disposition} 
                    onChange={e => handleGridChange(row.id, 'disposition', e.target.value)}
                    onKeyDown={e => handleGridKeyDown(e, idx, 1)}
                  >
                    <option>Return to Warehouse</option>
                    <option>Quarantine & Scrap</option>
                    <option>Defective / Damaged</option>
                  </select>
                </td>
                <td className="legacy-grid-cell text-right bg-gray-100 font-bold text-gray-800 pr-4">{row.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3.1 Replacement Items Grid (Exchanges only) */}
      {returnType === 'Exchange (Replacement)' && (
        <div className="bg-slate-50 border border-gray-400 p-3 rounded shadow-sm space-y-3 mt-2 flex-shrink-0">
          <div className="flex justify-between items-center border-b border-gray-300 pb-2">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-sm">Replacement / New Items Purchased</span>
              <span className="bg-green-200 text-green-800 text-[10px] px-2 py-0.5 rounded border border-green-400 font-bold">EXCHANGE MODE</span>
            </div>
            
            <div className="relative w-64 print:hidden">
              <input
                type="text"
                placeholder="Search replacement product..."
                className="w-full border border-gray-400 pl-8 pr-2 py-1 text-xs rounded focus:outline-none focus:border-blue-500"
                value={productSearchQuery}
                onChange={e => setProductSearchQuery(e.target.value)}
              />
              <Search size={14} className="absolute left-2.5 top-1.5 text-gray-500" />
              
              {isProductDropdownOpen && productSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-400 shadow-lg rounded mt-1 max-h-48 overflow-y-auto z-50">
                  {productSearchResults.map(prod => (
                    <div
                      key={prod.id || prod._id}
                      onClick={() => handleAddReplacementProduct(prod)}
                      className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-gray-800">{prod.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{prod.itemCode} | Barcode: {prod.barcode || '-'}</div>
                      </div>
                      <div className="font-bold font-mono text-blue-600">₹{Number(prod.price).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[160px] bg-white rounded border border-gray-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f0f4f8] sticky top-0 z-10">
                <tr>
                  <th className="p-2 border border-gray-300 w-10 text-center">#</th>
                  <th className="p-2 border border-gray-300 w-24">Item Code</th>
                  <th className="p-2 border border-gray-300">Name</th>
                  <th className="p-2 border border-gray-300 w-24 text-center">Qty</th>
                  <th className="p-2 border border-gray-300 w-28 text-right">Unit Price</th>
                  <th className="p-2 border border-gray-300 w-20 text-center">Tax %</th>
                  <th className="p-2 border border-gray-300 w-28 text-right">Taxable</th>
                  <th className="p-2 border border-gray-300 w-28 text-right">Subtotal</th>
                  <th className="p-2 border border-gray-300 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {replacementItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-gray-400 italic">
                      No replacement items selected yet. Search above to add items.
                    </td>
                  </tr>
                ) : replacementItems.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 border-b border-gray-200">
                    <td className="p-2 border-r border-gray-200 text-center font-mono text-gray-500">{idx + 1}</td>
                    <td className="p-2 border-r border-gray-200 font-mono text-gray-600">{row.itemCode}</td>
                    <td className="p-2 border-r border-gray-200 font-semibold text-gray-800">{row.itemName}</td>
                    <td className="p-0 border-r border-gray-200 w-24">
                      <input
                        type="number"
                        min="1"
                        className="w-full p-1.5 text-center font-bold outline-none border-none focus:bg-yellow-100"
                        value={row.qty}
                        onChange={e => handleReplacementGridChange(row.id, 'qty', e.target.value)}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-200 w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full p-1.5 text-right font-mono outline-none border-none focus:bg-yellow-100"
                        value={row.unitPrice}
                        onChange={e => handleReplacementGridChange(row.id, 'unitPrice', e.target.value)}
                      />
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center font-mono text-gray-600">{row.taxPercent.toFixed(1)}%</td>
                    <td className="p-2 border-r border-gray-200 text-right font-mono text-gray-600">₹{row.taxableAmt.toFixed(2)}</td>
                    <td className="p-2 border-r border-gray-200 text-right font-mono font-bold text-slate-800">₹{row.subtotal.toFixed(2)}</td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => handleDeleteReplacementItem(row.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold border border-red-200 shadow-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Bottom Summary Stack and Action Footer */}
      <div className="flex justify-between items-end pt-2 pb-1 gap-4">
        {/* Action Buttons Container */}
        <div className="flex flex-col space-y-2 mb-1 ml-2">
          <button 
            id="save-credit-note-btn" 
            onClick={handleSaveClick} 
            className="bg-red-600 text-white font-bold px-6 py-2.5 rounded-md shadow-md border border-red-800 hover:bg-red-700 focus:ring-2 focus:ring-red-400 focus:outline-none transition-all flex items-center space-x-2"
          >
            <span>{returnType === 'Exchange (Replacement)' ? 'Confirm Exchange (CTRL+S)' : 'Confirm Return (CTRL+S)'}</span>
          </button>
          <button 
            onClick={handleCancelClick} 
            className="bg-gray-200 text-gray-800 font-bold px-6 py-2.5 rounded-md shadow-sm border border-gray-400 hover:bg-gray-300 transition-all text-center"
          >
            Cancel (ESC)
          </button>
        </div>

        {/* Financial Adjustments Pane (Exchanges only) */}
        {returnType === 'Exchange (Replacement)' && (
          <div className="legacy-panel p-3 border border-indigo-200 bg-indigo-50/20 shadow-md grid grid-cols-2 gap-x-3 gap-y-1.5 items-center text-xs flex-1 mb-1 max-w-[400px]">
            <h4 className="col-span-2 font-bold text-indigo-950 border-b border-indigo-200 pb-1 uppercase tracking-wider mb-1">Exchange Financial Adjustments</h4>
            
            <label className="font-semibold text-gray-600">Reversal Total (R):</label>
            <span className="font-mono font-bold text-red-700 text-right">₹{netRefundAmount.toFixed(2)}</span>
            
            <label className="font-semibold text-gray-600">Replacement Purchase (P):</label>
            <span className="font-mono font-bold text-green-700 text-right">₹{netReplacementAmount.toFixed(2)}</span>
            
            <div className="col-span-2 border-t border-indigo-100 my-0.5"></div>
            
            {netReplacementAmount - netRefundAmount > 0 ? (
              <>
                <label className="font-bold text-slate-800">EXTRA AMOUNT TO COLLECT:</label>
                <span className="font-mono font-black text-slate-900 text-right text-sm text-green-700">₹{(netReplacementAmount - netRefundAmount).toFixed(2)}</span>
                
                <label className="font-semibold text-gray-700">Extra Payment Method:</label>
                <select className="legacy-input p-1 text-xs border border-gray-400 rounded focus:outline-none bg-white" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Credit</option>
                </select>
              </>
            ) : netReplacementAmount - netRefundAmount < 0 ? (
              <>
                <label className="font-bold text-orange-800">REFUND AMOUNT DUE:</label>
                <span className="font-mono font-black text-orange-900 text-right text-sm text-red-600">₹{(netRefundAmount - netReplacementAmount).toFixed(2)}</span>
                
                <label className="font-semibold text-gray-700">Refund / Credit Method:</label>
                <select className="legacy-input p-1 text-xs border border-gray-400 rounded focus:outline-none bg-white" value={refundMethod} onChange={e => setRefundMethod(e.target.value)}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Store Credit</option>
                </select>
              </>
            ) : (
              <span className="col-span-2 text-center py-2 font-bold text-emerald-800 bg-emerald-50 rounded border border-emerald-200">
                EXCHANGE BALANCED (DIFFERENCE IS ₹0.00)
              </span>
            )}
          </div>
        )}

        {/* Totals Summary */}
        <div className="legacy-panel p-3 grid grid-cols-2 gap-y-1 items-center w-80 shadow-md mb-1">
          <label className="legacy-label">Subtotal Reversal (Before Tax)</label>
          <input type="text" className="legacy-input text-right font-semibold text-gray-700 bg-gray-50" value={totalReturnAmount.toFixed(2)} disabled />
          
          <label className="legacy-label text-gray-600">Less CGST</label>
          <input type="text" className="legacy-input text-right bg-gray-50 text-gray-600" value={cgstReturn.toFixed(2)} disabled />
          
          <label className="legacy-label text-gray-600">Less SGST</label>
          <input type="text" className="legacy-input text-right bg-gray-50 text-gray-600" value={sgstReturn.toFixed(2)} disabled />
 
          <label className="legacy-label text-gray-600">Less IGST</label>
          <input type="text" className="legacy-input text-right bg-gray-50 text-gray-600" value={igstReturn.toFixed(2)} disabled />
 
          <label className="legacy-label text-gray-500">Rounding Offset</label>
          <input type="text" className="legacy-input text-right bg-gray-50 text-gray-500" value={roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)} disabled />
 
          <div className="col-span-2 border-t border-gray-400 my-1"></div>
 
          <label className="legacy-label text-sm font-bold text-red-800">TOTAL REFUNDABLE BALANCE</label>
          <input type="text" className="legacy-input text-right text-base font-black bg-red-100 text-red-900 border-red-300" value={netRefundAmount.toFixed(2)} disabled />
        </div>
      </div>

      {/* Invoice Search Modal */}
      {isInvoiceSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setIsInvoiceSearchOpen(false)}>
          <div className="bg-white shadow-2xl flex flex-col border border-gray-500 rounded w-1/2 max-h-[60vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#385386] text-white px-3 py-2 flex justify-between items-center shadow-sm">
              <span className="font-bold text-sm">Select Original Invoice</span>
              <button onClick={() => setIsInvoiceSearchOpen(false)} className="text-white hover:text-red-300 font-bold">✕</button>
            </div>
            
            <div className="p-2 border-b border-gray-300 bg-gray-100 flex space-x-2">
              <input 
                type="text" 
                className="flex-1 p-1 border border-gray-400 text-sm focus:outline-none focus:border-blue-500" 
                placeholder="Type to filter results..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button className="bg-gray-300 px-3 border border-gray-400 rounded text-sm font-bold" onClick={handleSearchInvoice}>Search</button>
            </div>

            <div className="overflow-y-auto flex-1 bg-white p-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-200 text-gray-700">
                    <th className="p-1 border border-gray-300">Invoice No</th>
                    <th className="p-1 border border-gray-300">Date</th>
                    <th className="p-1 border border-gray-300">Customer</th>
                    <th className="p-1 border border-gray-300 text-right">Amount</th>
                    <th className="p-1 border border-gray-300 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceSearchResults.map((inv) => (
                    <tr 
                      key={inv._id} 
                      className="hover:bg-blue-50 cursor-pointer"
                      onClick={() => loadInvoice(inv.invoiceNo)}
                    >
                      <td className="p-1 border border-gray-300 font-semibold text-blue-600 hover:text-blue-800 hover:underline">{inv.invoiceNo}</td>
                      <td className="p-1 border border-gray-300">{new Date(inv.invDate).toLocaleDateString()}</td>
                      <td className="p-1 border border-gray-300">{inv.buyerName}</td>
                      <td className="p-1 border border-gray-300 text-right font-mono">₹{inv.netAmount.toFixed(2)}</td>
                      <td className="p-1 border border-gray-300 text-center">
                        <button 
                          className="bg-[#a8d08d] text-black px-2 py-0.5 rounded text-xs font-bold shadow-sm hover:bg-green-400 border border-[#8ab870]"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadInvoice(inv.invoiceNo);
                          }}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invoiceSearchResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500 italic">No invoices found matching your query.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesReturn;
