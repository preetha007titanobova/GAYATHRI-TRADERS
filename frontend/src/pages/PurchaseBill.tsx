import React, { useState, useEffect } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import Api from '../Api';

interface PurchaseItem {
  id: string;
  itemCode: string;
  size: string;
  variety: string;
  category: string;
  itemDesc: string;
  hsn: string;
  qty: number;
  unitPrice: number;
  discPercent: number;
  taxPercent: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  total: number;
}

const PurchaseBill = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Header State
  const [billNo, setBillNo] = useState('Loading...');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState('');
  const [gstin, setGstin] = useState('');
  const [supplyPlace, setSupplyPlace] = useState('Tamil Nadu');
  const [vendorName, setVendorName] = useState('');
  
  const [vendors, setVendors] = useState<{id: string, name: string, gstin: string, state: string}[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchVendors();
    fetchProducts();
    fetchNextVoucher();
  }, []);

  // Parse state for editing bill passed from register
  useEffect(() => {
    const editBill = location.state?.editBill;
    if (editBill && vendors.length > 0) {
      setEditingId(editBill.id);
      setBillNo(editBill.voucherNo);
      setBillDate(editBill.date ? editBill.date.split('T')[0] : '');
      setGstin(editBill.supplierGstin || '');
      setSupplyPlace(editBill.type === 'Local' ? 'Tamil Nadu' : 'Other');
      setVendorName(editBill.supplierName);
      
      const foundVendor = vendors.find(v => v.name === editBill.supplierName);
      if (foundVendor) {
        setVendorId(foundVendor.id);
      }

      if (editBill.items && Array.isArray(editBill.items)) {
        const mapped = editBill.items.map((i: any) => ({
          id: i.id || Math.random().toString(),
          itemCode: i.itemCode,
          size: i.size || '',
          variety: i.variety || '',
          category: i.category || 'None',
          itemDesc: i.itemName || i.itemDesc || '',
          hsn: i.hsn || '',
          qty: i.qty || i.purchasedQty || 0,
          unitPrice: i.rate || i.unitPrice || 0,
          discPercent: i.discPercent || 0,
          taxPercent: i.taxPercent || 18,
          cgstAmt: i.cgst || 0,
          sgstAmt: i.sgst || 0,
          igstAmt: i.igst || 0,
          total: i.total || 0
        }));
        setItems(mapped);
      }
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

  // Handle Item Row Update
  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      let updated = { ...item, [field]: value };
      
      // Auto-fill from DB products when itemCode changes
      if (field === 'itemCode') {
        const prod = dbProducts.find(p => p.itemCode?.toLowerCase() === value.trim().toLowerCase());
        if (prod) {
          updated.itemDesc = prod.name || '';
          updated.hsn = prod.barcode || '';
          updated.unitPrice = prod.purchaseRate || 0;
          updated.taxPercent = prod.taxPercent || 18;
          updated.size = prod.size || '';
          updated.variety = prod.variety || '';
          updated.category = prod.department || 'None';
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
      itemCode: '', size: '', variety: '', category: 'None', itemDesc: '', hsn: '', qty: 1, unitPrice: 0, discPercent: 0,
      taxPercent: 18, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, total: 0
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
    navigate('/purchase-bill', { state: null, replace: true });
  };

  // Keyboard navigation for fast data entry
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, idx: number, field: string) => {
    if (e.key === 'Enter') {
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
      onSave: async () => {
        if (!vendorId || items.length === 0) {
          return setGlobalNotification({ msg: 'Please select vendor and add at least one item.', type: 'error' });
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
            itemName: i.itemDesc || i.itemCode,
            itemDesc: i.itemDesc,
            size: i.size,
            variety: i.variety,
            category: i.category,
            qty: i.qty,
            rate: i.unitPrice,
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
          } else {
            setGlobalNotification({ msg: 'Error saving purchase bill: ' + data.error, type: 'error' });
          }
        } catch (err) {
          console.error(err);
          setGlobalNotification({ msg: 'Network error saving purchase bill.', type: 'error' });
        }
      },
      onDelete: async () => {
        if (!editingId) {
          return setGlobalNotification({ msg: 'Delete option is only available when editing a saved bill.', type: 'error' });
        }
        if (!window.confirm("Are you sure you want to delete this purchase bill? This will revert physical stock levels.")) return;
        
        try {
          const res = await fetch(`${Api}/purchase-bills/${editingId}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            setGlobalNotification({ msg: `Purchase Bill ${billNo} deleted successfully.`, type: 'success' });
            clearForm();
          } else {
            setGlobalNotification({ msg: 'Failed to delete: ' + data.error, type: 'error' });
          }
        } catch (err) {
          console.error(err);
          setGlobalNotification({ msg: 'Network error deleting purchase bill.', type: 'error' });
        }
      },
      onPrint: () => setGlobalNotification({ msg: 'Printing layout...', type: 'info' })
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, billNo, billDate, vendorId, vendors, items, grandTotal, taxableTotal, totalCgst, totalSgst, totalIgst, roundedOff, supplyPlace, vendorName, gstin, editingId]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* Reusable DataList for Item Auto-completion */}
      <datalist id="item-catalog">
        {dbProducts.map((p, idx) => (
          <option key={p.id || idx} value={p.itemCode}>{p.name} {p.size ? `(${p.size})` : ''}</option>
        ))}
      </datalist>

      {/* Top Metadata Header */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0">
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Purchase Bill Entry
            {editingId && (
              <span className="text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded ml-3 shadow-sm">
                EDIT MODE
              </span>
            )}
          </h2>
        </div>
        
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Voucher No</label>
            <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} className="w-full border border-gray-400 p-1.5 rounded text-sm bg-gray-50 font-bold focus:bg-white" readOnly={!!editingId} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Vendor Name</label>
            <select 
              value={vendorId} 
              onChange={e => {
                if (e.target.value === 'NEW') {
                  setIsVendorModalOpen(true);
                } else {
                  setVendorId(e.target.value);
                }
              }} 
              className="w-full border border-gray-400 p-1.5 rounded text-sm focus:border-blue-500 bg-white"
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="NEW" className="font-bold text-blue-600 bg-blue-50">+ Add New Vendor...</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">GSTIN</label>
            <input type="text" value={gstin} readOnly className="w-full border border-gray-300 p-1.5 rounded text-sm bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Place of Supply</label>
            <input type="text" value={supplyPlace} readOnly className="w-full border border-gray-300 p-1.5 rounded text-sm bg-gray-100 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col bg-white border border-gray-400 shadow-sm relative overflow-hidden mb-2 rounded">
        {/* Grid Sub-Toolbar */}
        <div className="bg-[#d1e8e2] p-1.5 border-b border-gray-400 flex space-x-2">
          <button onClick={addRow} className="flex items-center space-x-1 bg-white hover:bg-gray-50 border border-gray-400 px-3 py-1 text-xs font-bold text-gray-700 shadow-sm rounded transition-colors">
            <Plus size={14} className="text-green-600" /> <span>Add Row</span>
          </button>
        </div>

        {/* Grid Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-[#2b579a] text-white sticky top-0 z-10">
              <tr>
                <th className="border-r border-gray-400 p-1.5 w-10 text-center text-xs font-semibold">S.No</th>
                <th className="border-r border-gray-400 p-1.5 w-28 text-xs font-semibold">Item Code</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold">Dress Size</th>
                <th className="border-r border-gray-400 p-1.5 w-28 text-xs font-semibold">Variety</th>
                <th className="border-r border-gray-400 p-1.5 w-28 text-xs font-semibold">Category</th>
                <th className="border-r border-gray-400 p-1.5 text-xs font-semibold">Item Description</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold">Barcode/HSN</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold text-right">Qty</th>
                <th className="border-r border-gray-400 p-1.5 w-24 text-xs font-semibold text-right">Unit Price</th>
                <th className="border-r border-gray-400 p-1.5 w-16 text-xs font-semibold text-right">Disc %</th>
                <th className="border-r border-gray-400 p-1.5 w-16 text-xs font-semibold text-right">Tax %</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold text-right">CGST</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold text-right">SGST</th>
                <th className="border-r border-gray-400 p-1.5 w-20 text-xs font-semibold text-right">IGST</th>
                <th className="border-r border-gray-400 p-1.5 w-28 text-xs font-semibold text-right">Total Amt</th>
                <th className="p-1.5 w-10 text-center text-xs font-semibold">Del</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-gray-500 italic">No items added. Click "Add Row" to begin. Use Enter key for quick entry.</td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-300 hover:bg-yellow-50 focus-within:bg-blue-50 transition-colors">
                  <td className="border-r border-gray-300 p-1 text-center text-gray-500 bg-gray-50">{idx + 1}</td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="text" 
                      list="item-catalog"
                      value={item.itemCode} 
                      onChange={e => updateItem(item.id, 'itemCode', e.target.value)} 
                      onKeyDown={e => handleKeyDown(e, idx, 'itemCode')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 uppercase" 
                      placeholder="ITM..." 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="text" 
                      value={item.size} 
                      onChange={e => updateItem(item.id, 'size', e.target.value)} 
                      onKeyDown={e => handleKeyDown(e, idx, 'size')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" 
                      placeholder="e.g. M, L, XL"
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="text" 
                      value={item.variety} 
                      onChange={e => updateItem(item.id, 'variety', e.target.value)} 
                      onKeyDown={e => handleKeyDown(e, idx, 'variety')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" 
                      placeholder="e.g. Cotton, Kurti"
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <select
                      value={item.category}
                      onChange={e => updateItem(item.id, 'category', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 'category')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
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
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="text" 
                      value={item.hsn} 
                      onChange={e => updateItem(item.id, 'hsn', e.target.value)} 
                      onKeyDown={e => handleKeyDown(e, idx, 'hsn')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="number" 
                      value={item.qty === 0 ? '' : item.qty} 
                      onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} 
                      onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right font-bold text-blue-800" 
                      min="1" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="number" 
                      value={item.unitPrice === 0 ? '' : item.unitPrice} 
                      onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} 
                      onKeyDown={e => handleKeyDown(e, idx, 'unitPrice')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="number" 
                      value={item.discPercent === 0 ? '' : item.discPercent} 
                      onChange={e => updateItem(item.id, 'discPercent', Number(e.target.value))} 
                      onKeyDown={e => handleKeyDown(e, idx, 'discPercent')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-0">
                    <input 
                      type="number" 
                      value={item.taxPercent} 
                      onChange={e => updateItem(item.id, 'taxPercent', Number(e.target.value))} 
                      onKeyDown={e => handleKeyDown(e, idx, 'taxPercent')}
                      className="w-full p-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right text-gray-600" 
                    />
                  </td>
                  <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-600 bg-gray-50">{item.cgstAmt.toFixed(2)}</td>
                  <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-600 bg-gray-50">{item.sgstAmt.toFixed(2)}</td>
                  <td className="border-r border-gray-300 p-2 text-right font-mono text-gray-600 bg-gray-50">{item.igstAmt.toFixed(2)}</td>
                  <td className="border-r border-gray-300 p-2 text-right font-mono font-bold text-green-700 bg-gray-50">{item.total.toFixed(2)}</td>
                  <td className="p-1 text-center bg-gray-50">
                    <button onClick={() => removeRow(item.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-100 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="flex justify-end flex-shrink-0">
        <div className="w-[700px] bg-[#1e3f70] text-white p-3 border border-[#142d54] shadow-md rounded flex flex-col justify-between">
           <div className="grid grid-cols-6 gap-3 text-sm font-bold text-right border-b border-[#2b579a] pb-2 mb-2">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">Sub Total</span>
              ₹{subTotal.toFixed(2)}
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-blue-200 mb-1">Discount</span>
              - ₹{discTotal.toFixed(2)}
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
            <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Grand Total</span>
            <div className="text-3xl font-black text-yellow-300 drop-shadow-md">
              ₹ {grandTotal.toFixed(2)}
            </div>
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

    </div>
  );
};

export default PurchaseBill;