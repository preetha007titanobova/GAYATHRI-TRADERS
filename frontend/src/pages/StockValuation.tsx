import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { PackageSearch, Search, Filter, Printer } from 'lucide-react';
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
}

const StockValuation = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
  }>();

  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);

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

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Stock Valuation Report...', type: 'info' });
      },
      onFind: () => {
        const searchInput = document.getElementById('valuation-search-input');
        if (searchInput) searchInput.focus();
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

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
  }, [inventory, search, hideZero]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalValuation = 0;
    filteredStock.forEach(item => {
      const qty = Math.max(0, item.stock || 0);
      const pRate = Number(item.purchaseRate) || 0;
      totalQty += qty;
      totalValuation += qty * pRate;
    });
    return { totalQty, totalValuation };
  }, [filteredStock]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">

      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">

        <div className="flex items-center space-x-6">
          <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            Stock Valuation Statement
          </h2>

          <div className="flex items-center space-x-4 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <Filter size={16} className="text-gray-500" />
            </div>

            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <Search size={16} className="text-gray-400" />
              <input
                id="valuation-search-input"
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

        <button 
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded text-xs shadow border border-emerald-800 transition-colors"
        >
          <Printer size={14} />
          <span>Print Valuation</span>
        </button>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Our Item Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Vendor Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Item Name</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Category</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Variety</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-20 text-center">Size</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-20 text-center">Unit</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Available stock</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Purchase Rate</th>
                <th className="p-2 text-xs font-semibold w-32 text-right">Valuation Amt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-500">
                    Loading valuation logs...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <PackageSearch size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No items found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const qty = Math.max(0, item.stock || 0);
                  const pRate = Number(item.purchaseRate) || 0;
                  const valuationAmt = qty * pRate;

                  return (
                    <tr key={item.id || item._id || idx} className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'}`}>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{item.itemCode}</td>
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-semibold text-slate-700">{item.vendorItemCode || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-gray-800 font-bold">{item.name}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.department || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.variety || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.size || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.uom || 'PCS'}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-blue-700">{qty}</td>
                      <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-gray-700">₹ {pRate.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-black text-gray-900 bg-gray-50/50">₹ {valuationAmt.toFixed(2)}</td>
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
            Total Items: {filteredStock.length}
          </div>
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Total Qty:</span>
              <span className="font-mono text-lg font-black text-white">{totals.totalQty}</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#142d54] px-4 py-1 rounded border border-[#0d1e38]">
              <span className="text-xs font-bold text-yellow-200 uppercase tracking-widest">Total Valuation:</span>
              <span className="font-mono text-xl font-black text-yellow-300">₹ {totals.totalValuation.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StockValuation;
