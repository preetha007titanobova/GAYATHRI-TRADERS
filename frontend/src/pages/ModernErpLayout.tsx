import React, { useState } from 'react';
import { 
  Search, Home, Box, ShoppingCart, Truck, PieChart, 
  ChevronDown, ChevronRight, FileDown, Printer, Mail, 
  User, Calendar 
} from 'lucide-react';

// Types
interface StockItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentQty: number;
  minReorder: number;
  purchaseRate: number;
}

const MOCK_DATA: StockItem[] = [
  { id: '1', code: 'ACC-001', name: 'Wireless Mouse (Logitech)', unit: 'Nos', currentQty: 45, minReorder: 10, purchaseRate: 450 },
  { id: '2', code: 'ACC-002', name: 'USB-C Hub (Anker)', unit: 'Nos', currentQty: 5, minReorder: 15, purchaseRate: 1200 },
  { id: '3', code: 'ACC-003', name: 'Mechanical Keyboard (Keychron)', unit: 'Nos', currentQty: 0, minReorder: 5, purchaseRate: 2500 },
  { id: '4', code: 'ACC-004', name: 'Laptop Sleeve 14"', unit: 'Nos', currentQty: 22, minReorder: 10, purchaseRate: 350 },
  { id: '5', code: 'ACC-005', name: 'HDMI Cable 2m', unit: 'Nos', currentQty: 8, minReorder: 20, purchaseRate: 150 },
];

