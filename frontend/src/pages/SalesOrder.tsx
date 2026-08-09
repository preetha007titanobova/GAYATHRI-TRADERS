import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Calendar, FileText, ArrowLeft, RefreshCw, ClipboardList, Search, MessageCircle, Save } from 'lucide-react';
import Api from '../Api';

interface SalesOrderItemLine {
  lineId: string;
  orderId: string;
  lineIndex: number;
  productId?: string;
  itemCode: string;
  itemDescription: string;
  weight?: string;
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

const printOrder = (order: any) => {
  const existingIframe = document.getElementById('printOrderIframe');
  if (existingIframe) {
    document.body.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'printOrderIframe';
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '210mm'; // A4 width
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const orderDateStr = new Date(order.orderDate).toLocaleDateString('en-IN');
  const deliveryDateStr = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'N/A';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Order - ${order.orderNo || order.orderNumber}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            color: #333;
            font-size: 14px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #2b579a;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .shop-name {
            font-size: 24px;
            font-weight: bold;
            color: #2b579a;
            margin: 0;
            text-transform: uppercase;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin: 5px 0 0 0;
            letter-spacing: 1px;
          }
          .info-table {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
          }
          .info-table td {
            padding: 5px;
            vertical-align: top;
          }
          .info-title {
            font-weight: bold;
            color: #555;
            width: 150px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .items-table th, .items-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .items-table th {
            background-color: #f2f2f2;
            color: #2b579a;
            font-weight: bold;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .summary-container {
            float: right;
            width: 300px;
            margin-bottom: 30px;
          }
          .summary-line {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 13px;
          }
          .summary-line.total {
            font-size: 16px;
            font-weight: bold;
            border-top: 1px solid #333;
            padding-top: 8px;
            color: #2b579a;
          }
          .footer {
            margin-top: 50px;
            clear: both;
            border-top: 1px solid #eee;
            padding-top: 15px;
          }
          .terms {
            font-size: 11px;
            color: #777;
            width: 60%;
            float: left;
          }
          .signatures {
            float: right;
            width: 35%;
            text-align: center;
            margin-top: 20px;
          }
          .sig-line {
            border-top: 1px solid #999;
            margin-top: 40px;
            padding-top: 5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="shop-name">BILLING SOFTWARE</h1>
          <div class="title">SALES ORDER</div>
        </div>

        <table class="info-table">
          <tr>
            <td>
              <div><span class="info-title">Order Number:</span> <strong>${order.orderNo || order.orderNumber}</strong></div>
              <div><span class="info-title">Order Date:</span> ${orderDateStr}</div>
              <div><span class="info-title">Expected Delivery:</span> <strong>${deliveryDateStr}</strong></div>
              <div><span class="info-title">Status:</span> <span style="text-transform: uppercase;">${order.status}</span></div>
            </td>
            <td style="text-align: right;">
              <div><strong>Customer Details:</strong></div>
              <div>Name: ${order.customer || order.buyerName || 'Walk-in Customer'}</div>
              ${order.mobileNo ? `<div>Phone: ${order.mobileNo}</div>` : ''}
              ${order.address ? `<div>Address: ${order.address}</div>` : ''}
            </td>
          </tr>
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">S.No</th>
              <th style="width: 15%;">Item Code</th>
              <th>Description</th>
              <th style="width: 15%;">Weight (Net Wt)</th>
              <th style="width: 10%;" class="text-center">Qty Ordered</th>
              <th style="width: 12%;" class="text-right">Unit Price</th>
              <th style="width: 10%;" class="text-center">Disc %</th>
              <th style="width: 15%;" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any, idx: number) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${item.itemCode || '-'}</td>
                <td>${item.itemDescription || item.itemName || 'Unknown Item'}</td>
                <td>${item.weight || '-'}</td>
                <td class="text-center">${item.quantityOrdered || item.orderedQty}</td>
                <td class="text-right">₹${Number(item.unitPrice).toFixed(2)}</td>
                <td class="text-center">${item.discountPercentage || item.discount || 0}%</td>
                <td class="text-right">₹${Number(item.lineSubTotal || item.lineTotal).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-line">
            <span>Subtotal:</span>
            <span>₹${Number(order.summary?.subtotal || order.subtotal).toFixed(2)}</span>
          </div>
          ${(order.summary?.cgst || order.cgst) > 0 ? `
          <div class="summary-line">
            <span>CGST:</span>
            <span>₹${Number(order.summary?.cgst || order.cgst).toFixed(2)}</span>
          </div>` : ''}
          ${(order.summary?.sgst || order.sgst) > 0 ? `
          <div class="summary-line">
            <span>SGST:</span>
            <span>₹${Number(order.summary?.sgst || order.sgst).toFixed(2)}</span>
          </div>` : ''}
          ${(order.summary?.igst || order.igst) > 0 ? `
          <div class="summary-line">
            <span>IGST:</span>
            <span>₹${Number(order.summary?.igst || order.igst).toFixed(2)}</span>
          </div>` : ''}
          <div class="summary-line">
            <span>Rounding:</span>
            <span>₹${Number(order.summary?.rounding || order.roundOff || 0).toFixed(2)}</span>
          </div>
          <div class="summary-line total">
            <span>Grand Total:</span>
            <span>₹${Number(order.summary?.grandTotal || order.grandTotal).toFixed(2)}</span>
          </div>
          <div class="summary-line" style="font-weight: bold; color: #15803d; border-top: 1px dashed #ddd; padding-top: 4px;">
            <span>Advance Paid:</span>
            <span>₹${Number(order.advancePaid || 0).toFixed(2)}</span>
          </div>
          <div class="summary-line" style="font-weight: bold; color: #b91c1c;">
            <span>Balance Due:</span>
            <span>₹${Number(order.balanceAmount || (order.summary?.grandTotal - order.advancePaid) || 0).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <div class="terms">
            <strong>Terms & Conditions:</strong>
            <ol style="margin: 5px 0; padding-left: 15px;">
              <li>Goods once ordered cannot be cancelled or returned.</li>
              <li>Expected delivery dates are estimates subject to transport availability.</li>
              <li>Balance amount must be cleared prior to or at the time of final delivery.</li>
            </ol>
          </div>

          <div class="signatures">
            <div class="sig-line">Authorized Signature</div>
          </div>
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  if ((window as any).api) {
    (window as any).api.send('print-html', htmlContent);
  } else {
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 250);
  }
};

const SalesOrder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};
  
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // --- Left Pane State ---
  const [status, setStatus] = useState<string>('Open');
  const [orderNo, setOrderNo] = useState('SO-AUTO');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [salesman, setSalesman] = useState('');
  const [isInterstate, setIsInterstate] = useState(false);
  const [advancePaid, setAdvancePaid] = useState<number | string>('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // Customer financial info
  const [creditLimit, setCreditLimit] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);

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
    grandTotal: 0,
    discount: 0
  });

