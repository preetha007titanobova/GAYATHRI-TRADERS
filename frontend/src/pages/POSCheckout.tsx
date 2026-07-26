import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, ArrowLeft, ArrowRight, Search, Printer, Mail, Paperclip, MessageSquare, Download, Send, QrCode, CreditCard, Smartphone, CheckCircle, Sparkles, MessageCircle, FileText, Zap } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';
import { downloadPdfBill } from '../utils/downloadPdfBill';
import { sendWhatsAppBill } from '../utils/whatsappHelper';
import Api from '../Api';

// Types for our grid
interface GridRow {
  id: number;
  itemName: string;
  itemDesc: string;
  size?: string;
  qty: number;
  uom: string;
  rate: number;
  discPercent: number;
  discAmt: number;
  amount: number;
}

const POSCheckout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingPayload = location.state?.quotationPayload;
  const orderToConvert = location.state?.orderToConvert;

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [fromSalesOrderId, setFromSalesOrderId] = useState<string | null>(null);

  // --- State for Document Input Panel ---
  const [invoiceNo, setInvoiceNo] = useState('Loading...'); // Fetched from backend
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDays, setPayDays] = useState(0);
  const [buyerName, setBuyerName] = useState(incomingPayload?.buyerName || orderToConvert?.buyerName || '');
  const [salesman, setSalesman] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [rapidBarcode, setRapidBarcode] = useState('');
  const [scannedFeedback, setScannedFeedback] = useState<{
    barcode: string;
    name: string;
    size: string;
    price: number;
    stock: number;
    uom?: string;
    dept?: string;
  } | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiTxnId, setUpiTxnId] = useState('');
  const rapidInputRef = useRef<HTMLInputElement>(null);
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [address, setAddress] = useState(orderToConvert?.address || '');
  const [eType, setEType] = useState('Local');
  const [mobileNo, setMobileNo] = useState(orderToConvert?.mobileNo || '');
  const [gstNo, setGstNo] = useState('');
  const [printIn, setPrintIn] = useState('Blank A4');
  const [invoiceFormat, setInvoiceFormat] = useState('GSTFormat Full Page');
  const [shippingAddress, setShippingAddress] = useState('');
  const [remarks, setRemarks] = useState('');


  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [favourDiscount, setFavourDiscount] = useState<number>(0);

  const fetchProducts = () => {
    fetch(`${Api}/products/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Error fetching products:", err));
  };

  const fetchNextInvoiceNo = () => {
    fetch(`${Api}/sales/next-invoice`)
      .then(res => res.json())
      .then(data => {
        if (data.invoiceNo) setInvoiceNo(data.invoiceNo);
      })
      .catch(err => console.error("Error fetching invoice no:", err));
  };

  const resetPageState = () => {
    setGridData([{ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: 'PCS', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }]);
    setBuyerName('');
    setAddress('');
    setMobileNo('');
    setGstNo('');
    setSalesman('');
    setTendered(0);
    setFavourDiscount(0);
    setEditingBillId(null);
    setFromSalesOrderId(null);
    setShippingAddress('');
    setRemarks('');
    fetchNextInvoiceNo();
    fetchProducts();
    if (setGlobalSettings) {
      setGlobalSettings({ isSelectiveCustomer: false });
    }
  };


  const filteredCustomersList = useMemo(() => {
    const q = buyerName.toLowerCase();
    const matches = availableCustomers.filter(c =>
      c.accountName.toLowerCase().includes(q) ||
      (c.ledgerCode && c.ledgerCode.toLowerCase().includes(q))
    );
    if (!q || 'cash'.includes(q)) {
      if (!matches.some(m => m.accountName === 'CASH')) {
        return [{ accountName: 'CASH' }, ...matches];
      }
    }
    return matches;
  }, [availableCustomers, buyerName]);

  // --- State for Data Entry Grid ---
  const initialGridData = useMemo(() => {
    const payload = incomingPayload || orderToConvert;
    if (payload?.items?.length > 0) {
      return payload.items.map((item: any, idx: number) => {
        const qty = Number(item.qty) || Number(item.quantityOrdered) || 0;
        const rate = Number(item.rate) || Number(item.unitPrice) || 0;
        const discPercent = Number(item.discPercent) || Number(item.discountPercentage) || 0;
        const baseAmount = qty * rate;
        const discAmt = (baseAmount * discPercent) / 100;
        return {
          id: idx + 1,
          itemName: item.itemName || item.itemDescription || '',
          itemDesc: item.itemDesc || item.itemCode || '',
          qty,
          uom: item.uom || 'PCS',
          rate,
          discPercent,
          discAmt: discAmt,
          amount: baseAmount - discAmt
        };
      });
    }
    return [{ id: 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }];
  }, [incomingPayload, orderToConvert]);

  const [gridData, setGridData] = useState<GridRow[]>(initialGridData);

  useEffect(() => {
    if (initialGridData.length > 0 && (initialGridData[0].itemName !== '' || initialGridData.length > 1)) {
      setGridData(initialGridData);
    }
  }, [initialGridData]);

  // --- Totals State ---
  const [totalQty, setTotalQty] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [cgstPercent, setCgstPercent] = useState(0);
  const [sgstPercent, setSgstPercent] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [tendered, setTendered] = useState(0);

  // --- Modal Search State ---
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeRowId, setActiveRowId] = useState<number>(1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean,
    action: (() => void) | null,
    cancelAction?: (() => void) | null,
    message?: string,
    title?: string,
    yesText?: string,
    noText?: string
  }>({ isOpen: false, action: null });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Global Context ---
  const { setToolbarActions, setGlobalNotification, globalSettings, setGlobalSettings } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any, globalSettings?: any, setGlobalSettings?: any }>() || {};

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();

    // Fetch available customers
    fetch(`${Api}/ledgers/search?group=Customers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableCustomers(data);
      })
      .catch(err => console.error("Error fetching customers:", err));

    const invoiceToEdit = location.state?.invoiceToEdit;
    if (invoiceToEdit) {
      setEditingBillId(invoiceToEdit._id || invoiceToEdit.id);
      setInvoiceNo(invoiceToEdit.invoiceNo);
      setInvDate(new Date(invoiceToEdit.invDate).toISOString().split('T')[0]);
      setPayDays(invoiceToEdit.payDays || 0);
      setBuyerName(invoiceToEdit.buyerName || '');
      setSalesman(invoiceToEdit.salesman || '');
      setPaymentMode(invoiceToEdit.paymentMode || 'Cash');
      setAddress(invoiceToEdit.address || '');
      setEType(invoiceToEdit.eType || 'Local');
      setMobileNo(invoiceToEdit.mobileNo || '');
      setGstNo(invoiceToEdit.gstNo || '');
      setPrintIn(invoiceToEdit.printIn || 'Blank A4');
      setInvoiceFormat(invoiceToEdit.invFormat || invoiceToEdit.invoiceFormat || 'GSTFormat Full Page');
      setShippingAddress(invoiceToEdit.shippingAddress || '');
      setRemarks(invoiceToEdit.remarks || '');

      // Fetch full details with items                                                                                                  
      fetch(`${Api}/sales/bills/${invoiceToEdit.invoiceNo}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.remarks) setRemarks(data.remarks);
            if (data.shippingAddress) setShippingAddress(data.shippingAddress);
            if (Array.isArray(data.items)) {
              setGridData(data.items.map((item: any, idx: number) => ({
                id: idx + 1,
                itemName: item.itemName,
                itemDesc: item.itemDesc || '',
                qty: item.qty,
                uom: item.uom || 'PCS',
                rate: item.rate,
                discPercent: item.discPercent || 0,
                discAmt: item.discAmt || 0,
                amount: item.amount
              })));
            }
          }
        })
        .catch(err => console.error("Error fetching full bill details:", err));
    } else {
      fetchNextInvoiceNo();

      if (orderToConvert) {
        setFromSalesOrderId(orderToConvert.id || orderToConvert._id || null);
        setBuyerName(orderToConvert.buyerName || '');
        setMobileNo(orderToConvert.mobileNo || '');
        setAddress(orderToConvert.address || '');
        setRemarks(orderToConvert.remarks || '');
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (isSearchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  // High-performance O(1) Map for instantaneous barcode lookups
  const barcodeMap = useMemo(() => {
    const map = new Map<string, any>();
    availableProducts.forEach(p => {
      if (p.barcode) map.set(p.barcode.toString().trim().toLowerCase(), p);
      if (p.itemCode) map.set(p.itemCode.toString().trim().toLowerCase(), p);
    });
    return map;
  }, [availableProducts]);

  // Lightning fast scanner processing function
  const processBarcodeScan = async (scannedCode: string, targetRowId?: number) => {
    const cleanCode = scannedCode.trim();
    if (!cleanCode) return;

    // 1. Instant local O(1) hash table lookup
    let product = barcodeMap.get(cleanCode.toLowerCase());

    // 2. High-speed API fallback if not found in local cache
    if (!product) {
      try {
        const res = await fetch(`${Api}/products/barcode/${encodeURIComponent(cleanCode)}`);
        if (res.ok) {
          product = await res.json();
        } else {
          const resSearch = await fetch(`${Api}/products/search?q=${encodeURIComponent(cleanCode)}`);
          const data = await resSearch.json();
          if (Array.isArray(data) && data.length > 0) {
            product = data.find((p: any) =>
              (p.barcode && p.barcode.toString().trim().toLowerCase() === cleanCode.toLowerCase()) ||
              (p.itemCode && p.itemCode.toString().trim().toLowerCase() === cleanCode.toLowerCase())
            ) || data[0];
          }
        }
      } catch (err) {
        console.error("Barcode fetch error", err);
      }
    }

    if (product) {
      const prodName = product.name || "Men's Shirt";
      const prodSize = product.size || 'L';
      const prodPrice = Number(product.price) || 799;
      const initialStock = typeof product.stock === 'number' ? product.stock : 0;

      // Prevent negative stock: Check if stock is 0 or insufficient
      if (initialStock <= 0) {
        if (setGlobalNotification) {
          setGlobalNotification({
            msg: `❌ Cannot add "${prodName}"! Available stock is 0. Stock cannot go negative.`,
            type: 'error'
          });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        setRapidBarcode('');
        return;
      }

      // Calculate total quantity of this barcode/product already added to the bill
      let currentQtyInGrid = 0;
      gridData.forEach(r => {
        if (r.itemName === prodName || (r.itemDesc && r.itemDesc.trim().toLowerCase() === cleanCode.toLowerCase())) {
          currentQtyInGrid += Number(r.qty || 0);
        }
      });

      if (currentQtyInGrid + 1 > initialStock) {
        if (setGlobalNotification) {
          setGlobalNotification({
            msg: `⚠️ Stock Limit Reached! Barcode "${cleanCode}" (${prodName}) has only ${initialStock} items in stock. Cannot add ${currentQtyInGrid + 1} items.`,
            type: 'error'
          });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        setRapidBarcode('');
        return;
      }

      const updatedStock = Math.max(0, initialStock - (currentQtyInGrid + 1));

      // Update Live Scanned Item Banner Feedback
      setScannedFeedback({
        barcode: cleanCode,
        name: prodName,
        size: prodSize,
        price: prodPrice,
        stock: updatedStock,
        uom: product.uom || 'PCS',
        dept: product.department || product.variety || 'General'
      });

      // Update grid table
      setGridData(prev => {
        let newGrid = [...prev];
        const existingIdx = newGrid.findIndex(r =>
          r.itemName === prodName || (r.itemDesc && r.itemDesc.trim().toLowerCase() === cleanCode.toLowerCase())
        );

        if (existingIdx !== -1) {
          // Increment quantity by 1
          const row = { ...newGrid[existingIdx] };
          row.qty = Number(row.qty || 0) + 1;
          row.size = prodSize;
          const baseAmount = row.qty * row.rate;
          row.discAmt = Number(((baseAmount * row.discPercent) / 100).toFixed(2));
          row.amount = Number((baseAmount - row.discAmt).toFixed(2));
          newGrid[existingIdx] = row;
        } else {
          // Find empty row or replace row
          let targetIdx = targetRowId ? newGrid.findIndex(r => r.id === targetRowId) : -1;
          if (targetIdx === -1) {
            targetIdx = newGrid.findIndex(r => !r.itemName.trim());
          }

          const newRow: GridRow = {
            id: targetIdx !== -1 ? newGrid[targetIdx].id : Date.now(),
            itemName: prodName,
            itemDesc: cleanCode,
            size: prodSize,
            uom: product.uom || 'PCS',
            rate: prodPrice,
            qty: 1,
            discPercent: 0,
            discAmt: 0,
            amount: prodPrice
          };

          if (targetIdx !== -1) {
            newGrid[targetIdx] = newRow;
          } else {
            newGrid.push(newRow);
          }
        }

        // Always maintain an empty trailing row for the next manual entry/scan
        const lastRow = newGrid[newGrid.length - 1];
        if (lastRow.itemName.trim() !== '') {
          newGrid.push({
            id: Date.now() + Math.random(),
            itemName: '',
            itemDesc: '',
            size: '',
            qty: 0,
            uom: '',
            rate: 0,
            discPercent: 0,
            discAmt: 0,
            amount: 0
          });
        }

        return newGrid;
      });

      if (setGlobalNotification) {
        setGlobalNotification({
          msg: `✓ Barcode ${cleanCode}: Added ${prodName} | Size: ${prodSize} | Price: ₹${prodPrice} | Stock Reduced to ${updatedStock}`,
          type: 'success'
        });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    } else {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `❌ Barcode not found: ${cleanCode}`, type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    }
    setRapidBarcode('');
  };

  // Global hardware barcode scanner keypress detector (<50ms keystrokes)
  const scannerBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElem = document.activeElement;
      const isInput = activeElem?.tagName === 'INPUT' || activeElem?.tagName === 'TEXTAREA';

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Reset buffer if delay between keypresses is > 80ms (manual typing vs hardware barcode scanner)
      if (timeDiff > 80 && scannerBufferRef.current.length < 5) {
        scannerBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (scannerBufferRef.current.length >= 3) {
          e.preventDefault();
          processBarcodeScan(scannerBufferRef.current);
          scannerBufferRef.current = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        scannerBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [barcodeMap]);

  const selectedCustomerObj = useMemo(() => {
    return availableCustomers.find(c => c.accountName === buyerName);
  }, [availableCustomers, buyerName]);

  const filteredProducts = availableProducts
    .filter(p => {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const openSearchModal = (rowId: number, targetElem?: HTMLElement) => {
    setActiveRowId(rowId);
    setSearchQuery('');
    setHighlightedIndex(0);

    if (targetElem) {
      const rect = targetElem.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 2, left: Math.max(10, rect.left) });
    } else {
      setDropdownPosition({ top: 150, left: 100 });
    }

    setIsSearchModalOpen(true);
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    // Return focus to grid
    setTimeout(() => {
      document.getElementById(`grid-input-${activeRowId - 1}-0`)?.focus();
    }, 100);
  };

  const selectProductFromModal = (product: any) => {
    setGridData(prev => prev.map(row => {
      if (row.id !== activeRowId) return row;

      let updatedRow = {
        ...row,
        itemName: product.name,
        itemDesc: product.itemCode || product.barcode || '',
        size: product.size || '',
        uom: product.uom || 'PCS',
        rate: product.price || 0,
        qty: row.qty === 0 ? 1 : row.qty
      };

      let baseAmount = updatedRow.qty * updatedRow.rate;
      updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
      updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
      return updatedRow;
    }));

    // Auto-add new row if it's the last row
    if (activeRowId === gridData.length) {
      setGridData(prev => [...prev, {
        id: prev.length + 1,
        itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0
      }]);
    }

    setIsSearchModalOpen(false);

    // Move focus to Qty
    setTimeout(() => {
      const rowIndex = gridData.findIndex(r => r.id === activeRowId);
      document.getElementById(`grid-input-${rowIndex}-1`)?.focus();
    }, 150);
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[highlightedIndex]) {
        selectProductFromModal(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchModal();
    }
  };

  // --- API Integrations ---

  const handleInstantCheckout = async () => {
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "⚠️ WhatsApp feature is blocked. Please renew the plan.", type: 'error' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
    }
    const validItems = gridData.filter(row => row.itemName && row.qty > 0 && row.rate > 0);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please add at least one valid item to the grid before checking out.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
      return;
    }

    // 1. Trigger Thermal Receipt Print
    const formattedItems = validItems.map(item => ({
      itemCode: item.itemDesc || item.itemName,
      itemDesc: item.itemName,
      qty: item.qty,
      rate: item.rate,
      totalAmt: item.amount
    }));

    printReceipt(formattedItems, {
      invoiceNo: invoiceNo,
      date: invDate,
      customerName: buyerName,
      paymentMode: paymentMode,
      totalQty: totalQty,
      subTotal: totalAmount,
      cgst: cgst,
      sgst: sgst,
      totalAmount: netAmount
    });

    // 2. Send WhatsApp Bill if mobile exists
    if (mobileNo) {
      handleSendWhatsApp();
    }

    // 3. Save Invoice in Database
    executeSave(validItems);
  };

  const handleTenderedEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInstantCheckout();
    }
  };

  const handleDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInstantCheckout();
    }
  };

  const handleSaveClick = () => {
    // Filter out empty rows
    const validItems = gridData.filter(row => row.itemName && row.qty > 0 && row.rate > 0);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please add at least one valid item to the grid before saving.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
      return;
    }

    executeSave(validItems);
  };

  const executeSave = async (validItems: any[]) => {
    setConfirmModalState({ isOpen: false, action: null });

    // Stock Check: Ensure no item quantity exceeds available physical stock
    for (const item of validItems) {
      const match = availableProducts.find(p =>
        p.name === item.itemName ||
        (p.itemCode && p.itemCode === item.itemDesc) ||
        (p.barcode && p.barcode === item.itemDesc)
      );
      if (match) {
        const avail = typeof match.stock === 'number' ? match.stock : 0;
        if (avail <= 0) {
          if (setGlobalNotification) {
            setGlobalNotification({
              msg: `Cannot save bill! "${item.itemName}" is out of stock (Available: 0). Stock cannot go negative.`,
              type: 'error'
            });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
          }
          return;
        }
        if (item.qty > avail) {
          if (setGlobalNotification) {
            setGlobalNotification({
              msg: `Cannot save bill! "${item.itemName}" requested quantity (${item.qty}) exceeds available stock (${avail}). Stock cannot go negative.`,
              type: 'error'
            });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
          }
          return;
        }
      }
    }

    const payload = {
      invoiceNo, invDate, payDays, buyerName, address, eType,
      mobileNo, gstNo, printIn, invoiceFormat, totalQty, totalAmount,
      favourDiscount: Number(favourDiscount) || 0,
      cgst, sgst, roundOff, netAmount,
      salesman, paymentMode,
      fromSalesOrderId,
      isSelectiveCustomer: globalSettings?.isSelectiveCustomer || false,
      shippingAddress,
      remarks,
      items: validItems.map(item => ({
        itemName: item.itemName,
        itemDesc: item.itemDesc,
        size: item.size || null,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        discPercent: item.discPercent,
        discAmt: item.discAmt,
        amount: item.amount
      }))
    };

    try {
      const url = editingBillId ? `${Api}/sales/${editingBillId}` : `${Api}/sales`;
      const method = editingBillId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) setGlobalNotification({ msg: `Sales Bill ${invoiceNo} saved successfully!`, type: 'success' });
        if (editingBillId) {
          setTimeout(() => navigate('/sales-register'), 1500);
        } else if (fromSalesOrderId) {
          setTimeout(() => navigate('/sales-register', { state: { activeTab: 'orders' } }), 1500);
        } else {
          setTimeout(() => {
            resetPageState();
            if (rapidInputRef.current) {
              rapidInputRef.current.focus();
            }
          }, 1500);
        }
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Error saving: " + data.error, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Network error while saving.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
    }
  };

  // --- Auxiliary Actions ---
  const handleCancelClick = () => {
    setConfirmModalState({
      isOpen: true,
      action: () => {
        setGridData([{ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }]);
        setBuyerName('');
        setAddress('');
        setMobileNo('');
        setGstNo('');
        setSalesman('');
        setTendered(0);
        setFavourDiscount(0);
        setShippingAddress('');
        setRemarks('');
        setConfirmModalState({ isOpen: false, action: null });
        if (setGlobalNotification) {
          setGlobalNotification({ msg: 'Invoice data cleared successfully.', type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
      },
      message: "Are you sure you want to cancel and clear all data? All unsaved work will be lost."
    });
  };

  const handlePrintAction = (docType: string) => {
    if (setGlobalNotification) setGlobalNotification({ msg: `Preparing ${docType} for printing...`, type: 'success' });

    // Format items for the print utility
    const formattedItems = gridData
      .filter(item => item.itemName) // Only print valid items
      .map(item => ({
        itemCode: item.itemDesc || item.itemName,
        itemDesc: item.itemName,
        qty: item.qty,
        rate: item.rate,
        totalAmt: item.amount
      }));

    printReceipt(formattedItems, {
      invoiceNo: invoiceNo,
      date: invDate,
      customerName: buyerName,
      paymentMode: paymentMode,
      totalQty: totalQty,
      subTotal: totalAmount,
      cgst: cgst,
      sgst: sgst,
      totalAmount: netAmount
    });

    setTimeout(() => {
      if (setGlobalNotification) setGlobalNotification({ msg: '', type: '' });
    }, 2000);
  };

  const handleExportCSV = () => {
    const validItems = gridData.filter(row => row.itemName);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "No items to export.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    if (setGlobalNotification) setGlobalNotification({ msg: "Generating CSV Export...", type: 'success' });

    // Create CSV content
    const headers = ["Item Name", "Qty", "UOM", "Rate", "Discount %", "Discount Amt", "Total Amount"];
    const rows = validItems.map(item => [
      `"${item.itemName}"`, item.qty, `"${item.uom}"`, item.rate, item.discPercent, item.discAmt, item.amount
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // Download logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `SalesBill_${invoiceNo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      if (setGlobalNotification) setGlobalNotification({ msg: '', type: '' });
    }, 3000);
  };

  // --- PDF & WhatsApp Handlers ---
  const getBillPayloadData = () => {
    const validItems = gridData.filter(row => row.itemName && row.qty > 0);
    return {
      invoiceNo,
      invDate,
      buyerName: buyerName || 'CASH CUSTOMER',
      mobileNo,
      address,
      gstNo,
      paymentMode,
      salesman,
      items: validItems,
      totalQty,
      totalAmount,
      favourDiscount: Number(favourDiscount) || 0,
      cgstPercent,
      sgstPercent,
      cgst,
      sgst,
      roundOff,
      netAmount
    };
  };

  const handleDownloadPDF = () => {
    const validItems = gridData.filter(row => row.itemName && row.qty > 0);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please add at least one item to download the PDF bill.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }
    const billData = getBillPayloadData();
    const fileName = downloadPdfBill(billData);
    if (setGlobalNotification) {
      setGlobalNotification({ msg: `📥 PDF Bill ${fileName} generated & downloaded successfully!`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
    }
  };

  const handleSendWhatsApp = () => {
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "❌ Customer WhatsApp bill sharing is blocked. Please renew the plan.", type: 'error' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
    }
    return;
    const validItems = gridData.filter(row => row.itemName && row.qty > 0 && row.rate > 0);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please add at least one item before sending WhatsApp bill.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    if (!mobileNo) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please enter customer mobile number to send WhatsApp bill.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    const billData = getBillPayloadData();
    const result = sendWhatsAppBill(billData, undefined, true);
    if (result.success) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `⚡ WhatsApp App opened instantly for customer (+${result.phone})!`, type: 'success' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
      }
    } else {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `❌ ${result.error}`, type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    }
  };


  // --- Global Toolbar Wiring (Layout Bridge) ---
  // Note: setGlobalNotification is destructured above
  const actionHandlers = useRef({
    onAdd: handleCancelClick,
    onDelete: handleCancelClick,
    onFind: () => openSearchModal(gridData[gridData.length - 1].id),
    onPrint: () => handlePrintAction('Sales Bill')
  });

  // Keep ref updated with fresh closures on every render
  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleCancelClick,
      onDelete: handleCancelClick,
      onFind: () => openSearchModal(gridData[gridData.length - 1].id),
      onPrint: () => handlePrintAction('Sales Bill')
    };
  });

  // Register the proxy handlers exactly once with Layout
  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        onDelete: () => actionHandlers.current.onDelete(),
        onFind: () => actionHandlers.current.onFind(),
        onPrint: () => actionHandlers.current.onPrint()
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions]);

  // --- Calculation Engine ---
  useEffect(() => {
    let tQty = 0;
    let tAmt = 0;

    // Calculate sums
    gridData.forEach(row => {
      tQty += row.qty || 0;
      tAmt += row.amount || 0;
    });

    setTotalQty(tQty);
    setTotalAmount(tAmt);

    // Apply favour discount
    const discountedTotal = Math.max(0, tAmt - favourDiscount);

    // Dynamic CGST & SGST logic
    const cgstVal = Number((discountedTotal * (cgstPercent / 100)).toFixed(2));
    const sgstVal = Number((discountedTotal * (sgstPercent / 100)).toFixed(2));
    setCgst(cgstVal);
    setSgst(sgstVal);

    // Calculate rounding
    const rawTotal = discountedTotal + cgstVal + sgstVal;
    const roundedTotal = Math.round(rawTotal);
    const roundDiff = Number((roundedTotal - rawTotal).toFixed(2));

    setRoundOff(roundDiff);
    setNetAmount(roundedTotal);
  }, [gridData, cgstPercent, sgstPercent, favourDiscount]);

  // --- Data Entry Grid Auto-Row Logic & Product Auto-Fill ---
  const handleGridChange = (id: number, field: keyof GridRow, value: string) => {
    setGridData(prev => {
      const newGrid = prev.map(row => {
        if (row.id !== id) return row;

        let updatedRow = { ...row, [field]: field === 'itemName' || field === 'itemDesc' || field === 'uom' ? value : Number(value) };

        // Real-time Stock Restriction Check on Manual Qty Input
        if (field === 'qty') {
          const requestedQty = Number(value) || 0;
          const match = availableProducts.find(p =>
            p.name === updatedRow.itemName ||
            (p.itemCode && p.itemCode.toLowerCase() === (updatedRow.itemDesc || '').toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase() === (updatedRow.itemDesc || '').toLowerCase())
          );
          if (match) {
            const availStock = typeof match.stock === 'number' ? match.stock : 0;
            if (requestedQty > availStock) {
              if (setGlobalNotification) {
                setGlobalNotification({
                  msg: `⚠️ Stock Limit Reached! Barcode "${match.barcode || match.itemCode}" (${match.name}) has only ${availStock} items in stock. Quantity restricted to ${availStock}.`,
                  type: 'error'
                });
                setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
              }
              updatedRow.qty = availStock;
            }
          }
        }

        let baseAmount = updatedRow.qty * updatedRow.rate;
        if (field === 'discPercent') {
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
        } else if (field === 'discAmt') {
          updatedRow.discPercent = baseAmount > 0 ? Number(((updatedRow.discAmt / baseAmount) * 100).toFixed(2)) : 0;
        } else if (field === 'qty' || field === 'rate') {
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
        }

        updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
        return updatedRow;
      });



      return newGrid;
    });
  };

  const handleDeleteRow = (rowId: number) => {
    setGridData(prev => {
      const newGrid = prev.filter(r => r.id !== rowId);
      if (newGrid.length === 0) {
        return [{ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }];
      }
      return newGrid;
    });
    if (setGlobalNotification) {
      setGlobalNotification({ msg: 'Row deleted', type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 1500);
    }
  };

  // Duplicate useEffect removed

  const handleItemBlur = async (id: number, itemName: string) => {
    if (!itemName.trim()) return;
    try {
      const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(itemName)}`);
      const products = await res.json();

      const product = products.find((p: any) => p.name.toLowerCase() === itemName.trim().toLowerCase()) || products[0];

      if (product) {
        setGridData(prev => prev.map(row => {
          if (row.id !== id) return row;

          let updatedRow = {
            ...row,
            itemName: product.name,
            itemDesc: product.itemCode || product.barcode || '',
            size: product.size || '',
            uom: product.uom || 'PCS',
            rate: product.price || 0,
            qty: row.qty === 0 ? 1 : row.qty
          };

          let baseAmount = updatedRow.qty * updatedRow.rate;
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
          updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
          return updatedRow;
        }));
      } else {
        // Unrecognized ad-hoc item, just set qty to 1 so math works if they manual enter a rate
        setGridData(prev => prev.map(row => {
          if (row.id !== id) return row;
          return { ...row, qty: row.qty === 0 ? 1 : row.qty };
        }));
      }
    } catch (err) {
      console.error('Error auto-filling item', err);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number, rowId: number, itemName: string) => {
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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('tendered-input')?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = gridData[rowIndex];
      if (colIndex === 0) {
        const barcode = row.itemDesc?.trim();
        if (!barcode) {
          document.getElementById(`grid-input-${rowIndex}-1`)?.focus();
          return;
        }
        processBarcodeScan(barcode, row.id);
      } else if (colIndex === 1) {
        if (!itemName.trim()) {
          openSearchModal(rowId, e.currentTarget);
        } else {
          // Trigger autocomplete on Item Name then jump to Qty
          handleItemBlur(rowId, itemName);
          setTimeout(() => {
            document.getElementById(`grid-input-${rowIndex}-2`)?.focus();
          }, 150); // slight delay to allow row generation if it was the last row
        }
      } else if (colIndex === 5 || colIndex === 6) {
        // Pressing Enter in Discount % (5) or Discount Amt (6) cell automatically prints the bill!
        handleInstantCheckout();
      } else {
        // Move to next column
        const nextInput = document.getElementById(`grid-input-${rowIndex}-${colIndex + 1}`);
        if (nextInput) {
          nextInput.focus();
        } else {
          // If at the end of the row, check if there is a next row
          if (rowIndex < gridData.length - 1) {
            // Move focus to the barcode of the next row
            document.getElementById(`grid-input-${rowIndex + 1}-0`)?.focus();
          } else {
            // If it is the last row, trigger printing and checkout immediately!
            handleInstantCheckout();
          }
        }
      }
    } else if (e.key === 'F2' && colIndex === 1) {
      e.preventDefault();
      openSearchModal(rowId, e.currentTarget);
    } else if (e.key === 'F9') {
      e.preventDefault();
      handleDeleteRow(rowId);
    }
  };

  const handleRapidBarcodeScan = async (barcode: string) => {
    try {
      let product = availableProducts.find(p => p.barcode === barcode || p.itemCode === barcode);
      if (!product) {
        const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        product = data.find((p: any) => p.barcode === barcode || p.itemCode === barcode);
      }

      if (product) {
        setGridData(prev => {
          let newGrid = [...prev];
          const existingRowIdx = newGrid.findIndex(r => r.itemName === product.name);
          if (existingRowIdx !== -1) {
            let row = { ...newGrid[existingRowIdx] };
            row.qty = Number(row.qty) + 1;
            let baseAmount = row.qty * row.rate;
            row.discAmt = Number(((baseAmount * row.discPercent) / 100).toFixed(2));
            row.amount = Number((baseAmount - row.discAmt).toFixed(2));
            newGrid[existingRowIdx] = row;
          } else {
            const emptyRowIdx = newGrid.findIndex(r => !r.itemName.trim());
            const newRow = {
              id: emptyRowIdx !== -1 ? newGrid[emptyRowIdx].id : Date.now(),
              itemName: product.name,
              itemDesc: product.itemCode || product.barcode || '',
              size: product.size || '',
              uom: product.uom || 'PCS',
              rate: product.price || 0,
              qty: 1,
              discPercent: 0,
              discAmt: 0,
              amount: product.price || 0
            };

            if (emptyRowIdx !== -1) {
              newGrid[emptyRowIdx] = newRow;
              if (emptyRowIdx === newGrid.length - 1) {
                newGrid.push({ id: Date.now() + 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 });
              }
            } else {
              newGrid.push(newRow);
              newGrid.push({ id: Date.now() + 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 });
            }
          }
          return newGrid;
        });

        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Added ${product.name}`, type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 1500);
        }
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Barcode not found: ${barcode}`, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2500);
        }
      }
    } catch (err) {
      console.error("Barcode scan error", err);
    }
    setRapidBarcode('');
  };

  return (
    <div className="flex flex-col h-full space-y-2">

      {/* 1. Header & Rapid Scan */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 border border-blue-700 p-2.5 rounded-md shadow-md text-white flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-1.5 rounded text-white shadow-sm">
            <Search size={18} />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide text-blue-50">HIGH-SPEED POS CHECKOUT</h2>
            <p className="text-[11px] text-blue-200">Hardware Barcode Scanner Ready | Instant O(1) Billing</p>
          </div>
        </div>

        {/* Rapid Barcode Input Field */}
        <div className="flex items-center space-x-2 w-full md:w-auto flex-1 max-w-lg">
          <div className="relative w-full">
            <input
              ref={rapidInputRef}
              type="text"
              className="w-full bg-white text-gray-900 font-mono font-bold text-sm py-1.5 px-3 pl-9 rounded border-2 border-yellow-400 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-300 outline-none shadow-inner placeholder-gray-400"
              placeholder="⚡ Scan barcode (e.g. 100002) for instant scan..."
              value={rapidBarcode}
              onChange={e => setRapidBarcode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  processBarcodeScan(rapidBarcode);
                }
              }}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-yellow-600 font-bold text-sm">⚡</span>
          </div>
          <button
            type="button"
            onClick={() => processBarcodeScan(rapidBarcode)}
            className="bg-yellow-500 hover:bg-yellow-400 text-blue-950 font-extrabold text-xs px-3 py-2 rounded shadow transition-all whitespace-nowrap active:scale-95"
          >
            SCAN
          </button>
        </div>

        {/* Live Scanned Item Display Badge */}
        {scannedFeedback && (
          <div className="bg-emerald-950/90 border border-emerald-500/60 p-2 rounded-md shadow-lg flex items-center space-x-3 text-xs animate-fade-in border-l-4 border-l-emerald-400 min-w-[320px]">
            <div className="bg-emerald-500 text-emerald-950 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
              LAST SCANNED
            </div>
            <div className="flex-1 font-mono text-emerald-100">
              <div className="font-extrabold text-white text-xs flex justify-between">
                <span>{scannedFeedback.name}</span>
                <span className="text-yellow-300 font-bold">₹{scannedFeedback.price}</span>
              </div>
              <div className="text-[11px] text-emerald-300 flex justify-between gap-2 mt-0.5">
                <span>Barcode: <strong className="text-white">{scannedFeedback.barcode}</strong></span>
                <span>Size: <strong className="text-yellow-200">{scannedFeedback.size}</strong></span>
                <span>Stock: <strong className="text-emerald-300">{scannedFeedback.stock} (-1)</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Document Input Panel */}
      <div className="legacy-panel p-1.5 text-xs grid grid-cols-12 gap-x-2 gap-y-1.5 items-center">
        <label className="legacy-label text-right">Buyer</label>
        <div className="col-span-3 relative flex items-center">
          <input
            type="text"
            className={`legacy-input w-full font-bold text-blue-900 bg-blue-50 py-0.5 px-2 focus:bg-yellow-50 outline-none border border-gray-300 rounded-sm ${globalSettings?.isSelectiveCustomer ? 'pr-20' : 'pr-6'}`}
            value={buyerName}
            onChange={e => {
              setBuyerName(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => {
              setTimeout(() => setShowCustomerDropdown(false), 200);
            }}
            placeholder="Search / select buyer..."
          />
          {globalSettings?.isSelectiveCustomer && (
            <span className="absolute right-5 bg-orange-100 text-orange-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-orange-300 uppercase tracking-wide pointer-events-none">
              Selective
            </span>
          )}
          <span className="absolute right-1.5 text-blue-400 font-bold pointer-events-none">▾</span>

          {showCustomerDropdown && (
            <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-gray-300 max-h-48 overflow-y-auto z-[999] shadow-lg rounded text-left">
              {filteredCustomersList.length === 0 ? (
                <div className="p-2 text-xs text-gray-500 italic">No matching customers</div>
              ) : (
                filteredCustomersList.map((c, i) => (
                  <button
                    key={c._id || i}
                    type="button"
                    onMouseDown={() => {
                      setBuyerName(c.accountName);
                      if (c.accountName === 'CASH') {
                        setAddress('');
                        setMobileNo('');
                        setGstNo('');
                      } else {
                        setAddress(c.address || '');
                        setMobileNo(c.mobileNo || '');
                        setGstNo(c.gstNo || '');
                      }
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 text-gray-800 font-semibold border-b border-gray-100 last:border-b-0 flex justify-between"
                  >
                    <span>{c.accountName}</span>
                    {c.ledgerCode && <span className="text-[10px] text-gray-400 font-mono">{c.ledgerCode}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <label className="legacy-label text-right">Inv No</label>
        <input type="text" className="legacy-input col-span-1 font-bold py-0.5 font-mono text-center" value={invoiceNo} disabled />

        <label className="legacy-label text-right">Inv Date</label>
        <input type="date" className="legacy-input col-span-2 py-0.5 font-bold" value={invDate} onChange={e => setInvDate(e.target.value)} />

        <label className="legacy-label text-right">E.Type</label>
        <select className="legacy-input col-span-2 py-0.5 font-bold" value={eType} onChange={e => setEType(e.target.value)}>
          <option>Local</option>
          <option>Interstate</option>
        </select>

        <label className="legacy-label text-right flex items-center justify-end font-bold text-gray-800">
          <MessageSquare size={13} className="mr-1 text-emerald-600" />
          Mobile
        </label>
        <div className="col-span-3 relative flex items-center">
          <input
            type="text"
            className="legacy-input w-full py-0.5 font-mono font-bold text-gray-900 bg-white border-gray-400 focus:bg-yellow-50 focus:border-blue-500 pr-6"
            value={mobileNo}
            onChange={e => setMobileNo(e.target.value)}
            placeholder="Mobile / WhatsApp..."
          />
          {mobileNo && (
            <button
              type="button"
              onClick={handleSendWhatsApp}
              title="Send Bill via WhatsApp"
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-700 text-white p-0.5 rounded shadow text-[10px] transition-all"
            >
              <Send size={10} />
            </button>
          )}
        </div>

        <label className="legacy-label text-right">Salesman</label>
        <input type="text" className="legacy-input col-span-2 bg-yellow-50 py-0.5 font-bold" value={salesman} onChange={e => setSalesman(e.target.value)} placeholder="Billed By" />

        <label className="legacy-label text-right text-blue-900 font-bold">Pay Mode</label>
        <div className="col-span-4 flex items-center space-x-1 min-w-0">
          <select
            className="legacy-input min-w-0 flex-1 font-bold py-0.5 border-blue-500 bg-blue-50 focus:bg-yellow-50 text-xs truncate"
            value={paymentMode}
            onChange={e => {
              const mode = e.target.value;
              setPaymentMode(mode);
              if (mode.includes('UPI') || mode.includes('Online')) {
                setShowUpiModal(true);
              }
            }}
          >
            <option value="Cash">💵 Cash Pay</option>
            <option value="UPI / Online Pay">📱 Online Pay (UPI / QR)</option>
            <option value="Credit Card">💳 Credit Card</option>
            <option value="Debit Card">💳 Debit Card</option>
            <option value="Bank Transfer">🏦 Bank Transfer</option>
            <option value="Credit / Ledger">📜 Credit / Account</option>
          </select>
          <div className="flex space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setPaymentMode('Cash')}
              className={`py-0.5 px-1.5 rounded text-[10px] font-extrabold transition-all border ${paymentMode === 'Cash' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-emerald-50 border-gray-300'}`}
            >
              💵 Cash
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMode('UPI / Online Pay');
                setShowUpiModal(true);
              }}
              className={`py-0.5 px-1.5 rounded text-[10px] font-extrabold transition-all border ${paymentMode.includes('UPI') || paymentMode.includes('Online') ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-blue-50 border-gray-300'}`}
            >
              📱 Online
            </button>
          </div>
        </div>
      </div>

      {/* Selected Customer Status Banner */}
      {selectedCustomerObj && (
        <div className="bg-[#e2f0d9] border border-[#a8d08d] mx-1 mt-1 p-1.5 px-3 flex items-center justify-between text-xs font-bold text-[#385623] shadow-sm rounded">
          <div className="flex items-center space-x-1">
            <span className="bg-[#385623] w-1.5 h-4 block"></span>
            <span>CUSTOMER CREDIT STATUS ({selectedCustomerObj.ledgerCode}):</span>
            {selectedCustomerObj.isRegular && (
              <span className="ml-2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                ⭐ REGULAR PRIVILEGED
              </span>
            )}
          </div>
          <div className="flex space-x-6">
            <div>Current Balance: <span className="font-mono text-[#c55a11]">₹{selectedCustomerObj.openingBalance?.toLocaleString() || 0} {selectedCustomerObj.drCr || 'Dr'}</span></div>
            <div>Credit Limit: <span className="font-mono">₹{selectedCustomerObj.creditLimit?.toLocaleString() || 0}</span></div>
            <div>Allowed Period: <span>{selectedCustomerObj.defaultCreditPeriod || 0} Days</span></div>
          </div>
        </div>
      )}

      {/* 3. Data Entry Grid */}
      <div className="flex-1 min-h-[200px] bg-white border border-gray-400 overflow-auto mx-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="legacy-grid-header w-10">S.No</th>
              <th className="legacy-grid-header w-32">Barcode Number</th>
              <th className="legacy-grid-header">Item Name</th>
              <th className="legacy-grid-header w-16">Size</th>
              <th className="legacy-grid-header w-16">Quantity</th>
              <th className="legacy-grid-header w-16">UOM</th>
              <th className="legacy-grid-header w-24">Rate</th>
              <th className="legacy-grid-header w-16">Disc %</th>
              <th className="legacy-grid-header w-20">DiscAmt</th>
              <th className="legacy-grid-header w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {gridData.map((row, idx) => (
              <tr key={row.id} className="hover:bg-blue-50">
                <td className="legacy-grid-cell text-center font-semibold text-gray-700">{idx + 1}</td>
                <td className="legacy-grid-cell p-0">
                  <input
                    id={`grid-input-${idx}-0`}
                    type="text"
                    placeholder="Barcode..."
                    className="w-full h-full p-1 pl-2 border-none outline-none focus:bg-yellow-100 font-mono text-blue-900 font-bold"
                    value={row.itemDesc}
                    onChange={e => handleGridChange(row.id, 'itemDesc', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx, 0, row.id, row.itemName)}
                  />
                </td>
                <td className="legacy-grid-cell p-0 relative">
                  <input
                    id={`grid-input-${idx}-1`}
                    type="text"
                    placeholder="Press Enter to search..."
                    className="w-full h-full p-1 pl-2 pr-8 border-none outline-none focus:bg-yellow-100 placeholder-gray-300 font-semibold text-gray-800"
                    value={row.itemName}
                    onChange={e => handleGridChange(row.id, 'itemName', e.target.value)}
                    onBlur={e => handleItemBlur(row.id, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx, 1, row.id, row.itemName)}
                    onDoubleClick={e => openSearchModal(row.id, e.currentTarget)}
                  />
                  {!row.itemName && (
                    <button 
                      onClick={e => openSearchModal(row.id, e.currentTarget)}
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                    >
                      <Search size={14} />
                    </button>
                  )}
                </td>
                <td className="legacy-grid-cell p-0">
                  <input
                    id={`grid-input-${idx}-size`}
                    type="text"
                    placeholder="Size"
                    className="w-full h-full p-1 text-center border-none outline-none focus:bg-yellow-100 font-bold text-blue-900 bg-blue-50/30"
                    value={row.size || ''}
                    onChange={e => handleGridChange(row.id, 'size', e.target.value)}
                  />
                </td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-2`} type="number" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100 font-bold text-gray-900" value={row.qty || ''} onChange={e => handleGridChange(row.id, 'qty', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 2, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-3`} type="text" className="w-full h-full p-1 border-none outline-none focus:bg-yellow-100" value={row.uom} onChange={e => handleGridChange(row.id, 'uom', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 3, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-4`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100 font-bold" value={row.rate || ''} onChange={e => handleGridChange(row.id, 'rate', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 4, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-5`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.discPercent || ''} onChange={e => handleGridChange(row.id, 'discPercent', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 5, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-6`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.discAmt || ''} onChange={e => handleGridChange(row.id, 'discAmt', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 6, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell text-right bg-gray-50 font-bold text-gray-900">{row.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid Table Action Buttons */}
      <div className="flex gap-2 my-1.5">
        <button
          type="button"
          onClick={() => setGridData(prev => [...prev, { id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }])}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[11px] shadow flex items-center gap-1.5 transition-all"
        >
          <span>+ Add Row</span>
        </button>
      </div>

      {/* 4. Totals & Terms Panel */}
      <div className="grid grid-cols-3 gap-2">
        {/* Left: Terms and Actions */}
        <div className="col-span-2 flex flex-col space-y-1">

          <div className="legacy-panel p-1 flex space-x-2">
            <div className="flex-1 flex items-center">
              <label className="legacy-label whitespace-nowrap mr-2">Shipping Addr.</label>
              <input 
                type="text" 
                className="legacy-input w-full py-0.5" 
                value={shippingAddress}
                onChange={e => setShippingAddress(e.target.value)}
              />
            </div>
            <div className="flex-1 flex items-center">
              <label className="legacy-label whitespace-nowrap mr-2">Remarks</label>
              <input 
                type="text" 
                className="legacy-input w-full py-0.5" 
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>
          </div>

          

          <div className="flex flex-wrap gap-1.5 mt-auto pb-1 items-center">
            <div className="flex-1"></div>
            <button type="button" className="legacy-button py-1.5 px-4 bg-green-600 text-white font-extrabold border-green-700 hover:bg-green-700 shadow-sm transition-all flex items-center space-x-1.5 rounded" onClick={handleInstantCheckout}>
              <Zap size={13} className="text-yellow-300 fill-yellow-300" />
              <span> Save + Print + WhatsApp</span>
            </button>
            <button type="button" className="legacy-button py-1.5 px-3 bg-red-100 font-bold border-red-400 hover:bg-red-200 transition-colors rounded text-xs" onClick={handleCancelClick}>Cancel</button>
          </div>
        </div>

        {/* Right: Calculations */}
        <div className="legacy-panel p-1 grid grid-cols-4 gap-x-2 gap-y-0.5 items-center text-xs">
          <label className="legacy-label col-span-2 text-right">Total Qty</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5" value={totalQty.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 text-right">Total Amount</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5" value={totalAmount.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 text-right text-emerald-700 font-bold flex items-center justify-end">
            {selectedCustomerObj?.isRegular && <span className="text-yellow-600 mr-1">⭐</span>}
            Favour Disc (₹)
          </label>
          <input
            type="number"
            className={`legacy-input col-span-2 text-right py-0.5 font-bold focus:bg-yellow-100 ${selectedCustomerObj?.isRegular ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : ''}`}
            value={favourDiscount || ''}
            onChange={e => setFavourDiscount(Number(e.target.value))}
            placeholder="Special Discount"
            onKeyDown={handleDiscountKeyDown}
          />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            CGST <input type="number" className="ml-1 w-10 text-center border border-gray-400 py-0 text-[10px]" value={cgstPercent} onChange={e => setCgstPercent(Number(e.target.value))} /> %
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={cgst.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            SGST <input type="number" className="ml-1 w-10 text-center border border-gray-400 py-0 text-[10px]" value={sgstPercent} onChange={e => setSgstPercent(Number(e.target.value))} /> %
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={sgst.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            Round Off
            <select className="legacy-input py-0 text-[10px] ml-1">
              <option>Auto</option>
              <option>Manual</option>
            </select>
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)} disabled />

          <div className="col-span-4 border-t border-gray-400 my-0.5"></div>

          <label className="legacy-label col-span-2 text-right text-sm">Net Amount</label>
          <input type="text" className="legacy-input col-span-2 text-right text-sm font-bold bg-[#e6f2ff] border-blue-500 text-blue-900 py-0.5" value={netAmount.toFixed(2)} disabled />

          <div className="col-span-4 border-t border-gray-400 my-0.5"></div>
          <label className="legacy-label col-span-2 text-right text-blue-900">Amt Tendered</label>
          <input
            id="tendered-input"
            type="number"
            className="legacy-input col-span-2 text-right font-bold bg-white border-blue-400 py-0.5"
            value={tendered || ''}
            onChange={e => setTendered(Number(e.target.value))}
            onKeyDown={handleTenderedEnter}
            placeholder="Cash given..."
          />

          <label className="legacy-label col-span-2 text-right text-green-700">Change Return</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold bg-green-100 text-green-900 border-green-500 py-0.5" value={(tendered > 0 ? tendered - netAmount : 0).toFixed(2)} disabled />
        </div>
      </div>

      {/* Enterprise-styled Inline Dropdown Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50" onClick={closeSearchModal}>
          <div
            className="fixed bg-white shadow-2xl flex flex-col border border-gray-500 rounded-sm overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: '750px',
              maxHeight: '400px'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header - Matching Image 1 Navy Blue Theme */}
            <div className="bg-[#385386] text-white px-3 py-1.5 flex justify-between items-center shadow-sm z-10 cursor-default">
              <div className="flex items-center space-x-2">
                <Search size={16} className="text-white" />
                <span className="font-bold tracking-wide text-sm">Product Search Lookup</span>
              </div>
              <button onClick={closeSearchModal} className="text-white hover:text-red-300 font-bold focus:outline-none">
                ✕
              </button>
            </div>

            {/* Search Input Area */}
            <div className="p-3 bg-[#f0f0f0] border-b border-gray-300 flex items-center space-x-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by product name, code, or barcode... (Sorted Alphabetically)"
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-400 focus:border-[#385386] focus:ring-1 focus:ring-[#385386] outline-none text-sm text-gray-800"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleModalKeyDown}
                />
              </div>
              <div className="text-xs text-gray-700 flex space-x-4 bg-white px-3 py-1.5 border border-gray-300 shadow-sm">
                <span><kbd className="font-bold">↑</kbd> <kbd className="font-bold">↓</kbd> Navigate</span>
                <span><kbd className="font-bold">Enter</kbd> Select</span>
              </div>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-[#e8ecef] border-b border-gray-400 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              <div className="col-span-2">Code</div>
              <div className="col-span-6">Product Details</div>
              <div className="col-span-2 text-center">Stock</div>
              <div className="col-span-2 text-right">Price (₹)</div>
            </div>

            {/* List Body */}
            <div className="overflow-y-auto flex-1 bg-white">
              {filteredProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-gray-200 cursor-pointer items-center text-sm ${idx === highlightedIndex ? 'bg-[#a3c293] text-black font-semibold' : 'hover:bg-[#eaf1e6] text-gray-800'}`}
                  onClick={() => selectProductFromModal(p)}
                >
                  <div className="col-span-2 text-xs">
                    {p.itemCode || '-'}
                  </div>
                  <div className="col-span-6 flex flex-col justify-center">
                    <span className="leading-tight font-medium">
                      {p.name}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-0.5 text-[10px]">
                      {p.department && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#f0f9eb] text-[#2b579a]' : 'bg-[#e8f4fd] text-blue-800'}`}>{p.department}</span>}
                      {p.variety && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#f3e8ff] text-[#2b579a]' : 'bg-purple-100 text-purple-800'}`}>{p.variety}</span>}
                      {p.size && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#fef3c7] text-[#2b579a]' : 'bg-amber-100 text-amber-800'}`}>Size: {p.size}</span>}
                      {p.barcode && <span className={idx === highlightedIndex ? 'text-gray-800 ml-1' : 'text-gray-500 ml-1'}>Barcode: {p.barcode}</span>}
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`px-1.5 py-0.5 text-xs font-bold ${idx === highlightedIndex ? '' : p.stock > 10 ? 'text-green-700' : p.stock > 0 ? 'text-yellow-700' : 'text-red-700'}`}>
                      {p.stock} {p.uom}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-bold text-sm">
                    {p.price.toFixed(2)}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <Search size={32} className="mb-2 text-gray-300" />
                  <p className="text-sm font-bold">No products found</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="bg-[#f0f0f0] px-3 py-1.5 border-t border-gray-300 text-[11px] text-gray-600 flex justify-between">
              <span>Showing {filteredProducts.length} enrolled products in alphabetical order.</span>
              <span>Use <kbd className="font-bold border border-gray-300 px-1 bg-white">ESC</kbd> to close</span>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise-styled Confirmation Modal */}
      {confirmModalState.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white shadow-2xl w-[400px] flex flex-col border border-gray-500 rounded-sm overflow-hidden">
            <div className="bg-[#385386] text-white px-3 py-1.5 flex justify-between items-center shadow-sm">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-white" />
                <span className="font-bold tracking-wide text-sm">{confirmModalState.title || "Save Confirmation"}</span>
              </div>
            </div>
            <div className="p-4 bg-[#f0f0f0] border-b border-gray-300">
              <p className="text-sm text-gray-800 font-semibold mb-2">{confirmModalState.message || "Do you want to save these changes permanently?"}</p>
              {!confirmModalState.title && <p className="text-xs text-gray-600">This action cannot be undone.</p>}
            </div>
            <div className="bg-gray-100 px-4 py-2 flex justify-end space-x-2 border-t border-gray-300">
              <button
                id="confirm-cancel-btn"
                className="px-4 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-sm text-sm border border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => {
                  if (confirmModalState.cancelAction) confirmModalState.cancelAction();
                  else setConfirmModalState({ isOpen: false, action: null });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') document.getElementById('confirm-save-btn')?.focus();
                  if (e.key === 'Escape') setConfirmModalState({ isOpen: false, action: null });
                }}
              >
                {confirmModalState.noText || "No, Cancel"}
              </button>
              <button
                id="confirm-save-btn"
                autoFocus
                className="px-4 py-1.5 bg-[#a3c293] hover:bg-[#8eb07d] text-black font-bold rounded-sm text-sm border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-700"
                onClick={() => {
                  if (confirmModalState.action) confirmModalState.action();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') document.getElementById('confirm-cancel-btn')?.focus();
                  if (e.key === 'Escape') setConfirmModalState({ isOpen: false, action: null });
                }}
              >
                {confirmModalState.yesText || "Yes, Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSCheckout;
