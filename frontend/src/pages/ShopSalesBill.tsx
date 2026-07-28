import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash, Edit, Trash2, ChevronLeft, ChevronRight, Search, FileText, Printer, ArrowLeft, Store } from 'lucide-react';
import Api from '../Api';
import type { ToolbarActions } from '../components/Layout';
import Modal from '../components/Modal';
import { printReceipt } from '../utils/printReceipt';
import { sendWhatsAppBill } from '../utils/whatsappHelper';

interface ShopSalesItem {
  id: string;
  itemCode: string;
  vendorItemCode?: string;
  itemName: string;
  size: string;
  variety: string;
  category: string;
  itemDesc: string;
  hsn: string;
  factory: string;
  qty: number;
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

const ShopSalesBill = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'form-only' | 'table-only'>('split');
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
  const [shopId, setShopId] = useState('');
  const [gstin, setGstin] = useState('');
  const [supplyPlace, setSupplyPlace] = useState('Tamil Nadu');
  const [shopName, setShopName] = useState('');
  
  const [shops, setShops] = useState<{id: string, name: string, gstin: string, state: string}[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

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

  // Load shops from Database on mount
  const fetchShops = async () => {
    try {
      const res = await fetch(`${Api}/ledgers/search?group=Shops`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((l: any) => ({
          id: l._id || l.id || l.ledgerCode,
          name: l.accountName,
          gstin: l.gstNo || '',
          state: l.state || 'Tamil Nadu'
        }));
        setShops(mapped);
      }
    } catch (err) {
      console.error("Error loading shops", err);
    }
  };

  // fetchProducts removed to prevent preloading all master products

  // Load saved bills from DB
  const fetchSavedBills = async () => {
    try {
      const res = await fetch(`${Api}/shop-sales-bills`);
      if (res.ok) {
        const data = await res.json();
        setSavedBills(data);
      }
    } catch (e) {
      console.error("Failed to load bills", e);
    }
  };

  // Next voucher number sequence
  const fetchNextVoucher = async () => {
    try {
      const res = await fetch(`${Api}/shop-sales-bills/next-voucher`);
      if (res.ok) {
        const data = await res.json();
        if (data.voucherNo) setBillNo(data.voucherNo);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShops();
    fetchSavedBills();
    fetchNextVoucher();
  }, []);

  // Quick navigation: load bill if passed from register state
  useEffect(() => {
    if (location.state && location.state.editBill) {
      handleEditBill(location.state.editBill);
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

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInput.trim();
      if (!code) return;

      if (!shopName) {
        setGlobalNotification({
          msg: "Please select or enter the Wholesale Customer (Shop Name) first before scanning.",
          type: 'error'
        });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        setScanInput('');
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`${Api}/products/barcode/${encodeURIComponent(code)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setGlobalNotification({
              msg: "Product not registered. Please create this product in Product Register.",
              type: 'error'
            });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
          } else {
            throw new Error('Failed to query product');
          }
          setScanInput('');
          setLoading(false);
          return;
        }

        const product = await res.json();
        if (product) {
          const existingItemIndex = items.findIndex(item => item.itemCode.toUpperCase() === product.itemCode.toUpperCase());
          
          if (existingItemIndex > -1) {
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
            const newItem: ShopSalesItem = {
              id: Math.random().toString(),
              itemCode: product.itemCode,
              vendorItemCode: product.vendorItemCode || '',
              itemName: product.name,
              size: product.size || '',
              variety: product.variety || '',
              category: product.department || 'None',
              itemDesc: product.name,
              hsn: product.barcode || '',
              factory: product.factory || '',
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
              msg: `Added product ${product.name} to wholesale list`,
              type: 'success'
            });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
          }
        }
      } catch (err) {
        console.error(err);
        setGlobalNotification({ msg: "Error searching barcode.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      } finally {
        setScanInput('');
        setLoading(false);
        setTimeout(() => {
          scanInputRef.current?.focus();
        }, 100);
      }
    }
  };

  // Handle selected shop
  useEffect(() => {
    const found = shops.find(s => s.id === shopId);
    if (found) {
      setShopName(found.name);
      setGstin(found.gstin || '');
      setSupplyPlace(found.state || 'Tamil Nadu');
    } else {
      setShopName('');
      setGstin('');
      setSupplyPlace('Tamil Nadu');
    }
  }, [shopId, shops]);

  // Modal State for new shop creation
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopGstin, setNewShopGstin] = useState('');
  const [newShopState, setNewShopState] = useState('Tamil Nadu');
  const [newShopCity, setNewShopCity] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopMobile, setNewShopMobile] = useState('');

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    try {
      const codeRes = await fetch(`${Api}/ledgers/next-code`);
      const codeData = await codeRes.json();
      const code = codeData.ledgerCode || `LED-${Date.now().toString().slice(-4)}`;

      const payload = {
        ledgerCode: code,
        accountName: newShopName,
        accountGroup: 'Shops',
        gstNo: newShopGstin,
        state: newShopState,
        city: newShopCity,
        address: newShopAddress,
        mobileNo: newShopMobile,
        openingBalance: 0,
        drCr: 'Dr'
      };

      const res = await fetch(`${Api}/ledgers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: `Shop "${newShopName}" created successfully!`, type: 'success' });
        setIsShopModalOpen(false);
        setNewShopName('');
        setNewShopGstin('');
        setNewShopCity('');
        setNewShopAddress('');
        setNewShopMobile('');
        
        // Reload shops and select newly created shop
        const reloadRes = await fetch(`${Api}/ledgers/search?group=Shops`);
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          const mapped = reloadData.map((l: any) => ({
            id: l._id || l.id || l.ledgerCode,
            name: l.accountName,
            gstin: l.gstNo || '',
            state: l.state || 'Tamil Nadu'
          }));
          setShops(mapped);
          
          const created = mapped.find((v: any) => v.name === payload.accountName);
          if (created) {
            setShopId(created.id);
          }
        }
      } else {
        setGlobalNotification({ msg: "Error: " + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: "Failed to create shop account", type: 'error' });
    }
  };

  // Main items list state
  const [items, setItems] = useState<ShopSalesItem[]>([]);

  // Calculation Logic
  const calculateItemValues = (item: ShopSalesItem, placeOfSupply: string): ShopSalesItem => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.unitPrice) || 0;
    const discPercent = Number(item.discPercent) || 0;
    const taxPercent = Number(item.taxPercent) || 0;

