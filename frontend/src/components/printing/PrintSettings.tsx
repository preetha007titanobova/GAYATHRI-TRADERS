import React, { useState, useEffect } from 'react';
import { X, Printer, Cpu, Network, CheckCircle2, Shield, Play } from 'lucide-react';
import { PrinterConfig, PrintEngineMode, PaperWidth, CommunicationType } from '../../types/receipt';

interface PrintSettingsProps {
  config: PrinterConfig;
  onSave: (config: PrinterConfig) => void;
  onClose: () => void;
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
  config,
  onSave,
  onClose
}) => {
  const [engineMode, setEngineMode] = useState<PrintEngineMode>(config.engineMode || 'silent-chromium');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(config.paperWidth || '80mm');
  const [communicationType, setCommunicationType] = useState<CommunicationType>(config.communicationType || 'win32-spooler');
  const [printerName, setPrinterName] = useState(config.printerName || 'POS-80');
  const [networkIp, setNetworkIp] = useState(config.networkIp || '192.168.1.200');
  const [networkPort, setNetworkPort] = useState(config.networkPort || 9100);
  const [openCashDrawer, setOpenCashDrawer] = useState(config.openCashDrawer || false);
  const [autoCut, setAutoCut] = useState(config.autoCut !== false);

  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  useEffect(() => {
    // Fetch system printers via IPC if running inside Electron
    if ((window as any).api && typeof (window as any).api.send === 'function') {
      (window as any).api.send('detect-printers');
      (window as any).api.receive('detect-printers-response', (event: any, printers: any[]) => {
        if (Array.isArray(printers)) {
          setAvailablePrinters(printers.map(p => typeof p === 'string' ? p : p.name));
        }
      });
    }
  }, []);

  const handleSave = () => {
    onSave({
      engineMode,
      paperWidth,
      communicationType,
      printerName,
      networkIp,
      networkPort,
      openCashDrawer,
      autoCut
    });
  };

  const handleTestPrint = () => {
    setIsTestPrinting(true);
    const testPayload = {
      storeName: 'ITHU NAMMA KADA',
      storeMobile: '8270691757',
      invoiceNo: 'TEST-0001',
      date: new Date().toISOString().split('T')[0],
      customerName: 'Test Customer',
      paymentMode: 'Cash',
      items: [
        { index: 1, itemName: 'TEST THERMAL ITEM', qty: 1, rate: 100, amount: 100 }
      ],
      totalQty: 1,
      subTotal: 100,
      netAmount: 100,
      receiptTitle: 'TEST PRINT INVOICE'
    };

    if ((window as any).api && typeof (window as any).api.send === 'function') {
      if (engineMode === 'direct-escpos') {
        (window as any).api.send('print-escpos', { payload: testPayload, config: { engineMode, paperWidth, communicationType, printerName, networkIp, networkPort, openCashDrawer, autoCut } });
      } else {
        (window as any).api.send('print-receipt', { payload: testPayload, config: { engineMode, paperWidth, communicationType, printerName, networkIp, networkPort, openCashDrawer, autoCut } });
      }
    } else {
      window.print();
    }

    setTimeout(() => setIsTestPrinting(false), 1000);
  };

  return (
    <div className="apple-glass-card rounded-2xl p-6 shadow-2xl space-y-5 border border-white/80 animate-scale-up text-slate-900">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Printer size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Printer Hardware & Layout Config</h3>
            <p className="text-xs text-slate-400">Configure dual-engine rules and spooler channels</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 text-xs">
        
        {/* 1. Dual Engine Mode Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Primary Print Engine</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEngineMode('direct-escpos')}
              className={`p-3 rounded-xl border text-left transition-all ${
                engineMode === 'direct-escpos'
                  ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Direct ESC/POS Driver</span>
                <Cpu size={15} className={engineMode === 'direct-escpos' ? 'text-blue-600' : 'text-slate-400'} />
              </div>
              <p className="text-[11px] text-slate-500 font-normal">High-speed binary stream. Bypasses Chromium rendering.</p>
            </button>

            <button
              onClick={() => setEngineMode('silent-chromium')}
              className={`p-3 rounded-xl border text-left transition-all ${
                engineMode === 'silent-chromium'
                  ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Silent Chromium Renderer</span>
                <Printer size={15} className={engineMode === 'silent-chromium' ? 'text-blue-600' : 'text-slate-400'} />
              </div>
              <p className="text-[11px] text-slate-500 font-normal">Headless window print with @page 80mm/58mm CSS alignment.</p>
            </button>
          </div>
        </div>

        {/* 2. Paper Width Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Paper Roll Standard</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`py-2 rounded-xl text-center font-semibold text-xs border transition-all ${
                paperWidth === '80mm' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              80mm Roll (48 Columns / 72mm Printable)
            </button>

            <button
              onClick={() => setPaperWidth('58mm')}
              className={`py-2 rounded-xl text-center font-semibold text-xs border transition-all ${
                paperWidth === '58mm' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              58mm Roll (32 Columns / 48mm Printable)
            </button>
          </div>
        </div>

        {/* 3. Communication Channel */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Communication Channel</label>
          <select
            value={communicationType}
            onChange={(e) => setCommunicationType(e.target.value as CommunicationType)}
            className="apple-input w-full"
          >
            <option value="win32-spooler">Windows Spooler / Local USB Device</option>
            <option value="network-socket">TCP Network Socket (IP : Port 9100)</option>
          </select>
        </div>

        {/* 4. Target Printer Name / Network Config */}
        {communicationType === 'network-socket' ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Printer IP Address</label>
              <input
                type="text"
                value={networkIp}
                onChange={(e) => setNetworkIp(e.target.value)}
                placeholder="192.168.1.200"
                className="apple-input w-full font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Port</label>
              <input
                type="number"
                value={networkPort}
                onChange={(e) => setNetworkPort(Number(e.target.value) || 9100)}
                className="apple-input w-full font-mono"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Target Printer Spooler Name</label>
            {availablePrinters.length > 0 ? (
              <select
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                className="apple-input w-full font-mono"
              >
                {availablePrinters.map((p, idx) => (
                  <option key={idx} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder="e.g. POS-80, Thermal-Printer"
                className="apple-input w-full font-mono"
              />
            )}
          </div>
        )}

        {/* 5. Additional Hardware Commands */}
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCut}
              onChange={(e) => setAutoCut(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700 font-medium">Auto-Cut Paper</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={openCashDrawer}
              onChange={(e) => setOpenCashDrawer(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700 font-medium">Kick Cash Drawer</span>
          </label>
        </div>

      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <button
          onClick={handleTestPrint}
          disabled={isTestPrinting}
          className="apple-button-secondary text-xs"
        >
          <Play size={14} className="text-blue-500" />
          <span>{isTestPrinting ? 'Printing Test...' : 'Test Print'}</span>
        </button>

        <div className="flex gap-2">
          <button onClick={onClose} className="apple-button-secondary text-xs">Cancel</button>
          <button onClick={handleSave} className="apple-button-primary text-xs">Save Settings</button>
        </div>
      </div>

    </div>
  );
};
