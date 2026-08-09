import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Plus, Trash2, Edit, Search } from 'lucide-react';
import Modal from '../components/Modal';
import Api from '../Api';

interface PurchaseItem {
  id: string;
  itemCode: string;
  vendorItemCode?: string;
  itemName: string;
  weight?: string;
  category: string;
  itemDesc: string;
  hsn: string;
  qty: number;
  freeQty?: number;
  unitPrice: number;
  salesRate: number;
  mrp: number;
  discPercent: number;
  taxPercent: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  total: number;
  isManualItem?: boolean;
}

const PurchaseBill = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'form-only' | 'table-only'>('form-only');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'bills' | 'items'>('bills');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Dress Selection Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Header State
  const [billNo, setBillNo] = useState('Loading...');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState('');
  const [gstin, setGstin] = useState('');
  const [supplyPlace, setSupplyPlace] = useState('Tamil Nadu');
  const [vendorName, setVendorName] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [vendors, setVendors] = useState<{id: string, name: string, gstin: string, state: string}[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    barcode: '',
    itemCode: '',
    name: '',
    weight: '1kg',
    department: '',
    purchaseRate: 0,
    price: 0,
    mrp: 0,
    taxPercent: 18,
    qty: 1
  });

  // Filter products for the modal search list
  const modalFilteredProducts = useMemo(() => {
    const q = modalSearchQuery.toLowerCase().trim();
    if (!q) return dbProducts;
    return dbProducts.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.variety?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q)
    );
  }, [dbProducts, modalSearchQuery]);

  // Handle select product from modal
  const selectProductFromModal = (prod: any) => {
    if (!activeRowId) return;
    updateItem(activeRowId, 'itemCode', prod.itemCode || '');
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

  // Load vendors from Database on mount
  const fetchVendors = async () => {
    try {
      const res = await fetch(`${Api}/ledgers/search?group=Suppliers`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((l: any) => ({
          id: l._id || l.id || l.ledgerCode,
          name: l.accountName,
          gstin: l.gstNo || '',
          state: l.state || 'Tamil Nadu'
        }));
        setVendors(mapped);
      }
    } catch (err) {
      console.error("Error loading suppliers", err);
    }
  };

  const handleVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setVendorName(val);
    
    // Check if the typed value matches any vendor in the list
    const foundVendor = vendors.find(v => v.name.toLowerCase() === val.toLowerCase());
    if (foundVendor) {
      setVendorId(foundVendor.id);
      setGstin(foundVendor.gstin);
      setSupplyPlace(foundVendor.state);
    } else {
      setVendorId('');
    }
  };

  // Fetch sequential voucher number from DB
  const fetchNextVoucher = async () => {
    try {
      const res = await fetch(`${Api}/purchase-bills/next-voucher`);
      if (res.ok) {
        const data = await res.json();
        if (data.voucherNo) {
          setBillNo(data.voucherNo);
        }
      }
    } catch (err) {
      console.error("Error fetching next voucher", err);
    }
  };

  // Fetch all saved purchase bills from DB
  const fetchSavedBills = async () => {
    try {
      const res = await fetch(`${Api}/purchase-bills`);
      if (res.ok) {
        const data = await res.json();
        setSavedBills(data);
      }
    } catch (err) {
      console.error("Error fetching saved bills", err);
    }
  };

  // Fetch all products from DB for lookup and sidebar list
  const fetchProducts = async () => {
    try {
      const res = await fetch(`${Api}/products/search?q=`);
      if (res.ok) {
        const data = await res.json();
        setDbProducts(data);
      }
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  // Auto-save/update product to the master catalog (Product database)
  const saveProductToDb = async (item: PurchaseItem) => {
    if (!item.itemCode || !item.itemCode.trim()) return;

    try {
      const checkRes = await fetch(`${Api}/products/barcode/${encodeURIComponent(item.itemCode.trim())}`);
      let url = `${Api}/products`;
      let method = 'POST';
      let existingStock = 0;

      if (checkRes.ok) {
        const existingProduct = await checkRes.json();
        if (existingProduct) {
          url = `${Api}/products/${existingProduct.id || existingProduct._id}`;
          method = 'PUT';
          existingStock = existingProduct.stock || 0;
        }
      }

      const payload = {
        itemCode: item.itemCode.trim().toUpperCase(),
        name: (item.itemDesc || item.itemName || item.itemCode).trim(),
        barcode: item.itemCode.trim(),
        weight: item.weight || '',
        department: item.category || 'General',
        purchaseRate: Number(item.unitPrice) || 0,
        price: Number(item.salesRate) || Number(item.unitPrice) || 0,
        mrp: Number(item.mrp) || Number(item.unitPrice) || 0,
        taxPercent: Number(item.taxPercent) || 18,
        stock: method === 'POST' ? 0 : existingStock,
        uom: 'PCS'
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error("Error auto-saving product to master:", err);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchNextVoucher();
    fetchSavedBills();
    fetchProducts();
  }, []);

  // Parse state for editing bill passed from register
  useEffect(() => {
    const editBill = location.state?.editBill;
    if (editBill) {
      handleEditBill(editBill);
    }
  }, [location.state]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Global scanner listener: redirects focus to the barcode scanner field when user starts typing (and is not editing another input)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElem = document.activeElement;
      
      // If the user is currently editing an input, select dropdown, or textarea, let them work normally.
      if (
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'SELECT' ||
          activeElem.tagName === 'TEXTAREA') &&
        activeElem !== scanInputRef.current
      ) {
        return;
      }

      // Ignore common modifier key actions (Ctrl+C, Ctrl+V, Alt, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
        return;
      }

      // Redirect focus to scanner input field
      if (scanInputRef.current && document.activeElement !== scanInputRef.current) {
        scanInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) {
      setGlobalNotification({ msg: "Product Name is required.", type: 'error' });
      return;
    }

    try {
      setLoading(true);
      // 1. Save product to database Product Register
      const response = await fetch(`${Api}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode: quickAddForm.itemCode,
          name: quickAddForm.name.trim(),
          barcode: quickAddForm.barcode.trim(),
          weight: quickAddForm.weight || '',
          department: quickAddForm.department,
          purchaseRate: quickAddForm.purchaseRate,
          price: quickAddForm.price,
          mrp: quickAddForm.mrp,
          taxPercent: quickAddForm.taxPercent,
          stock: 0, // Stock is incremented by the purchase bill save itself!
          uom: 'PCS'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      // 2. Add product to active bill items grid
      const newItem: PurchaseItem = {
        id: Math.random().toString(),
        itemCode: quickAddForm.itemCode,
        vendorItemCode: '',
        itemName: quickAddForm.name.trim(),
        weight: '',
        category: quickAddForm.department || 'General',
        itemDesc: quickAddForm.name.trim(),
        hsn: quickAddForm.barcode.trim(),
        qty: Number(quickAddForm.qty) || 1,
        freeQty: 0,
        unitPrice: Number(quickAddForm.purchaseRate) || 0,
        salesRate: Number(quickAddForm.price) || 0,
        mrp: Number(quickAddForm.mrp) || 0,
        discPercent: 0,
        taxPercent: Number(quickAddForm.taxPercent) || 18,
        cgstAmt: 0,
        sgstAmt: 0,
        igstAmt: 0,
        total: 0
      };

      const calculated = calculateItemValues(newItem, supplyPlace);
      setItems(prev => [...prev, calculated]);
      
      setGlobalNotification({
        msg: `Product ${quickAddForm.name} registered and added to bill successfully!`,
        type: 'success'
      });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      
      setIsQuickAddModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: `Error creating product: ${err.message}`, type: 'error' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
    } finally {
      setLoading(false);
      // Keep scanner focused
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  };

  // Modal State
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({ name: '', gstin: '', state: 'Tamil Nadu' });

  const createBlankRow = (): PurchaseItem => ({
    id: Math.random().toString(36).substring(2, 15),
    itemCode: '',
    vendorItemCode: '',
    itemName: '',
    weight: '',
    category: 'General',
    itemDesc: '',
    hsn: '',
    qty: 1,
    freeQty: 0,
    unitPrice: 0,
    salesRate: 0,
    mrp: 0,
    discPercent: 0,
    taxPercent: 18,
    cgstAmt: 0,
    sgstAmt: 0,
    igstAmt: 0,
    total: 0,
    isManualItem: false
  });

  // Grid State - initialized with 1 default blank row
  const [items, setItems] = useState<PurchaseItem[]>([createBlankRow()]);
  
  // Calculate Totals
  const subTotal = items.reduce((acc, curr) => acc + (curr.qty * curr.unitPrice), 0);
  const discTotal = items.reduce((acc, curr) => acc + ((curr.qty * curr.unitPrice) * (curr.discPercent / 100)), 0);
  const taxableTotal = subTotal - discTotal;
  
  const totalCgst = items.reduce((acc, curr) => acc + curr.cgstAmt, 0);
  const totalSgst = items.reduce((acc, curr) => acc + curr.sgstAmt, 0);
  const totalIgst = items.reduce((acc, curr) => acc + curr.igstAmt, 0);
  
  const rawTotal = taxableTotal + totalCgst + totalSgst + totalIgst;
  const roundedOff = Math.round(rawTotal) - rawTotal;
  const grandTotal = Math.round(rawTotal);

  // Handle Vendor Change
  useEffect(() => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setGstin(vendor.gstin);
      setSupplyPlace(vendor.state);
      setVendorName(vendor.name);
    } else {
      setGstin('');
      setSupplyPlace('Tamil Nadu');
      setVendorName('');
    }
  }, [vendorId, vendors]);

  // Recalculate item calculations helper
  const calculateItemValues = (item: PurchaseItem, currentSupplyPlace: string) => {
    const qty = isNaN(item.qty) ? 0 : item.qty;
    const price = isNaN(item.unitPrice) ? 0 : item.unitPrice;
    const baseVal = qty * price;
    const afterDisc = baseVal - (baseVal * (item.discPercent / 100));
    
    const isInterstate = currentSupplyPlace.toLowerCase() !== 'tamil nadu';
    
    let igstAmt = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;

    if (isInterstate) {
      igstAmt = afterDisc * (item.taxPercent / 100);
    } else {
      cgstAmt = afterDisc * ((item.taxPercent / 2) / 100);
      sgstAmt = afterDisc * ((item.taxPercent / 2) / 100);
    }
    
    const total = afterDisc + cgstAmt + sgstAmt + igstAmt;

    return {
      ...item,
      cgstAmt,
      sgstAmt,
      igstAmt,
      total
    };
  };

  const triggerScannerScan = async (code: string) => {
    if (!code) return;

    try {
      setLoading(true);
      const res = await fetch(`${Api}/products/barcode/${encodeURIComponent(code)}`);
      if (!res.ok) {
        if (res.status === 404) {
          // Fetch next available system item code
          try {
            const codeRes = await fetch(`${Api}/products/next-code`);
            let nextItemCode = 'ITM-1000';
            if (codeRes.ok) {
              const codeData = await codeRes.json();
              if (codeData.itemCode) nextItemCode = codeData.itemCode;
            }
            setQuickAddForm({
              barcode: code,
              itemCode: nextItemCode,
              name: '',
              weight: '1kg',
              department: '',
              purchaseRate: 0,
              price: 0,
              mrp: 0,
              taxPercent: 18,
              qty: 1
            });
            setIsQuickAddModalOpen(true);
          } catch (ce) {
            console.error("Failed to fetch next sequence code:", ce);
          }
        } else {
          setGlobalNotification({ msg: "Error fetching product.", type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        return;
      }

      const product = await res.json();
      if (product) {
        // Check if item already exists in purchase items
        const existingItemIndex = items.findIndex(item => item.itemCode.toUpperCase() === product.itemCode.toUpperCase());
        
        if (existingItemIndex > -1) {
          // Increment quantity
          setItems(prev => prev.map((item, idx) => {
            if (idx === existingItemIndex) {
              const updatedQty = item.qty + 1;
              return calculateItemValues({ ...item, qty: updatedQty }, supplyPlace);
            }
            return item;
          }));
          setGlobalNotification({
            msg: `Increased quantity of ${product.name} to ${items[existingItemIndex].qty + 1}`,
            type: 'success'
          });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
        } else {
          // Add new row
          const newItem: PurchaseItem = {
            id: Math.random().toString(),
            itemCode: product.itemCode,
            vendorItemCode: product.vendorItemCode || '',
            itemName: product.name,
            weight: product.weight || '',
            category: product.department || 'General',
            itemDesc: product.name,
            hsn: product.barcode || '',
            qty: 1,
            unitPrice: product.purchaseRate || 0,
            salesRate: product.price || 0,
            mrp: product.mrp || 0,
            discPercent: 0,
            taxPercent: product.taxPercent || 18,
            cgstAmt: 0,
            sgstAmt: 0,
            igstAmt: 0,
            total: 0
          };
          const calculated = calculateItemValues(newItem, supplyPlace);
          setItems(prev => [...prev, calculated]);
          setGlobalNotification({
            msg: `Added product ${product.name} to purchase list`,
            type: 'success'
          });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
        }
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: "Error searching barcode.", type: 'error' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
    } finally {
      setLoading(false);
      // Keep input focused
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  };

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInput.trim();
      if (!code) return;
      await triggerScannerScan(code);
      setScanInput('');
    }
  };

  // Global hardware barcode scanner keypress detector
  const scannerBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElem = document.activeElement;

      // Skip global intercept if they are typing inside the scan input itself
      if (activeElem?.id === 'purchase-scan-input') {
        return;
      }

      // Check if active element is a text input. If so, let them type normally.
      // (Unless it is very fast scanner input, but standard inputs are bypassed)
      const isInput = activeElem?.tagName === 'INPUT' || activeElem?.tagName === 'TEXTAREA' || activeElem?.tagName === 'SELECT';
      if (isInput && scannerBufferRef.current.length === 0) {
        // Let user type normally in normal input fields (except scan input)
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (timeDiff > 80 && scannerBufferRef.current.length < 5) {
        scannerBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (scannerBufferRef.current.length >= 3) {
          e.preventDefault();
          const scannedCode = scannerBufferRef.current;
          scannerBufferRef.current = '';
          triggerScannerScan(scannedCode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        scannerBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [vendorId, items, supplyPlace]);

  // Generate a unique sequential item code for a row
  const generateCodeForRow = async (rowId: string) => {
    try {
      const res = await fetch(`${Api}/products/next-code`);
      if (res.ok) {
        const data = await res.json();
        let code = data.itemCode || 'ITM-1001';
        
        const match = code.match(/^(ITM-)(\d+)$/);
        if (match) {
          const prefix = match[1];
          let num = parseInt(match[2]);
          
          while (
            items.some(item => item.itemCode?.toUpperCase() === `${prefix}${num}`) ||
            dbProducts.some(p => p.itemCode?.toUpperCase() === `${prefix}${num}`)
          ) {
            num++;
          }
          code = `${prefix}${num}`;
        }
        
        updateItem(rowId, 'itemCode', code);
      }
    } catch (err) {
      console.error("Error generating item code:", err);
      const fallbackNum = Math.floor(1000 + Math.random() * 9000);
      updateItem(rowId, 'itemCode', `ITM-${fallbackNum}`);
    }
  };

  // Handle Item Row Update
  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      let updated = { ...item, [field]: value };
      
      // Keep itemName and itemDesc in sync
      if (field === 'itemDesc') {
        updated.itemName = value;
      }
      
      // Auto-fill from DB products when itemCode changes
      if (field === 'itemCode') {
        const prod = dbProducts.find(p => p.itemCode?.toLowerCase() === value.trim().toLowerCase());
        if (prod) {
          updated.itemName = prod.name || '';
          updated.itemDesc = prod.name || '';
          updated.hsn = prod.barcode || '';
          updated.unitPrice = prod.purchaseRate || 0;
          updated.salesRate = prod.price || 0;
          updated.mrp = prod.mrp || 0;
          updated.taxPercent = prod.taxPercent || 18;
          updated.weight = prod.weight || '';
          updated.freeQty = 0;
          updated.category = prod.department || 'General';
          updated.vendorItemCode = prod.vendorItemCode || '';
        }
      }

      updated = calculateItemValues(updated, supplyPlace);
      return updated;
    }));
  };

  // Recalculate all items if Place of Supply changes
  useEffect(() => {
    setItems(prev => prev.map(item => calculateItemValues(item, supplyPlace)));
  }, [supplyPlace]);

  const addRow = () => {
    setItems(prev => [...prev, createBlankRow()]);
  };

  const removeRow = (id: string) => {
    setItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered.length === 0 ? [createBlankRow()] : filtered;
    });
  };

  const clearForm = () => {
    setEditingId(null);
    fetchNextVoucher();
    setItems([createBlankRow()]);
    setVendorId('');
    setVendorName('');
    setGstin('');
    setSupplyPlace('Tamil Nadu');
    setSupplierInvoiceNo('');
    setSupplierInvoiceDate(new Date().toISOString().split('T')[0]);
    navigate('/purchase-bill', { state: null, replace: true });
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 150);
  };

  // Keyboard navigation for fast data entry
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, _idx?: number, _field?: string) => {
    if (e.key === 'Enter') {
      if (_field === 'itemCode') {
        const val = (e.target as HTMLInputElement).value.trim();
        const found = dbProducts.find(p => p.itemCode?.toLowerCase() === val.toLowerCase() || p.barcode?.toLowerCase() === val.toLowerCase());
        if (!found) {
          e.preventDefault();
          setActiveRowId(_idx !== undefined ? items[_idx].id : null);
          setModalSearchQuery(val);
          setHighlightedProductIndex(0);
          setIsProductModalOpen(true);
          return;
        }
      }
      e.preventDefault();
      const formElements = Array.from(
        document.querySelectorAll('table tbody input, table tbody select')
      ) as (HTMLInputElement | HTMLSelectElement)[];
      
      const currentElement = e.target as (HTMLInputElement | HTMLSelectElement);
      const currentIndex = formElements.indexOf(currentElement);
      
      if (currentIndex !== -1 && currentIndex < formElements.length - 1) {
        formElements[currentIndex + 1].focus();
      } else if (currentIndex === formElements.length - 1) {
        addRow();
        setTimeout(() => {
          const updatedElements = Array.from(
            document.querySelectorAll('table tbody input, table tbody select')
          ) as (HTMLInputElement | HTMLSelectElement)[];
          if (updatedElements.length > formElements.length) {
            updatedElements[currentIndex + 1].focus();
          }
        }, 100);
      }
    }
  };

  // Handle Edit selection
  const handleEditBill = async (billInput: any) => {
    if (!billInput) return;
    let bill = billInput;
    const bId = billInput.id || billInput._id || billInput.voucherNo;

    if (bId) {
      try {
        const res = await fetch(`${Api}/purchase-bills/${encodeURIComponent(bId)}`);
        if (res.ok) {
          const fetched = await res.json();
          if (fetched && (fetched.voucherNo || fetched.id || fetched._id)) {
            bill = fetched;
          }
        }
      } catch (err) {
        console.warn("Could not fetch full purchase bill by ID, falling back to local object:", err);
      }
    }

    setEditingId(bill.id || bill._id || bill.voucherNo);
    setBillNo(bill.voucherNo || bill.billNo || '');

    const rawDate = bill.date || bill.billDate || bill.createdAt;
    setBillDate(rawDate ? String(rawDate).split('T')[0] : new Date().toISOString().split('T')[0]);

    const sName = bill.supplierName || bill.vendorName || bill.buyerName || bill.supplier || bill.vendor || bill.accountName || '';
    setVendorName(sName);

    const sGstin = bill.supplierGstin || bill.vendorGstin || bill.gstin || bill.gstNo || '';
    setGstin(sGstin);

    const invNo = bill.supplierInvoiceNo || bill.invoiceNo || bill.billNo || bill.supplierBillNo || '';
    setSupplierInvoiceNo(invNo && invNo !== 'N/A' ? invNo : '');

    const rawInvDate = bill.supplierInvoiceDate || bill.invoiceDate || rawDate;
    setSupplierInvoiceDate(rawInvDate ? String(rawInvDate).split('T')[0] : (rawDate ? String(rawDate).split('T')[0] : new Date().toISOString().split('T')[0]));

    const isLocal = bill.type === 'Local' || bill.eType === 'Local' || bill.supplyPlace === 'Tamil Nadu' || bill.placeOfSupply === 'Tamil Nadu';
    const currentSupplyPlace = isLocal ? 'Tamil Nadu' : 'Other State';
    setSupplyPlace(currentSupplyPlace);

    const foundVendor = vendors.find(v => v.name?.toLowerCase() === sName.toLowerCase());
    if (foundVendor) {
      setVendorId(foundVendor.id);
      if (!sGstin && foundVendor.gstin) setGstin(foundVendor.gstin);
    } else if (bill.vendorId) {
      setVendorId(bill.vendorId);
    }

    if (bill.items && Array.isArray(bill.items)) {
      const mapped = bill.items.map((i: any) => {
        const prod = dbProducts.find(p => p.itemCode?.toLowerCase() === i.itemCode?.toLowerCase());
        const rate = Number(i.rate || i.unitPrice || i.purchaseRate || prod?.purchaseRate || 0);
        const salesRate = Number(i.sellingPrice || i.salesRate || prod?.price || rate);
        const mrp = Number(i.mrp || prod?.mrp || salesRate || rate);
        const qty = Number(i.qty || i.purchasedQty || 1);
        const freeQty = Number(i.freeQty || 0);
        const discPercent = Number(i.discPercent || i.discountPercent || 0);
        const taxPercent = Number(i.taxPercent || i.taxRate || 18);

        const rawItem: PurchaseItem = {
          id: i.id || i._id || Math.random().toString(),
          itemCode: i.itemCode || '',
          vendorItemCode: i.vendorItemCode || prod?.vendorItemCode || '',
          itemName: i.itemName || i.itemDesc || i.itemCode || '',
          weight: i.weight || prod?.weight || '',
          category: i.category || i.department || prod?.department || 'General',
          itemDesc: i.itemName || i.itemDesc || i.itemCode || '',
          hsn: i.hsn || i.barcode || prod?.barcode || '',
          qty: qty,
          freeQty: freeQty,
          unitPrice: rate,
          salesRate: salesRate,
          mrp: mrp,
          discPercent: discPercent,
          taxPercent: taxPercent,
          cgstAmt: Number(i.cgst || i.cgstAmt || 0),
          sgstAmt: Number(i.sgst || i.sgstAmt || 0),
          igstAmt: Number(i.igst || i.igstAmt || 0),
          total: Number(i.total || i.lineTotal || 0),
          isManualItem: !prod
        };

        return calculateItemValues(rawItem, currentSupplyPlace);
      });
      setItems(mapped);
    }
    setGlobalNotification({ msg: `Voucher ${bill.voucherNo || ''} loaded for editing`, type: 'info' });
  };

  // Handle Delete selection
  const handleDeleteBill = async (id: string, voucherNo: string) => {
    if (!window.confirm(`Are you sure you want to delete purchase bill ${voucherNo}? This will revert physical stock levels.`)) return;
    try {
      const res = await fetch(`${Api}/purchase-bills/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: `Purchase Bill ${voucherNo} deleted successfully.`, type: 'success' });
        if (editingId === id) {
          clearForm();
        }
        fetchSavedBills();
        fetchProducts();
      } else {
        setGlobalNotification({ msg: 'Failed to delete: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error deleting purchase bill.', type: 'error' });
    }
  };

  // Save/Update Handler
  const handleSaveBill = async () => {
    if (!vendorName.trim()) {
      return setGlobalNotification({ msg: 'Please enter vendor name.', type: 'error' });
    }
    if (items.length === 0) {
      return setGlobalNotification({ msg: 'Please add at least one item.', type: 'error' });
    }
    
    if (items.some(i => !i.itemCode.trim())) {
      return setGlobalNotification({ msg: 'Please enter Item Code for all rows.', type: 'error' });
    }

    const payload = {
      voucherNo: billNo,
      date: billDate,
      supplierInvoiceNo: supplierInvoiceNo || 'N/A',
      supplierInvoiceDate: supplierInvoiceDate || null,
      supplierName: vendorName,
      supplierGstin: gstin,
      vendorId: vendorId,
      taxableAmt: taxableTotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      otherCharges: roundedOff,
      discount: discTotal,
      roundOff: roundedOff,
      netPayable: grandTotal,
      status: 'Paid',
      type: supplyPlace.toLowerCase() === 'tamil nadu' ? 'Local' : 'Central',
      paymentMode: 'Cash',
      items: items.map(i => ({
        itemCode: i.itemCode.trim().toUpperCase(),
        vendorItemCode: i.vendorItemCode ? i.vendorItemCode.trim() : '',
        itemName: i.itemName || i.itemDesc || i.itemCode,
        itemDesc: i.itemDesc,
        weight: i.weight || '',
        category: i.category,
        qty: i.qty,
        freeQty: i.freeQty || 0,
        rate: i.unitPrice,
        sellingPrice: i.salesRate || i.unitPrice,
        mrp: i.mrp || i.unitPrice,
        taxPercent: i.taxPercent,
        discPercent: i.discPercent,
        discount: i.qty * i.unitPrice * (i.discPercent / 100),
        total: i.total
      }))
    };

    try {
      const url = editingId 
        ? `${Api}/purchase-bills/${editingId}` 
        : `${Api}/purchase-bills`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ 
          msg: `Purchase Bill ${billNo} ${editingId ? 'updated' : 'saved'} successfully!`, 
          type: 'success' 
        });
        clearForm();
        fetchSavedBills();
        fetchProducts();
      } else {
        setGlobalNotification({ msg: 'Error saving purchase bill: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error saving purchase bill.', type: 'error' });
    }
  };

  const handleSaveNewVendor = async () => {
    if (!newVendorForm.name.trim()) {
      setGlobalNotification({ msg: 'Vendor name is required', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const codeRes = await fetch(`${Api}/ledgers/next-code`);
      const codeData = await codeRes.json();
      const ledgerCode = codeData.ledgerCode || 'LDG-001';

      const payload = {
        ledgerCode,
        accountName: newVendorForm.name,
        accountGroup: 'Suppliers',
        gstNo: newVendorForm.gstin,
        state: newVendorForm.state,
        openingBalance: 0,
        drCr: 'Cr'
      };

      const res = await fetch(`${Api}/ledgers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setGlobalNotification({ msg: 'New vendor added to database successfully', type: 'success' });
        await fetchVendors();
        setVendorId(data.ledger._id || data.ledger.id || data.ledger.ledgerCode);
        setIsVendorModalOpen(false);
        setNewVendorForm({ name: '', gstin: '', state: 'Tamil Nadu' });
      } else {
        setGlobalNotification({ msg: 'Failed to add vendor: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error saving vendor', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setToolbarActions({
      onAdd: () => {
        clearForm();
        setGlobalNotification({ msg: 'Ready for new Purchase Bill.', type: 'info' });
      },
      onSave: handleSaveBill,
      onDelete: async () => {
        if (!editingId) {
          return setGlobalNotification({ msg: 'Delete option is only available when editing a saved bill.', type: 'error' });
        }
        await handleDeleteBill(editingId, billNo);
      },
      onPrint: () => setGlobalNotification({ msg: 'Printing layout...', type: 'info' })
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, billNo, billDate, vendorId, vendors, items, grandTotal, taxableTotal, totalCgst, totalSgst, totalIgst, roundedOff, supplyPlace, vendorName, gstin, editingId]);

  const filteredBills = savedBills.filter(bill => {
    const q = billSearchQuery.toLowerCase();
    return (
      (bill.voucherNo || '').toLowerCase().includes(q) ||
      (bill.supplierName || '').toLowerCase().includes(q) ||
      (bill.supplierInvoiceNo || '').toLowerCase().includes(q)
    );
  });

  const filteredProducts = dbProducts.filter(p => {
    const q = itemSearchQuery.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.itemCode || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.variety || '').toLowerCase().includes(q) ||
      (p.department || '').toLowerCase().includes(q) ||
      (p.vendorItemCode || '').toLowerCase().includes(q)
    );
  });

  const addProductFromMaster = (prod: any) => {
    const existing = items.find(i => i.itemCode?.toLowerCase() === prod.itemCode?.toLowerCase());
    if (existing) {
      updateItem(existing.id, 'qty', existing.qty + 1);
      setGlobalNotification({ msg: `Incremented quantity for ${prod.name}`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
      return;
    }

    const newRow: PurchaseItem = {
      id: Math.random().toString(),
      itemCode: prod.itemCode || '',
      vendorItemCode: prod.vendorItemCode || '',
      itemName: prod.name || '',
      weight: prod.weight || '',
      category: prod.department || 'General',
      itemDesc: prod.name || '',
      hsn: prod.barcode || '',
      qty: 1,
      freeQty: 0,
      unitPrice: prod.purchaseRate || 0,
      salesRate: prod.price || 0,
      mrp: prod.mrp || 0,
      discPercent: 0,
      taxPercent: prod.taxPercent || 18,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 0,
      total: 0,
      isManualItem: false
    };

    const calculated = calculateItemValues(newRow, supplyPlace);
    setItems([...items, calculated]);
    setGlobalNotification({ msg: `Added ${prod.name} from Item Master`, type: 'success' });
    setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] relative overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      
      {/* Header bar with layout switches */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2 flex justify-between items-center shadow-md z-10 flex-shrink-0 border-b border-indigo-900/40">
        <span className="font-semibold text-lg tracking-wide flex items-center">
          Purchase Bill Entry 
          <span className="font-light text-slate-300 text-sm ml-2">(Stock Inward Master)</span>
          {editingId && (
            <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full ml-3 shadow-sm">
              EDIT MODE: {billNo}
            </span>
          )}
        </span>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'form-only' ? 'split' : 'form-only')}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all border border-indigo-500 cursor-pointer"
          >
            <span>{viewMode === 'form-only' ? '📁 Show Item Catalog' : '📁 Hide Item Catalog'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Purchase Bill Form */}
        <div className={`${viewMode === 'table-only' ? 'hidden' : viewMode === 'form-only' ? 'w-full' : 'w-[64%]'} overflow-y-auto p-3 bg-white flex flex-col justify-between border-r border-slate-200`}>
          <div>
            {/* Top Metadata Header inside form */}
            <div className="bg-white p-3 border border-slate-200 shadow-[0_2px_15px_rgba(0,0,0,0.02)] rounded-lg mb-3 space-y-2.5">
              {/* Row 1 */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Voucher No</label>
                  <input 
                    type="text" 
                    value={billNo} 
                    onChange={e => setBillNo(e.target.value)} 
                    className="w-full border border-slate-200 bg-slate-50/50 p-1.5 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner" 
                    readOnly={!!editingId} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Purchase Date</label>
                  <input 
                    type="date" 
                    value={billDate} 
                    onChange={e => setBillDate(e.target.value)} 
                    className="w-full border border-slate-200 bg-white p-1.5 rounded-md text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-800" 
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">Vendor Name</label>
                    <button
                      type="button"
                      onClick={() => setIsVendorModalOpen(true)}
                      className="text-[8px] font-extrabold text-blue-600 hover:text-blue-800 uppercase tracking-wider cursor-pointer"
                    >
                      + Save Vendor
                    </button>
                  </div>
                  <input 
                    type="text" 
                    list="vendors-list" 
                    value={vendorName} 
                    onChange={handleVendorChange}
                    placeholder="Type or select vendor name..."
                    className="w-full border border-slate-200 bg-white p-1.5 rounded-md text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800 shadow-sm" 
                  />
                  <datalist id="vendors-list">
                    {vendors.map(v => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Supplier Invoice Number</label>
                  <input 
                    type="text" 
                    value={supplierInvoiceNo} 
                    onChange={e => setSupplierInvoiceNo(e.target.value)} 
                    placeholder="Enter Supplier Invoice Number..."
                    className="w-full border border-slate-200 bg-white p-1.5 rounded-md text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Supplier Invoice Date</label>
                  <input 
                    type="date" 
                    value={supplierInvoiceDate} 
                    onChange={e => setSupplierInvoiceDate(e.target.value)} 
                    className="w-full border border-slate-200 bg-white p-1.5 rounded-md text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-slate-800" 
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">GSTIN</label>
                  <input 
                    type="text" 
                    value={gstin} 
                    onChange={e => setGstin(e.target.value.toUpperCase())}
                    placeholder="Enter supplier GSTIN (optional)..."
                    className="w-full border border-slate-200 p-1.5 rounded-md text-xs bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Place of Supply</label>
                  <select 
                    value={supplyPlace} 
                    onChange={e => setSupplyPlace(e.target.value)}
                    className="w-full border border-slate-200 p-1.5 rounded-md text-xs bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="Tamil Nadu">Tamil Nadu (Local)</option>
                    <option value="Other State">Other State (Central)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Main Items Grid Container */}
            <div className="flex flex-col bg-white border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.01)] relative overflow-hidden rounded-lg mb-2">
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 p-2.5 border-b border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-2.5 flex-1 max-w-md">
                  <label className="text-[11px] font-black text-slate-700 uppercase whitespace-nowrap tracking-wide">Scan Barcode / Code:</label>
                  <input
                    id="purchase-scan-input"
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                    placeholder="Scan barcode or type code & Enter..."
                    className="flex-1 border border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 p-1.5 rounded-md text-xs font-mono font-bold bg-white focus:outline-none placeholder:font-sans placeholder:font-normal shadow-inner"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs px-3 py-1.5 rounded-md shadow flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Item Row</span>
                  </button>
                  <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full animate-pulse">
                    System Listening for Scans
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-max">
                  <thead className="bg-slate-900 text-white sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="border-r border-slate-800 p-2 text-center font-bold text-[10px] uppercase tracking-wider w-8">S.No</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-28">Barcode</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-48">Product Name</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-28">Vendor Item Code</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-24">Weight (Net Wt)</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-24">Category</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-16 text-right">Purchase Qty</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-16 text-right">Free Qty</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-20 text-right">Purchase Rate</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-12 text-right">Discount %</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-12 text-right">GST %</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-20 text-right">MRP</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-20 text-right">Selling Price</th>
                      <th className="border-r border-slate-800 p-2 font-bold text-[10px] uppercase tracking-wider w-20 text-right">Amount</th>
                      <th className="p-2 w-8 text-center font-bold text-[10px] uppercase tracking-wider">Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={15} className="p-6 text-gray-400 italic text-center">
                          No items added.
                        </td>
                      </tr>
                    )}
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50/50 focus-within:bg-indigo-50/50 transition-colors">
                        <td className="border-r border-slate-200 p-2 text-center text-slate-500 font-medium">{idx + 1}</td>
                        <td className="border-r border-gray-300 p-0">
                          <div className="flex items-center relative w-full h-full pr-1 min-w-[150px]">
                            <input 
                              type="text" 
                              value={item.itemCode} 
                              onChange={e => updateItem(item.id, 'itemCode', e.target.value)} 
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  const found = dbProducts.find(p => p.itemCode?.toLowerCase() === val.toLowerCase() || p.barcode?.toLowerCase() === val.toLowerCase());
                                  if (!found && val) {
                                    e.preventDefault();
                                    setActiveRowId(item.id);
                                    setModalSearchQuery(val);
                                    setHighlightedProductIndex(0);
                                    setIsProductModalOpen(true);
                                    return;
                                  }
                                }
                                handleKeyDown(e, idx, 'itemCode');
                              }}
                              onDoubleClick={() => {
                                setActiveRowId(item.id);
                                setModalSearchQuery(item.itemCode || '');
                                setHighlightedProductIndex(0);
                                setIsProductModalOpen(true);
                              }}
                              onBlur={() => {
                                const latest = items.find(i => i.id === item.id);
                                if (latest) saveProductToDb(latest);
                              }}
                              className="w-full p-1.5 pl-2 pr-10 bg-transparent focus:bg-white focus:outline-none font-mono font-bold text-indigo-700 text-xs" 
                              placeholder="Barcode / Code..." 
                            />
                            <button
                              onClick={() => {
                                setActiveRowId(item.id);
                                setModalSearchQuery(item.itemCode || '');
                                setHighlightedProductIndex(0);
                                setIsProductModalOpen(true);
                              }}
                              type="button"
                              className="absolute right-1 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-700 rounded transition-colors shadow-sm"
                              title="Search product table"
                            >
                              Find
                            </button>
                          </div>
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.itemName || item.itemDesc || ''} 
                            onChange={e => {
                              updateItem(item.id, 'itemName', e.target.value);
                              updateItem(item.id, 'itemDesc', e.target.value);
                            }} 
                            onKeyDown={e => handleKeyDown(e, idx, 'itemDesc')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 pl-2 bg-transparent focus:bg-white focus:outline-none font-bold text-slate-800 text-xs" 
                            placeholder="Enter product name..." 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.vendorItemCode || ''} 
                            onChange={e => updateItem(item.id, 'vendorItemCode', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'vendorItemCode')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none font-mono" 
                            placeholder="Vendor Code" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.weight || ''} 
                            onChange={e => updateItem(item.id, 'weight', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'weight')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-center" 
                            placeholder="1kg, 500g..."
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input
                            type="text"
                            value={item.category || ''}
                            onChange={e => updateItem(item.id, 'category', e.target.value)}
                            onKeyDown={e => handleKeyDown(e, idx, 'category')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.qty === 0 ? '' : item.qty} 
                            onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right font-bold text-blue-900 border border-transparent focus:border-indigo-400" 
                            min="1" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.freeQty === 0 ? '' : item.freeQty} 
                            onChange={e => updateItem(item.id, 'freeQty', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'freeQty')}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right font-bold text-blue-900 border border-transparent focus:border-indigo-400" 
                            min="0" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.unitPrice === 0 ? '' : item.unitPrice} 
                            onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'unitPrice')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right border border-transparent focus:border-indigo-400" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.discPercent === 0 ? '' : item.discPercent} 
                            onChange={e => updateItem(item.id, 'discPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'discPercent')}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right border border-transparent focus:border-indigo-400" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.taxPercent} 
                            onChange={e => updateItem(item.id, 'taxPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'taxPercent')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right text-gray-500" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.mrp === 0 ? '' : item.mrp} 
                            onChange={e => updateItem(item.id, 'mrp', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'mrp')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right border border-transparent focus:border-indigo-400" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.salesRate === 0 ? '' : item.salesRate} 
                            onChange={e => updateItem(item.id, 'salesRate', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'salesRate')}
                            onBlur={() => {
                              const latest = items.find(i => i.id === item.id);
                              if (latest) saveProductToDb(latest);
                            }}
                            className="w-full p-1.5 bg-slate-50/50 focus:bg-white focus:outline-none text-right font-semibold text-indigo-700 border border-transparent focus:border-indigo-400" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-slate-200 p-2 text-right font-mono font-bold text-emerald-600 bg-slate-50/10">{item.total.toFixed(2)}</td>
                        <td className="p-2 text-center bg-slate-50/10">
                          <button onClick={() => removeRow(item.id)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded-full hover:bg-rose-50 active:scale-95 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Panel containing Action Buttons and Grand Total Card */}
          <div className="flex items-center justify-between mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-[0_-4px_20px_rgba(0,0,0,0.02)] flex-shrink-0">
            <div className="flex space-x-2">
              <button 
                onClick={handleSaveBill}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg focus:ring-4 focus:ring-emerald-500/20 active:scale-95 transition-all duration-200 flex items-center space-x-2 text-xs"
              >
                <span>{editingId ? '✓ Update Bill' : '💾 Save Bill'}</span>
              </button>
              
              <button 
                onClick={clearForm}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-lg shadow-sm focus:ring-4 focus:ring-slate-100 active:scale-95 transition-all duration-200 text-xs"
              >
                Clear / New
              </button>

              <button 
                onClick={addRow}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-sm focus:ring-4 focus:ring-blue-100 active:scale-95 transition-all duration-200 text-xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Item Row</span>
              </button>

              {editingId && (
                <button 
                  onClick={() => handleDeleteBill(editingId, billNo)}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-lg shadow-md focus:ring-4 focus:ring-red-500/20 active:scale-95 transition-all duration-200 text-xs"
                >
                  Delete Bill
                </button>
              )}
            </div>

            <div className="w-[450px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-4 border border-slate-800 shadow-xl rounded-xl flex flex-col justify-between">
              <div className="grid grid-cols-6 gap-2 text-xs font-bold text-right border-b border-slate-800 pb-2.5 mb-2.5">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">Sub Total</span>
                  ₹{subTotal.toFixed(0)}
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">Discount</span>
                  - ₹{discTotal.toFixed(0)}
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">CGST</span>
                  ₹{totalCgst.toFixed(0)}
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">SGST</span>
                  ₹{totalSgst.toFixed(0)}
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">IGST</span>
                  ₹{totalIgst.toFixed(0)}
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-1">Round Off</span>
                  {roundedOff > 0 ? '+' : ''}{roundedOff.toFixed(2)}
                </div>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-extrabold text-indigo-300 uppercase tracking-widest">Grand Total</span>
                <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                  ₹ {grandTotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Item Master Sidebar Panel */}
        <div className={`${viewMode === 'form-only' ? 'hidden' : viewMode === 'table-only' ? 'w-full' : 'w-[36%]'} bg-slate-50/50 p-3 flex flex-col overflow-hidden border-l border-slate-200`}>
          <div className="flex-shrink-0 mb-2.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Item Master Catalog</span>
              <span className="text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                {filteredProducts.length} Items
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search code, name, category, variety..." 
                value={itemSearchQuery}
                onChange={e => setItemSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 p-2 pl-8 rounded-lg text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
              />
              <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[10px]">Item Code</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[10px]">Item Name</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[10px] text-right">Stock</th>
                  <th className="p-2.5 font-bold uppercase tracking-wider text-[10px] text-center w-12">Add</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 italic bg-slate-50">No products found.</td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => (
                    <tr 
                      key={prod.id || prod._id} 
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => addProductFromMaster(prod)}
                      title="Click to add to purchase bill"
                    >
                      <td className="p-2 font-mono text-slate-800">
                        <div className="text-blue-600 font-bold">{prod.itemCode}</div>
                        {prod.vendorItemCode && <div className="text-[10px] text-gray-400 font-medium">VC: {prod.vendorItemCode}</div>}
                      </td>
                      <td className="p-2 text-slate-800 max-w-[150px] truncate" title={prod.name}>
                        <div>{prod.name}</div>
                        {prod.size && <span className="text-[10px] text-gray-500 bg-gray-100 px-1 py-0.2 rounded border mr-1">Size {prod.size}</span>}
                        {prod.variety && <span className="text-[10px] text-slate-500 italic">{prod.variety}</span>}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-gray-700">{prod.stock}</td>
                      <td className="p-2 text-center h-[41px]" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => addProductFromMaster(prod)}
                          className="bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700 p-1.5 rounded transition-colors font-bold flex items-center justify-center w-6 h-6 mx-auto"
                          title="Add Product to Bill"
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add Vendor Custom Modal */}
      <Modal
        isOpen={isVendorModalOpen}
        onClose={() => {
          setIsVendorModalOpen(false);
          setVendorId('');
        }}
        title="Add New Vendor"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Vendor Name <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={newVendorForm.name}
              onChange={e => setNewVendorForm({...newVendorForm, name: e.target.value})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="e.g. Acme Corporation"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">GSTIN</label>
            <input 
              type="text" 
              value={newVendorForm.gstin}
              onChange={e => setNewVendorForm({...newVendorForm, gstin: e.target.value.toUpperCase()})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase"
              placeholder="e.g. 29ABCDE1234F2Z5"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">State / Place of Supply</label>
            <input 
              type="text" 
              value={newVendorForm.state}
              onChange={e => setNewVendorForm({...newVendorForm, state: e.target.value})}
              className="w-full border border-gray-400 p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="e.g. Tamil Nadu"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            <button 
              onClick={() => {
                setIsVendorModalOpen(false);
                setVendorId('');
              }}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveNewVendor}
              disabled={loading}
              className="px-4 py-2 bg-[#2b579a] text-white rounded hover:bg-blue-800 font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </Modal>
      
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
              <div className="col-span-4">Dress Name</div>
              <div className="col-span-2">Variety</div>
              <div className="col-span-1 text-center">Size</div>
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
                  No matching products found in master catalog.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isQuickAddModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={() => setIsQuickAddModalOpen(false)}>
          <div
            className="bg-white shadow-2xl flex flex-col border border-gray-300 rounded-xl overflow-hidden w-full max-w-xl animate-in fade-in zoom-in-95 duration-155"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#2b579a] text-white px-4 py-3 flex justify-between items-center shadow-md">
              <span className="font-extrabold text-sm tracking-wide">Quick Register & Add New Product</span>
              <button type="button" onClick={() => setIsQuickAddModalOpen(false)} className="text-white hover:text-red-300 font-bold focus:outline-none text-base">✕</button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickAddSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Barcode (Scanned)</label>
                  <input type="text" value={quickAddForm.barcode} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-100 font-mono font-bold text-slate-700" />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">System Item Code</label>
                  <input type="text" value={quickAddForm.itemCode} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-100 font-mono font-bold text-slate-700" />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={quickAddForm.name}
                  onChange={e => setQuickAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Silk Saree, Cotton Kurti..."
                  className="w-full border border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 p-2 rounded bg-white font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Weight (Net Wt)</label>
                  <input type="text" value={quickAddForm.weight || ''} onChange={e => setQuickAddForm(prev => ({ ...prev, weight: e.target.value }))} className="w-full border border-gray-300 p-2 rounded outline-none font-semibold" placeholder="e.g. 1kg, 500g..." />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Category</label>
                  <input type="text" value={quickAddForm.department || ''} onChange={e => setQuickAddForm(prev => ({ ...prev, department: e.target.value }))} className="w-full border border-gray-300 p-2 rounded outline-none bg-white font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Purchase Rate</label>
                  <input type="number" step="0.01" value={quickAddForm.purchaseRate || ''} onChange={e => setQuickAddForm(prev => ({ ...prev, purchaseRate: Number(e.target.value) }))} className="w-full border border-gray-300 p-2 rounded outline-none text-right font-mono font-bold" />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Sales Rate</label>
                  <input type="number" step="0.01" value={quickAddForm.price || ''} onChange={e => setQuickAddForm(prev => ({ ...prev, price: Number(e.target.value) }))} className="w-full border border-indigo-300 focus:border-indigo-650 p-2 rounded outline-none text-right font-mono text-indigo-700 font-bold" />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">MRP</label>
                  <input type="number" step="0.01" value={quickAddForm.mrp || ''} onChange={e => setQuickAddForm(prev => ({ ...prev, mrp: Number(e.target.value) }))} className="w-full border border-gray-300 p-2 rounded outline-none text-right font-mono text-gray-700 font-semibold" />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Tax %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddForm.taxPercent || ''}
                    onChange={e => setQuickAddForm(prev => ({ ...prev, taxPercent: Number(e.target.value) }))}
                    className="w-full border border-gray-300 p-2 rounded outline-none text-right font-mono font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-blue-900 font-extrabold">Purchase Qty</label>
                  <input type="number" min="1" required value={quickAddForm.qty} onChange={e => setQuickAddForm(prev => ({ ...prev, qty: Number(e.target.value) }))} className="w-full border border-blue-400 p-2 rounded outline-none text-center font-extrabold text-blue-950 bg-blue-50/50" />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 mt-4">
                <button
                  type="button"
                  onClick={() => setIsQuickAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors shadow-sm flex items-center space-x-1.5"
                >
                  {loading && <span className="animate-spin mr-1">⌛</span>}
                  <span>Save & Add to Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseBill;