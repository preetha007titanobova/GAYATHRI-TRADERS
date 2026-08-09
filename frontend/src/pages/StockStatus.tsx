import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PackageSearch, AlertTriangle, Search, Filter, Trash2, CheckSquare, Square } from 'lucide-react';
import Api from '../Api';

interface StockItem {
  id?: string;
  _id?: string;
  itemCode: string;
  vendorItemCode?: string;
  name: string;
  group?: string;
  uom: string;
  stock: number;
  damagedStock?: number;
  minReorder?: number;
  purchaseRate: number;
  department?: string;
  variety?: string;
  size?: string;
  pendingOrderQty?: number;
}

const StockStatus = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
  }>();

  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [hideZero, setHideZero] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Bulk & Single Delete States
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [singleDeleteModalOpen, setSingleDeleteModalOpen] = useState(false);
  const [deletingSingle, setDeletingSingle] = useState(false);

  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Damages state
  const [damages, setDamages] = useState<Record<string, { qty: number, reason: string, productId?: string, itemCode?: string }>>({});

  useEffect(() => {
    const stored = localStorage.getItem('billing_damages');
    if (stored) {
      try {
        setDamages(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing billing_damages", e);
      }
    }
  }, []);

  const getProductDamages = (prodId: string, itemCode: string) => {
    let totalQty = 0;
    const reasons: string[] = [];
    
    Object.entries(damages).forEach(([rowId, dmg]) => {
      const isMatch = (dmg.productId && (dmg.productId === prodId)) ||
                      (dmg.itemCode && dmg.itemCode === itemCode) ||
                      (rowId.includes(`-${itemCode}`));
      
      if (isMatch) {
        totalQty += dmg.qty || 0;
        if (dmg.reason) {
          reasons.push(`${dmg.reason} (${dmg.qty})`);
        }
      }
    });
    
    return { totalQty, reasons: reasons.join(', ') || '-' };
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${Api}/products/search?q=`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch (err) {
      console.error("Failed to fetch inventory", err);
      setGlobalNotification({ msg: 'Failed to fetch stock data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredStock = useMemo(() => {
    return inventory.filter(item => {
      const qty = item.stock || 0;
      if (hideZero && qty <= 0) return false;

      if (search) {
        const q = search.toLowerCase();
        const code = item.itemCode?.toLowerCase() || '';
        const vendorCode = item.vendorItemCode?.toLowerCase() || '';
        const name = item.name?.toLowerCase() || '';
        const department = item.department?.toLowerCase() || '';
        const variety = item.variety?.toLowerCase() || '';
        const size = item.size?.toLowerCase() || '';

        if (
          !name.includes(q) && 
          !code.includes(q) && 
          !vendorCode.includes(q) && 
          !department.includes(q) && 
          !variety.includes(q) && 
          !size.includes(q)
        ) return false;
      }
      return true;
    });
  }, [inventory, search, selectedGroup, hideZero]);

  const isAllSelected = useMemo(() => {
    return filteredStock.length > 0 && filteredStock.every(item => selectedIds.includes(item.id || item._id || ''));
  }, [filteredStock, selectedIds]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStock.map(item => item.id || item._id || '').filter(Boolean));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id || itemToDelete._id;
    if (!id) return;

    setDeletingSingle(true);
    try {
      const res = await fetch(`${Api}/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGlobalNotification({ msg: `Product [${itemToDelete.itemCode}] ${itemToDelete.name} deleted successfully!`, type: 'success' });
        setSelectedRowId(null);
        fetchInventory();
      } else {
        const data = await res.json();
        setGlobalNotification({ msg: `Failed to delete product: ${data.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: 'Network error deleting product.', type: 'error' });
    } finally {
      setDeletingSingle(false);
      setSingleDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (bulkConfirmText.trim().toUpperCase() !== 'CONFIRM DELETE') return;
    setDeletingBulk(true);
    try {
      const deletePromises = selectedIds.map(id =>
        fetch(`${Api}/products/${id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      setGlobalNotification({ msg: `Successfully deleted ${selectedIds.length} products.`, type: 'success' });
      setSelectedIds([]);
      fetchInventory();
    } catch (err) {
      console.error(err);
      setGlobalNotification({ msg: 'Error performing bulk deletion.', type: 'error' });
    } finally {
      setDeletingBulk(false);
      setBulkDeleteModalOpen(false);
      setBulkConfirmText('');
    }
  };

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Stock Status Report...', type: 'info' });
      },
      onFind: () => {
        const searchInput = document.getElementById('stock-search-input');
        if (searchInput) searchInput.focus();
      },
      onDelete: () => {
        if (selectedIds.length > 0) {
          setBulkDeleteModalOpen(true);
        } else if (selectedRowId) {
          const matched = inventory.find(i => (i.id || i._id) === selectedRowId);
          if (matched) {
            setItemToDelete(matched);
            setSingleDeleteModalOpen(true);
          }
        } else {
          setGlobalNotification({ msg: 'Please select a product to delete.', type: 'error' });
        }
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification, selectedIds, selectedRowId, inventory]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">

      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex flex-wrap justify-between items-center gap-3 print:hidden">

        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Stock Status (Valuation)
          </h2>

          <div className="flex items-center space-x-4 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <Filter size={16} className="text-gray-500" />
            </div>

            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <Search size={16} className="text-gray-400" />
              <input
                id="stock-search-input"
                type="text"
                placeholder="Search item code/name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm focus:outline-none w-48 placeholder-gray-400"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hideZero"
                checked={hideZero}
                onChange={e => setHideZero(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="hideZero" className="text-sm font-bold text-gray-700 cursor-pointer">Hide Zero Bal</label>
            </div>
          </div>

          {/* Multi-Select & Bulk Delete Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) setSelectedIds([]);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                isMultiSelectMode
                  ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              {isMultiSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isMultiSelectMode ? 'Cancel Selection' : 'Select Multiple'}</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold rounded-md shadow border border-red-700 transition-colors flex items-center gap-1.5 animate-pulse cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Bulk Delete ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
            <AlertTriangle size={14} /> <span>= Below Reorder Level</span>
          </div>
        </div>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                {isMultiSelectMode && (
                  <th className="border-r border-[#142d54] p-2 text-center w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer accent-red-600"
                      title="Select / Unselect All"
                    />
                  </th>
                )}
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Our Item Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Vendor Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Item Name</th>
                <th className="px-4 py-2.5 font-medium border-b border-slate-200">Category</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-20 text-center">Unit</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Available stock</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right text-red-300">Damaged Stock</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Min Reorder</th>
                <th className="p-2 text-xs font-semibold w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isMultiSelectMode ? 10 : 9} className="p-12 text-center text-gray-500">
                    Loading stock data...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={isMultiSelectMode ? 10 : 9} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <PackageSearch size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No items found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const recId = item.id || item._id || '';
                  const isSelected = selectedRowId === recId || selectedIds.includes(recId);
                  const qty = Math.max(0, item.stock || 0);
                  const minReorder = item.minReorder || 10;
                  const isLow = qty < minReorder;
                  const { reasons: localDmgReasons } = getProductDamages(recId, item.itemCode || '');
                  const dbDamageReasons = (item as any).damageReasons || [];
                  const combinedDmgReasonsList: string[] = [];
                  if (localDmgReasons && localDmgReasons !== '-') {
                    combinedDmgReasonsList.push(`Manual: ${localDmgReasons}`);
                  }
                  dbDamageReasons.forEach((r: string) => {
                    combinedDmgReasonsList.push(`Customer Return: ${r}`);
                  });
                  const hoverTitle = combinedDmgReasonsList.length > 0 
                    ? `Damage / Return Reasons:\n• ${combinedDmgReasonsList.join('\n• ')}` 
                    : 'No damage reasons logged';

                  return (
                    <tr
                      key={recId || idx}
                      onClick={() => setSelectedRowId(isSelected ? null : recId)}
                      className={`border-b border-gray-200 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-100/70 font-medium'
                          : isLow ? 'bg-red-50/70 hover:bg-red-100/70' : (idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50')
                      }`}
                    >
                      {isMultiSelectMode && (
                        <td className="border-r border-gray-200 p-2 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(recId)}
                            onChange={() => handleToggleSelect(recId)}
                            className="w-4 h-4 rounded cursor-pointer accent-red-600"
                          />
                        </td>
                      )}
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{item.itemCode}</td>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-semibold text-slate-700">{item.vendorItemCode || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-gray-800">
                        <div className="font-bold">{item.name} {item.group && <span className="text-[10px] font-normal text-gray-400 ml-2">({item.group})</span>}</div>
                      </td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.department || item.group || 'General'}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.uom || 'PCS'}</td>
                      <td className={`border-r border-gray-200 p-2 text-right font-mono font-black text-sm ${isLow ? 'text-red-600' : 'text-blue-700'}`}>
                        {isLow && <AlertTriangle size={12} className="inline mr-1 -mt-1 text-red-500" />}
                        <div>{qty}</div>
                        {Number(item.pendingOrderQty) > 0 && (
                          <div className="text-[10px] text-amber-600 font-bold whitespace-nowrap leading-none mt-1">
                            ({item.pendingOrderQty} {item.uom || 'PCS'} in sales order)
                          </div>
                        )}
                      </td>
                      <td 
                        className="border-r border-gray-200 p-2 text-right font-mono font-bold text-red-600 bg-red-50/10 cursor-help"
                        title={hoverTitle}
                      >
                        {item.damagedStock || 0}
                      </td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-xs text-gray-500">{minReorder}</td>
                      <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item);
                            setSingleDeleteModalOpen(true);
                          }}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-1.5 rounded transition-colors cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
          <div className="text-sm font-bold text-blue-200">
            Total Items Listed: {filteredStock.length}
            {isMultiSelectMode && selectedIds.length > 0 && ` (${selectedIds.length} Selected)`}
          </div>
        </div>

      </div>

      {/* Single Item Delete Confirmation Modal */}
      {singleDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setSingleDeleteModalOpen(false); setItemToDelete(null); }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white px-4 py-3 font-bold text-sm flex justify-between items-center shadow">
              <span>Confirm Deletion</span>
              <button onClick={() => { setSingleDeleteModalOpen(false); setItemToDelete(null); }} className="text-white hover:text-red-200 text-lg font-bold leading-none cursor-pointer">✕</button>
            </div>
            <div className="p-4 text-sm text-slate-700 space-y-3">
              <p className="font-semibold text-slate-800">Are you sure you want to delete this product?</p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700 space-y-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-gray-500">Item Code:</span>
                  <span className="font-mono font-bold text-slate-900">{itemToDelete.itemCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Product Name:</span>
                  <span className="font-semibold text-slate-800">{itemToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category / Variety:</span>
                  <span className="font-medium text-slate-700">{itemToDelete.department || '-'} / {itemToDelete.variety || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Available Stock:</span>
                  <span className="font-mono font-bold text-blue-700">{itemToDelete.stock || 0} {itemToDelete.uom || 'PCS'}</span>
                </div>
              </div>
              <p className="text-xs text-red-600 font-bold">⚠️ Warning: This action will permanently remove the product from the database.</p>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => { setSingleDeleteModalOpen(false); setItemToDelete(null); }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deletingSingle}
                onClick={handleConfirmSingleDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded text-xs font-bold shadow transition-colors cursor-pointer"
              >
                {deletingSingle ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal (Requires typing CONFIRM DELETE) */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
            <div className="bg-red-700 text-white px-4 py-3 font-bold text-sm flex justify-between items-center shadow">
              <span>Bulk Delete Confirmation ({selectedIds.length} Selected)</span>
              <button onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }} className="text-white hover:text-red-200 text-lg font-bold leading-none cursor-pointer">✕</button>
            </div>
            <div className="p-4 text-sm text-slate-700 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-xs font-medium space-y-1">
                <div className="font-bold flex items-center gap-1 text-sm">⚠️ High Risk Action</div>
                <div>You are about to permanently delete <strong>{selectedIds.length}</strong> selected products from the database.</div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Type <span className="font-mono text-red-600 font-extrabold select-all">CONFIRM DELETE</span> below to unlock deletion:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={bulkConfirmText}
                  onChange={(e) => setBulkConfirmText(e.target.value)}
                  placeholder="Type CONFIRM DELETE"
                  className="w-full border border-red-300 rounded px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase tracking-wider bg-red-50/20"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => { setBulkDeleteModalOpen(false); setBulkConfirmText(''); }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={bulkConfirmText.trim().toUpperCase() !== 'CONFIRM DELETE' || deletingBulk}
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed text-white rounded text-xs font-bold shadow transition-colors cursor-pointer"
              >
                {deletingBulk ? 'Deleting...' : `Confirm Bulk Delete (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockStatus;