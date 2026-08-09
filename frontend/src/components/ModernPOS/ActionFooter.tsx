import React from 'react';
import { Printer, MessageCircle, Save, XCircle, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';

interface ActionFooterProps {
  onSavePrintWhatsApp: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  totalItemsCount: number;
  netAmount: number;
}

export const ActionFooter: React.FC<ActionFooterProps> = ({
  onSavePrintWhatsApp,
  onCancel,
  isSaving = false,
  totalItemsCount,
  netAmount
}) => {
  return (
    <footer className="sticky bottom-0 z-30 w-full apple-glass border-t border-white/60 shadow-2xl py-3 px-4 lg:px-6 transition-all duration-300">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Left Status & Summary Quick View */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Billing Counter Active</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Items: <strong className="text-slate-900 font-bold">{totalItemsCount}</strong>
            </span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-medium">
              Payable: <strong className="text-blue-600 font-bold font-mono">₹{netAmount.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Cancel / Clear Button */}
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="apple-button-secondary text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all duration-200"
          >
            <RotateCcw size={16} />
            <span>Cancel</span>
          </button>

          {/* Primary Action Button: Save + Print + WhatsApp */}
          <button
            onClick={onSavePrintWhatsApp}
            disabled={isSaving || totalItemsCount === 0}
            className="apple-button-primary bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 shadow-xl shadow-blue-500/25 py-2.5 px-6 text-sm font-semibold tracking-tight"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing Invoice...</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Save size={17} />
                  <Printer size={17} />
                  <MessageCircle size={17} className="text-emerald-300" />
                </div>
                <span>Save + Print + WhatsApp</span>
              </>
            )}
          </button>
        </div>

      </div>
    </footer>
  );
};
