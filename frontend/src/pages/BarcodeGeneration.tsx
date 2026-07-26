import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Save, RotateCcw, Download, Trash2, Plus, Search, Package, Check, Tag, FileDown } from 'lucide-react';
import Api from '../Api';
import { useLicense } from '../context/LicenseContext';

interface Product {
  id?: string;
  _id?: string;
  itemCode: string;
  name: string;
  barcode?: string;
  department?: string;
  variety?: string;
  size?: string;
  mrp?: number;
  price?: number;
  uom?: string;
}

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

const CODE39_MAP: { [key: string]: string } = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

function generateCode39Bars(text: string): { width: number; type: 'bar' | 'space' }[] {
  const cleanText = text.toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, '');
  const formatted = `*${cleanText}*`;
  const result: { width: number; type: 'bar' | 'space' }[] = [];

  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    const pattern = CODE39_MAP[char];
    if (!pattern) continue;

    for (let j = 0; j < 9; j++) {
      const isWide = pattern[j] === '1';
      const isBar = j % 2 === 0;
      result.push({
        width: isWide ? 2.5 : 1,
        type: isBar ? 'bar' : 'space'
      });
    }
    if (i < formatted.length - 1) {
      result.push({
        width: 1,
        type: 'space'
      });
    }
  }
  return result;
}

