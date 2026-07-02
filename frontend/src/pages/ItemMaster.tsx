import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';

interface Product {
  id: string;
  itemCode: string;
  name: string;
  barcode: string;
  uom: string;
  purchaseRate: number;
  price: number;
  mrp: number;
  taxPercent: number;
  stock: number;
}

const ItemMaster = () => {
  const [itemCode, setItemCode] = useState('ITM-1001');
  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [uom, setUom] = useState('PCS');
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [salesRate, setSalesRate] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [openingStock, setOpeningStock] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Global Context ---
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const fetchNextCode = async (retries = 3) => {
    try {
      const res = await fetch('http://localhost:5000/api/products/next-code');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.itemCode) setItemCode(data.itemCode);
    } catch (err) {
      console.error("Failed to fetch item code", err);
      if (retries > 0) {
        setTimeout(() => fetchNextCode(retries - 1), 2000);
      }
    }
  };

  const fetchProducts = async (q = '', retries = 3) => {
    try {
      const res = await fetch(`http://localhost:5000/api/items/search?q=${q}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products", err);
      if (retries > 0 && q === '') {
        setTimeout(() => fetchProducts(q, retries - 1), 2000);
      }
    }
  };

  useEffect(() => {
    fetchNextCode();
    fetchProducts();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleClear = () => {
    setItemName('');
    setBarcode('');
    setUom('PCS');
    setPurchaseRate(0);
    setSalesRate(0);
    setMrp(0);
    setTaxPercent(18);
    setOpeningStock(0);
    fetchNextCode();
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Item Name is required.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
      return;
    }

    setLoading(true);
    const payload = {
      itemCode, 
      name: itemName, 
      barcode, 
      uom, 
      purchaseRate, 
      price: salesRate, 
      mrp, 
      taxPercent: taxPercent, 
      stock: openingStock
    };

    try {
      const res = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({msg: `Product ${itemName} saved successfully!`, type: 'success'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
        handleClear();
        fetchProducts(); // refresh the list
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Error saving: " + data.error, type: 'error'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Network error while saving.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Global Toolbar Wiring ---
  const actionHandlers = useRef({
    onAdd: handleClear,
    onDelete: handleClear,
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleClear,
      onDelete: handleClear,
    };
  });

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        onDelete: () => actionHandlers.current.onDelete(),
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] text-white px-4 py-2 flex items-center shadow-md z-10 sticky top-0">
        <span className="font-semibold text-lg tracking-wide">Item Master <span className="font-light text-blue-200 text-sm ml-2">(Product Creation)</span></span>
      </div>

      <div className="flex-1 flex flex-col p-6 space-y-6">
        
        {/* Form Panel */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden w-full max-w-4xl mx-auto transition-all duration-300 hover:shadow-xl">
          <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-100">
            <h2 className="text-slate-700 font-semibold text-base">Add New Product</h2>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Item Code</label>
              <input type="text" className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-500 text-sm focus:outline-none cursor-not-allowed" value={itemCode} disabled />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Item Name <span className="text-red-500">*</span></label>
              <input type="text" className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={itemName} onChange={e => setItemName(e.target.value)} autoFocus placeholder="e.g. Cashew Premium" />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Barcode</label>
              <input type="text" className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter barcode" />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Unit of Measure (UOM)</label>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={uom} onChange={e => setUom(e.target.value)}>
                <option>PCS</option>
                <option>KG</option>
                <option>LTR</option>
                <option>BOX</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2 border-b border-slate-200 my-2"></div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Purchase Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">₹</span>
                <input type="number" className="pl-7 pr-3 py-2 w-full bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={purchaseRate} onChange={e => setPurchaseRate(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Sales Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">₹</span>
                <input type="number" className="pl-7 pr-3 py-2 w-full bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={salesRate} onChange={e => setSalesRate(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">M.R.P</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">₹</span>
                <input type="number" className="pl-7 pr-3 py-2 w-full bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={mrp} onChange={e => setMrp(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Tax (%)</label>
              <div className="relative">
                <input type="number" className="pr-7 pl-3 py-2 w-full bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} />
                <span className="absolute right-3 top-2 text-slate-400">%</span>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 border-b border-slate-200 my-2"></div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-600 mb-1">Opening Stock</label>
              <input type="number" className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={openingStock} onChange={e => setOpeningStock(Number(e.target.value))} />
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 mt-4">
              <button 
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 active:bg-slate-100" 
                onClick={handleClear}
              >
                Clear
              </button>
              <button 
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center min-w-[100px]" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : 'Save Product'}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Products List */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-[300px]">
          <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-slate-700 font-semibold text-base">Product List</h2>
            <div className="relative w-64">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-medium">Item Code</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">UOM</th>
                  <th className="px-6 py-3 font-medium text-right">Stock</th>
                  <th className="px-6 py-3 font-medium text-right">Sales Rate</th>
                  <th className="px-6 py-3 font-medium text-right">M.R.P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length > 0 ? (
                  products.map(product => (
                    <tr key={product.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap text-blue-600 font-medium">{product.itemCode}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-slate-800 font-medium">{product.name}</td>
                      <td className="px-6 py-3 whitespace-nowrap">{product.uom}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">{product.stock}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">₹{product.price?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">₹{product.mrp?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      No products found. Add a new product above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ItemMaster;