    const baseAmount = qty * rate;
    const discAmt = baseAmount * (discPercent / 100);
    const taxableAmt = baseAmount - discAmt;
    const totalTax = taxableAmt * (taxPercent / 100);

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (placeOfSupply.toLowerCase() === 'tamil nadu') {
      cgstAmt = totalTax / 2;
      sgstAmt = totalTax / 2;
    } else {
      igstAmt = totalTax;
    }

    const total = taxableAmt + totalTax;

    return {
      ...item,
      cgstAmt: Number(cgstAmt.toFixed(2)),
      sgstAmt: Number(sgstAmt.toFixed(2)),
      igstAmt: Number(igstAmt.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  };

  const totals = useMemo(() => {
    let taxableTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let rawGrandTotal = 0;

    items.forEach(item => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.unitPrice) || 0;
      const discPercent = Number(item.discPercent) || 0;
      const taxPercent = Number(item.taxPercent) || 0;
      
      const base = qty * rate;
      const disc = base * (discPercent / 100);
      const taxable = base - disc;
      const tax = taxable * (taxPercent / 100);

      taxableTotal += taxable;
      if (supplyPlace.toLowerCase() === 'tamil nadu') {
        totalCgst += tax / 2;
        totalSgst += tax / 2;
      } else {
        totalIgst += tax;
      }
      rawGrandTotal += taxable + tax;
    });

    const grandTotal = Math.round(rawGrandTotal);
    const roundedOff = Number((grandTotal - rawGrandTotal).toFixed(2));

    return {
      taxableTotal: Number(taxableTotal.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      totalIgst: Number(totalIgst.toFixed(2)),
      roundedOff,
      grandTotal
    };
  }, [items, supplyPlace]);

  const { taxableTotal, totalCgst, totalSgst, totalIgst, roundedOff, grandTotal } = totals;

  // Auto-generate code for manual item insertion
  const generateCodeForRow = (id: string) => {
    const code = `ITM-SS-${Math.floor(100000 + Math.random() * 900000)}`;
    setItems(prev => prev.map(i => i.id === id ? { ...i, itemCode: code, barcode: code } : i));
  };

  // Handle Item Row Update
  const updateItem = (id: string, field: keyof ShopSalesItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      let updated = { ...item, [field]: value };
      
      // Auto-fill from DB products when itemCode changes
      if (field === 'itemCode') {
        const prod = dbProducts.find(p => p.itemCode?.toLowerCase() === value.trim().toLowerCase());
        if (prod) {
          updated.itemName = prod.name || '';
          updated.itemDesc = prod.name || '';
          updated.hsn = prod.barcode || '';
          updated.unitPrice = prod.purchaseRate || 0; // standard purchase rate
          updated.salesRate = prod.price || 0;
          updated.mrp = prod.mrp || 0;
          updated.taxPercent = prod.taxPercent || 18;
          updated.size = prod.size || '';
          updated.variety = prod.variety || '';
          updated.category = prod.department || 'None';
          updated.factory = prod.factory || '';
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
    setItems([...items, {
      id: Math.random().toString(),
      itemCode: '', vendorItemCode: '', itemName: '', size: '', variety: '', category: 'None', itemDesc: '', hsn: '', factory: '', qty: 1, unitPrice: 0, salesRate: 0, mrp: 0, discPercent: 0,
      taxPercent: 18, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, total: 0, isManualItem: false
    }]);
  };

  const removeRow = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const clearForm = () => {
    setEditingId(null);
    fetchNextVoucher();
    setItems([]);
    setShopId('');
    setShopName('');
    setGstin('');
    setSupplyPlace('Tamil Nadu');
    navigate('/shop-sales-bill', { state: null, replace: true });
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
  const handleEditBill = (bill: any) => {
    setEditingId(bill.id || bill._id);
    setBillNo(bill.voucherNo);
    setBillDate(bill.date ? bill.date.split('T')[0] : '');
    setGstin(bill.shopGstin || '');
    setSupplyPlace(bill.type === 'Local' ? 'Tamil Nadu' : 'Other');
    setShopName(bill.shopName);
    
    const found = shops.find(s => s.name === bill.shopName);
    if (found) {
      setShopId(found.id);
    }

    if (bill.items && Array.isArray(bill.items)) {
      const mapped = bill.items.map((i: any) => {
        const prod = dbProducts.find(p => p.itemCode?.toLowerCase() === i.itemCode?.toLowerCase());
        return {
          id: i.id || Math.random().toString(),
          itemCode: i.itemCode,
          vendorItemCode: i.vendorItemCode || prod?.vendorItemCode || '',
          itemName: i.itemName || i.itemDesc || i.itemCode,
          size: i.size || '',
          variety: i.variety || '',
          category: i.category || 'None',
          itemDesc: i.itemName || i.itemDesc || '',
          hsn: i.hsn || '',
          factory: i.factory || prod?.factory || '',
          qty: i.qty || 0,
          unitPrice: i.rate || 0,
          salesRate: i.salesRate || prod?.price || i.rate || 0,
          mrp: i.mrp || prod?.mrp || i.rate || 0,
          discPercent: i.discPercent || 0,
          taxPercent: i.taxPercent || 18,
          cgstAmt: i.cgst || 0,
          sgstAmt: i.sgst || 0,
          igstAmt: i.igst || 0,
          total: i.total || 0,
          isManualItem: !prod
        };
      });
      setItems(mapped);
    }
    setGlobalNotification({ msg: `Wholesale Sales Voucher ${bill.voucherNo} loaded for editing`, type: 'info' });
  };

  // Handle Delete selection
  const handleDeleteBill = async (id: string, voucherNo: string) => {
    if (!window.confirm(`Are you sure you want to delete Wholesale Sales Bill ${voucherNo}?`)) return;
    try {
      const res = await fetch(`${Api}/shop-sales-bills/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ msg: `Bill ${voucherNo} deleted successfully`, type: 'success' });
        clearForm();
        fetchSavedBills();
      } else {
        setGlobalNotification({ msg: 'Failed to delete: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Failed to delete bill due to server error', type: 'error' });
    }
  };

  // Save/Update Handler
  const handleSaveBill = async () => {
    if (!shopId) {
      return setGlobalNotification({ msg: 'Please select shop.', type: 'error' });
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
      shopName,
      shopGstin: gstin,
      taxableAmt: taxableTotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      otherCharges: roundedOff,
      netPayable: grandTotal,
      status: 'Paid',
      type: supplyPlace.toLowerCase() === 'tamil nadu' ? 'Local' : 'Central',
      paymentMode: 'Cash',
      items: items.map(i => ({
        itemCode: i.itemCode.trim().toUpperCase(),
        vendorItemCode: i.vendorItemCode ? i.vendorItemCode.trim() : '',
        itemName: i.itemDesc || i.itemCode,
        itemDesc: i.itemDesc,
        size: i.size,
        variety: i.variety,
        category: i.category,
        factory: i.factory,
        qty: i.qty,
        rate: i.unitPrice,
        salesRate: i.salesRate || i.unitPrice,
        mrp: i.mrp || i.unitPrice,
        taxPercent: i.taxPercent,
        discPercent: i.discPercent,
        total: i.total
      }))
    };

    try {
      const url = editingId 
        ? `${Api}/shop-sales-bills/${editingId}` 
        : `${Api}/shop-sales-bills`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setGlobalNotification({ 
          msg: `Wholesale Sales Bill ${billNo} ${editingId ? 'updated' : 'saved'} successfully!`, 
          type: 'success' 
        });

        // 1. Auto-Print receipt
        try {
          printReceipt({
            invoiceNo: billNo,
            date: date,
            customerName: shopName,
            subTotal: totals.taxableAmt,
            totalAmount: totals.netPayable,
            gridData: items.map(i => ({ itemName: i.itemName, qty: i.qty, rate: i.unitPrice, amount: i.total }))
          });
        } catch (pErr) {
          console.error("Auto print error:", pErr);
        }

        // 2. Auto-Send via WhatsApp if mobile/phone number is available
        const rawPhone = shopGstin || '';
        if (rawPhone && rawPhone.replace(/\D/g, '').length >= 10) {
          try {
            sendWhatsAppBill({
              invoiceNo: billNo,
              invDate: date,
              buyerName: shopName,
              mobileNo: rawPhone,
              items: items.map(i => ({ itemName: i.itemName, qty: i.qty, rate: i.unitPrice, amount: i.total })),
              totalQty: items.reduce((acc, i) => acc + i.qty, 0),
              totalAmount: totals.taxableAmt,
              netAmount: totals.netPayable
            }, undefined, true);
          } catch (waErr) {
            console.error("Auto WhatsApp error:", waErr);
          }
        }

        clearForm();
        fetchSavedBills();
      } else {
        setGlobalNotification({ msg: 'Error saving wholesale sales bill: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error saving wholesale sales bill.', type: 'error' });
    }
  };

  // Wire layout actions
  const actionHandlers = useRef({
    onAdd: clearForm,
    onSave: handleSaveBill,
    onCancel: clearForm
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: clearForm,
      onSave: handleSaveBill,
      onCancel: clearForm
    };
  });

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        onSave: () => actionHandlers.current.onSave(),
        onCancel: () => actionHandlers.current.onCancel()
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions]);

  // Filtering lists
  const filteredBills = savedBills.filter(bill => {
    const q = billSearchQuery.toLowerCase();
    return (
      (bill.voucherNo || '').toLowerCase().includes(q) ||
      (bill.shopName || '').toLowerCase().includes(q)
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

    const newRow: ShopSalesItem = {
      id: Math.random().toString(),
      itemCode: prod.itemCode || '',
      vendorItemCode: prod.vendorItemCode || '',
      itemName: prod.name || '',
      size: prod.size || '',
      variety: prod.variety || '',
      category: prod.department || 'None',
      itemDesc: prod.name || '',
      hsn: prod.barcode || '',
      factory: prod.factory || '',
      qty: 1,
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
      
      {/* Header bar with layout switches */}
      <div className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] text-white px-4 py-2 flex justify-between items-center shadow-md z-10 flex-shrink-0">
        <span className="font-semibold text-lg tracking-wide flex items-center">
          <Store className="mr-2 h-5 w-5 text-blue-300" />
          Wholesale Sales Bill Entry 
          <span className="font-light text-blue-200 text-sm ml-2">(Wholesale Dress Outward)</span>
        </span>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setViewMode('split')} 
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'split' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-[#1b3f70] hover:bg-[#1a3a6c] text-blue-100'}`}
          >
            ◧ Split Screen
          </button>
          <button 
            onClick={() => setViewMode('form-only')} 
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'form-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-[#1b3f70] hover:bg-[#1a3a6c] text-blue-100'}`}
          >
            ❌ Hide Saved Bills
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Wholesale Sales Bill Form */}
        <div className={`${viewMode === 'table-only' ? 'hidden' : viewMode === 'form-only' ? 'w-full' : 'w-[64%]'} overflow-y-auto p-3 bg-white flex flex-col justify-between border-r border-gray-300`}>
          <div>
            {/* Top Metadata Header inside form */}
            <div className="bg-slate-50 p-3 border border-gray-300 shadow-sm rounded mb-2">
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Voucher No</label>
                  <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} className="w-full border border-gray-400 p-1.5 rounded text-sm bg-gray-50 font-bold focus:bg-white focus:outline-none" readOnly={!!editingId} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Date</label>
                  <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 focus:outline-none bg-white" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Select Shop Name</label>
                  <select 
                    value={shopId} 
                    onChange={e => {
                      if (e.target.value === 'NEW') {
                        setIsShopModalOpen(true);
                      } else {
                        setShopId(e.target.value);
                      }
                    }} 
                    className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 focus:outline-none bg-white font-semibold text-gray-800"
                  >
                    <option value="">-- Select Shop --</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="NEW" className="font-bold text-blue-600 bg-blue-50">+ Add New Shop Ledger...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">GSTIN</label>
                  <input type="text" value={gstin} readOnly className="w-full border border-gray-300 p-1.5 rounded text-sm bg-gray-200 text-gray-700 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Place of Supply</label>
                  <input type="text" value={supplyPlace} readOnly className="w-full border border-gray-300 p-1.5 rounded text-sm bg-gray-200 text-gray-700 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Main Items Grid */}
            <div className="flex flex-col bg-white border border-gray-400 shadow-sm relative rounded overflow-hidden mb-2">
              <div className="bg-[#d1e8e2] p-2 border-b border-gray-400 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-2 flex-1 max-w-md">
                  <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">Scan Barcode / Code:</label>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                    placeholder="Scan USB barcode or type code & press Enter..."
                    className="flex-1 border border-indigo-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 p-1.5 rounded text-xs font-mono font-bold bg-white focus:outline-none placeholder:font-sans placeholder:font-normal shadow-sm"
                  />
                </div>
                <div className="text-[10px] text-indigo-700 font-semibold italic bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                  Ready for scanning. Focus is kept automatically.
                </div>
              </div>

              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-max">
                  <thead className="bg-[#2b579a] text-white sticky top-0 z-10">
                    <tr>
                      <th className="border-r border-gray-400 p-1.5 w-8 text-center font-semibold">S.No</th>
                      <th className="border-r border-gray-400 p-1.5 w-48 font-semibold">Product Name</th>
                      <th className="border-r border-gray-400 p-1.5 w-28 font-semibold">Item Code (Barcode)</th>
                      <th className="border-r border-gray-400 p-1.5 w-28 font-semibold">Vendor Item Code</th>
                      <th className="border-r border-gray-400 p-1.5 w-16 font-semibold">Dress Size</th>
                      <th className="border-r border-gray-400 p-1.5 w-24 font-semibold">Variety</th>
                      <th className="border-r border-gray-400 p-1.5 w-24 font-semibold">Category</th>
                      <th className="border-r border-gray-400 p-1.5 font-semibold">Description</th>
                      <th className="border-r border-gray-400 p-1.5 w-24 font-semibold">Factory</th>
                      <th className="border-r border-gray-400 p-1.5 w-16 font-semibold text-right">Qty</th>
                      <th className="border-r border-gray-400 p-1.5 w-20 font-semibold text-right">Unit Price</th>
                      <th className="border-r border-gray-400 p-1.5 w-20 font-semibold text-right">Sales Price</th>
                      <th className="border-r border-gray-400 p-1.5 w-20 font-semibold text-right">MRP</th>
                      <th className="border-r border-gray-400 p-1.5 w-12 font-semibold text-right">Disc %</th>
                      <th className="border-r border-gray-400 p-1.5 w-12 font-semibold text-right">Tax %</th>
                      <th className="border-r border-gray-400 p-1.5 w-20 font-semibold text-right">Total Amt</th>
                      <th className="p-1.5 w-8 text-center font-semibold">Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={17} className="p-6 text-gray-400 italic">
                          <div className="sticky left-0 text-center w-[75vw]">
                            No items added.
                          </div>
                        </td>
                      </tr>
                    )}
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-300 hover:bg-yellow-50 focus-within:bg-blue-50 transition-colors">
                        <td className="border-r border-gray-300 p-1 text-center text-gray-500 bg-gray-50">{idx + 1}</td>
                        <td className="border-r border-gray-300 p-2 font-semibold text-gray-800 bg-gray-50">
                          {item.itemName}
                        </td>
                        <td className="border-r border-gray-300 p-2 font-mono font-bold text-slate-700 bg-gray-50">
                          {item.itemCode}
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.vendorItemCode || ''} 
                            onChange={e => updateItem(item.id, 'vendorItemCode', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'vendorItemCode')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none font-mono" 
                            placeholder="Vendor Code" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.size} 
                            onChange={e => updateItem(item.id, 'size', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'size')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-center" 
                            placeholder="M, L..."
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.variety} 
                            onChange={e => updateItem(item.id, 'variety', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'variety')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none" 
                            placeholder="Kurti, Jeans..."
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <select
                            value={item.category}
                            onChange={e => updateItem(item.id, 'category', e.target.value)}
                            className="w-full p-1 bg-transparent focus:bg-white focus:outline-none text-xs"
                          >
                            <option value="None">None</option>
                            <option value="Womens">Womens</option>
                            <option value="Mens">Mens</option>
                            <option value="Kids">Kids</option>
                          </select>
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.itemDesc} 
                            onChange={e => updateItem(item.id, 'itemDesc', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'itemDesc')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none" 
                            placeholder="Dress description..."
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="text" 
                            value={item.factory} 
                            onChange={e => updateItem(item.id, 'factory', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'factory')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none" 
                            placeholder="Factory Name"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-16">
                          <input 
                            type="number" 
                            value={item.qty} 
                            onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-semibold font-mono" 
                            placeholder="0"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-20">
                          <input 
                            type="number" 
                            value={item.unitPrice} 
                            onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'unitPrice')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-20">
                          <input 
                            type="number" 
                            value={item.salesRate} 
                            onChange={e => updateItem(item.id, 'salesRate', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'salesRate')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-20">
                          <input 
                            type="number" 
                            value={item.mrp} 
                            onChange={e => updateItem(item.id, 'mrp', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'mrp')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-12">
                          <input 
                            type="number" 
                            value={item.discPercent} 
                            onChange={e => updateItem(item.id, 'discPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'discPercent')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono" 
                            placeholder="0"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0 w-12">
                          <input 
                            type="number" 
                            value={item.taxPercent} 
                            onChange={e => updateItem(item.id, 'taxPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'taxPercent')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-mono" 
                            placeholder="18"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-1 text-right font-semibold font-mono bg-gray-50 text-slate-800 w-20">
                          {item.total?.toFixed(2)}
                        </td>
                        <td className="p-1 text-center w-8 bg-gray-50">
                          <button onClick={() => removeRow(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors">
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Form Bottom Total Valuation Bar */}
          <div className="bg-[#2b579a] text-white p-3 border border-gray-400 shadow-md rounded mt-2">
            <div className="grid grid-cols-6 gap-3 text-center text-xs font-semibold">
              <div className="border-r border-blue-400">
                <span className="block text-[10px] text-blue-200">Taxable Total</span>
                <span className="text-base font-bold font-mono">₹ {taxableTotal.toFixed(2)}</span>
              </div>
              <div className="border-r border-blue-400">
                <span className="block text-[10px] text-blue-200">Total CGST</span>
                <span className="text-base font-bold font-mono">₹ {totalCgst.toFixed(2)}</span>
              </div>
              <div className="border-r border-blue-400">
                <span className="block text-[10px] text-blue-200">Total SGST</span>
                <span className="text-base font-bold font-mono">₹ {totalSgst.toFixed(2)}</span>
              </div>
              <div className="border-r border-blue-400">
                <span className="block text-[10px] text-blue-200">Total IGST</span>
                <span className="text-base font-bold font-mono">₹ {totalIgst.toFixed(2)}</span>
              </div>
              <div className="border-r border-blue-400">
                <span className="block text-[10px] text-blue-200">Round Off</span>
                <span className="text-base font-bold font-mono">₹ {roundedOff.toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] text-blue-200">Net Payable</span>
                <span className="text-lg font-black font-mono text-yellow-300">₹ {grandTotal}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex space-x-2 mt-2 bg-slate-50 p-1.5 border border-gray-300 rounded shadow-sm">
            <button 
              onClick={handleSaveBill}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-colors"
            >
              {editingId ? '✓ Update Bill' : '💾 Save Bill'}
            </button>
            <button 
              onClick={clearForm}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1.5 px-3 rounded text-xs shadow transition-colors"
            >
              Clear / New
            </button>
            {editingId && (
              <button 
                onClick={() => handleDeleteBill(editingId, billNo)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Saved Shop Bills / Item Master Suggestion Sidebar */}
        <div className={`${viewMode === 'form-only' ? 'hidden' : 'w-[36%]'} bg-white border-l border-gray-300 flex flex-col p-3`}>
          
          <div className="flex border-b border-gray-300 mb-3">
            <button
              onClick={() => setSidebarTab('bills')}
              className={`flex-1 text-center py-2 text-xs font-bold transition-all border-b-2 uppercase ${sidebarTab === 'bills' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
            >
              Saved Shop Bills
            </button>
            <button
              onClick={() => setSidebarTab('items')}
              className={`flex-1 text-center py-2 text-xs font-bold transition-all border-b-2 uppercase ${sidebarTab === 'items' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
            >
              Item Master SUGGESTIONS
            </button>
          </div>

          <div className="mb-2">
            {sidebarTab === 'bills' ? (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search saved shop bills..."
                  value={billSearchQuery}
                  onChange={e => setBillSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 border border-gray-300 pl-8 pr-3 py-1 text-xs rounded focus:bg-white focus:outline-none"
                />
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products in catalog..."
                  value={itemSearchQuery}
                  onChange={e => setItemSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 border border-gray-300 pl-8 pr-3 py-1 text-xs rounded focus:bg-white focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto border border-gray-300 rounded shadow-inner">
            {sidebarTab === 'bills' ? (
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2 font-semibold">Voucher</th>
                    <th className="p-2 font-semibold">Shop Name</th>
                    <th className="p-2 font-semibold text-right">Net Amt</th>
                    <th className="p-2 font-semibold text-center w-12">Act</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 italic">No saved bills found.</td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => (
                      <tr 
                        key={bill.id} 
                        className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${editingId === bill.id ? 'bg-blue-50/50 font-semibold' : ''}`}
                      >
                        <td className="p-2 font-mono text-slate-700">
                          {bill.voucherNo}
                          <div className="text-[10px] text-slate-400 font-normal">{bill.date ? bill.date.split('T')[0] : ''}</div>
                        </td>
                        <td className="p-2 text-slate-800 max-w-[120px] truncate" title={bill.shopName}>
                          {bill.shopName}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-900 font-bold">
                          ₹ {bill.netPayable?.toFixed(0) || '0'}
                        </td>
                        <td className="p-2 text-center flex items-center justify-center space-x-1.5 h-[41px]">
                          <button 
                            onClick={() => handleEditBill(bill)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                            title="Edit Wholesale Sales Bill"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteBill(bill.id, bill.voucherNo)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Delete Wholesale Sales Bill"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead className="bg-[#1e3f70] text-white sticky top-0 z-10">
                  <tr>
                    <th className="p-2 font-semibold">Item Code</th>
                    <th className="p-2 font-semibold">Item Name</th>
                    <th className="p-2 font-semibold text-right">Stock</th>
                    <th className="p-2 font-semibold text-center w-12">Add</th>
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
                        title="Click to add to bill"
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
            )}
          </div>
        </div>
      </div>

      {/* Modal for creating a new shop ledger */}
      <Modal isOpen={isShopModalOpen} onClose={() => setIsShopModalOpen(false)} title="Create New Shop Ledger Account">
        <form onSubmit={handleCreateShop} className="space-y-4 text-left p-1 text-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Shop Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                value={newShopName} 
                onChange={e => setNewShopName(e.target.value)} 
                placeholder="e.g. Sri Balaji Textiles Branch-2"
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">GSTIN</label>
              <input 
                type="text" 
                value={newShopGstin} 
                onChange={e => setNewShopGstin(e.target.value)} 
                placeholder="33AAAAA0000A1Z0"
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Mobile No</label>
              <input 
                type="text" 
                value={newShopMobile} 
                onChange={e => setNewShopMobile(e.target.value)} 
                placeholder="Mobile number"
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">State</label>
              <select 
                value={newShopState} 
                onChange={e => setNewShopState(e.target.value)} 
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Kerala">Kerala</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">City</label>
              <input 
                type="text" 
                value={newShopCity} 
                onChange={e => setNewShopCity(e.target.value)} 
                placeholder="City Name"
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Address</label>
              <textarea 
                value={newShopAddress} 
                onChange={e => setNewShopAddress(e.target.value)} 
                placeholder="Street address details"
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none" 
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button 
              type="button" 
              onClick={() => setIsShopModalOpen(false)} 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 font-medium rounded text-xs text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow transition-colors"
            >
              Save Shop Account
            </button>
          </div>
        </form>
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
                  No matching dresses found in master catalog.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopSalesBill;
