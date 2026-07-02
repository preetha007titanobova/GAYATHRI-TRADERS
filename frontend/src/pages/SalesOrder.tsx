import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Search, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface SalesOrderItemLine {
  lineId: string;
  orderId: string;
  lineIndex: number;
  itemCode: string;
  itemDescription: string;
  quantityOrdered: number | string;
  quantityFulfilled: number;
  unitPrice: number | string;
  discountPercentage: number | string;
  taxableAmount: number;
  taxRatePercentage: number | string;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineSubTotal: number;
}

const SalesOrder = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  // --- Left Pane State ---
  const [status, setStatus] = useState<'OPEN' | 'PENDING' | 'FULFILLED' | 'CANCELLED'>('OPEN');
  const [orderNo, setOrderNo] = useState('SO-AUTO');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('NET 30 DAYS');
  const [isInterstate, setIsInterstate] = useState(false); // Used to toggle IGST vs CGST/SGST

  // --- Right Pane State ---
  const [lineItems, setLineItems] = useState<SalesOrderItemLine[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);

  // --- Summary Calculations ---
  const [summary, setSummary] = useState({
    subtotal: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    rounding: 0,
    grandTotal: 0
  });

  // Fetch initial data
  useEffect(() => {
    fetch('http://localhost:5000/api/items/search?q=')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Failed to fetch products", err));

    fetch('http://localhost:5000/api/ledgers/search')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableCustomers(data);
      })
      .catch(err => console.error("Failed to fetch customers", err));

    // Initialize with one empty row
    handleAddRow();
  }, []);

  // --- Math Matrix Engine ---
  useEffect(() => {
    let tSubtotal = 0;
    let tCgst = 0;
    let tSgst = 0;
    let tIgst = 0;

    const updatedItems = lineItems.map(item => {
      const qty = Number(item.quantityOrdered) || 0;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discountPercentage) || 0;
      const taxRate = Number(item.taxRatePercentage) || 0;

      const taxableAmount = (qty * price) * (1 - (disc / 100));
      const taxAmount = taxableAmount * (taxRate / 100);
      
      let cgstAmt = 0;
      let sgstAmt = 0;
      let igstAmt = 0;

      if (isInterstate) {
        igstAmt = taxAmount;
      } else {
        cgstAmt = taxAmount / 2;
        sgstAmt = taxAmount / 2;
      }

      const lineSubTotal = taxableAmount + taxAmount;

      tSubtotal += taxableAmount;
      tCgst += cgstAmt;
      tSgst += sgstAmt;
      tIgst += igstAmt;

      return {
        ...item,
        taxableAmount,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        igstAmount: igstAmt,
        lineSubTotal
      };
    });

    // Prevent infinite loop by only updating if values actually changed
    // In a real app we might use a ref to prevent looping, or carefully manage dependencies.
    // For simplicity, we just aggregate the totals.
    
    const rawTotal = tSubtotal + tCgst + tSgst + tIgst;
    const roundedTotal = Math.round(rawTotal);
    const roundingDiff = roundedTotal - rawTotal;

    setSummary({
      subtotal: tSubtotal,
      cgst: tCgst,
      sgst: tSgst,
      igst: tIgst,
      rounding: roundingDiff,
      grandTotal: roundedTotal
    });

  }, [lineItems, isInterstate]); // Need to ensure this doesn't cause infinite render if we map inside

  const generateUUID = () => Math.random().toString(36).substring(2, 15);

  const handleAddRow = () => {
    const newLine: SalesOrderItemLine = {
      lineId: generateUUID(),
      orderId: orderNo,
      lineIndex: lineItems.length + 1,
      itemCode: '',
      itemDescription: '',
      quantityOrdered: 1,
      quantityFulfilled: 0,
      unitPrice: 0,
      discountPercentage: 0,
      taxableAmount: 0,
      taxRatePercentage: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      lineSubTotal: 0
    };
    setLineItems(prev => [...prev, newLine]);
  };

  const handleRemoveRow = (lineId: string) => {
    setLineItems(prev => prev.filter(item => item.lineId !== lineId).map((item, index) => ({...item, lineIndex: index + 1})));
  };

  const handleItemChange = (lineId: string, field: keyof SalesOrderItemLine, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.lineId !== lineId) return item;

      const updated = { ...item, [field]: value };

      // Auto-populate description and price if itemCode changes
      if (field === 'itemCode' && value) {
        const product = availableProducts.find(p => p.itemCode === value || p.code === value || p.name === value);
        if (product) {
          updated.itemDescription = product.name || '';
          updated.unitPrice = product.price || 0;
        }
      }

      return updated;
    }));
  };

  const handleSave = async () => {
    if (setGlobalNotification) {
      setGlobalNotification({msg: "Saving Sales Order...", type: 'success'});
    }

    // Validation
    const validItems = lineItems.filter(item => Number(item.quantityOrdered) > 0 && item.itemCode);
    if (validItems.length === 0) {
      if (setGlobalNotification) setGlobalNotification({msg: "Cannot save: Please add at least one valid item.", type: 'error'});
      return;
    }

    try {
      const payload = {
        orderNo,
        orderDate,
        customer,
        deliveryDate,
        paymentTerms,
        status,
        isInterstate,
        summary,
        items: validItems
      };

      const res = await fetch('http://localhost:5000/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Sales Order Saved Successfully! (Stock Committed)", type: 'success'});
        }
        setStatus('PENDING'); // Lock the state
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Failed to save: " + data.error, type: 'error'});
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Network Error: Could not reach backend server.", type: 'error'});
      }
    }
  };

  // --- Hotkeys ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setLineItems([]);
        handleAddRow();
        setCustomer('');
      } else if (e.key === 'Escape') {
        // Clear focus or abort
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden text-slate-800">
      
      {/* LEFT PANE: Order Meta-Data & Status */}
      <div className="w-[350px] flex-shrink-0 bg-white border-r border-slate-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)] flex flex-col h-full z-10 relative">
        <div className="p-5 flex-1 overflow-y-auto">
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Order Details
            </h2>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
              status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
              status === 'FULFILLED' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {status}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Order No.</label>
              <input 
                type="text" 
                value={orderNo} 
                onChange={e => setOrderNo(e.target.value)}
                className="w-full border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 outline-none" 
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Order Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date" 
                  value={orderDate} 
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full border border-slate-300 text-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Customer</label>
              <select 
                value={customer} 
                onChange={e => setCustomer(e.target.value)}
                className="w-full border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none bg-white"
              >
                <option value="">Search Customers...</option>
                {availableCustomers.map((c, i) => (
                  <option key={i} value={c.accountName}>{c.accountName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Expected Delivery</label>
               <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date" 
                  value={deliveryDate} 
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 text-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Payment Terms</label>
              <select 
                value={paymentTerms} 
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none bg-white"
              >
                <option value="NET 15 DAYS">NET 15 DAYS</option>
                <option value="NET 30 DAYS">NET 30 DAYS</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Advance Payment">Advance Payment</option>
              </select>
            </div>
            
            <div className="pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={isInterstate} onChange={() => setIsInterstate(!isInterstate)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-slate-700">Interstate Sale (Apply IGST)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Grand Total Box (Bottom of Left Pane) */}
        <div className="bg-[#1e293b] p-6 text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Grand Total</span>
          <div className="text-4xl font-bold tracking-tight">
            ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Transaction Matrix & Summary Stack */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Matrix Area */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 font-semibold text-center w-10">#</th>
                    <th className="px-3 py-3 font-semibold w-40">Item Code</th>
                    <th className="px-3 py-3 font-semibold">Description</th>
                    <th className="px-3 py-3 font-semibold w-24 text-center">Qty</th>
                    <th className="px-3 py-3 font-semibold w-28 text-right">Unit Price</th>
                    <th className="px-3 py-3 font-semibold w-20 text-center">Disc %</th>
                    <th className="px-3 py-3 font-semibold w-28 text-right">Taxable</th>
                    <th className="px-3 py-3 font-semibold w-24 text-center">Tax %</th>
                    <th className="px-3 py-3 font-semibold w-32 text-right">Subtotal</th>
                    <th className="px-3 py-3 font-semibold w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, index) => {
                    
                    // On-the-fly calculations for read-only fields
                    const qty = Number(item.quantityOrdered) || 0;
                    const price = Number(item.unitPrice) || 0;
                    const disc = Number(item.discountPercentage) || 0;
                    const taxRate = Number(item.taxRatePercentage) || 0;

                    const taxableAmount = (qty * price) * (1 - (disc / 100));
                    const taxAmount = taxableAmount * (taxRate / 100);
                    const subtotal = taxableAmount + taxAmount;

                    return (
                      <tr key={item.lineId} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-3 py-2 text-center text-sm font-medium text-slate-400">{item.lineIndex}</td>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            className="w-full border-none bg-transparent focus:ring-2 focus:ring-blue-500 rounded text-sm text-slate-800 font-medium outline-none p-1 placeholder-slate-300"
                            value={item.itemCode}
                            onChange={(e) => handleItemChange(item.lineId, 'itemCode', e.target.value)}
                            placeholder="Code/Search"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            className="w-full border-none bg-transparent focus:ring-2 focus:ring-blue-500 rounded text-sm text-slate-700 outline-none p-1 placeholder-slate-300"
                            value={item.itemDescription}
                            onChange={(e) => handleItemChange(item.lineId, 'itemDescription', e.target.value)}
                            placeholder="Item Description"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-1.5 text-sm text-slate-800 outline-none transition-all text-center"
                            value={item.quantityOrdered}
                            onChange={(e) => handleItemChange(item.lineId, 'quantityOrdered', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td className="px-3 py-2">
                           <input 
                            type="number" 
                            className="w-full border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-1.5 text-sm text-slate-800 outline-none transition-all text-right"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(item.lineId, 'unitPrice', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                           <input 
                            type="number" 
                            className="w-full border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-1.5 text-sm text-slate-800 outline-none transition-all text-center"
                            value={item.discountPercentage}
                            onChange={(e) => handleItemChange(item.lineId, 'discountPercentage', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-slate-600 font-medium">
                          {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                           <select 
                            className="w-full border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-md p-1.5 text-sm text-slate-800 outline-none transition-all bg-white text-center"
                            value={item.taxRatePercentage}
                            onChange={(e) => handleItemChange(item.lineId, 'taxRatePercentage', e.target.value)}
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-slate-800">
                          {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button 
                            onClick={() => handleRemoveRow(item.lineId)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={handleAddRow}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-100/50 border border-transparent hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Summary Stack */}
        <div className="bg-white border-t border-slate-200 p-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10 flex justify-between items-end">
          
          <div className="flex gap-4">
             <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm shadow-blue-600/20 transition-all focus:ring-4 focus:ring-blue-600/30">
               Save Order (CTRL+S)
             </button>
             <button className="bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-6 rounded-lg hover:bg-slate-50 transition-all focus:ring-4 focus:ring-slate-200">
               Convert to Bill
             </button>
          </div>

          <div className="w-[300px] flex flex-col space-y-2 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Subtotal (before Tax):</span>
              <span className="font-semibold text-slate-800">₹{summary.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            
            {!isInterstate && (
              <>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Add CGST:</span>
                  <span className="font-semibold text-slate-800">₹{summary.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Add SGST:</span>
                  <span className="font-semibold text-slate-800">₹{summary.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}

            {isInterstate && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Add IGST:</span>
                <span className="font-semibold text-slate-800">₹{summary.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-slate-200">
              <span className="font-medium">Rounding:</span>
              <span>{summary.rounding > 0 ? '+' : ''}{summary.rounding.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center pt-1 text-lg">
              <span className="font-bold text-slate-800">GRAND TOTAL:</span>
              <span className="font-black text-blue-700">₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default SalesOrder;