const BarcodeGeneration = () => {
  const { shopName } = useLicense();
  // --- Form States ---
  const [productName, setProductName] = useState("Men's Shirt");
  const [barcodeValue, setBarcodeValue] = useState('100002');
  const [department, setDepartment] = useState('Mens');
  const [variety, setVariety] = useState('Formal');
  const [size, setSize] = useState('L');
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDate, setExpDate] = useState('');
  const [batchNo, setBatchNo] = useState('BATCH-1001');
  const [mrp, setMrp] = useState<number | ''>(799);
  const [salesPrice, setSalesPrice] = useState<number | ''>(799);
  const [barcodeType, setBarcodeType] = useState('Code 128');
  const [printCount, setPrintCount] = useState<number | ''>(1);

  // --- Item Master Integration States ---
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- Saved Barcodes Table State ---
  const [savedBarcodes, setSavedBarcodes] = useState<SavedBarcodeItem[]>(() => {
    try {
      const stored = localStorage.getItem('saved_barcodes_list');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: '100002-seed',
        productName: "Men's Shirt",
        barcodeValue: '100002',
        department: 'Mens',
        variety: 'Formal',
        size: 'L',
        batchNo: 'BATCH-1001',
        mrp: 799,
        salesPrice: 799,
        mfgDate: new Date().toISOString().split('T')[0],
        expDate: '',
        barcodeType: 'Code 128',
        printCount: 1,
        createdAt: new Date().toLocaleString()
      }
    ];
  });

  const [tableSearch, setTableSearch] = useState('');

  // Global Context
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  // Fetch Item Master saved list on mount
  useEffect(() => {
    fetch(`${Api}/products/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Error fetching item master:", err));
  }, []);

  // Save barcodes list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('saved_barcodes_list', JSON.stringify(savedBarcodes));
    } catch (e) {
      console.error(e);
    }
  }, [savedBarcodes]);

  // Filtered Item Master List
  const filteredItemMaster = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    if (!q) return availableProducts.slice(0, 15);
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      (p as any).vendorItemCode?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.variety?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q)
    );
  }, [availableProducts, itemSearch]);

  // Handle selecting item from Item Master
  const handleSelectProduct = (prod: Product) => {
    setProductName(prod.name);
    setBarcodeValue(prod.barcode || prod.itemCode || `BC-${Date.now().toString().slice(-6)}`);
    setDepartment(prod.department || 'General');
    setVariety(prod.variety || 'Standard');
    setSize(prod.size || 'L');
    setMrp(prod.mrp || prod.price || 0);
    setSalesPrice(prod.price || prod.mrp || 0);
    setBatchNo(`BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowItemDropdown(false);
    setItemSearch('');

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `Loaded product: ${prod.name} (Barcode: ${prod.barcode || prod.itemCode})`, type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Generate random barcode
  const handleGenerateRandomBarcode = () => {
    const randomCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    setBarcodeValue(randomCode);
  };

  const handleClear = () => {
    setProductName('');
    setBarcodeValue('');
    setDepartment('');
    setVariety('');
    setSize('');
    setMfgDate('');
    setExpDate('');
    setBatchNo('');
    setMrp('');
    setSalesPrice('');
    setBarcodeType('Code 128');
    setPrintCount(1);
    setItemSearch('');
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Form cleared.", type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Save Barcode Entry to Table List
  const handleSaveBarcodeToTable = () => {
    if (!productName.trim() || !barcodeValue.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Product Name and Barcode Number are required to save.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    const newItem: SavedBarcodeItem = {
      id: `${barcodeValue.trim()}-${Date.now()}`,
      productName: productName.trim(),
      barcodeValue: barcodeValue.trim(),
      department: department.trim() || 'General',
      variety: variety.trim() || 'Standard',
      size: size.trim() || 'L',
      batchNo: batchNo.trim() || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
      mrp: mrp !== '' ? Number(mrp) : 0,
      salesPrice: salesPrice !== '' ? Number(salesPrice) : 0,
      mfgDate: mfgDate,
      expDate: expDate,
      barcodeType: barcodeType,
      printCount: printCount !== '' ? Number(printCount) : 1,
      createdAt: new Date().toLocaleString()
    };

    setSavedBarcodes(prev => [newItem, ...prev.filter(b => b.barcodeValue !== newItem.barcodeValue)]);

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `✓ Saved barcode [${newItem.barcodeValue}] for ${newItem.productName} in table!`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
    }
  };

  // Print Labels Function
  const printLabelHTML = (itemsToPrint: SavedBarcodeItem[]) => {
    let printHtml = '';
    itemsToPrint.forEach(item => {
      const numLabels = Number(item.printCount) || 1;
      const mfgFormatted = item.mfgDate ? `${item.mfgDate.substring(8, 10)}/${item.mfgDate.substring(5, 7)}/${item.mfgDate.substring(2, 4)}` : '--/--';
      const expFormatted = item.expDate ? `${item.expDate.substring(8, 10)}/${item.expDate.substring(5, 7)}/${item.expDate.substring(2, 4)}` : '--/--';
      const mrpFormatted = Number(item.mrp || 0).toFixed(2);
      const saleFormatted = Number(item.salesPrice || 0).toFixed(2);

      const bars = generateCode39Bars(item.barcodeValue || '100002');
      const scale = 1.15;
      const barcodeHtml = bars.map(bar => {
        if (bar.type === 'bar') {
          return `<div style="border-left: ${bar.width * scale}px solid #000000; height: 100%; flex-shrink: 0;"></div>`;
        } else {
          return `<div style="width: ${bar.width * scale}px; height: 100%; flex-shrink: 0;"></div>`;
        }
      }).join('');

      for (let i = 0; i < numLabels; i++) {
        printHtml += `
          <div id="print-label">
            <div class="header">${shopName}</div>
            <div class="product">${item.productName}</div>
            <div class="meta">${item.department} | ${item.variety} | Size: ${item.size}</div>
            <div class="dates">pkd ${mfgFormatted} Exp ${expFormatted}</div>
            <div class="price-container">
              <span class="mrp">MRP: <del>₹${mrpFormatted}</del></span>
              <span class="sale">₹${saleFormatted}</span>
            </div>
            <div class="barcode-wrapper" style="display: flex; justify-content: center; align-items: stretch; height: 6mm; width: 100%; background-color: #ffffff; overflow: hidden; margin-top: 0.8mm;">
               ${barcodeHtml}
            </div>
            <div class="barcode-text">* ${item.barcodeValue} *</div>
          </div>
        `;
      }
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Labels</title>
          <style>
            @page { size: 35mm 25mm; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              font-family: Arial, sans-serif;
              color: #000;
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
            #print-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 0.5mm;
              box-sizing: border-box;
            }
            #print-label {
              width: 34mm;
              height: 24mm;
              padding: 1mm 1.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              background-color: #fff;
              page-break-after: always;
              overflow: hidden;
            }
            .header { font-size: 5pt; font-weight: bold; text-align: center; text-transform: uppercase; color: #1e3a8a; line-height: 1; margin-bottom: 0.2mm; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .product { font-size: 7pt; font-weight: bold; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1; width: 100%; }
            .meta { font-size: 5pt; font-weight: bold; text-align: center; line-height: 1; color: #333; }
            .dates { font-size: 5pt; line-height: 1; white-space: nowrap; }
            .price-container { display: flex; justify-content: center; align-items: baseline; gap: 1.5mm; }
            .mrp { font-size: 5pt; }
            .sale { font-size: 8pt; font-weight: bold; }
            .barcode-wrapper { height: 6mm; width: 90%; display: flex; justify-content: center; align-items: stretch; overflow: hidden; }
            .barcode-text { font-size: 5pt; font-family: monospace; font-weight: bold; margin-top: 0.5mm; }
          </style>
        </head>
        <body>
          <div id="print-wrapper">${printHtml}</div>
        </body>
      </html>
    `;

    if ((window as any).api) {
      (window as any).api.send('print-html', fullHtml);
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Please allow popups to print labels.", type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        return;
      }
      printWindow.document.write(fullHtml);
      printWindow.document.write(`
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      `);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const handlePrintCurrentForm = () => {
    if (!productName || !barcodeValue) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please fill in Product Name and Barcode Number before printing.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }
    const item: SavedBarcodeItem = {
      id: Date.now().toString(),
      productName,
      barcodeValue,
      department: department || 'General',
      variety: variety || 'Standard',
      size: size || 'L',
      batchNo,
      mrp,
      salesPrice,
      mfgDate,
      expDate,
      barcodeType,
      printCount: printCount || 1,
      createdAt: new Date().toLocaleString()
    };
    printLabelHTML([item]);
  };

  // Download Barcode Label Image (PNG)
  const handleDownloadLabelImage = (item: SavedBarcodeItem) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 400, 280);

    // Label Border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 388, 268);

    // Header
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(shopName, 200, 32);

    // Line separator
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 42);
    ctx.lineTo(385, 42);
    ctx.stroke();

    // Product Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(item.productName.toUpperCase(), 200, 70);

    // Category | Variety | Size
    const metaStr = `${item.department || 'General'} | ${item.variety || 'Standard'} | Size: ${item.size || 'L'}`;
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(metaStr, 200, 94);

    // Dates
    const mfg = item.mfgDate ? `${item.mfgDate.substring(8, 10)}/${item.mfgDate.substring(5, 7)}/${item.mfgDate.substring(2, 4)}` : '--/--';
    const exp = item.expDate ? `${item.expDate.substring(8, 10)}/${item.expDate.substring(5, 7)}/${item.expDate.substring(2, 4)}` : '--/--';
    ctx.font = '13px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`pkd ${mfg}  Exp ${exp}  |  Batch: ${item.batchNo}`, 200, 118);

    // Prices
    const mrpVal = Number(item.mrp || 0).toFixed(2);
    const saleVal = Number(item.salesPrice || 0).toFixed(2);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Arial';
    ctx.fillText(`MRP: ₹${mrpVal}   SALE: ₹${saleVal}`, 200, 146);

    // Barcode Visual Lines
    const bars = generateCode39Bars(item.barcodeValue || '100002');
    const barY = 158;
    const barHeight = 75;

    // Calculate total width to center it on the 400px wide canvas
    const scale = 2.0;
    let totalUnits = 0;
    bars.forEach(bar => totalUnits += bar.width);
    const totalWidth = totalUnits * scale;
    let currentX = Math.max(10, 200 - totalWidth / 2); // Center the barcode

    bars.forEach(bar => {
      if (bar.type === 'bar') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(currentX, barY, bar.width * scale, barHeight);
      }
      currentX += bar.width * scale;
    });

    // Barcode text
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`* ${code} *`, 200, 258);

    // Download PNG
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Barcode_${code}_${item.productName.replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `Downloaded barcode image Barcode_${code}.png`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  const handleDeleteSaved = (id: string) => {
    setSavedBarcodes(prev => prev.filter(b => b.id !== id));
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Barcode removed from table.", type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Filtered Saved Barcodes Table List
  const filteredSavedTable = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return savedBarcodes;
    return savedBarcodes.filter(b =>
      b.productName.toLowerCase().includes(q) ||
      b.barcodeValue.toLowerCase().includes(q) ||
      b.department.toLowerCase().includes(q) ||
      b.variety.toLowerCase().includes(q) ||
      b.size.toLowerCase().includes(q) ||
      b.batchNo.toLowerCase().includes(q)
    );
  }, [savedBarcodes, tableSearch]);

  // Wire Global Toolbar Actions
  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: handleClear,
        onSave: handleSaveBarcodeToTable,
        onPrint: handlePrintCurrentForm,
        onCancel: handleClear
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions, productName, barcodeValue, department, variety, size, mrp, salesPrice, printCount]);

  return (
    <div className="flex flex-col h-full bg-slate-100 relative overflow-y-auto space-y-4 p-3">

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-3 rounded-md shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-md shadow">
            <Tag size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide">BARCODE GENERATION & ITEM MASTER LABEL MASTER</h1>
            <p className="text-xs text-blue-200">Select Item Master saved products, generate barcodes, print labels, and save to table list.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSaveBarcodeToTable}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded shadow transition-all active:scale-95"
          >
            <Save size={15} />
            <span>SAVE TO TABLE</span>
          </button>
          <button
            onClick={handlePrintCurrentForm}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded shadow transition-all active:scale-95"
          >
            <Printer size={15} />
            <span>PRINT LABELS</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workstation: Form (Left) & Live Label Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* Left Panel: Item Master Selector & Data Entry Form */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-md shadow-sm">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
            <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={16} className="text-blue-700" />
              1. Select from Item Master Saved List & Edit Details
            </h2>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {availableProducts.length} Items Loaded
            </span>
          </div>

          <div className="p-4 space-y-3 text-xs">

            {/* ITEM MASTER SEARCHABLE SELECTOR */}
            <div className="relative">
              <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                <span>SELECT FROM ITEM MASTER SAVED LIST:</span>
                <span className="text-[10px] text-blue-600 font-normal">Click item to auto-populate category, size & variety</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full font-bold text-blue-900 bg-blue-50/70 border border-blue-300 py-1.5 px-3 pl-8 rounded focus:outline-none focus:bg-yellow-50 focus:border-blue-600"
                  placeholder="🔍 Type product name, barcode, or code to search Item Master saved list..."
                  value={itemSearch}
                  onChange={e => {
                    setItemSearch(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
              </div>

              {/* Item Master Dropdown List */}
              {showItemDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-blue-400 rounded-md shadow-2xl max-h-60 overflow-y-auto z-[999]">
                  <div className="bg-slate-100 p-1.5 text-[11px] font-bold text-slate-600 border-b flex justify-between">
                    <span>SAVED ITEM MASTER PRODUCTS ({filteredItemMaster.length})</span>
                    <button type="button" className="text-red-500" onClick={() => setShowItemDropdown(false)}>Close ✕</button>
                  </div>
                  {filteredItemMaster.length === 0 ? (
                    <div className="p-3 text-slate-500 italic text-center">No products found matching "{itemSearch}"</div>
                  ) : (
                    filteredItemMaster.map((prod, idx) => (
                      <div
                        key={prod.id || prod._id || idx}
                        onClick={() => handleSelectProduct(prod)}
                        className="p-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{prod.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Code: <strong className="font-mono text-blue-700">{prod.itemCode}</strong></span>
                            {prod.barcode && <span>Barcode: <strong className="font-mono text-emerald-700">{prod.barcode}</strong></span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">₹{prod.price || prod.mrp || 0}</div>
                          <div className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {prod.department || 'Mens'} | {prod.variety || 'Casual'} | Size: <strong>{prod.size || 'L'}</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 my-2"></div>

            {/* FORM INPUT FIELDS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="e.g. Men's Shirt"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1 flex justify-between">
                  <span>Barcode Number <span className="text-red-500">*</span></span>
                  <button type="button" onClick={handleGenerateRandomBarcode} className="text-[10px] text-blue-600 font-bold hover:underline">
                    ⚡ Auto Code
                  </button>
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-mono font-bold text-blue-900 bg-yellow-50 focus:border-blue-600 focus:outline-none"
                  value={barcodeValue}
                  onChange={e => setBarcodeValue(e.target.value)}
                  placeholder="e.g. 100002"
                />
              </div>

              {/* CATEGORY / DEPARTMENT, VARIETY, SIZE */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category / Department</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="e.g. Mens, Womens, Kids"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Variety / Sub-Category</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={variety}
                  onChange={e => setVariety(e.target.value)}
                  placeholder="e.g. Formal, Casual, Cotton"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Size <span className="text-blue-600 font-bold">*</span></label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-900 bg-blue-50 focus:border-blue-600 focus:outline-none"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  placeholder="e.g. L, M, S, XL, 42, 38"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Batch Number</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 uppercase focus:border-blue-600 focus:outline-none"
                  value={batchNo}
                  onChange={e => setBatchNo(e.target.value.toUpperCase())}
                  placeholder="e.g. BATCH-1001"
                />
              </div>

              {/* DATES */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mfg Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={mfgDate}
                  onChange={e => setMfgDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exp Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                />
              </div>

              {/* PRICE */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={mrp}
                  onChange={e => setMrp(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sales Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-emerald-700 focus:border-blue-600 focus:outline-none"
                  value={salesPrice}
                  onChange={e => setSalesPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                />
              </div>

              {/* TYPE & QUANTITY */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode Standard</label>
                <select
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={barcodeType}
                  onChange={e => setBarcodeType(e.target.value)}
                >
                  <option value="Code 128">Code 128 (Standard)</option>
                  <option value="EAN-13">EAN-13</option>
                  <option value="UPC-A">UPC-A</option>
                  <option value="QR Code">QR Code</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Print Label Qty</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={printCount}
                  onChange={e => setPrintCount(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-2 pt-3 border-t border-slate-200 mt-2">
              <button
                type="button"
                onClick={handleSaveBarcodeToTable}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded shadow transition-all active:scale-95 text-xs"
              >
                <Save size={16} />
                Save Barcode to Table
              </button>
              <button
                type="button"
                onClick={handlePrintCurrentForm}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-extrabold py-2 px-3 rounded shadow transition-all active:scale-95 text-xs"
              >
                <Printer size={16} />
                Generate & Print
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-3 rounded transition-all text-xs"
              >
                <RotateCcw size={15} />
                Clear
              </button>
            </div>

          </div>
        </div>

        {/* Right Panel: Live Thermal Barcode Label Preview */}
        <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-md shadow-md p-4 text-white flex flex-col items-center justify-center relative min-h-[480px]">
          <div className="absolute top-2.5 left-3 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
            <Tag size={12} className="text-yellow-400" />
            2. Live Thermal Label Preview (35mm x 25mm)
          </div>

          <div className="flex justify-center items-center w-full my-8">
            <div
              className="bg-white shadow-2xl relative overflow-hidden border border-slate-300"
              style={{
                width: '35mm',
                height: '25mm',
                boxSizing: 'border-box',
                padding: '1.2mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'Arial, sans-serif',
                color: '#000',
                transform: 'scale(3.2)',
                transformOrigin: 'center'
              }}
            >
              {/* Store Name */}
              <div className="w-full text-center border-b border-black/20 pb-[0.2mm]">
                <h1 className="text-[5.5pt] font-extrabold uppercase leading-none m-0 p-0 whitespace-nowrap tracking-tight">
                  {shopName}
                </h1>
              </div>

              {/* Product Name */}
              <div className="w-full text-center">
                <h2 className="text-[7pt] font-extrabold uppercase leading-none truncate m-0 p-0 w-full text-black">
                  {productName || 'PRODUCT NAME'}
                </h2>
              </div>

              {/* Category / Variety / Size Badge */}
              <div className="w-full text-center">
                <span className="text-[4.8pt] font-bold leading-none m-0 p-0 text-slate-800 block truncate">
                  {department || 'General'} | {variety || 'Standard'} | Size: <strong className="text-black font-extrabold">{size || 'L'}</strong>
                </span>
              </div>

              {/* Dates & Batch */}
              <div className="w-full text-center">
                <span className="text-[4.5pt] leading-none m-0 p-0 whitespace-nowrap text-slate-700">
                  pkd {mfgDate ? `${mfgDate.substring(8, 10)}/${mfgDate.substring(5, 7)}/${mfgDate.substring(2, 4)}` : '--/--'} Exp {expDate ? `${expDate.substring(8, 10)}/${expDate.substring(5, 7)}/${expDate.substring(2, 4)}` : '--/--'}
                </span>
              </div>

              {/* Price */}
              <div className="w-full text-center flex justify-center items-baseline gap-[1.5mm]">
                <span className="text-[4.5pt] leading-none m-0 p-0 text-slate-700">
                  MRP: <span className="line-through">₹{mrp !== '' ? Number(mrp).toFixed(2) : '0.00'}</span>
                </span>
                <span className="text-[7.5pt] font-extrabold leading-none m-0 p-0 text-black">
                  ₹{salesPrice !== '' ? Number(salesPrice).toFixed(2) : '0.00'}
                </span>
              </div>

              {/* Barcode Visual Lines */}
              <div className="w-[92%] h-[6mm] flex justify-center items-stretch overflow-hidden bg-white">
                {generateCode39Bars(barcodeValue || '100002').map((bar, index) => (
                  <div
                    key={index}
                    style={{
                      width: `${bar.width * 1.6}px`,
                      backgroundColor: bar.type === 'bar' ? '#000000' : 'transparent',
                      flexShrink: 0
                    }}
                  />
                ))}
              </div>

              {/* Barcode Number Code */}
              <div className="w-full text-center">
                <span className="text-[4.5pt] font-mono font-bold leading-none block">
                  * {barcodeValue || '100002'} *
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-300 font-semibold bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 mt-4">
            <Check size={14} className="text-emerald-400" />
            <span>Ready to generate & print {printCount || 1} label(s) for <strong>{productName || 'Item'}</strong></span>
          </div>

        </div>

      </div>

      {/* 3. SAVED BARCODE MASTER TABLE LIST */}
      <div className="bg-white border border-slate-300 rounded-md shadow-md">
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between rounded-t-md">
          <div className="flex items-center space-x-2">
            <Tag size={18} className="text-yellow-400" />
            <h2 className="font-extrabold text-sm tracking-wide uppercase">Saved Barcodes Master Table List</h2>
            <span className="bg-emerald-500 text-slate-950 font-extrabold text-xs px-2 py-0.5 rounded-full">
              {savedBarcodes.length} Records
            </span>
          </div>

          {/* Table Search Field */}
          <div className="relative w-64">
            <input
              type="text"
              className="w-full bg-slate-800 text-white font-semibold text-xs py-1 px-3 pl-8 rounded border border-slate-700 focus:outline-none focus:border-yellow-400 placeholder-slate-400"
              placeholder="Search table barcodes..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[200px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase tracking-wider text-[11px]">
                <th className="p-2 border-r border-slate-200 text-center w-12">S.No</th>
                <th className="p-2 border-r border-slate-200">Barcode No</th>
                <th className="p-2 border-r border-slate-200">Product Name</th>
                <th className="p-2 border-r border-slate-200">Category</th>
                <th className="p-2 border-r border-slate-200">Variety</th>
                <th className="p-2 border-r border-slate-200 text-center">Size</th>
                <th className="p-2 border-r border-slate-200 text-right">MRP (₹)</th>
                <th className="p-2 border-r border-slate-200 text-right">Sale Price (₹)</th>
                <th className="p-2 border-r border-slate-200">Batch No</th>
                <th className="p-2 border-r border-slate-200 text-center">Print Qty</th>
                <th className="p-2 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSavedTable.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-500 italic">
                    No saved barcodes in table list. Use the form above to add items.
                  </td>
                </tr>
              ) : (
                filteredSavedTable.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/70 border-b border-slate-200 transition-colors">
                    <td className="p-2 border-r border-slate-200 text-center font-semibold text-slate-600">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-blue-900 bg-yellow-50/50">
                      {item.barcodeValue}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{item.productName}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-700">{item.department || 'General'}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-700">{item.variety || 'Standard'}</td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold text-blue-800 bg-blue-50/30">
                      {item.size || 'L'}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-700">
                      ₹{Number(item.mrp || 0).toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(item.salesPrice || 0).toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{item.batchNo || '-'}</td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-900">{item.printCount || 1}</td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* PRINT ICON BUTTON */}
                        <button
                          type="button"
                          title="Print Barcode Label"
                          onClick={() => printLabelHTML([item])}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded shadow transition-all active:scale-95"
                        >
                          <Printer size={14} />
                        </button>

                        {/* DOWNLOAD ICON BUTTON */}
                        <button
                          type="button"
                          title="Download Barcode PNG Image"
                          onClick={() => handleDownloadLabelImage(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded shadow transition-all active:scale-95"
                        >
                          <FileDown size={14} />
                        </button>

                        {/* DELETE ICON BUTTON */}
                        <button
                          type="button"
                          title="Delete from Saved Table"
                          onClick={() => handleDeleteSaved(item.id)}
                          className="bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded shadow transition-all active:scale-95"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default BarcodeGeneration;
