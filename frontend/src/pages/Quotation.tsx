import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Api from '../Api';
import { 
  FileText, Mail, RefreshCcw, Plus, Trash2, Calendar, 
  ChevronDown, ChevronUp, FileSignature, Loader2 
} from 'lucide-react';

interface LineItem {
  id: string;
  itemCode: string;
  itemDescription: string;
  quantity: number | string;
  unitPrice: number | string;
  discountPercent: number | string;
  taxRate: number | string;
}

const Quotation = () => {
  const navigate = useNavigate();
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: any }>() || {};

  // --- Initializing Dynamic System Dates ---
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const validityTarget = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
  const validityString = validityTarget.toISOString().split('T')[0];

  // --- State Lifecycles (Clean Fresh Entry) ---
  const [quoteNo, setQuoteNo] = useState('QT-LOADING');
  const [quoteDate, setQuoteDate] = useState(todayString);
  const [validityDate, setValidityDate] = useState(validityString);
  const [customer, setCustomer] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED'>('DRAFT');
  const [isInterstate, setIsInterstate] = useState(false); // Regional Accounting Logic

  // Action States
  const [isConverting, setIsConverting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  // Initialize line items with exactly one clean blank array object line
  const generateId = () => Math.random().toString(36).substring(2, 15);
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    id: generateId(),
    itemCode: '',
    itemDescription: '',
    quantity: 1,
    unitPrice: '',
    discountPercent: '',
    taxRate: 18
  }]);

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // --- Fetch Initial Setup Parameters ---
  useEffect(() => {
    // Fetch Next Quotation Sequence
    fetch(`${Api}/quotations/next-sequence`)
      .then(res => res.json())
      .then(data => {
        if (data.quoteNo) setQuoteNo(data.quoteNo);
      })
      .catch(err => console.error("Sequence generator failed", err));

    // Fetch Products (Item Master mock/DB hook)
    fetch(`${Api}/products/search?q=`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Failed to fetch products", err));
  }, []);

  // --- Precision Regional Accounting Logic & Math Matrix ---
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const processedItems = lineItems.map(item => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discountPercent) || 0;
    const taxRate = Number(item.taxRate) || 0;

    const taxableValue = (qty * price) * (1 - disc / 100);
    const taxAmount = taxableValue * (taxRate / 100);

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (isInterstate) {
      igstAmt = taxAmount;
    } else {
      cgstAmt = taxAmount / 2;
      sgstAmt = taxAmount / 2;
    }

    totalTaxable += taxableValue;
    totalCgst += cgstAmt;
    totalSgst += sgstAmt;
    totalIgst += igstAmt;

    return {
      ...item,
      taxableValue,
      taxAmount,
      subtotal: taxableValue + taxAmount
    };
  });

  const rawGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundingOffset = roundedGrandTotal - rawGrandTotal;

  // --- Handlers ---
  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto-populate description and price if a valid itemCode is matched
      if (field === 'itemCode' && value) {
        const product = availableProducts.find(p => p.itemCode === value || p.barcode === value || p.name === value);
        if (product) {
          updated.itemDescription = product.name;
          updated.unitPrice = product.price;
        }
      }
      return updated;
    }));
  };

  const handleAddItem = () => {
    setLineItems(prev => [...prev, {
      id: generateId(),
      itemCode: '',
      itemDescription: '',
      quantity: 1,
      unitPrice: '',
      discountPercent: '',
      taxRate: 18
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  // --- Unified Dynamic Data Validation Matrix ---
  const validateStructuralIntegrity = () => {
    if (lineItems.length === 0) {
      if (setGlobalNotification) setGlobalNotification({msg: "Cannot save: Transaction array contains no lines.", type: "error"});
      return null;
    }

    const validItems = lineItems.filter(item => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return qty > 0 && price > 0 && (item.itemCode.trim() !== '' || item.itemDescription.trim() !== '');
    });

    if (validItems.length === 0) {
      if (setGlobalNotification) setGlobalNotification({msg: "Cannot save: Please add at least one valid item with a price.", type: "error"});
      return null;
    }

    return validItems;
  };

  // --- Pipeline & Inter-Module Hand-Off ---
  const handleConvert = () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return; // Validation failed, halt pipeline

    setIsConverting(true);
    
    // Simulate pipeline hand-off and push array rows cleanly into POSCheckout state
    setTimeout(() => {
      setIsConverting(false);
      setStatus('CONVERTED');
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Quotation Converted! Moving to Sales Bill...", type: "success"});
      }

      const quotationPayload = {
        invoiceNo: 'AUTO',
        buyerName: customer || 'Cash Sale',
        items: validItems.map(item => ({
          itemName: item.itemDescription || item.itemCode,
          itemDesc: item.itemCode,
          qty: Number(item.quantity) || 0,
          rate: Number(item.unitPrice) || 0,
          discPercent: Number(item.discountPercent) || 0,
          taxPercent: Number(item.taxRate) || 0
        })),
        isInterstate
      };

      // Navigate downstream to Sales Bill (POSCheckout) mapping the payload
      setTimeout(() => navigate('/pos', { state: { quotationPayload } }), 800);
    }, 1000);
  };

  const handleEmail = async () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return; // Halt exhaustive merge

    setIsEmailing(true);
    
    try {
      const response = await fetch(`${Api}/quotations/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNo,
          quoteDate,
          customer: customer || 'Valued Customer',
          totalAmount: roundedGrandTotal,
          items: validItems
        })
      });
      
      const data = await response.json();
      if (data.success) {
        if (status === 'DRAFT') setStatus('SENT');
        if (setGlobalNotification) setGlobalNotification({msg: "Quotation Email Sent Successfully!", type: "success"});
      } else {
        if (setGlobalNotification) setGlobalNotification({msg: `Email Failed: ${data.details || 'Unknown Error'}`, type: "error"});
      }
    } catch (error: any) {
      console.error(error);
      if (setGlobalNotification) setGlobalNotification({msg: `Network Error: ${error.message}`, type: "error"});
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <div className="h-full bg-[#f8fafc] text-slate-800 p-6 flex flex-col gap-6 overflow-y-auto">
      {/* Top Banner */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <FileSignature className="text-indigo-600" />
            Dynamic Quotation Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">Generate fresh estimates and convert them into tax bills seamlessly.</p>
        </div>
        
        <div className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase ${
          status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
          status === 'SENT' ? 'bg-blue-100 text-blue-700' :
          status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
          'bg-purple-100 text-purple-700'
        }`}>
          {status}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT PANE: Details */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Quotation Meta-Data</h3>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quote No.</label>
              <input type="text" value={quoteNo} readOnly className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-3 py-2 text-sm font-medium" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
              <input 
                type="text" 
                value={customer} 
                onChange={(e) => setCustomer(e.target.value)} 
                className="w-full border border-slate-300 text-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" 
                placeholder="Search or Select Customer From Ledger..." 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Quote Date</label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Validity Date</label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms</label>
              <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full border border-slate-300 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Payment Window Terms...</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={isInterstate} onChange={() => setIsInterstate(!isInterstate)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-medium text-slate-700">Interstate Supply (IGST Only)</span>
              </label>
            </div>
          </div>

          {/* Workflow Action Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-2">Workflow Hand-Off</h3>
            
            <button 
              onClick={handleConvert} 
              disabled={isConverting || status === 'CONVERTED'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-600/20"
            >
              {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {status === 'CONVERTED' ? 'Already Converted' : 'Convert to Tax Bill'}
            </button>
            
            <button 
              onClick={handleEmail} 
              disabled={isEmailing}
              className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Email Quotation
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Grid & Totals */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-3 py-3 w-36">Item Code</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 w-20 text-center">Qty</th>
                    <th className="px-3 py-3 w-28 text-right">Unit Price</th>
                    <th className="px-3 py-3 w-20 text-center">Disc %</th>
                    <th className="px-3 py-3 w-28 text-right">Taxable</th>
                    <th className="px-3 py-3 w-24 text-center">Tax %</th>
                    <th className="px-3 py-3 w-32 text-right">Subtotal</th>
                    <th className="px-3 py-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-2 text-center text-sm font-medium text-slate-400">{index + 1}</td>
                      <td className="px-3 py-2">
                        <input 
                          type="text" 
                          className="w-full border-none bg-transparent focus:ring-2 focus:ring-indigo-500 rounded p-1 text-sm font-medium outline-none placeholder-slate-300"
                          value={item.itemCode}
                          onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)}
                          placeholder="Search Item..."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          type="text" 
                          className="w-full border-none bg-transparent focus:ring-2 focus:ring-indigo-500 rounded p-1 text-sm outline-none placeholder-slate-300"
                          value={item.itemDescription}
                          onChange={(e) => handleItemChange(item.id, 'itemDescription', e.target.value)}
                          placeholder="Custom description..."
                        />
                      </td>
                      <td className="px-3 py-2">
                         <input 
                          type="number" 
                          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded text-center p-1.5 text-sm outline-none transition-all"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          min="1"
                        />
                      </td>
                      <td className="px-3 py-2">
                         <input 
                          type="number" 
                          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded text-right p-1.5 text-sm outline-none transition-all"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                         <input 
                          type="number" 
                          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded text-center p-1.5 text-sm outline-none transition-all"
                          value={item.discountPercent}
                          onChange={(e) => handleItemChange(item.id, 'discountPercent', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-600">
                        {item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                         <select 
                          className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded bg-white text-center p-1.5 text-sm outline-none transition-all"
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(item.id, 'taxRate', e.target.value)}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-slate-800">
                        {item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={handleAddItem}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-indigo-100/50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
            </div>
          </div>

          {/* Precision Regional Accounting Summary Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 ml-auto w-full max-w-sm">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Subtotal (before Tax):</span>
                <span className="font-semibold text-slate-800">₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              
              {!isInterstate ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-medium">Add CGST:</span>
                    <span className="font-semibold text-slate-800">₹{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-medium">Add SGST:</span>
                    <span className="font-semibold text-slate-800">₹{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Add IGST:</span>
                  <span className="font-semibold text-slate-800">₹{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-3">
                <span className="font-medium">Rounding:</span>
                <span>{roundingOffset > 0 ? '+' : ''}{roundingOffset.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-slate-800">GRAND TOTAL:</span>
                <span className="text-2xl font-black text-indigo-700">
                  ₹{roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Quotation;