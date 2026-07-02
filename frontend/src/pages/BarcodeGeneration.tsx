import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Save, RotateCcw } from 'lucide-react';

const BarcodeGeneration = () => {
  const [productName, setProductName] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [salesPrice, setSalesPrice] = useState<number | ''>('');
  const [barcodeType, setBarcodeType] = useState('Code 128');
  const [printCount, setPrintCount] = useState<number | ''>(1);
  const [barcodeValue, setBarcodeValue] = useState('');

  // Generate a random alphanumeric barcode for preview if inputs change
  useEffect(() => {
    if (batchNo && productName) {
      const generatedCode = `${productName.substring(0, 3).toUpperCase()}${batchNo}${Math.floor(1000 + Math.random() * 9000)}`;
      setBarcodeValue(generatedCode);
    } else {
      setBarcodeValue('BARCODE-PLACEHOLDER');
    }
  }, [productName, batchNo]);

  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const handleClear = () => {
    setProductName('');
    setMfgDate('');
    setExpDate('');
    setBatchNo('');
    setMrp('');
    setSalesPrice('');
    setBarcodeType('Code 128');
    setPrintCount(1);
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Form cleared.", type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  const handleSaveTemplate = () => {
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Template saved successfully.", type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  const handlePrint = () => {
    if (!productName || !batchNo || !mrp) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please fill in all required fields (Product Name, Batch No, MRP) before printing.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please allow popups to print labels.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
      return;
    }

    // Format Data
    const mfgFormatted = mfgDate ? `${mfgDate.substring(8, 10)}/${mfgDate.substring(5, 7)}/${mfgDate.substring(2, 4)}` : '--/--';
    const expFormatted = expDate ? `${expDate.substring(8, 10)}/${expDate.substring(5, 7)}/${expDate.substring(2, 4)}` : '--/--';
    const mrpFormatted = mrp !== '' ? Number(mrp).toFixed(2) : '0.00';
    const salesPriceFormatted = salesPrice !== '' ? Number(salesPrice).toFixed(2) : '0.00';

    // Generate specific quantity of labels
    let printHtml = '';
    const numLabels = Number(printCount) || 1;
    for (let i = 0; i < numLabels; i++) {
       printHtml += `
          <div id="print-label">
            <div class="header">SRI GAYATHRI TRADERS</div>
            <div class="product">${productName || '&nbsp;'}</div>
            <div class="dates">pkd ${mfgFormatted} Exp ${expFormatted}</div>
            <div class="price-container">
              <span class="mrp">MRP: <del>₹${mrpFormatted}</del></span>
              <span class="sale">₹${salesPriceFormatted}</span>
            </div>
            <div class="barcode-wrapper">
               ${Array.from({ length: 45 }).map(() => `<div class="barcode-line" style="width: ${Math.max(1, Math.floor(Math.random() * 3))}px;"></div>`).join('')}
            </div>
          </div>
       `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label</title>
          <style>
            @page { size: 35mm 25mm; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              transform: none !important;
              font-family: Arial, sans-serif;
              color: #000;
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
            #print-wrapper {
              display: block;
            }
            #print-label {
              width: 35mm;
              height: 25mm;
              overflow: hidden;
              box-sizing: border-box;
              padding: 1mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              page-break-after: always;
            }
            .header {
              font-size: 6pt;
              font-weight: bold;
              text-align: center;
              line-height: 1;
              white-space: nowrap;
            }
            .product {
              font-size: 7pt;
              font-weight: bold;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1;
              width: 100%;
            }
            .dates {
              font-size: 5pt;
              line-height: 1;
              white-space: nowrap;
            }
            .price-container {
              display: flex;
              justify-content: center;
              align-items: baseline;
              gap: 2mm;
            }
            .mrp {
              font-size: 5pt;
            }
            .sale {
              font-size: 8pt;
              font-weight: bold;
            }
            .barcode-wrapper {
              height: 8mm;
              width: 90%;
              display: flex;
              justify-content: center;
              align-items: stretch;
              overflow: hidden;
            }
            .barcode-line {
              background-color: #000;
              height: 100%;
              margin-right: 0.5mm;
            }
          </style>
        </head>
        <body>
          <div id="print-wrapper">
            ${printHtml}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `Printing ${printCount} labels for ${productName}...`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
    }
  };

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: handleClear,
        onSave: handleSaveTemplate,
        onPrint: handlePrint,
        onCancel: handleClear
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions, productName, batchNo, mrp, salesPrice, printCount]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] text-white px-4 py-2 flex items-center shadow-md z-10 sticky top-0">
        <span className="font-semibold text-lg tracking-wide">Barcode Generation & Label Printing</span>
      </div>

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Data Entry Form */}
        <div className="bg-white border border-slate-300 shadow-sm rounded-sm">
          <div className="bg-[#e9ecef] border-b border-slate-300 px-4 py-2">
            <h2 className="text-slate-800 font-bold text-sm uppercase tracking-wider">Label Data Entry</h2>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                  value={productName} 
                  onChange={e => setProductName(e.target.value)} 
                  placeholder="Enter or select product" 
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Mfg Date</label>
                  <input 
                    type="date" 
                    className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                    value={mfgDate} 
                    onChange={e => setMfgDate(e.target.value)} 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Exp Date</label>
                  <input 
                    type="date" 
                    className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                    value={expDate} 
                    onChange={e => setExpDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Batch No <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm uppercase"
                    value={batchNo} 
                    onChange={e => setBatchNo(e.target.value.toUpperCase())} 
                    placeholder="e.g. BATCH-001" 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">MRP <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-slate-500 text-sm font-semibold">₹</span>
                    <input 
                      type="number" 
                      className="w-full pl-6 pr-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                      value={mrp} 
                      onChange={e => setMrp(e.target.value ? Number(e.target.value) : '')} 
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Sales Price <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-slate-500 text-sm font-semibold">₹</span>
                    <input 
                      type="number" 
                      className="w-full pl-6 pr-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                      value={salesPrice} 
                      onChange={e => setSalesPrice(e.target.value ? Number(e.target.value) : '')} 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 my-1"></div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Barcode Type</label>
                  <select 
                    className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                    value={barcodeType}
                    onChange={e => setBarcodeType(e.target.value)}
                  >
                    <option value="Code 128">Code 128</option>
                    <option value="EAN-13">EAN-13</option>
                    <option value="UPC-A">UPC-A</option>
                    <option value="QR Code">QR Code</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">Number of Labels</label>
                  <input 
                    type="number" 
                    min="1"
                    className="px-2 py-1.5 border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-[#2b579a] focus:ring-1 focus:ring-[#2b579a] transition-all rounded-sm"
                    value={printCount} 
                    onChange={e => setPrintCount(e.target.value ? Number(e.target.value) : '')} 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 mt-2 border-t border-slate-200">
              <button 
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 bg-[#2b579a] hover:bg-[#204070] text-white font-bold py-2 px-4 rounded-sm shadow-sm transition-colors text-sm"
              >
                <Printer size={16} />
                Generate & Print
              </button>
              <button 
                onClick={handleSaveTemplate}
                className="flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-sm shadow-sm transition-colors text-sm"
              >
                <Save size={16} />
                Save Template
              </button>
              <button 
                onClick={handleClear}
                className="flex items-center justify-center gap-2 bg-white border border-slate-400 hover:bg-slate-100 text-slate-800 font-bold py-2 px-4 rounded-sm shadow-sm transition-colors text-sm"
              >
                <RotateCcw size={16} />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Label Preview */}
        <div className="bg-[#cbd5e1] border border-slate-400 shadow-inner rounded-sm min-h-[450px] p-8 flex items-center justify-center relative">
          <div className="absolute top-2 left-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
            Live Preview
          </div>
          
          {/* Live Preview Container (Simulating 35x25mm Label) */}
          <div className="flex justify-center items-center w-full mt-4">
            <div 
              className="bg-white shadow-2xl relative overflow-hidden" 
              style={{ 
                width: '35mm', 
                height: '25mm', 
                boxSizing: 'border-box',
                padding: '1mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'Arial, sans-serif', 
                color: '#000',
                transform: 'scale(3)', 
                transformOrigin: 'center'
              }}
            >
              
              {/* Header */}
              <div className="w-full text-center">
                <h1 className="text-[6pt] font-bold uppercase leading-none m-0 p-0 whitespace-nowrap">
                  SRI GAYATHRI TRADERS
                </h1>
              </div>

              {/* Product Name */}
              <div className="w-full text-center">
                <h2 className="text-[7pt] font-bold uppercase leading-none truncate m-0 p-0 w-full">
                  {productName || '\u00A0'}
                </h2>
              </div>

              {/* Dates */}
              <div className="w-full text-center">
                <span className="text-[5pt] leading-none m-0 p-0 whitespace-nowrap">
                  pkd {mfgDate ? `${mfgDate.substring(8, 10)}/${mfgDate.substring(5, 7)}/${mfgDate.substring(2, 4)}` : '--/--'} Exp {expDate ? `${expDate.substring(8, 10)}/${expDate.substring(5, 7)}/${expDate.substring(2, 4)}` : '--/--'}
                </span>
              </div>

              {/* Price */}
              <div className="w-full text-center flex justify-center items-baseline gap-[2mm]">
                <span className="text-[5pt] leading-none m-0 p-0">
                  MRP: <span className="line-through">₹{mrp !== '' ? Number(mrp).toFixed(2) : '0.00'}</span>
                </span>
                <span className="text-[8pt] font-bold leading-none m-0 p-0">
                  ₹{salesPrice !== '' ? Number(salesPrice).toFixed(2) : '0.00'}
                </span>
              </div>

              {/* Barcode Visual */}
              <div className="w-[90%] h-[8mm] flex justify-center items-stretch overflow-hidden">
                 {Array.from({ length: 45 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="h-full bg-[#000]" 
                      style={{ width: `${Math.max(1, Math.floor(Math.random() * 3))}px`, marginRight: '0.5mm' }}
                    ></div>
                 ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default BarcodeGeneration;
