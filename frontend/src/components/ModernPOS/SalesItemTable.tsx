import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Search, Scan, Hash, Box, ArrowUpDown, ChevronDown } from 'lucide-react';

export interface InvoiceItem {
  id: string | number;
  barcode: string;
  itemName: string;
  size: string;
  qty: number;
  rate: number;
  amount: number;
  stock?: number;
}

interface SalesItemTableProps {
  items: InvoiceItem[];
  setItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  onAddRow: () => void;
  onRemoveRow: (id: string | number) => void;
  availableProducts?: any[];
}

export const SalesItemTable: React.FC<SalesItemTableProps> = ({
  items,
  setItems,
  onAddRow,
  onRemoveRow,
  availableProducts = []
}) => {
  const [rapidScanInput, setRapidScanInput] = useState('');
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | number | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Rapid Barcode Scanner handler
  const handleRapidScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && rapidScanInput.trim()) {
      const query = rapidScanInput.trim().toLowerCase();
      const matched = availableProducts.find(p => 
        (p.barcode && p.barcode.toLowerCase() === query) || 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.code && p.code.toLowerCase() === query)
      );

      if (matched) {
        // Add or update existing row
        setItems(prev => {
          const existingIdx = prev.findIndex(item => item.barcode === matched.barcode || item.itemName === matched.name);
          if (existingIdx >= 0) {
            const updated = [...prev];
            const newQty = updated[existingIdx].qty + 1;
            updated[existingIdx] = {
              ...updated[existingIdx],
              qty: newQty,
              amount: newQty * updated[existingIdx].rate
            };
            return updated;
          } else {
            // Replace empty first row or append new row
            const emptyIdx = prev.findIndex(item => !item.itemName && item.qty === 0);
            const newRow: InvoiceItem = {
              id: emptyIdx >= 0 ? prev[emptyIdx].id : Date.now(),
              barcode: matched.barcode || matched.code || 'BAR-001',
              itemName: matched.name,
              size: matched.size || matched.unit || 'Standard',
              qty: 1,
              rate: matched.sellingPrice || matched.price || matched.saleRate || 100,
              amount: matched.sellingPrice || matched.price || matched.saleRate || 100,
              stock: matched.currentStock || matched.stock || 50
            };

            if (emptyIdx >= 0) {
              const updated = [...prev];
              updated[emptyIdx] = newRow;
              return updated;
            }
            return [...prev, newRow];
          }
        });
        setRapidScanInput('');
      } else {
        // Fallback demo row if barcode unknown
        const newRow: InvoiceItem = {
          id: Date.now(),
          barcode: rapidScanInput.toUpperCase(),
          itemName: `Item ${rapidScanInput}`,
          size: 'M',
          qty: 1,
          rate: 150,
          amount: 150,
          stock: 25
        };
        setItems(prev => [...prev.filter(r => r.itemName || r.qty > 0), newRow]);
        setRapidScanInput('');
      }
    }
  };

  const handleCellChange = (id: string | number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const qty = field === 'qty' ? Number(value) || 0 : item.qty;
          const rate = field === 'rate' ? Number(value) || 0 : item.rate;
          updated.amount = qty * rate;
        }
        return updated;
      }
      return item;
    }));
  };

  const selectProductForRow = (rowId: string | number, prod: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === rowId) {
        const rate = prod.sellingPrice || prod.price || prod.saleRate || 100;
        const qty = item.qty > 0 ? item.qty : 1;
        return {
          ...item,
          barcode: prod.barcode || prod.code || 'BAR-' + prod.id,
          itemName: prod.name,
          size: prod.size || prod.unit || 'Standard',
          rate: rate,
          qty: qty,
          amount: qty * rate,
          stock: prod.currentStock || prod.stock || 50
        };
      }
      return item;
    }));
    setActiveSearchRowId(null);
  };

  return (
    <div className="apple-glass-card rounded-2xl overflow-hidden flex flex-col transition-all duration-300 shadow-lg border border-slate-200/80">
      
      {/* Table Bar / Search Header */}
      <div className="p-4 bg-white/40 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          {/* Rapid Scanner Input */}
          <div className="relative flex-1">
            <Scan size={16} className="absolute left-3.5 top-3 text-blue-500 animate-pulse" />
            <input
              ref={scanInputRef}
              type="text"
              value={rapidScanInput}
              onChange={(e) => setRapidScanInput(e.target.value)}
              onKeyDown={handleRapidScan}
              className="apple-input w-full pl-10 pr-4 text-xs font-mono bg-white/90"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Items: {items.filter(i => i.itemName).length}
          </span>

          <button
            onClick={onAddRow}
            className="apple-button-primary py-2 px-3.5 text-xs shadow-blue-500/20"
          >
            <Plus size={15} />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Main Dynamic Data Table */}
      <div className="overflow-x-auto min-h-[300px] max-h-[480px] custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 backdrop-blur-md z-10">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 w-36">Barcode</th>
              <th className="py-3 px-4">Item Name</th>
              <th className="py-3 px-4 w-28">Size</th>
              <th className="py-3 px-4 w-28 text-right">Qty (PCS)</th>
              <th className="py-3 px-4 w-32 text-right">Rate (₹)</th>
              <th className="py-3 px-4 w-36 text-right">Amount (₹)</th>
              <th className="py-3 px-4 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.map((row, index) => {
              const matchingProds = availableProducts.filter(p => 
                row.itemName && p.name.toLowerCase().includes(row.itemName.toLowerCase())
              );

              return (
                <tr 
                  key={row.id} 
                  className="hover:bg-blue-50/40 transition-colors group"
                >
                  {/* Row Number */}
                  <td className="py-2.5 px-4 text-center text-xs font-medium text-slate-400">
                    {index + 1}
                  </td>

                  {/* Barcode Column */}
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={row.barcode}
                      onChange={(e) => handleCellChange(row.id, 'barcode', e.target.value)}
                      className="w-full bg-slate-50/60 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-700 focus:outline-none transition-all"
                    />
                  </td>

                  {/* Item Name Column with Live Search Dropdown */}
                  <td className="py-2.5 px-4 relative">
                    <input
                      type="text"
                      value={row.itemName}
                      onFocus={() => setActiveSearchRowId(row.id)}
                      onChange={(e) => {
                        handleCellChange(row.id, 'itemName', e.target.value);
                        setActiveSearchRowId(row.id);
                      }}
                      className="w-full bg-transparent focus:bg-white border border-transparent focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:outline-none transition-all"
                    />

                    {/* Live Search Popup */}
                    {activeSearchRowId === row.id && row.itemName && matchingProds.length > 0 && (
                      <div className="absolute left-4 right-4 top-full mt-1 apple-glass-card rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {matchingProds.map((prod, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => selectProductForRow(row.id, prod)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-slate-800">{prod.name}</span>
                              <span className="text-[10px] text-slate-400 ml-2">Size: {prod.size || prod.unit || 'Std'}</span>
                            </div>
                            <span className="font-mono font-medium text-blue-600">₹{prod.sellingPrice || prod.price || 100}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Size Column */}
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={row.size}
                      onChange={(e) => handleCellChange(row.id, 'size', e.target.value)}
                      className="w-full bg-slate-50/60 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none transition-all"
                    />
                  </td>

                  {/* Qty Column */}
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="number"
                      min="1"
                      value={row.qty || ''}
                      onChange={(e) => handleCellChange(row.id, 'qty', e.target.value)}
                      className="w-20 bg-blue-50/50 focus:bg-white border border-blue-200/60 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 text-right focus:outline-none transition-all"
                    />
                  </td>

                  {/* Rate Column */}
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={row.rate || ''}
                      onChange={(e) => handleCellChange(row.id, 'rate', e.target.value)}
                      className="w-24 bg-slate-50/60 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 text-right focus:outline-none transition-all"
                    />
                  </td>

                  {/* Amount Column */}
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 text-xs">
                    ₹{row.amount ? row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </td>

                  {/* Action Delete */}
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => onRemoveRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Remove Item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                  No items added yet. Click "Add Row" or scan barcode above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