  const isReadOnly = status === 'Completed' || status === 'Cancelled';

  // Dress Selection Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter products for the modal search list
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

  // Handle select product from modal
  const selectProductFromModal = (prod: any) => {
    if (!activeRowId) return;
    handleItemChange(activeRowId, 'itemCode', prod.itemCode || '');
    setIsProductModalOpen(false);
    setModalSearchQuery('');
  };

  // Handle keyboard events in modal search
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

  // Focus modal input on open
  useEffect(() => {
    if (isProductModalOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isProductModalOpen]);

  // Fetch initial data
  useEffect(() => {
    fetch(`${Api}/products/search?q=`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Failed to fetch products", err));

    fetch(`${Api}/ledgers/search?group=Customers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableCustomers(data);
      })
      .catch(err => console.error("Failed to fetch customers", err));

    const orderToEdit = location.state?.orderToEdit;
    if (orderToEdit) {
      setEditingOrderId(orderToEdit._id || orderToEdit.id);
      setStatus(orderToEdit.status || 'Open');
      setOrderNo(orderToEdit.orderNumber || orderToEdit.orderNo);
      setOrderDate(new Date(orderToEdit.orderDate).toISOString().split('T')[0]);
      setCustomer(orderToEdit.buyerName || orderToEdit.customer || '');
      setMobileNo(orderToEdit.mobileNo || '');
      setAddress(orderToEdit.address || '');
      setDeliveryDate(orderToEdit.expectedDeliveryDate ? new Date(orderToEdit.expectedDeliveryDate).toISOString().split('T')[0] : '');
      setIsInterstate(orderToEdit.cgst === 0 && orderToEdit.igst > 0);
      setAdvancePaid(orderToEdit.advancePaid ? orderToEdit.advancePaid : '');
      setPaymentMode(orderToEdit.paymentMode || 'Cash');
      setRemarks(orderToEdit.remarks || '');
      setSalesman(orderToEdit.salesman || '');

      // Load items
      const loadedItems = (orderToEdit.items || []).map((item: any, idx: number) => ({
        lineId: item.id || String(Math.random()),
        orderId: item.salesOrderId || '',
        lineIndex: idx + 1,
        productId: item.productId || undefined,
        itemCode: item.itemCode || '',
        itemDescription: item.itemName || item.itemDescription || '',
        color: item.color || '',
        size: item.size || '',
        quantityOrdered: item.orderedQty || item.quantityOrdered || 0,
        quantityFulfilled: item.deliveredQty || item.quantityFulfilled || 0,
        unitPrice: item.unitPrice || 0,
        discountPercentage: item.discount || item.discountPercentage || 0,
        taxableAmount: item.lineTotal || item.taxableAmount || 0,
        taxRatePercentage: item.tax || item.taxRatePercentage || 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        lineSubTotal: item.lineTotal || item.lineSubTotal || 0
      }));
      setLineItems(loadedItems);
    } else {
      // Fetch auto sequence order number
      fetch(`${Api}/sales/orders/next-sequence`)
        .then(res => res.json())
        .then(data => {
          if (data.orderNo) setOrderNo(data.orderNo);
        })
        .catch(err => console.error("Error fetching order number sequence", err));

      // Initialize with one empty row
      handleAddRow();
    }
  }, [location.state]);

  // Load customer metadata on selection
  useEffect(() => {
    if (!customer) {
      setCreditLimit(0);
      setCurrentBalance(0);
      return;
    }
    const matched = availableCustomers.find(c => c.accountName === customer);
    if (matched) {
      setMobileNo(matched.mobileNo || '');
      setAddress(matched.address || '');
      setCreditLimit(matched.creditLimit || 0);
      setCurrentBalance(matched.openingBalance || 0);
    }
  }, [customer, availableCustomers]);

  // Summary and tax calculation engine
  useEffect(() => {
    let tSubtotal = 0;
    let tCgst = 0;
    let tSgst = 0;
    let tIgst = 0;
    let tDiscount = 0;

    const updatedItems = lineItems.map(item => {
      const qty = Number(item.quantityOrdered) || 0;
      const price = Number(item.unitPrice) || 0;
      const discPercent = Number(item.discountPercentage) || 0;
      const taxRate = Number(item.taxRatePercentage) || 0;

      const baseAmount = qty * price;
      const discAmt = baseAmount * (discPercent / 100);
      const taxableAmount = baseAmount - discAmt;
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
      tDiscount += discAmt;

      return {
        ...item,
        taxableAmount,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        igstAmount: igstAmt,
        lineSubTotal
      };
    });
    
    const rawTotal = tSubtotal + tCgst + tSgst + tIgst;
    const roundedTotal = Math.round(rawTotal);
    const roundingDiff = roundedTotal - rawTotal;

    setSummary({
      subtotal: tSubtotal,
      cgst: tCgst,
      sgst: tSgst,
      igst: tIgst,
      rounding: roundingDiff,
      grandTotal: roundedTotal,
      discount: tDiscount
    });
  }, [lineItems, isInterstate]);

  const generateUUID = () => Math.random().toString(36).substring(2, 15);

  const handleAddRow = () => {
    if (isReadOnly) return;
    const newLine: SalesOrderItemLine = {
      lineId: generateUUID(),
      orderId: orderNo,
      lineIndex: lineItems.length + 1,
      itemCode: '',
      itemDescription: '',
      weight: '',
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
    if (isReadOnly) return;
    setLineItems(prev => prev.filter(item => item.lineId !== lineId).map((item, index) => ({...item, lineIndex: index + 1})));
  };

  const handleItemChange = (lineId: string, field: keyof SalesOrderItemLine, value: any) => {
    if (isReadOnly) return;
    setLineItems(prev => prev.map(item => {
      if (item.lineId !== lineId) return item;

      const updated = { ...item, [field]: value };

      if (field === 'itemCode' && value) {
        const product = availableProducts.find(p => p.itemCode === value || p.barcode === value || p.name === value);
        if (product) {
          updated.productId = product.id || product._id;
          updated.itemCode = product.itemCode || '';
          updated.itemDescription = product.name || '';
          updated.unitPrice = product.price || 0;
          updated.taxRatePercentage = product.taxPercent || 18;
          updated.weight = product.weight || '';
        }
      }

      if (field === 'quantityOrdered') {
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

  // Validation Errors state
  const [formErrors, setFormErrors] = useState<{ customer?: string; mobileNo?: string; items?: string }>({});

  const handleSave = async () => {
    if (isReadOnly) {
      if (setGlobalNotification) setGlobalNotification({msg: "Completed or Cancelled orders are read-only.", type: 'error'});
      return;
    }

    const errors: { customer?: string; mobileNo?: string; items?: string } = {};

    if (!customer || !customer.trim()) {
      errors.customer = "Customer Name is a mandatory field.";
    }

    const cleanPhone = (mobileNo || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.mobileNo = "Customer Phone Number is mandatory (minimum 10 digits).";
    }

    const validItems = lineItems.filter(item => Number(item.quantityOrdered) > 0 && (item.itemCode || item.itemDescription));
    if (validItems.length === 0) {
      errors.items = "Cannot save: Please add at least one valid item with Quantity > 0.";
    }

    // Strict Stock Check for Sales Order Items
    for (const item of validItems) {
      const match = availableProducts.find(p =>
        (p.itemCode && p.itemCode === item.itemCode) ||
        (p.barcode && p.barcode === item.itemCode) ||
        (p.name && item.itemDescription && p.name.toLowerCase() === item.itemDescription.toLowerCase())
      );
      if (match) {
        const avail = typeof match.stock === 'number' ? match.stock : 0;
        const totalOrderedInOrder = lineItems.reduce((acc, l) => {
          const isMatch = (l.itemCode && item.itemCode && l.itemCode === item.itemCode) ||
                          (l.itemDescription && item.itemDescription && l.itemDescription.toLowerCase() === item.itemDescription.toLowerCase());
          return isMatch ? acc + (Number(l.quantityOrdered) || 0) : acc;
        }, 0);

        if (avail <= 0) {
          errors.items = `Cannot save order! "${match.name}" is OUT OF STOCK (0 PCS available).`;
          break;
        }
        if (totalOrderedInOrder > avail) {
          errors.items = `Cannot save order! "${match.name}" requested quantity (${totalOrderedInOrder}) exceeds available stock (${avail} PCS).`;
          break;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.customer || errors.mobileNo) {
        setIsLeftPanelOpen(true);
      }
      if (setGlobalNotification) {
        const firstErr = errors.customer || errors.mobileNo || errors.items;
        setGlobalNotification({ msg: `⚠️ Form Validation Failed: ${firstErr}`, type: 'error' });
      }
      return;
    }

    setFormErrors({});

    if (setGlobalNotification) {
      setGlobalNotification({msg: "Saving Sales Order...", type: 'info'});
    }

    try {
      const payload = {
        orderNo,
        orderDate,
        customer: customer.trim(),
        mobileNo: cleanPhone,
        address,
        deliveryDate,
        status,
        isInterstate,
        summary,
        items: validItems,
        advancePaid: Number(advancePaid) || 0,
        paymentMode,
        remarks,
        salesman
      };

      const url = editingOrderId ? `${Api}/sales/orders/${editingOrderId}` : `${Api}/sales/orders`;
      const method = editingOrderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({msg: `Sales Order Saved Successfully!`, type: 'success'});
        }
        setTimeout(() => navigate('/sales-register', { state: { activeTab: 'orders' } }), 1000);
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Failed to save: " + data.error, type: 'error'});
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Error saving sales order.", type: 'error'});
      }
    }
  };

  const handleConvertToBill = () => {
    if (status === 'Cancelled') {
      if (setGlobalNotification) setGlobalNotification({msg: "Cancelled orders cannot be converted.", type: 'error'});
      return;
    }
    // Compile order payload for POS checkout
    const orderPayload = {
      id: editingOrderId,
      orderNumber: orderNo,
      buyerName: customer || 'CASH CUSTOMER',
      mobileNo,
      address,
      items: lineItems.map(item => ({
        productId: item.productId,
        itemCode: item.itemCode,
        itemName: item.itemDescription,
        qty: Math.max(0, (Number(item.quantityOrdered) || 0) - item.quantityFulfilled),
        rate: Number(item.unitPrice) || 0,
        discPercent: Number(item.discountPercentage) || 0
      }))
    };
    navigate('/sales-bill', { state: { orderToConvert: orderPayload } });
  };

  const handleShareWhatsApp = () => {
    if (!customer || !customer.trim()) {
      if (setGlobalNotification) setGlobalNotification({ msg: "Please enter Customer Name before sharing on WhatsApp.", type: 'error' });
      return;
    }

    const cleanMobile = (mobileNo || '').replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      if (setGlobalNotification) setGlobalNotification({ msg: "Please enter a valid 10-digit Customer Phone Number before sharing on WhatsApp.", type: 'error' });
      return;
    }

    const validItems = lineItems.filter(item => item.itemDescription || item.itemCode);
    if (!validItems || validItems.length === 0) {
      if (setGlobalNotification) setGlobalNotification({ msg: "No order items to share on WhatsApp.", type: "error" });
      return;
    }

    const text = `*SALES ORDER SUMMARY*
Order No: ${orderNo}
Order Date: ${new Date(orderDate).toLocaleDateString('en-IN')}
Customer Name: ${customer.trim()}
Mobile: ${cleanMobile}
${deliveryDate ? `Expected Delivery: ${new Date(deliveryDate).toLocaleDateString('en-IN')}\n` : ''}
*Order Items:*
${validItems.map((item, i) => `${i + 1}. ${item.itemDescription || item.itemCode} | Qty: ${item.quantityOrdered} | Wt: ${item.weight || '-'} | Rate: ₹${Number(item.unitPrice).toFixed(2)}`).join('\n')}

Subtotal: ₹${summary.subtotal.toFixed(2)}
Grand Total: ₹${summary.grandTotal.toFixed(2)}
Advance Paid: ₹${Number(advancePaid).toFixed(2)}
*Balance Due: ₹${Math.max(0, summary.grandTotal - Number(advancePaid)).toFixed(2)}*

Thank you!`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/91${cleanMobile}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- Hotkeys ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleConvertToBill();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/sales-register', { state: { activeTab: 'orders' } });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, status, orderNo, orderDate, customer, mobileNo, address, deliveryDate, summary, advancePaid, paymentMode, remarks, salesman]);

  return (
    <div className="flex flex-col h-full bg-slate-55 overflow-hidden text-slate-800">
      
      {/* TOOLBAR */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/sales-register', { state: { activeTab: 'orders' } })}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="Back (ESC)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">
            {editingOrderId ? `Edit Sales Order: ${orderNo}` : 'New Sales Order'}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate('/sales-register', { state: { activeTab: 'orders', selectedCustomerName: customer } })}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#d1e8e2] hover:bg-[#c3dfd8] border border-[#a8d08d] text-emerald-900 text-sm font-semibold rounded-md shadow-sm transition-all"
            title="Click to see customer orders"
          >
            <ClipboardList className="w-4 h-4 text-emerald-800" />
            <span>Customer Orders</span>
          </button>

          <button 
            onClick={handleShareWhatsApp} 
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md shadow-sm transition-all"
            title="Share Order via WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Share</span>
          </button>

          {!isReadOnly && editingOrderId && (
            <button 
              onClick={handleConvertToBill}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-all"
              title="Convert to Bill (CTRL+B)"
            >
              <FileText className="w-4 h-4" />
              <span>Convert to Bill (Ctrl+B)</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: METADATA */}
        <div className={`flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto flex flex-col justify-between transition-all duration-300 ${isLeftPanelOpen ? 'w-[320px] p-4 space-y-4' : 'w-0 p-0 overflow-hidden border-r-0'}`}>
          {isLeftPanelOpen && (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">Fulfillment Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  status === 'Open' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                  status === 'Partial' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                  status === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                  'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {status}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order Number</label>
                <input 
                  type="text" 
                  value={orderNo} 
                  onChange={e => setOrderNo(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-500 bg-slate-50 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order Date</label>
                <input 
                  type="date" 
                  value={orderDate} 
                  onChange={e => setOrderDate(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer / Client Ledger</label>
                <select 
                  value={availableCustomers.some(c => c.accountName === customer) ? customer : ""} 
                  onChange={e => {
                    const val = e.target.value;
                    setCustomer(val);
                    const found = availableCustomers.find(c => c.accountName === val);
                    if (found) {
                      const phone = found.mobileNo || found.mobile || found.phone || '';
                      if (phone) setMobileNo(phone);
                      if (found.address) setAddress(found.address);
                    }
                  }}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white outline-none focus:border-blue-500"
                >
                  <option value="">Walk-in Cash Customer</option>
                  {availableCustomers.map(c => (
                    <option key={c.id || c._id} value={c.accountName}>{c.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Customer Name <span className="text-red-500 font-extrabold">*</span>
                </label>
                <input 
                  type="text" 
                  value={customer} 
                  onChange={e => {
                    setCustomer(e.target.value);
                    if (formErrors.customer) setFormErrors(prev => ({ ...prev, customer: undefined }));
                  }}
                  disabled={isReadOnly}
                  placeholder="Enter Customer Name"
                  className={`w-full border rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500 ${
                    formErrors.customer ? 'border-2 border-red-500 bg-red-50 text-red-900 font-semibold' : 'border-slate-300'
                  }`}
                />
                {formErrors.customer && (
                  <span className="text-[11px] font-bold text-red-600 block mt-0.5 animate-pulse">
                    ⚠️ {formErrors.customer}
                  </span>
                )}
              </div>

              {availableCustomers.some(c => c.accountName === customer) && (
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Credit Limit:</span>
                    <span className="font-semibold text-slate-800">₹{creditLimit.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Bal:</span>
                    <span className={`font-semibold ${currentBalance > creditLimit ? 'text-red-600' : 'text-slate-800'}`}>
                      ₹{currentBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Customer Phone <span className="text-red-500 font-extrabold">*</span>
                </label>
                <input 
                  type="text" 
                  value={mobileNo} 
                  onChange={e => {
                    setMobileNo(e.target.value);
                    if (formErrors.mobileNo) setFormErrors(prev => ({ ...prev, mobileNo: undefined }));
                  }}
                  disabled={isReadOnly}
                  placeholder="10-digit mobile number"
                  className={`w-full border rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500 ${
                    formErrors.mobileNo ? 'border-2 border-red-500 bg-red-50 text-red-900 font-semibold' : 'border-slate-300'
                  }`}
                />
                {formErrors.mobileNo && (
                  <span className="text-[11px] font-bold text-red-600 block mt-0.5 animate-pulse">
                    ⚠️ {formErrors.mobileNo}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Address</label>
                <textarea 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expected Delivery Date</label>
                <input 
                  type="date" 
                  value={deliveryDate} 
                  onChange={e => setDeliveryDate(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sales Person</label>
                <input 
                  type="text" 
                  value={salesman} 
                  onChange={e => setSalesman(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Name"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isInterstate} 
                    onChange={() => setIsInterstate(!isInterstate)} 
                    disabled={isReadOnly}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" 
                  />
                  <span className="text-sm font-semibold text-slate-700">Interstate (Apply IGST)</span>
                </label>
              </div>
            </div>
          )}

          {isLeftPanelOpen && (
            <div className="bg-slate-900 p-4 rounded-lg text-white">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Total Order Value</span>
              <div className="text-2xl font-black text-blue-400">
                ₹{summary.grandTotal.toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>

        {/* Toggle Button for Left Panel */}
        <button 
          onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          className="absolute top-1/2 -translate-y-1/2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 w-4 h-16 flex items-center justify-center rounded-r-md shadow-md cursor-pointer z-50 focus:outline-none transition-all duration-300"
          style={{ left: isLeftPanelOpen ? '320px' : '0px' }}
          title={isLeftPanelOpen ? "Hide Details" : "Show Details"}
        >
          <span className="text-xs font-black">{isLeftPanelOpen ? '‹' : '›'}</span>
        </button>

        {/* RIGHT PANEL: TRANSACTION MATRIX & DETAILS */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Matrix table wrapper */}
          <div className="flex-1 overflow-auto p-4">
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                    <th className="p-2 w-10 text-center">S.No</th>
                    <th className="p-2 w-44">Item Code</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 w-28">Weight (Net Wt)</th>
                    <th className="p-2 w-24 text-center">Ordered Qty</th>
                    <th className="p-2 w-24 text-center bg-slate-50/50">Delivered</th>
                    <th className="p-2 w-28 text-right">Unit Price</th>
                    <th className="p-2 w-20 text-center">Disc %</th>
                    <th className="p-2 w-28 text-right">Subtotal</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {lineItems.map((item, idx) => {
                    const baseAmount = (Number(item.quantityOrdered) || 0) * (Number(item.unitPrice) || 0);
                    const discAmt = baseAmount * ((Number(item.discountPercentage) || 0) / 100);
                    const subtotal = baseAmount - discAmt;

                    return (
                      <tr key={item.lineId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-2">
                          <div className="flex items-center relative pr-1 min-w-[150px]">
                            <input 
                              type="text" 
                              value={item.itemCode}
                              onChange={e => handleItemChange(item.lineId, 'itemCode', e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  const found = availableProducts.find(p => p.itemCode?.toLowerCase() === val.toLowerCase() || p.barcode?.toLowerCase() === val.toLowerCase());
                                  if (!found) {
                                    e.preventDefault();
                                    setActiveRowId(item.lineId);
                                    setModalSearchQuery(val);
                                    setHighlightedProductIndex(0);
                                    setIsProductModalOpen(true);
                                  }
                                }
                              }}
                              onDoubleClick={() => {
                                if (isReadOnly) return;
                                setActiveRowId(item.lineId);
                                setModalSearchQuery(item.itemCode || '');
                                setHighlightedProductIndex(0);
                                setIsProductModalOpen(true);
                              }}
                              disabled={isReadOnly}
                              placeholder="Double click to search..."
                              className="w-full bg-transparent border border-slate-200 rounded pl-2 pr-12 py-1 focus:border-blue-500 outline-none text-xs font-mono font-bold"
                            />
                            {!isReadOnly && (
                              <button
                                onClick={() => {
                                  setActiveRowId(item.lineId);
                                  setModalSearchQuery(item.itemCode || '');
                                  setHighlightedProductIndex(0);
                                  setIsProductModalOpen(true);
                                }}
                                type="button"
                                className="absolute right-1 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-700 rounded transition-colors shadow-sm"
                                title="Search dress table"
                              >
                                Find
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={item.itemDescription}
                            onChange={e => handleItemChange(item.lineId, 'itemDescription', e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Description"
                            className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={item.weight || ''}
                            onChange={e => handleItemChange(item.lineId, 'weight', e.target.value)}
                            disabled={isReadOnly}
                            placeholder="1kg, 500g..."
                            className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 focus:border-blue-500 outline-none text-center"
                          />
                        </td>
                        <td className="p-2 relative">
                          {(() => {
                            const match = availableProducts.find(p =>
                              (p.itemCode && p.itemCode === item.itemCode) ||
                              (p.barcode && p.barcode === item.itemCode) ||
                              (p.name && item.itemDescription && p.name.toLowerCase() === item.itemDescription.toLowerCase())
                            );
                            const availStock = match ? (typeof match.stock === 'number' ? match.stock : 0) : null;
                            const totalOrderedInOrder = lineItems.reduce((acc, l) => {
                              const isMatch = (l.itemCode && item.itemCode && l.itemCode === item.itemCode) ||
                                              (l.itemDescription && item.itemDescription && l.itemDescription.toLowerCase() === item.itemDescription.toLowerCase());
                              return isMatch ? acc + (Number(l.quantityOrdered) || 0) : acc;
                            }, 0);
                            const isExceeding = availStock !== null && totalOrderedInOrder > availStock;

                            return (
                              <div className="relative flex items-center justify-center">
                                <input 
                                  type="number" 
                                  value={item.quantityOrdered}
                                  onChange={e => handleItemChange(item.lineId, 'quantityOrdered', e.target.value)}
                                  disabled={isReadOnly}
                                  min="1"
                                  className={`w-full bg-transparent border rounded px-2 py-1 text-center outline-none focus:border-blue-500 font-bold ${
                                    isExceeding ? 'bg-red-100 text-red-900 border-2 border-red-500 font-extrabold ring-1 ring-red-400' : 'border-slate-200'
                                  }`}
                                />
                                {isExceeding && (
                                  <span 
                                    className="absolute -top-3 right-0 bg-red-600 text-white text-[9px] font-extrabold px-1 rounded shadow z-10 whitespace-nowrap animate-pulse pointer-events-none"
                                    title={`Total ordered (${totalOrderedInOrder}) exceeds available stock (${availStock} PCS)`}
                                  >
                                    ⚠️ Max: {availStock}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-500 bg-slate-50/30">
                          {item.quantityFulfilled}
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            value={item.unitPrice}
                            onChange={e => handleItemChange(item.lineId, 'unitPrice', e.target.value)}
                            disabled={isReadOnly}
                            min="0"
                            className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-right outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            value={item.discountPercentage}
                            onChange={e => handleItemChange(item.lineId, 'discountPercentage', e.target.value)}
                            disabled={isReadOnly}
                            min="0"
                            max="100"
                            className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-center outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-semibold font-mono text-slate-800">
                          ₹{subtotal.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          {!isReadOnly && lineItems.length > 1 && (
                            <button 
                              onClick={() => handleRemoveRow(item.lineId)}
                              className="text-slate-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!isReadOnly && (
                <div className="bg-slate-50 border-t border-slate-100 p-2.5">
                  <button 
                    onClick={handleAddRow}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LOWER WORKFLOW & TOTALS SECTION */}
          <div className="bg-white border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
            {/* Remarks and details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks / Delivery Notes</label>
                <textarea 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border border-slate-300 rounded-md p-2 text-xs outline-none focus:border-blue-500"
                  rows={2}
                  placeholder="Enter comments..."
                />
              </div>
            </div>

            {/* Advance payment inputs */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center space-x-1">
                <span>Advance Details</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Advance Paid</label>
                  <input 
                    type="number" 
                    value={advancePaid === 0 ? '' : advancePaid} 
                    onChange={e => setAdvancePaid(e.target.value)}
                    disabled={isReadOnly}
                    min="0"
                    max={summary.grandTotal}
                    placeholder="0.00"
                    className="w-full border border-slate-300 rounded-md px-2 py-1 font-mono text-sm outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Payment Mode</label>
                  <select 
                    value={paymentMode} 
                    onChange={e => setPaymentMode(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full border border-slate-300 rounded-md px-2 py-1 outline-none bg-white focus:border-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-red-600 border-t border-slate-200 pt-2">
                <span>Remaining Balance:</span>
                <span className="font-mono text-sm">
                  ₹{Math.max(0, summary.grandTotal - Number(advancePaid)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Totals panel */}
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal (before tax):</span>
                <span className="font-semibold text-slate-800 font-mono">₹{summary.subtotal.toFixed(2)}</span>
              </div>
              
              {summary.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Line Discount:</span>
                  <span className="font-semibold font-mono">-₹{summary.discount.toFixed(2)}</span>
                </div>
              )}

              {!isInterstate && (
                <>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span className="font-semibold text-slate-800 font-mono">₹{summary.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span className="font-semibold text-slate-800 font-mono">₹{summary.sgst.toFixed(2)}</span>
                  </div>
                </>
              )}

              {isInterstate && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span className="font-semibold text-slate-800 font-mono">₹{summary.igst.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400 border-b border-slate-100 pb-1.5">
                <span>Rounding Difference:</span>
                <span className="font-mono">{summary.rounding > 0 ? '+' : ''}{summary.rounding.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-1.5 text-base text-slate-900 font-bold">
                <span>GRAND TOTAL:</span>
                <span className="text-lg font-black text-blue-700 font-mono">
                  ₹{summary.grandTotal.toFixed(2)}
                </span>
              </div>

              {!isReadOnly && (
                <div className="pt-3 border-t border-slate-200">
                  <button 
                    onClick={handleSave} 
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#2b579a] hover:bg-[#1f3f6f] text-white text-sm font-extrabold rounded-md shadow-md shadow-blue-500/20 transition-all focus:outline-none"
                    title="Save Sales Order (CTRL+S)"
                  >
                    <Save className="w-4.5 h-4.5" />
                    <span>Save Sales Order (Ctrl+S)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Dress Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)' }} onClick={() => setIsProductModalOpen(false)}>
          <div
            className="bg-white shadow-2xl flex flex-col border border-gray-300 rounded-lg overflow-hidden w-full max-w-4xl h-[500px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#2b579a] text-white px-4 py-3 flex justify-between items-center shadow-md">
              <div className="flex items-center space-x-2">
                <Search size={18} />
                <span className="font-bold tracking-wide text-sm">Dress/Product Table Lookup</span>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-white hover:text-red-300 font-bold focus:outline-none text-lg">
                ✕
              </button>
            </div>

            {/* Search Input and Help */}
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
              <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2.5 py-1.5 shadow-sm space-x-3 flex font-medium">
                <span><kbd className="bg-slate-100 border border-slate-300 rounded px-1 text-[9px] font-bold">↑</kbd> <kbd className="bg-slate-100 border border-slate-300 rounded px-1 text-[9px] font-bold">↓</kbd> Navigate</span>
                <span><kbd className="bg-slate-100 border border-slate-300 rounded px-1 text-[9px] font-bold">Enter</kbd> Select</span>
                <span><kbd className="bg-slate-100 border border-slate-300 rounded px-1 text-[9px] font-bold">Esc</kbd> Close</span>
              </div>
            </div>

            {/* List Table Headers */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <div className="col-span-2">Item Code</div>
              <div className="col-span-4">Product Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1 text-center">Weight</div>
              <div className="col-span-1 text-center">Stock</div>
              <div className="col-span-2 text-right">Price (₹)</div>
            </div>

            {/* List Body */}
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
                    {p.department || p.category || '-'}
                  </div>
                  <div className="col-span-1 text-center font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 text-xs">
                    {p.weight || '-'}
                  </div>
                  <div className="col-span-1 text-center">
                    {(() => {
                      const qtyInCurrentOrder = lineItems.reduce((acc, l) => {
                        const isMatch = (l.itemCode && p.itemCode && l.itemCode === p.itemCode) ||
                                        (l.itemDescription && p.name && l.itemDescription.toLowerCase() === p.name.toLowerCase());
                        return isMatch ? acc + (Number(l.quantityOrdered) || 0) : acc;
                      }, 0);
                      const effectiveStock = (typeof p.stock === 'number' ? p.stock : 0) - qtyInCurrentOrder;

                      return (
                        <div className="flex flex-col items-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                            idx === highlightedProductIndex
                              ? 'text-black'
                              : effectiveStock > 10 
                                ? 'bg-green-100 text-green-800' 
                                : effectiveStock > 0 
                                  ? 'bg-yellow-100 text-yellow-800 font-extrabold' 
                                  : 'bg-red-100 text-red-800 font-extrabold'
                          }`}>
                            {effectiveStock > 0 ? effectiveStock : '0 (NO STOCK)'}
                          </span>
                          {qtyInCurrentOrder > 0 && (
                            <span className="text-[9px] text-blue-900 font-extrabold whitespace-nowrap mt-0.5">
                              ({qtyInCurrentOrder} in order)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-2 text-right font-mono font-extrabold text-slate-800">
                    {Number(p.price || 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {modalFilteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 italic">
                  No matching products found in master catalog.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrder;