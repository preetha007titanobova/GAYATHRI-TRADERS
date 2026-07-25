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

const PurchaseBill = () => {
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
  const [vendorId, setVendorId] = useState('');
  const [gstin, setGstin] = useState('');
  const [supplyPlace, setSupplyPlace] = useState('Tamil Nadu');
  const [vendorName, setVendorName] = useState('');
  
  const [vendors, setVendors] = useState<{id: string, name: string, gstin: string, state: string}[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  // Load products from DB on mount for local suggestion and fast search
  const fetchProducts = async () => {
    try {
      const res = await fetch(`${Api}/products/search?q=`);
      if (res.ok) {
        const data = await res.json();
        setDbProducts(data);
      }
    } catch (err) {
      console.error("Error loading products", err);
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

  useEffect(() => {
    fetchVendors();
    fetchProducts();
    fetchNextVoucher();
    fetchSavedBills();
  }, []);

  // Parse state for editing bill passed from register
  useEffect(() => {
    const editBill = location.state?.editBill;
    if (editBill && vendors.length > 0) {
      handleEditBill(editBill);
    }
  }, [location.state, vendors]);

  // Modal State
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({ name: '', gstin: '', state: 'Tamil Nadu' });

  // Grid State
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
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
    setVendorId('');
    setVendorName('');
    setGstin('');
    setSupplyPlace('Tamil Nadu');
    navigate('/purchase-bill', { state: null, replace: true });
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
    setGstin(bill.supplierGstin || '');
    setSupplyPlace(bill.type === 'Local' ? 'Tamil Nadu' : 'Other');
    setVendorName(bill.supplierName);
    
    const foundVendor = vendors.find(v => v.name === bill.supplierName);
    if (foundVendor) {
      setVendorId(foundVendor.id);
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
          qty: i.qty || i.purchasedQty || 0,
          unitPrice: i.rate || i.unitPrice || 0,
          salesRate: i.salesRate || prod?.price || i.rate || i.unitPrice || 0,
          mrp: i.mrp || prod?.mrp || i.rate || i.unitPrice || 0,
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
    setGlobalNotification({ msg: `Voucher ${bill.voucherNo} loaded for editing`, type: 'info' });
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
    if (!vendorId) {
      return setGlobalNotification({ msg: 'Please select vendor.', type: 'error' });
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
      supplierInvoiceNo: 'N/A',
      supplierName: vendorName,
      supplierGstin: gstin,
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
        fetchProducts(); 
        fetchSavedBills();
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
        setVendorId(data.ledger.id || data.ledger.ledgerCode);
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
          Purchase Bill Entry 
          <span className="font-light text-blue-200 text-sm ml-2">(Stock Inward Master)</span>
          {editingId && (
            <span className="text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded ml-3 shadow-sm">
              EDIT MODE: {billNo}
            </span>
          )}
        </span>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'split' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
          >
            ◧ Split View
          </button>
          <button
            onClick={() => setViewMode('form-only')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'form-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
          >
            ❌ Hide Table
          </button>
          <button
            onClick={() => setViewMode('table-only')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'table-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
          >
            👁 View Full Table
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Purchase Bill Form */}
        <div className={`${viewMode === 'table-only' ? 'hidden' : viewMode === 'form-only' ? 'w-full' : 'w-[64%]'} overflow-y-auto p-3 bg-white flex flex-col justify-between border-r border-gray-300`}>
          <div>
            {/* Reusable DataList for Item Auto-completion */}
            <datalist id="item-catalog">
              {dbProducts.map((p, idx) => (
                <option key={p.id || idx} value={p.itemCode}>{p.name} {p.size ? `(${p.size})` : ''}</option>
              ))}
            </datalist>

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
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Vendor Name</label>
                  <select 
                    value={vendorId} 
                    onChange={e => {
                      if (e.target.value === 'NEW') {
                        setIsVendorModalOpen(true);
                      } else {
                        setVendorId(e.target.value);
                      }
                    }} 
                    className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 focus:outline-none bg-white font-semibold text-gray-800"
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    <option value="NEW" className="font-bold text-blue-600 bg-blue-50">+ Add New Vendor...</option>
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
              <div className="bg-[#d1e8e2] p-1 border-b border-gray-400 flex space-x-2">
                <button onClick={addRow} className="flex items-center space-x-1 bg-white hover:bg-gray-50 border border-gray-400 px-3 py-1 text-xs font-bold text-gray-700 shadow-sm rounded transition-colors">
                  <Plus size={12} className="text-green-600" /> <span>Add Row</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-max">
                  <thead className="bg-[#2b579a] text-white sticky top-0 z-10">
                    <tr>
                      <th className="border-r border-gray-400 p-1.5 w-8 text-center font-semibold">S.No</th>
                      <th className="border-r border-gray-400 p-1.5 w-48 font-semibold">Select Product (Master)</th>
                      <th className="border-r border-gray-400 p-1.5 w-28 font-semibold">Our Item Code</th>
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
                        <td className="border-r border-gray-300 p-0 w-48">
                          {item.isManualItem ? (
                            <div className="flex items-center p-1 bg-white">
                              <input 
                                type="text" 
                                value={item.itemName || ''} 
                                onChange={e => updateItem(item.id, 'itemName', e.target.value)} 
                                placeholder="Enter Item Name..."
                                className="w-full bg-transparent focus:outline-none text-xs font-semibold text-gray-800"
                              />
                              <button 
                                type="button"
                                onClick={() => updateItem(item.id, 'isManualItem', false)} 
                                className="text-blue-600 hover:text-blue-800 text-[10px] font-bold px-1.5 py-0.5 hover:bg-blue-50 rounded ml-1 transition-colors"
                                title="Switch to master catalog selection list"
                              >
                                List
                              </button>
                            </div>
                          ) : (
                            <select
                              value={item.itemCode || ''}
                              onChange={e => {
                                const code = e.target.value;
                                if (code === 'MANUAL') {
                                  updateItem(item.id, 'isManualItem', true);
                                  updateItem(item.id, 'itemCode', '');
                                  updateItem(item.id, 'itemName', '');
                                } else if (!code) {
                                  updateItem(item.id, 'itemCode', '');
                                } else {
                                  updateItem(item.id, 'itemCode', code);
                                }
                              }}
                              className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-xs font-semibold text-gray-800"
                            >
                              <option value="">-- Select Product --</option>
                              <option value="MANUAL" className="text-blue-600 font-bold bg-blue-50">+ Type Manually...</option>
                              {dbProducts.map(p => (
                                <option key={p.id} value={p.itemCode}>
                                  {p.itemCode} - {p.name} {p.size ? `(${p.size})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <div className="flex items-center relative pr-1 min-w-[160px]">
                            <input 
                              type="text" 
                              list="item-catalog"
                              value={item.itemCode} 
                              onChange={e => updateItem(item.id, 'itemCode', e.target.value)} 
                              onKeyDown={e => handleKeyDown(e, idx, 'itemCode')}
                              onDoubleClick={() => {
                                setActiveRowId(item.id);
                                setModalSearchQuery(item.itemCode || '');
                                setHighlightedProductIndex(0);
                                setIsProductModalOpen(true);
                              }}
                              className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none uppercase pr-16 text-xs font-mono font-bold" 
                              placeholder="Double click to search..." 
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 z-10">
                              <button
                                onClick={() => {
                                  setActiveRowId(item.id);
                                  setModalSearchQuery(item.itemCode || '');
                                  setHighlightedProductIndex(0);
                                  setIsProductModalOpen(true);
                                }}
                                type="button"
                                className="px-1 py-0.5 text-[9px] font-bold bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-700 rounded transition-colors shadow-sm"
                                title="Search dress table (F2)"
                              >
                                Find
                              </button>
                              <button
                                onClick={() => generateCodeForRow(item.id)}
                                type="button"
                                className="px-1 py-0.5 text-[9px] font-bold bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-700 rounded transition-colors shadow-sm"
                                title="Auto-generate item code"
                              >
                                Gen
                              </button>
                            </div>
                          </div>
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
                            onKeyDown={e => handleKeyDown(e, idx, 'category')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none"
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
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.qty === 0 ? '' : item.qty} 
                            onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-bold text-blue-800" 
                            min="1" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.unitPrice === 0 ? '' : item.unitPrice} 
                            onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'unitPrice')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.salesRate === 0 ? '' : item.salesRate} 
                            onChange={e => updateItem(item.id, 'salesRate', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'salesRate')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right font-semibold text-indigo-700" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.mrp === 0 ? '' : item.mrp} 
                            onChange={e => updateItem(item.id, 'mrp', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'mrp')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right text-gray-700" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.discPercent === 0 ? '' : item.discPercent} 
                            onChange={e => updateItem(item.id, 'discPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'discPercent')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-0">
                          <input 
                            type="number" 
                            value={item.taxPercent} 
                            onChange={e => updateItem(item.id, 'taxPercent', Number(e.target.value))} 
                            onKeyDown={e => handleKeyDown(e, idx, 'taxPercent')}
                            className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none text-right text-gray-500" 
                          />
                        </td>
                        <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700 bg-gray-50">{item.total.toFixed(2)}</td>
                        <td className="p-1 text-center bg-gray-50">
                          <button onClick={() => removeRow(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors">
                            <Trash2 size={12} />
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
          <div className="flex items-center justify-between mt-2 p-2 bg-slate-50 border border-gray-300 rounded shadow-sm flex-shrink-0">
            <div className="flex space-x-2">
              <button 
                onClick={handleSaveBill}
                disabled={loading}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow flex items-center space-x-1.5 text-xs transition-colors"
              >
                <span>{editingId ? '✓ Update Bill' : '💾 Save Bill'}</span>
              </button>
              
              <button 
                onClick={clearForm}
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-slate-100 font-semibold rounded shadow-sm text-xs transition-colors"
              >
                Clear / New
              </button>

              {editingId && (
                <button 
                  onClick={() => handleDeleteBill(editingId, billNo)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded shadow-sm text-xs transition-colors"
                >
                  Delete Bill
                </button>
              )}
            </div>

            <div className="w-[450px] bg-[#1e3f70] text-white p-3 border border-[#142d54] shadow-md rounded flex flex-col justify-between">
              <div className="grid grid-cols-6 gap-2 text-xs font-bold text-right border-b border-[#2b579a] pb-2 mb-2">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">Sub Total</span>
                  ₹{subTotal.toFixed(2)}
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">Discount</span>
                  - ₹{discTotal.toFixed(2)}
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">CGST</span>
                  ₹{totalCgst.toFixed(2)}
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">SGST</span>
                  ₹{totalSgst.toFixed(2)}
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">IGST</span>
                  ₹{totalIgst.toFixed(2)}
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-blue-200 mb-1">Round Off</span>
                  {roundedOff > 0 ? '+' : ''}{roundedOff.toFixed(2)}
                </div>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Grand Total</span>
                <div className="text-2xl font-black text-yellow-300 drop-shadow-md">
                  ₹ {grandTotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Saved Bills / Item Master Sidebar Panel */}
        <div className={`${viewMode === 'form-only' ? 'hidden' : viewMode === 'table-only' ? 'w-full' : 'w-[36%]'} bg-slate-100 p-3 flex flex-col overflow-hidden border-l border-gray-300`}>
          <div className="flex-shrink-0 mb-2">
            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-200 p-1 rounded-md border border-slate-300 mb-2">
              <button
                onClick={() => setSidebarTab('bills')}
                className={`flex-1 text-center py-1 text-xs font-bold rounded transition-all ${
                  sidebarTab === 'bills'
                    ? 'bg-[#1e3f70] text-white shadow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                Saved Bills ({filteredBills.length})
              </button>
              <button
                onClick={() => setSidebarTab('items')}
                className={`flex-1 text-center py-1 text-xs font-bold rounded transition-all ${
                  sidebarTab === 'items'
                    ? 'bg-[#1e3f70] text-white shadow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                Item Master ({filteredProducts.length})
              </button>
            </div>

            {/* Search Input depending on active tab */}
            {sidebarTab === 'bills' ? (
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search voucher, vendor..." 
                  value={billSearchQuery}
                  onChange={e => setBillSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 p-1.5 pl-8 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 transition-shadow"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            ) : (
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search code, name, category, variety..." 
                  value={itemSearchQuery}
                  onChange={e => setItemSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 p-1.5 pl-8 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 transition-shadow"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            )}
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-auto border border-slate-200 rounded bg-white">
            {sidebarTab === 'bills' ? (
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead className="bg-[#1e3f70] text-white sticky top-0 z-10">
                  <tr>
                    <th className="p-2 font-semibold">Vch No</th>
                    <th className="p-2 font-semibold">Vendor</th>
                    <th className="p-2 font-semibold text-right">Net Payable</th>
                    <th className="p-2 font-semibold text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic bg-slate-50">No saved bills found.</td>
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
                        <td className="p-2 text-slate-800 max-w-[120px] truncate" title={bill.supplierName}>
                          {bill.supplierName}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-900 font-bold">
                          ₹ {bill.netPayable?.toFixed(0) || '0'}
                        </td>
                        <td className="p-2 text-center flex items-center justify-center space-x-1.5 h-[41px]">
                          <button 
                            onClick={() => handleEditBill(bill)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                            title="Edit Purchase Bill"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteBill(bill.id, bill.voucherNo)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Delete Purchase Bill"
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
                        style={{padding:"20px"}}
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
            )}
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

export default PurchaseBill;