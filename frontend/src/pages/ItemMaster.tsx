import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Api from '../Api';

interface Product {
  id: string;
  itemCode: string;
  vendorItemCode?: string;
  name: string;
  barcode: string;
  uom: string;
  purchaseRate: number;
  price: number;
  mrp: number;
  taxPercent: number;
  stock: number;
  department?: string;
  variety?: string;
  size?: string;
  factory?: string;
}

const ItemMaster = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState('ITM-1001');
  const [vendorItemCode, setVendorItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [uom, setUom] = useState('PCS');
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [salesRate, setSalesRate] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [openingStock, setOpeningStock] = useState(0);
  const [department, setDepartment] = useState('Womens');
  const [variety, setVariety] = useState('');
  const [size, setSize] = useState('');
  const [factory, setFactory] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Layout view modes: 'split' | 'form-only' | 'table-only'
  const [viewMode, setViewMode] = useState<'split' | 'form-only' | 'table-only'>('split');

  // --- Global Context ---
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const fetchNextCode = async (retries = 3) => {
    try {
      const res = await fetch(`${Api}/products/next-code`);
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

  const fetchProducts = async (query = '') => {
    try {
      const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data.map((p: any) => ({
          id: p._id || p.id,
          itemCode: p.itemCode,
          vendorItemCode: p.vendorItemCode || '',
          name: p.name,
          barcode: p.barcode || '',
          uom: p.uom || 'PCS',
          purchaseRate: p.purchaseRate || 0,
          price: p.price || 0,
          mrp: p.mrp || 0,
          taxPercent: p.taxPercent || 0,
          stock: p.stock || 0,
          department: p.department || '',
          variety: p.variety || '',
          size: p.size || '',
          factory: p.factory || ''
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchNextCode();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleClear = () => {
    setSelectedId(null);
    setVendorItemCode('');
    setItemName('');
    setBarcode('');
    setUom('PCS');
    setPurchaseRate(0);
    setSalesRate(0);
    setMrp(0);
    setTaxPercent(18);
    setOpeningStock(0);
    setDepartment('Womens');
    setVariety('');
    setSize('');
    setFactory('');
    fetchNextCode();
  };

  const handleRowClick = (product: any) => {
    setSelectedId(product.id || product._id || null);
    setItemCode(product.itemCode || '');
    setVendorItemCode(product.vendorItemCode || '');
    setItemName(product.name || '');
    setBarcode(product.barcode || '');
    setUom(product.uom || 'PCS');
    setPurchaseRate(product.purchaseRate || 0);
    setSalesRate(product.price || 0);
    setMrp(product.mrp || 0);
    setTaxPercent(product.taxPercent || 18);
    setOpeningStock(product.stock || 0);
    setDepartment(product.department || 'Womens');
    setVariety(product.variety || '');
    setSize(product.size || '');
    setFactory(product.factory || '');
  };

  const handleDelete = async () => {
    if (!selectedId) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please select a product to delete.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${Api}/products/${selectedId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Product deleted successfully!", type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
        handleClear();
        fetchProducts();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Error deleting: " + data.error, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Network error while deleting.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Product Name is required.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    setLoading(true);
    const payload = {
      itemCode,
      vendorItemCode,
      name: itemName,
      barcode,
      uom,
      purchaseRate,
      price: salesRate,
      mrp,
      taxPercent,
      stock: openingStock,
      department,
      variety,
      size,
      factory
    };

    try {
      const url = selectedId ? `${Api}/products/${selectedId}` : `${Api}/products`;
      const method = selectedId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Product ${itemName} saved successfully!`, type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
        handleClear();
        fetchProducts();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Error saving: " + data.error, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Network error while saving.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Global Toolbar Wiring ---
  const actionHandlers = useRef({
    onAdd: handleClear,
    onDelete: handleDelete,
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleClear,
      onDelete: handleDelete,
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
  }, [setToolbarActions, selectedId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.vendorItemCode && p.vendorItemCode.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] text-white px-4 py-2 flex justify-between items-center shadow-md z-10">
        <span className="font-semibold text-lg tracking-wide">Item Master <span className="font-light text-blue-200 text-sm ml-2">(Product Creation)</span></span>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'split' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
            title="Split Screen View"
          >
            ◧ Split View
          </button>
          <button
            onClick={() => setViewMode('table-only')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'table-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
            title="Maximize Table"
          >
            👁 View Full Table
          </button>
          <button
            onClick={() => setViewMode('form-only')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${viewMode === 'form-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
            title="Hide Table"
          >
            ❌ Hide Table
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* Left Side: Product Entry Form */}
        <div className={`${viewMode === 'table-only' ? 'hidden' : viewMode === 'form-only' ? 'w-full' : 'w-[58%]'} overflow-y-auto p-6 border-r border-slate-200 bg-white flex flex-col justify-between`}>
          <div>
            <h2 className="text-slate-700 font-semibold text-base mb-4 pb-2 border-b border-slate-100">
              {selectedId ? 'Edit Product' : 'Add New Product'}
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Our Item Code</label>
                <input type="text" className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-slate-500 text-sm focus:outline-none cursor-not-allowed font-mono" value={itemCode} disabled />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Vendor Item Code</label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono" value={vendorItemCode} onChange={e => setVendorItemCode(e.target.value)} placeholder="Vendor Code" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Barcode</label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Barcode" />
              </div>

              <div className="flex flex-col col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1">Item Name <span className="text-red-500">*</span></label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={itemName} onChange={e => setItemName(e.target.value)} autoFocus placeholder="e.g. Cashew Premium" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Unit (UOM)</label>
                <select className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={uom} onChange={e => setUom(e.target.value)}>
                  <option>PCS</option>
                  <option>Pair</option>
                  <option>Set</option>
                  <option>Pack</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Tax (%)</label>
                <div className="relative">
                  <input type="number" className="pr-6 pl-3 py-1 w-full bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} />
                  <span className="absolute right-2 top-1.5 text-slate-400 text-xs">%</span>
                </div>
              </div>

              <div className="col-span-3 border-b border-slate-100 my-1"></div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Category</label>
                <select className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="">None</option>
                  <option value="Womens">Womens</option>
                  <option value="Mens">Mens</option>
                  <option value="Kids">Kids</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Variety</label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={variety} onChange={e => setVariety(e.target.value)} placeholder="e.g. Kurti, Jeans, Shirt" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Size</label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. M, L, XL, 32" />
              </div>

              <div className="flex flex-col col-span-3">
                <label className="text-xs font-medium text-slate-600 mb-1">Factory / Brand Name</label>
                <input type="text" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={factory} onChange={e => setFactory(e.target.value)} placeholder="e.g. Surya Exports, SK Textiles" />
              </div>

              <div className="col-span-3 border-b border-slate-100 my-1"></div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Purchase Rate</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1 text-slate-400 text-xs">₹</span>
                  <input type="number" className="pl-6 pr-3 py-1 w-full bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={purchaseRate} onChange={e => setPurchaseRate(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Sales Rate</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1 text-slate-400 text-xs">₹</span>
                  <input type="number" className="pl-6 pr-3 py-1 w-full bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={salesRate} onChange={e => setSalesRate(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">M.R.P</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1 text-slate-400 text-xs">₹</span>
                  <input type="number" className="pl-6 pr-3 py-1 w-full bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={mrp} onChange={e => setMrp(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1">Opening Stock</label>
                <input type="number" className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" value={openingStock} onChange={e => setOpeningStock(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
            <button
              className="px-5 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 active:bg-slate-100 text-sm"
              onClick={handleClear}
            >
              Clear
            </button>
            {selectedId && (
              <button
                className="px-5 py-1.5 bg-red-600 border border-red-700 text-white font-medium rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 active:bg-red-800 text-sm"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </button>
            )}
            <button
              className="px-5 py-1.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center min-w-[100px] text-sm"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : selectedId ? 'Update' : 'Save Product'}
            </button>
          </div>
        </div>

        {/* Right Side: Product Directory Grid */}
        <div className={`${viewMode === 'form-only' ? 'hidden' : viewMode === 'table-only' ? 'w-full' : 'w-[42%]'} flex flex-col bg-white overflow-hidden p-6`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative w-48">
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
          </div>

          <div className="overflow-auto flex-1 border border-slate-200 rounded-lg">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Our Item Code</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Vendor Code</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Name</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Category</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Variety</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Size</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">Factory</th>
                  <th className="px-4 py-2.5 font-medium border-b border-slate-200">UOM</th>
                  <th className="px-4 py-2.5 font-medium text-right border-b border-slate-200">Stock</th>
                  <th className="px-4 py-2.5 font-medium text-right border-b border-slate-200">Purchase Rate</th>
                  <th className="px-4 py-2.5 font-medium text-right border-b border-slate-200">Sales Rate</th>
                  <th className="px-4 py-2.5 font-medium text-right border-b border-slate-200">M.R.P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map(product => {
                    const isSelected = selectedId === product.id;
                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 font-medium' : ''}`}
                        onClick={() => handleRowClick(product)}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap text-blue-600 font-medium">{product.itemCode}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-mono font-semibold">{product.vendorItemCode || '-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-800 font-medium">
                          <div>{product.name}</div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{product.department} </td>
                         <td className="px-4 py-2.5 whitespace-nowrap">{product.variety} </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{product.size}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{product.factory}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{product.uom}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">{product.stock}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">{product.purchaseRate}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">₹{product.price?.toFixed(2) || '0.00'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">₹{product.mrp?.toFixed(2) || '0.00'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-150 text-sm">
              <span className="text-slate-500 text-xs">
                Showing {Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredProducts.length, currentPage * itemsPerPage)} of {filteredProducts.length} products
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ItemMaster;