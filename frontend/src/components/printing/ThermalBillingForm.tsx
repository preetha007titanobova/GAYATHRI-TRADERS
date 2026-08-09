import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Printer, Settings, Eye, RefreshCw, ShoppingCart, CheckCircle, Smartphone } from 'lucide-react';
import { ThermalReceipt } from './ThermalReceipt';
import { PrintSettings } from './PrintSettings';
import type { ReceiptPayload, ReceiptItem, PaperWidth, PrinterConfig } from '../../types/receipt';

export const ThermalBillingForm: React.FC = () => {
  // Form State
  const [storeName, setStoreName] = useState(localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || '');
  const [storeMobile, setStoreMobile] = useState(localStorage.getItem('registered_shop_mobile') || '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [showSettings, setShowSettings] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Dynamic Items State
  const [items, setItems] = useState<ReceiptItem[]>([
    { index: 1, itemName: 'PANT', qty: 1, rate: 80.00, amount: 80.00 }
  ]);

  // Printer Settings State
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    engineMode: 'silent-chromium',
    paperWidth: '80mm',
    communicationType: 'win32-spooler',
    printerName: 'POS-80',
    openCashDrawer: false,
    autoCut: true
  });

  // Real-time Calculations
  const calculatedPayload: ReceiptPayload = useMemo(() => {
    const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netAmount = subTotal;

    return {
      storeName,
      storeMobile,
      invoiceNo,
      date: new Date().toISOString().split('T')[0],
      customerName,
      customerMobile,
      paymentMode,
      items,
      totalQty,
      subTotal,
      netAmount,
      receiptTitle: 'TAX INVOICE',
      footerNote: 'Thank you for purchasing!\nHave a great day!'
    };
  }, [storeName, storeMobile, invoiceNo, customerName, customerMobile, paymentMode, items]);

  // Form Handlers
  const handleAddItem = () => {
    const newIdx = items.length + 1;
    setItems(prev => [
      ...prev,
      { index: newIdx, itemName: '', qty: 1, rate: 0, amount: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, index: i + 1 })));
  };

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const q = field === 'qty' ? Number(value) || 0 : item.qty;
          const r = field === 'rate' ? Number(value) || 0 : item.rate;
          updated.amount = q * r;
        }
        return updated;
      }
      return item;
    }));
  };

  // Execution: Trigger Dual-Engine Print
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if ((window as any).api && typeof (window as any).api.send === 'function') {
        if (printerConfig.engineMode === 'direct-escpos') {
          (window as any).api.send('print-escpos', { payload: calculatedPayload, config: printerConfig });
        } else {
          (window as any).api.send('print-receipt', { payload: calculatedPayload, config: printerConfig });
        }
      } else {
        // Browser Fallback Print
        window.print();
      }
    } catch (err) {
      console.error('Print trigger error:', err);
    } finally {
      setTimeout(() => setIsPrinting(false), 500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <ShoppingCart size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Thermal Receipt Studio</h1>
            <p className="text-xs text-slate-500">Live 1:1 Thermal Printing & Layout Replica Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Paper Size Preview Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => { setPaperWidth('80mm'); setPrinterConfig((p: any) => ({ ...p, paperWidth: '80mm' })); }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                paperWidth === '80mm' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              80mm Roll
            </button>
            <button
              onClick={() => { setPaperWidth('58mm'); setPrinterConfig((p: any) => ({ ...p, paperWidth: '58mm' })); }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                paperWidth === '58mm' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              58mm Roll
            </button>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="apple-button-secondary py-2 text-xs"
            title="Printer Hardware Settings"
          >
            <Settings size={16} />
            <span>Hardware Config</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={isPrinting || items.length === 0}
            className="apple-button-primary py-2 px-4 text-xs font-semibold shadow-lg shadow-blue-500/20"
          >
            {isPrinting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Printer size={16} />
            )}
            <span>Print Receipt ({printerConfig.engineMode === 'direct-escpos' ? 'Direct ESC/POS' : 'Silent Chromium'})</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Form (7 cols), Right Live Thermal Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form & Item Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Metadata Section */}
          <div className="apple-glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-200">
              Header & Customer Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Store Title</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="apple-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Store Mobile</label>
                <input
                  type="text"
                  value={storeMobile}
                  onChange={(e) => setStoreMobile(e.target.value)}
                  className="apple-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="apple-input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="apple-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Customer Phone</label>
                <input
                  type="text"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="Optional 10-digit mobile"
                  className="apple-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="apple-input w-full"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dynamic Items Table Form */}
          <div className="apple-glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Invoice Item List ({items.length} items)
              </h3>
              <button
                onClick={handleAddItem}
                className="apple-button-primary py-1.5 px-3 text-xs"
              >
                <Plus size={14} />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
                  
                  {/* Item Name */}
                  <input
                    type="text"
                    value={item.itemName}
                    onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                    placeholder="Item Name (e.g. PANT)"
                    className="apple-input flex-1 text-xs py-1.5"
                  />

                  {/* Quantity */}
                  <input
                    type="number"
                    min="1"
                    value={item.qty || ''}
                    onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                    placeholder="Qty"
                    className="apple-input w-16 text-right font-semibold text-xs py-1.5"
                  />

                  {/* Rate */}
                  <input
                    type="number"
                    step="0.01"
                    value={item.rate || ''}
                    onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                    placeholder="Rate ₹"
                    className="apple-input w-24 text-right font-mono text-xs py-1.5"
                  />

                  {/* Amount (Calculated) */}
                  <span className="font-mono font-bold text-xs text-slate-900 w-24 text-right pr-2">
                    ₹{(Number(item.amount) || 0).toFixed(2)}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Live 1:1 Thermal Print Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye size={15} className="text-blue-500" />
              Live 1:1 Thermal Print Preview
            </span>
            <span className="text-[11px] font-mono text-slate-400">Width: {paperWidth}</span>
          </div>

          {/* Interactive Thermal Receipt View */}
          <div className="flex justify-center p-4 bg-slate-200/60 rounded-2xl border border-slate-300/70 shadow-inner min-h-[460px]">
            <ThermalReceipt
              payload={calculatedPayload}
              paperWidth={paperWidth}
            />
          </div>
        </div>

      </div>

      {/* Hardware Settings Drawer / Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowSettings(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg z-10">
            <PrintSettings
              config={printerConfig}
              onSave={(newCfg) => {
                setPrinterConfig(newCfg);
                setPaperWidth(newCfg.paperWidth);
                setShowSettings(false);
              }}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
};