const ModernErpLayout = () => {
  // Navigation State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inventory: true,
    sales: false,
    purchases: false,
    finance: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [category, setCategory] = useState('Accessories');

  // Filter logic
  const filteredData = MOCK_DATA.filter(item => {
    if (hideZero && item.currentQty <= 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.code.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalValuation = filteredData.reduce((sum, item) => sum + (item.currentQty * item.purchaseRate), 0);

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Left Sidebar (Navigation) - Dark blue/slate theme */}
      <aside className="w-64 flex flex-col h-full bg-slate-900 text-slate-300 transition-all duration-300 shadow-xl z-20">
        <div className="flex items-center justify-center p-5 border-b border-slate-700/50 h-16 box-border">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Box className="text-blue-400" size={24} />
            <span>ERP System</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          
          {/* Dashboard */}
          <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Home size={18} className="mr-3 text-slate-400" />
            Dashboard
          </button>

          {/* Inventory */}
          <div className="pt-2">
            <button 
              onClick={() => toggleSection('inventory')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors"
            >
              <div className="flex items-center">
                <Box size={18} className="mr-3 text-slate-400" />
                Inventory
              </div>
              {expandedSections.inventory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {expandedSections.inventory && (
              <div className="pl-9 pr-3 py-1 space-y-1">
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Item Master</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md bg-blue-600 text-white font-medium shadow-md shadow-blue-900/20">Stock Status</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Stock Register</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Barcode Generation</a>
              </div>
            )}
          </div>

          {/* Sales */}
          <div className="pt-2">
            <button 
              onClick={() => toggleSection('sales')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors"
            >
              <div className="flex items-center">
                <ShoppingCart size={18} className="mr-3 text-slate-400" />
                Sales
              </div>
              {expandedSections.sales ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {expandedSections.sales && (
              <div className="pl-9 pr-3 py-1 space-y-1">
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Quotation</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Sales Order</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Sales Bill</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Sales Return</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Register</a>
              </div>
            )}
          </div>

          {/* Purchases */}
          <div className="pt-2">
            <button 
              onClick={() => toggleSection('purchases')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors"
            >
              <div className="flex items-center">
                <Truck size={18} className="mr-3 text-slate-400" />
                Purchases
              </div>
              {expandedSections.purchases ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {expandedSections.purchases && (
              <div className="pl-9 pr-3 py-1 space-y-1">
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Purchase Bill</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Return</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Register</a>
              </div>
            )}
          </div>

          {/* Finance */}
          <div className="pt-2">
            <button 
              onClick={() => toggleSection('finance')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors"
            >
              <div className="flex items-center">
                <PieChart size={18} className="mr-3 text-slate-400" />
                Finance
              </div>
              {expandedSections.finance ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {expandedSections.finance && (
              <div className="pl-9 pr-3 py-1 space-y-1">
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Ledger</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Cash/Bank Book</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">P&L</a>
                <a href="#" className="block px-3 py-2 text-sm rounded-md hover:text-white hover:bg-slate-800 transition-colors">Balance Sheet</a>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 z-10 shadow-sm">
          
          <div className="flex items-center flex-1">
            {/* Global Search */}
            <div className="relative w-64 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Global search..."
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <span className="font-bold text-gray-800 tracking-wide">Sri Gayathri Traders</span>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
              <Calendar size={16} className="text-gray-400" />
              <select className="bg-transparent focus:outline-none font-medium cursor-pointer">
                <option>2026-2027</option>
                <option>2025-2026</option>
              </select>
            </div>

            <button className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 border border-blue-200">
                <User size={16} />
              </div>
              <span>Admin</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 flex flex-col relative z-0 p-6 pb-24">
          
          <div className="max-w-7xl mx-auto w-full space-y-6">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Status & Valuation</h2>
              
              <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                <button className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20">
                  <FileDown size={16} className="mr-2 text-gray-500" />
                  Export CSV
                </button>
                <button className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20">
                  <Printer size={16} className="mr-2 text-gray-500" />
                  Print
                </button>
                <button className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20">
                  <Mail size={16} className="mr-2 text-gray-500" />
                  Email Report
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4">
              
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Category:</span>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-40 pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option>Accessories</option>
                  <option>Electronics</option>
                  <option>Hardware</option>
                </select>
              </div>

              <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

              <div className="relative flex-1 min-w-[200px] max-w-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search Item Code/Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

              <label className="flex items-center space-x-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={hideZero}
                    onChange={(e) => setHideZero(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Hide Zero Balance</span>
              </label>

            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Code</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th scope="col" className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Qty</th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Reorder Level</th>
                      <th scope="col" className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase Rate (₹)</th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Valuation (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredData.map((item) => {
                      const isLowStock = item.currentQty <= item.minReorder;
                      const valuation = item.currentQty * item.purchaseRate;
                      
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-gray-50 transition-colors duration-150 ${isLowStock ? 'bg-red-50/30' : ''}`}
                        >
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isLowStock ? 'text-red-800' : 'text-gray-900'}`}>
                            {item.code}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isLowStock ? 'text-red-800' : 'text-gray-700'}`}>
                            {item.name}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${isLowStock ? 'text-red-600' : 'text-gray-500'}`}>
                            {item.unit}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right tabular-nums ${isLowStock ? 'text-red-700' : 'text-gray-900'}`}>
                            {item.currentQty}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums ${isLowStock ? 'text-red-500' : 'text-gray-500'}`}>
                            {item.minReorder}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums ${isLowStock ? 'text-red-700' : 'text-gray-700'}`}>
                            {item.purchaseRate.toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right tabular-nums ${isLowStock ? 'text-red-800' : 'text-gray-900'}`}>
                            {valuation.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 bg-gray-50/50">
                          <p className="text-sm font-medium">No items found matching the current filters.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>

        {/* Footer Panel - Sticky bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-8 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="text-slate-300 font-medium">
            Total Items Listed: <span className="text-white ml-1 font-bold">{filteredData.length}</span>
          </div>
          <div className="flex items-center space-x-4 bg-slate-800 px-6 py-2 rounded-lg border border-slate-700 shadow-inner">
            <span className="text-slate-400 text-sm font-bold tracking-wider uppercase">Total Stock Valuation:</span>
            <span className="text-2xl font-black text-yellow-400 drop-shadow-sm tabular-nums">
              ₹ {totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ModernErpLayout;
