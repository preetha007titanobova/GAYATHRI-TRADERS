import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Api from '../Api';
import { printReceipt } from '../utils/printReceipt';
import { sendWhatsAppTextMessage } from '../utils/whatsappHelper';
import { useLicense } from '../context/LicenseContext';
import {
  Mail, RefreshCcw, Plus, Trash2, Calendar,
  FileSignature, Loader2, Search, Save, MessageCircle, Printer, ListFilter
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
  const { shopName } = useLicense();
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: any }>() || {};

  // --- Initializing Dynamic System Dates ---
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const validityTarget = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
  const validityString = validityTarget.toISOString().split('T')[0];

  // --- State Lifecycles ---
  const [quoteNo, setQuoteNo] = useState('QT-LOADING');
  const [quoteDate, setQuoteDate] = useState(todayString);
  const [validityDate, setValidityDate] = useState(validityString);
  const [customer, setCustomer] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [status, setStatus] = useState<'SAVED' | 'SENT' | 'ACCEPTED' | 'CONVERTED'>('SAVED');
  const [isInterstate, setIsInterstate] = useState(false);

  // Action States
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  // Initialize line items with one clean blank row
  const generateId = () => Math.random().toString(36).substring(2, 15);
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    id: generateId(),
    itemCode: '',
    itemDescription: '',
    quantity: 1,
    unitPrice: '',
    discountPercent: '',
    taxRate: 0
  }]);

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Product Selection Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter products for modal
  const modalFilteredProducts = useMemo(() => {
    const q = modalSearchQuery.toLowerCase().trim();
    if (!q) return availableProducts;
    return availableProducts.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.variety?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q)
    );
  }, [availableProducts, modalSearchQuery]);

  const selectProductFromModal = (prod: any) => {
    if (!activeRowId) return;
    handleItemChange(activeRowId, 'itemCode', prod.itemCode || '');
    setIsProductModalOpen(false);
    setModalSearchQuery('');
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedProductIndex(prev => Math.min(prev + 1, modalFilteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedProductIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (modalFilteredProducts[highlightedProductIndex]) {
        selectProductFromModal(modalFilteredProducts[highlightedProductIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsProductModalOpen(false);
    }
  };

  useEffect(() => {
    if (isProductModalOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isProductModalOpen]);

  // Fetch sequence & available products
  const fetchNextSequence = () => {
    fetch(`${Api}/quotations/next-sequence`)
      .then(res => res.json())
      .then(data => {
        if (data.quoteNo) setQuoteNo(data.quoteNo);
      })
      .catch(err => console.error("Sequence generator failed", err));
  };

  useEffect(() => {
    fetchNextSequence();

    fetch(`${Api}/products/search?q=`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Failed to fetch products", err));
  }, []);

  // Accounting calculations
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
  const totalQty = lineItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

  // Handlers
  // Validation Errors state
  const [formErrors, setFormErrors] = useState<{ customer?: string; mobileNo?: string; items?: string }>({});

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      if (field === 'itemCode' && value) {
        const product = availableProducts.find(p => p.itemCode === value || p.barcode === value || p.name === value);
        if (product) {
          updated.itemDescription = product.name;
          updated.unitPrice = product.price;
        }
      }

      if (field === 'quantity') {
        const reqQty = Number(value) || 0;
        const match = availableProducts.find(p =>
          (p.itemCode && p.itemCode === updated.itemCode) ||
          (p.barcode && p.barcode === updated.itemCode) ||
          (p.name && updated.itemDescription && p.name.toLowerCase() === updated.itemDescription.toLowerCase())
        );
        if (match) {
          const avail = typeof match.stock === 'number' ? match.stock : 0;
          if (reqQty > avail) {
            if (setGlobalNotification) {
              setGlobalNotification({
                msg: `⚠️ Stock Limit Warning: "${match.name}" has only ${avail} PCS in stock. Requested quantity (${reqQty}) exceeds stock.`,
                type: 'error'
              });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
            }
          }
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
      taxRate: 0
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const validateStructuralIntegrity = () => {
    const errors: { customer?: string; mobileNo?: string; items?: string } = {};

    if (!customer || !customer.trim()) {
      errors.customer = "Customer Name is a mandatory field.";
    }

    const cleanMobile = (mobileNo || '').replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      errors.mobileNo = "Customer Phone Number is mandatory (minimum 10 digits).";
    }

    if (lineItems.length === 0) {
      errors.items = "Cannot save: Quotation contains no item lines.";
    }

    const validItems = lineItems.filter(item => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return qty > 0 && price > 0 && (item.itemCode.trim() !== '' || item.itemDescription.trim() !== '');
    });

    if (validItems.length === 0 && !errors.items) {
      errors.items = "Cannot save: Please add at least one valid item with Quantity > 0 and Unit Price > 0.";
    }

    // Strict Stock Check for Quotation Line Items
    for (const item of validItems) {
      const match = availableProducts.find(p =>
        (p.itemCode && p.itemCode === item.itemCode) ||
        (p.barcode && p.barcode === item.itemCode) ||
        (p.name && item.itemDescription && p.name.toLowerCase() === item.itemDescription.toLowerCase())
      );
      if (match) {
        const avail = typeof match.stock === 'number' ? match.stock : 0;
        const totalQtyForProduct = lineItems.reduce((acc, l) => {
          const isMatch = (l.itemCode && item.itemCode && l.itemCode === item.itemCode) ||
                          (l.itemDescription && item.itemDescription && l.itemDescription.toLowerCase() === item.itemDescription.toLowerCase());
          return isMatch ? acc + (Number(l.quantity) || 0) : acc;
        }, 0);

        if (avail <= 0) {
          errors.items = `Cannot save quotation! "${match.name}" is OUT OF STOCK (0 PCS available).`;
          break;
        }
        if (totalQtyForProduct > avail) {
          errors.items = `Cannot save quotation! "${match.name}" requested quantity (${totalQtyForProduct}) exceeds available stock (${avail} PCS).`;
          break;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (setGlobalNotification) {
        const firstErr = errors.customer || errors.mobileNo || errors.items;
        setGlobalNotification({ msg: `⚠️ Form Validation Failed: ${firstErr}`, type: "error" });
      }
      return null;
    }

    setFormErrors({});
    return validItems;
  };

  // Save Quotation Handler
  const handleSaveQuotation = async () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return;

    setIsSaving(true);
    const quotationPayload = {
      quoteNo,
      quoteDate,
      validityDate,
      customer: customer || 'CASH CUSTOMER',
      mobileNo,
      paymentTerms,
      isInterstate,
      status: 'SAVED',
      totalQty,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      roundedGrandTotal,
      items: validItems
    };

    try {
      const response = await fetch(`${Api}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotationPayload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStatus('SAVED');
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Quotation ${quoteNo} Saved to Database Successfully!`, type: "success" });
        }
        fetchNextSequence();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Save Failed: ${data.error || 'Unknown Error'}`, type: "error" });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (setGlobalNotification) setGlobalNotification({ msg: `Network Error: ${err.message}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // Direct WhatsApp Share Handler (Saves to database & shares)
  const handleWhatsAppShare = async () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return;

    let targetMobile = mobileNo.replace(/\D/g, '');
    if (!targetMobile) {
      if (setGlobalNotification) setGlobalNotification({ msg: "Please enter customer mobile number to share via WhatsApp.", type: "error" });
      return;
    }

    if (targetMobile.length === 10) targetMobile = `91${targetMobile}`;

    // Auto-save quotation to database table
    const quotationPayload = {
      quoteNo,
      quoteDate,
      validityDate,
      customer: customer || 'CASH CUSTOMER',
      mobileNo,
      paymentTerms,
      isInterstate,
      status: 'SENT',
      totalQty,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      roundedGrandTotal,
      items: validItems
    };

    try {
      const response = await fetch(`${Api}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotationPayload)
      });

      if (response.ok) {
        setStatus('SENT');
        fetchNextSequence();
      }
    } catch (err) {
      console.error("Auto-save on WhatsApp share error:", err);
    }

    const itemsText = validItems.map((it, idx) =>
      `${idx + 1}. ${it.itemDescription || it.itemCode} x ${it.quantity} @ ₹${it.unitPrice} = ₹${((Number(it.quantity) * Number(it.unitPrice)) * (1 - (Number(it.discountPercent) || 0) / 100)).toFixed(2)}`
    ).join('\n');

    const message = `*🧾 ESTIMATE QUOTATION - ${shopName || 'STORE'}*\n` +
      `----------------------------------------\n` +
      `📌 *Quote No:* ${quoteNo}\n` +
      `📅 *Date:* ${quoteDate}\n` +
      `👤 *Customer:* ${customer || 'Valued Customer'}\n` +
      `----------------------------------------\n` +
      `*ITEMS:*\n${itemsText}\n` +
      `----------------------------------------\n` +
      `💰 *GRAND TOTAL:* ₹${roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `----------------------------------------\n` +
      `Thank you for choosing us!`;

    sendWhatsAppTextMessage(targetMobile, message);
    if (setGlobalNotification) setGlobalNotification({ msg: `Quotation ${quoteNo} Saved to Register & Shared via WhatsApp!`, type: "success" });
  };

  const handleConvert = () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return;

    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      setStatus('CONVERTED');
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Quotation Converted! Moving to Sales Bill...", type: "success" });
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

      setTimeout(() => navigate('/sales-bill', { state: { quotationPayload } }), 600);
    }, 800);
  };

  const handlePrintQuote = () => {
    const validItems = validateStructuralIntegrity();
    if (!validItems) return;

    const formattedItems = validItems.map(item => {
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

    const storePhone = localStorage.getItem('close_day_whatsapp') || '';

    printReceipt({
      gridData: formattedItems,
      invoiceNo: quoteNo,
      date: quoteDate,
      customerName: customer || 'VALUED CUSTOMER',
      paymentMode: paymentTerms || 'N/A',
      totalQty: totalQty,
      subTotal: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      totalAmount: roundedGrandTotal,
      storeName: shopName,
      storePhone: storePhone,
      receiptTitle: 'QUOTATION'
    });
  };

  return (
    <div className="flex flex-col h-full space-y-2 p-3 bg-[#f8fafc]">

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 border border-blue-700 p-2.5 rounded-md shadow-md text-white flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-1.5 rounded text-white shadow-sm">
            <FileSignature size={18} />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide text-blue-50">DYNAMIC ESTIMATE & QUOTATION ENGINE</h2>
            <p className="text-[11px] text-blue-200">Generate estimates, share on WhatsApp, and save to database table</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/quotation-register')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded text-xs shadow flex items-center space-x-1"
          >
            <ListFilter size={14} />
            <span>Quotation Register (History)</span>
          </button>
          <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase ${
            status === 'CONVERTED' ? 'bg-purple-600 text-white' :
            status === 'SENT' ? 'bg-blue-600 text-white' :
            'bg-emerald-600 text-white'
          }`}>
            {status}
          </div>
        </div>
      </div>

      {/* 2. Main Document Input Panel */}
      <div className="legacy-panel p-2.5 text-xs grid grid-cols-12 gap-x-2 gap-y-1.5 items-center shrink-0">
        <label className="legacy-label text-right">Customer</label>
        <div className="col-span-3 relative flex flex-col">
          <input
            type="text"
            className={`legacy-input w-full font-bold text-blue-900 bg-blue-50 py-0.5 px-2 focus:bg-yellow-50 outline-none border rounded-sm ${
              formErrors.customer ? 'border-2 border-red-500 bg-red-50 text-red-900' : 'border-gray-300'
            }`}
            value={customer}
            onChange={e => {
              setCustomer(e.target.value);
              if (formErrors.customer) setFormErrors(prev => ({ ...prev, customer: undefined }));
            }}
            placeholder="Customer Name..."
          />
          {formErrors.customer && (
            <span className="text-[10px] font-bold text-red-600 animate-pulse">⚠️ {formErrors.customer}</span>
          )}
        </div>

        <label className="legacy-label text-right">Mobile No</label>
        <div className="col-span-2 relative flex flex-col">
          <input
            type="text"
            className={`legacy-input w-full font-bold text-gray-800 bg-white py-0.5 px-2 focus:bg-yellow-50 outline-none border rounded-sm font-mono ${
              formErrors.mobileNo ? 'border-2 border-red-500 bg-red-50 text-red-900' : 'border-gray-300'
            }`}
            value={mobileNo}
            onChange={e => {
              setMobileNo(e.target.value);
              if (formErrors.mobileNo) setFormErrors(prev => ({ ...prev, mobileNo: undefined }));
            }}
            placeholder="10-digit Mobile..."
          />
          {formErrors.mobileNo && (
            <span className="text-[10px] font-bold text-red-600 animate-pulse">⚠️ {formErrors.mobileNo}</span>
          )}
        </div>

        <label className="legacy-label text-right">Quote No</label>
        <input type="text" className="legacy-input col-span-2 font-bold py-0.5 font-mono text-center bg-gray-100" value={quoteNo} disabled />

        <label className="legacy-label text-right">Quote Date</label>
        <input type="date" className="legacy-input col-span-2 py-0.5 font-bold" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />

        <label className="legacy-label text-right">E.Type</label>
        <select className="legacy-input col-span-2 py-0.5 font-bold" value={isInterstate ? 'Interstate' : 'Local'} onChange={e => setIsInterstate(e.target.value === 'Interstate')}>
          <option value="Local">Local</option>
          <option value="Interstate">Interstate</option>
        </select>

        <label className="legacy-label text-right">Validity Date</label>
        <input type="date" className="legacy-input col-span-2 py-0.5 font-bold" value={validityDate} onChange={e => setValidityDate(e.target.value)} />

        <label className="legacy-label text-right">Payment Terms</label>
        <select className="legacy-input col-span-3 py-0.5 font-bold" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
          <option value="">Select Payment Window Terms...</option>
          <option value="Net 15 Days">Net 15 Days</option>
          <option value="Net 30 Days">Net 30 Days</option>
          <option value="Cash on Delivery">Cash on Delivery</option>
        </select>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex space-x-2 bg-slate-50 p-1.5 border border-gray-300 rounded shadow-sm w-fit mb-1 mx-1">
        <button
          onClick={handleAddItem}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> <span>Add Row</span>
        </button>

        <button
          onClick={handleSaveQuotation}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Quotation</span>
        </button>

        <button
          onClick={handleWhatsAppShare}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Share WhatsApp</span>
        </button>

        {/* <button
          onClick={handlePrintQuote}
          className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Receipt</span>
        </button> */}

        <button
          onClick={handleConvert}
          disabled={isConverting || status === 'CONVERTED'}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-extrabold py-1.5 px-3 rounded text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          {isConverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          <span>{status === 'CONVERTED' ? 'Converted to Tax Bill' : 'Convert to Tax Bill'}</span>
        </button>
      </div>

      {/* 3. Data Entry Grid */}
      <div className="flex-1 min-h-[160px] max-h-[240px] bg-white border border-gray-400 overflow-auto mx-1 shadow-sm">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-max">
          <thead className="bg-[#2b579a] text-white sticky top-0 z-10">
            <tr>
              <th className="border-r border-gray-400 p-2 w-10 text-center font-semibold">S.No</th>
              <th className="border-r border-gray-400 p-2 w-44 font-semibold">Item Code</th>
              <th className="border-r border-gray-400 p-2 font-semibold">Item Description</th>
              <th className="border-r border-gray-400 p-2 w-16 text-center font-semibold">Qty</th>
              <th className="border-r border-gray-400 p-2 w-24 text-right font-semibold">Unit Price</th>
              <th className="border-r border-gray-400 p-2 w-16 text-center font-semibold">Disc %</th>
              <th className="border-r border-gray-400 p-2 w-24 text-right font-semibold">Taxable</th>
              <th className="border-r border-gray-400 p-2 w-20 text-center font-semibold">Tax %</th>
              <th className="border-r border-gray-400 p-2 w-28 text-right font-semibold">Subtotal</th>
              <th className="p-2 w-10 text-center font-semibold">Del</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item, index) => (
              <tr key={item.id} className="hover:bg-yellow-50 border-b border-gray-300 focus-within:bg-blue-50 transition-colors">
                <td className="border-r border-gray-300 p-2 text-center font-semibold text-gray-500 bg-gray-50">{index + 1}</td>
                <td className="border-r border-gray-300 p-0 relative">
                  <div className="flex items-center relative w-full h-full">
                    <input
                      type="text"
                      className="w-full h-full p-2 border-none outline-none focus:bg-yellow-100 font-mono text-blue-900 font-bold uppercase text-xs"
                      value={item.itemCode}
                      onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          const found = availableProducts.find(p => p.itemCode?.toLowerCase() === val.toLowerCase() || p.barcode?.toLowerCase() === val.toLowerCase());
                          if (!found) {
                            e.preventDefault();
                            setActiveRowId(item.id);
                            setModalSearchQuery(val);
                            setHighlightedProductIndex(0);
                            setIsProductModalOpen(true);
                          }
                        }
                      }}
                      onDoubleClick={() => {
                        setActiveRowId(item.id);
                        setModalSearchQuery(item.itemCode || '');
                        setHighlightedProductIndex(0);
                        setIsProductModalOpen(true);
                      }}
                      placeholder="Double click..."
                    />
                    <button
                      onClick={() => {
                        setActiveRowId(item.id);
                        setModalSearchQuery(item.itemCode || '');
                        setHighlightedProductIndex(0);
                        setIsProductModalOpen(true);
                      }}
                      type="button"
                      className="absolute right-1 px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded transition-colors shadow-sm"
                      title="Search dress table"
                    >
                      Find
                    </button>
                  </div>
                </td>
                <td className="border-r border-gray-300 p-0">
                  <input
                    type="text"
                    className="w-full h-full p-2 border-none outline-none focus:bg-yellow-100 font-semibold text-gray-800 text-xs"
                    value={item.itemDescription}
                    onChange={(e) => handleItemChange(item.id, 'itemDescription', e.target.value)}
                    placeholder="Custom description..."
                  />
                </td>
                <td className="border-r border-gray-300 p-0 relative">
                  {(() => {
                    const match = availableProducts.find(p =>
                      (p.itemCode && p.itemCode === item.itemCode) ||
                      (p.barcode && p.barcode === item.itemCode) ||
                      (p.name && item.itemDescription && p.name.toLowerCase() === item.itemDescription.toLowerCase())
                    );
                    const availStock = match ? (typeof match.stock === 'number' ? match.stock : 0) : null;
                    const totalQtyInCurrentQuote = lineItems.reduce((acc, l) => {
                      const isMatch = (l.itemCode && item.itemCode && l.itemCode === item.itemCode) ||
                                      (l.itemDescription && item.itemDescription && l.itemDescription.toLowerCase() === item.itemDescription.toLowerCase());
                      return isMatch ? acc + (Number(l.quantity) || 0) : acc;
                    }, 0);
                    const isExceeding = availStock !== null && totalQtyInCurrentQuote > availStock;

                    return (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <input
                          type="number"
                          className={`w-full h-full p-2 text-center outline-none font-bold text-xs ${
                            isExceeding
                              ? 'bg-red-100 text-red-900 border-2 border-red-500 font-extrabold ring-1 ring-red-400'
                              : 'border-none focus:bg-yellow-100'
                          }`}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          min="1"
                        />
                        {isExceeding && (
                          <span
                            className="absolute -top-3 right-0 bg-red-600 text-white text-[9px] font-extrabold px-1 rounded shadow z-10 whitespace-nowrap animate-pulse pointer-events-none"
                            title={`Total requested (${totalQtyInCurrentQuote}) exceeds available stock (${availStock} PCS)`}
                          >
                            ⚠️ Max: {availStock}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="border-r border-gray-300 p-0">
                  <input
                    type="number"
                    className="w-full h-full p-2 text-right border-none outline-none focus:bg-yellow-100 font-mono font-bold text-xs"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                  />
                </td>
                <td className="border-r border-gray-300 p-0">
                  <input
                    type="number"
                    className="w-full h-full p-2 text-center border-none outline-none focus:bg-yellow-100 font-bold text-xs"
                    value={item.discountPercent}
                    onChange={(e) => handleItemChange(item.id, 'discountPercent', e.target.value)}
                  />
                </td>
                <td className="border-r border-gray-300 p-2 text-right bg-gray-50 font-mono text-gray-600">
                  ₹{item.taxableValue.toFixed(2)}
                </td>
                <td className="border-r border-gray-300 p-0">
                  <input
                    type="number"
                    className="w-full h-full p-2 text-center border-none outline-none focus:bg-yellow-100 font-bold text-xs text-amber-900 font-mono"
                    value={item.taxRate}
                    onChange={(e) => handleItemChange(item.id, 'taxRate', e.target.value)}
                    placeholder="Tax %"
                  />
                </td>
                <td className="border-r border-gray-300 p-2 text-right bg-gray-50 font-bold font-mono text-gray-900">
                  ₹{item.subtotal.toFixed(2)}
                </td>
                <td className="text-center p-0 bg-gray-50">
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 hover:text-red-700 font-bold p-1 rounded hover:bg-red-50 transition-all text-xs"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Totals Panel */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <div className="col-span-2 flex flex-col justify-end pb-1"></div>

        <div className="legacy-panel p-2 grid grid-cols-4 gap-x-2 gap-y-0.5 items-center text-xs font-semibold">
          <label className="legacy-label col-span-2 text-right">Total Qty</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5" value={totalQty} disabled />

          <label className="legacy-label col-span-2 text-right">Total Taxable</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5 font-mono text-gray-700" value={`₹${totalTaxable.toFixed(2)}`} disabled />

          {!isInterstate ? (
            <>
              <label className="legacy-label col-span-2 text-right">CGST</label>
              <input type="text" className="legacy-input col-span-2 text-right py-0.5 font-mono text-gray-600" value={`₹${totalCgst.toFixed(2)}`} disabled />

              <label className="legacy-label col-span-2 text-right">SGST</label>
              <input type="text" className="legacy-input col-span-2 text-right py-0.5 font-mono text-gray-600" value={`₹${totalSgst.toFixed(2)}`} disabled />
            </>
          ) : (
            <>
              <label className="legacy-label col-span-2 text-right">IGST</label>
              <input type="text" className="legacy-input col-span-2 text-right py-0.5 font-mono text-gray-600" value={`₹${totalIgst.toFixed(2)}`} disabled />
            </>
          )}

          <label className="legacy-label col-span-2 text-right text-gray-400">Rounding</label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5 font-mono text-gray-400" value={roundingOffset > 0 ? `+${roundingOffset.toFixed(2)}` : roundingOffset.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 text-right text-sm font-bold text-blue-900">GRAND TOTAL</label>
          <input type="text" className="legacy-input col-span-2 text-right text-sm font-bold bg-[#e6f2ff] border-blue-500 text-blue-900 py-0.5 font-mono" value={`₹${roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} disabled />
        </div>
      </div>

      {/* Dress Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-xs" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }} onClick={() => setIsProductModalOpen(false)}>
          <div
            className="bg-white shadow-2xl flex flex-col border border-gray-300 rounded-lg overflow-hidden w-full max-w-4xl h-[500px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#2b579a] text-white px-4 py-3 flex justify-between items-center shadow-md">
              <div className="flex items-center space-x-2">
                <Search size={18} />
                <span className="font-bold tracking-wide text-sm">Product Lookup</span>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-white hover:text-red-300 font-bold focus:outline-none text-lg">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-100 border-b border-gray-300 flex items-center justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by dress name, code, variety, size..."
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-inner font-semibold"
                  value={modalSearchQuery}
                  onChange={e => {
                    setModalSearchQuery(e.target.value);
                    setHighlightedProductIndex(0);
                  }}
                  onKeyDown={handleModalKeyDown}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <div className="col-span-2">Item Code</div>
              <div className="col-span-4">Item Name</div>
              <div className="col-span-2">Variety</div>
              <div className="col-span-1 text-center">Size</div>
              <div className="col-span-1 text-center">Stock</div>
              <div className="col-span-2 text-right">Price (₹)</div>
            </div>

            <div className="overflow-y-auto flex-1 bg-white">
              {modalFilteredProducts.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-100 cursor-pointer items-center text-sm transition-colors ${idx === highlightedProductIndex ? 'bg-blue-100 text-blue-900 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-800'}`}
                  onClick={() => selectProductFromModal(p)}
                >
                  <div className="col-span-2 font-mono font-bold text-blue-700">
                    {p.itemCode || '-'}
                  </div>
                  <div className="col-span-4 font-semibold">
                    {p.name}
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 w-fit">
                    {p.variety || '-'}
                  </div>
                  <div className="col-span-1 text-center font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 text-xs">
                    {p.size || '-'}
                  </div>
                  <div className="col-span-1 text-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${p.stock > 10 ? 'bg-green-100 text-green-800' : p.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {p.stock}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-extrabold text-slate-800">
                    {Number(p.price || 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {modalFilteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 italic">
                  No matching products found in catalog.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotation;