import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Search, Trash2, Printer, Download, FileDown, CheckSquare, Square, AlertTriangle, RefreshCw } from 'lucide-react';
import Api from '../Api';

interface SavedBarcodeItem {
  id: string;
  productName: string;
  barcodeValue: string;
  department: string;
  variety: string;
  size: string;
  batchNo: string;
  mrp: number | '';
  salesPrice: number | '';
  mfgDate: string;
  expDate: string;
  barcodeType: string;
  printCount: number | '';
  createdAt: string;
}

const BarcodeRegister = () => {
  const navigate = useNavigate();

  // --- STATE ---
  const [savedBarcodes, setSavedBarcodes] = useState<SavedBarcodeItem[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMultiple, setIsSelectMultiple] = useState(false);

  // Delete Modal State
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Load saved barcodes on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('saved_barcodes_list');
      if (stored) {
        setSavedBarcodes(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load saved barcodes:', e);
    }
  }, []);

  const saveToStorage = (items: SavedBarcodeItem[]) => {
    setSavedBarcodes(items);
    localStorage.setItem('saved_barcodes_list', JSON.stringify(items));
  };

  // Filter items
  const filteredBarcodes = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return savedBarcodes;
    return savedBarcodes.filter(item =>
      (item.productName || '').toLowerCase().includes(q) ||
      (item.barcodeValue || '').toLowerCase().includes(q) ||
      (item.department || '').toLowerCase().includes(q) ||
      (item.variety || '').toLowerCase().includes(q) ||
      (item.batchNo || '').toLowerCase().includes(q)
    );
  }, [savedBarcodes, tableSearch]);

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredBarcodes.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Single Delete
  const handleConfirmSingleDelete = () => {
    if (!singleDeleteId) return;
    if (deleteConfirmInput !== 'CONFIRM DELETE') return;

    const updated = savedBarcodes.filter(i => i.id !== singleDeleteId);
    saveToStorage(updated);
    setSelectedIds(prev => prev.filter(i => i !== singleDeleteId));
    setSingleDeleteId(null);
    setDeleteConfirmInput('');
  };

  // Bulk Delete
  const handleConfirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (deleteConfirmInput !== 'CONFIRM DELETE') return;

    const updated = savedBarcodes.filter(i => !selectedIds.includes(i.id));
    saveToStorage(updated);
    setSelectedIds([]);
    setIsBulkDeleteModalOpen(false);
    setDeleteConfirmInput('');
  };

  // Direct TSPL Print helper
  const handleDirectTSPLPrint = async (item: SavedBarcodeItem) => {
    const code = item.barcodeValue || '100002';
    const name = (item.productName || 'Item').toUpperCase();
    const sizeStr = item.size || 'L';
    const mrpStr = item.mrp ? Number(item.mrp).toFixed(2) : '0.00';
    const count = item.printCount || 1;

    const tsplCmd = `
SIZE 100 mm, 25 mm
GAP 2 mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
SET CUTTER OFF
SET PARTIAL_CUTTER OFF
CLS

TEXT 100,10,"3",0,1,1,"${name.substring(0, 18)}"
BARCODE 100,35,"128",40,1,0,2,4,"${code}"
TEXT 100,85,"2",0,1,1,"Size: ${sizeStr}  MRP: Rs.${mrpStr}"

TEXT 420,10,"3",0,1,1,"${name.substring(0, 18)}"
BARCODE 420,35,"128",40,1,0,2,4,"${code}"
TEXT 420,85,"2",0,1,1,"Size: ${sizeStr}  MRP: Rs.${mrpStr}"

TEXT 740,10,"3",0,1,1,"${name.substring(0, 18)}"
BARCODE 740,35,"128",40,1,0,2,4,"${code}"
TEXT 740,85,"2",0,1,1,"Size: ${sizeStr}  MRP: Rs.${mrpStr}"

PRINT 1,${count}
`;

    if ((window as any).api && (window as any).api.send) {
      (window as any).api.send('print-tspl-raw', { tsplString: tsplCmd, printerName: 'TSC TE244' });
    } else {
      alert('TSPL Hardware Print requires Electron desktop application environment.');
    }
  };

  const isAllSelected = filteredBarcodes.length > 0 && selectedIds.length === filteredBarcodes.length;

  return (
    <div className="flex flex-col h-full bg-slate-100 relative overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-500 p-2 rounded-lg text-slate-950 shadow">
            <Tag size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide uppercase">Barcode Register & History</h1>
            <p className="text-xs text-slate-300">Manage saved barcodes, bulk delete master records & reprint labels</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/barcode-generation')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-md text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Tag size={14} />
            <span>+ Generate New Barcode</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col space-y-4">
        {/* Filter and Action Toolbar */}
        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative w-72">
              <input
                type="text"
                placeholder="Search barcode, product name, variety..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <span className="bg-blue-50 border border-blue-200 text-blue-900 font-extrabold text-xs px-2.5 py-1 rounded-md">
              {filteredBarcodes.length} Records Found
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setIsSelectMultiple(!isSelectMultiple);
                if (isSelectMultiple) setSelectedIds([]);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                isSelectMultiple ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-inner' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {isSelectMultiple ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isSelectMultiple ? 'Cancel Multi-Select' : 'Select Multiple'}</span>
            </button>

            {isSelectMultiple && (
              <button
                disabled={selectedIds.length === 0}
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  selectedIds.length > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 size={14} />
                <span>Bulk Delete ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Barcode Table */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                <tr>
                  {isSelectMultiple && (
                    <th className="p-2.5 border-r border-slate-800 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="p-2.5 border-r border-slate-800 text-center w-12">S.No</th>
                  <th className="p-2.5 border-r border-slate-800">Barcode Number</th>
                  <th className="p-2.5 border-r border-slate-800">Product Name</th>
                  <th className="p-2.5 border-r border-slate-800">Category</th>
                  <th className="p-2.5 border-r border-slate-800">Variety</th>
                  <th className="p-2.5 border-r border-slate-800 text-center">Size</th>
                  <th className="p-2.5 border-r border-slate-800 text-right">MRP (₹)</th>
                  <th className="p-2.5 border-r border-slate-800 text-right">Sale Price (₹)</th>
                  <th className="p-2.5 border-r border-slate-800">Batch No</th>
                  <th className="p-2.5 border-r border-slate-800 text-center">Print Qty</th>
                  <th className="p-2.5 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBarcodes.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMultiple ? 12 : 11} className="p-12 text-center text-slate-400 italic bg-slate-50">
                      No saved barcodes found in register.
                    </td>
                  </tr>
                ) : (
                  filteredBarcodes.map((item, idx) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-indigo-50/90 font-semibold' : 'hover:bg-blue-50/50'
                        }`}
                      >
                        {isSelectMultiple && (
                          <td className="p-2.5 text-center border-r border-slate-200">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(item.id)}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="p-2.5 text-center border-r border-slate-200 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-2.5 border-r border-slate-200 font-mono font-extrabold text-blue-900 bg-yellow-50/60">
                          {item.barcodeValue}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">{item.productName}</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-700">{item.department || 'General'}</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-700">{item.variety || 'Standard'}</td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold text-blue-800 bg-blue-50/40">
                          {item.size || 'L'}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right font-mono text-slate-700">
                          ₹{Number(item.mrp || 0).toFixed(2)}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                          ₹{Number(item.salesPrice || 0).toFixed(2)}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-mono text-slate-600">{item.batchNo || '-'}</td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-900">{item.printCount || 1}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* TSPL DIRECT PRINT */}
                            <button
                              type="button"
                              title="Hardware Print to TSC TE244 Printer"
                              onClick={() => handleDirectTSPLPrint(item)}
                              className="bg-purple-600 hover:bg-purple-700 text-white p-1 rounded shadow transition-all active:scale-95 cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>

                            {/* DELETE BUTTON */}
                            <button
                              type="button"
                              title="Delete from Register"
                              onClick={() => {
                                setSingleDeleteId(item.id);
                                setDeleteConfirmInput('');
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded shadow transition-all active:scale-95 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SINGLE DELETE MODAL WITH CONFIRMATION */}
      {singleDeleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={18} />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Confirm Barcode Delete</h3>
              </div>
              <button
                onClick={() => {
                  setSingleDeleteId(null);
                  setDeleteConfirmInput('');
                }}
                className="text-white hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to delete this saved barcode record?
              </p>
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900 font-semibold">
                To prevent accidental deletion, please type <strong className="font-black underline select-none text-rose-700">CONFIRM DELETE</strong> below:
              </div>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder="Type CONFIRM DELETE"
                className="w-full border border-slate-300 p-2 rounded-md font-mono font-bold text-center text-sm outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                autoFocus
              />

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setSingleDeleteId(null);
                    setDeleteConfirmInput('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-md font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmInput !== 'CONFIRM DELETE'}
                  onClick={handleConfirmSingleDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-extrabold shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE MODAL WITH CONFIRMATION */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={18} />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Confirm Bulk Delete ({selectedIds.length})</h3>
              </div>
              <button
                onClick={() => {
                  setIsBulkDeleteModalOpen(false);
                  setDeleteConfirmInput('');
                }}
                className="text-white hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                You have selected <strong className="font-extrabold text-rose-700">{selectedIds.length}</strong> barcode items for bulk deletion. This action cannot be undone.
              </p>
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900 font-semibold">
                To confirm bulk deletion, please type <strong className="font-black underline select-none text-rose-700">CONFIRM DELETE</strong> below:
              </div>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder="Type CONFIRM DELETE"
                className="w-full border border-slate-300 p-2 rounded-md font-mono font-bold text-center text-sm outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                autoFocus
              />

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkDeleteModalOpen(false);
                    setDeleteConfirmInput('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-md font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmInput !== 'CONFIRM DELETE'}
                  onClick={handleConfirmBulkDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-extrabold shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete Selected ({selectedIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeRegister;
