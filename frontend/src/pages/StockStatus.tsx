import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PackageSearch, AlertTriangle, Search, Filter } from 'lucide-react';

interface StockItem {
  id?: string;
  _id?: string;
  itemCode: string;
  name: string;
  group?: string;
  uom: string;
  stock: number;
  minReorder?: number;
  purchaseRate: number;
}

const GROUPS = ['All', 'Electronics', 'Hardware', 'Accessories'];

const StockStatus = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [hideZero, setHideZero] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/items/search?q=');
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

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Stock Status Report...', type: 'info' });
      },
      onFind: () => {
        const searchInput = document.getElementById('stock-search-input');
        if (searchInput) searchInput.focus();
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const filteredStock = useMemo(() => {
    return inventory.filter(item => {
      // Group filtering is mocked as backend might not support it yet
      // if (selectedGroup !== 'All' && item.group !== selectedGroup) return false;
      
      const qty = item.stock || 0;
      if (hideZero && qty <= 0) return false;
      
      if (search) {
        const q = search.toLowerCase();
        const code = item.itemCode?.toLowerCase() || '';
        const name = item.name?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [inventory, search, selectedGroup, hideZero]);

  const totalValuation = useMemo(() => {
    return filteredStock.reduce((sum, item) => sum + ((item.stock || 0) * (item.purchaseRate || 0)), 0);
  }, [filteredStock]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Stock Status (Valuation)
          </h2>

          <div className="flex items-center space-x-4 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
             <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
               <Filter size={16} className="text-gray-500" />
               <select 
                 value={selectedGroup} 
                 onChange={e => setSelectedGroup(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer"
               >
                 {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
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
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Item Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Item Name</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-20 text-center">Unit</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Current Qty</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Min Reorder</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right">Pur. Rate (₹)</th>
                <th className="p-2 text-xs font-semibold w-36 text-right">Valuation (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    Loading stock data...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <PackageSearch size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No items found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const qty = item.stock || 0;
                  const minReorder = item.minReorder || 10; // Defaulting to 10 if not set
                  const purchaseRate = item.purchaseRate || 0;
                  const isLow = qty < minReorder;
                  const val = qty * purchaseRate;
                  
                  return (
                    <tr key={item.id || item._id || idx} className={`border-b border-gray-200 transition-colors ${isLow ? 'bg-red-50/70 hover:bg-red-100/70' : (idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50')}`}>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{item.itemCode}</td>
                      <td className="border-r border-gray-200 p-2 font-bold text-gray-800">{item.name} {item.group && <span className="text-[10px] font-normal text-gray-400 ml-2">({item.group})</span>}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.uom || 'PCS'}</td>
                      <td className={`border-r border-gray-200 p-2 text-right font-mono font-black text-sm ${isLow ? 'text-red-600' : 'text-blue-700'}`}>
                        {isLow && <AlertTriangle size={12} className="inline mr-1 -mt-1 text-red-500" />}
                        {qty}
                      </td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-xs text-gray-500">{minReorder}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-gray-700">{purchaseRate.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-gray-900 bg-gray-50/50">{val.toFixed(2)}</td>
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
          </div>

          <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
             <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Total Stock Valuation</span>
             <span className="font-mono text-2xl font-black text-yellow-300 drop-shadow-md">₹ {totalValuation.toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StockStatus;