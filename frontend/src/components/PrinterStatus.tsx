import React, { useState, useEffect, useRef } from 'react';
import { Printer, RefreshCw, Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { getPrinterStatus, detectPrinters, setActivePrinter } from '../services/printService';
import type { PrinterStatusInfo } from '../services/printService';

const PrinterStatus: React.FC = () => {
  const [status, setStatus] = useState<PrinterStatusInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to printer status updates
    const unsubscribe = getPrinterStatus((statusInfo) => {
      setStatus(statusInfo);
    });

    // Close dropdown on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRedetect = () => {
    setLoading(true);
    detectPrinters((result) => {
      setLoading(false);
      if (result.success) {
        // Fetch status again to update UI
        getPrinterStatus((statusInfo) => {
          setStatus(statusInfo);
        });
      }
    });
  };

  const handleSelectPrinter = (name: string) => {
    setActivePrinter(name, (result) => {
      if (result.success) {
        getPrinterStatus((statusInfo) => {
          setStatus(statusInfo);
        });
        setIsOpen(false);
      }
    });
  };

  if (!status) {
    return (
      <div className="flex items-center space-x-1.5 bg-gray-100 border border-gray-300 text-gray-500 px-2.5 py-1 rounded text-xs font-bold shadow-xs animate-pulse">
        <Printer size={13} />
        <span>Detecting Printer...</span>
      </div>
    );
  }

  const { activePrinter, isConnected, selectionType, allPrinters } = status;

  // Determine pill status color class
  let pillClass = 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100';
  let dotClass = 'bg-red-500';
  
  if (isConnected) {
    if (selectionType.includes('Thermal')) {
      pillClass = 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100';
      dotClass = 'bg-green-500';
    } else {
      pillClass = 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
      dotClass = 'bg-amber-500';
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Printer Status Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 border px-2.5 py-1 rounded text-xs font-bold shadow-sm transition-all cursor-pointer focus:outline-none ${pillClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-ping absolute`} style={{ width: '6px', height: '6px', marginLeft: '3.5px' }} />
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <Printer size={13} className="ml-1" />
        <span className="truncate max-w-[120px] font-bold">
          {activePrinter ? activePrinter : 'No Printer'}
        </span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-400 shadow-2xl rounded-lg w-64 p-3 z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="font-bold border-b border-gray-200 pb-1.5 mb-2 text-blue-900 flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider">Printer Connections</span>
            <button
              onClick={handleRedetect}
              disabled={loading}
              className="text-gray-500 hover:text-blue-600 focus:outline-none transition-colors disabled:opacity-50"
              title="Auto-detect Thermal Printers"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Active selection info */}
          <div className="bg-gray-50 rounded border border-gray-200 p-2 mb-3 text-[10px] text-gray-600 font-semibold leading-relaxed">
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="text-blue-800 font-bold">{selectionType}</span>
            </div>
            {isConnected && (
              <div className="mt-0.5 flex items-center justify-between text-emerald-700">
                <span>Status:</span>
                <span>Active & Ready</span>
              </div>
            )}
            {!isConnected && (
              <div className="mt-0.5 flex items-center gap-0.5 text-red-600">
                <AlertTriangle size={10} />
                <span>No POS printer detected</span>
              </div>
            )}
          </div>

          {/* Connected printers list */}
          <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {allPrinters.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic text-center py-2">No printers installed on this PC</p>
            ) : (
              allPrinters.map((p) => {
                const isCurrent = activePrinter === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => handleSelectPrinter(p.name)}
                    className={`w-full text-left px-2 py-1 rounded text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      isCurrent ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">{p.name}</span>
                    {isCurrent && <Check size={11} className="text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterStatus;
