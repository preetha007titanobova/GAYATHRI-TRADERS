import React from 'react';
import { Plus, X, ShoppingBag, CheckCircle } from 'lucide-react';

export interface TabSummary {
  id: string;
  title: string;
  invoiceNo: string;
  itemCount: number;
  totalAmount: number;
  buyerName?: string;
}

interface BillingTabBarProps {
  tabs: TabSummary[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  maxTabs?: number;
}

export const BillingTabBar: React.FC<BillingTabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  maxTabs = 15
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-lg text-xs font-sans scrollbar-none">
      
      {/* List of Bill Tabs */}
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTabId;
        const displayName = tab.buyerName && tab.buyerName.trim() !== '' && tab.buyerName !== 'CASH CUSTOMER'
          ? `${tab.title} (${tab.buyerName.split(' ')[0]})`
          : tab.title;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all duration-200 select-none min-w-[120px] max-w-[180px] border ${
              isActive
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold border-emerald-400/50 shadow-md shadow-emerald-950/40 scale-[1.02]'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border-slate-700/50'
            }`}
          >
            <span className="flex items-center gap-1 shrink-0">
              <ShoppingBag className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-200' : 'text-slate-400'}`} />
              <span className="font-semibold text-[11px] truncate">{displayName}</span>
            </span>

            {/* Badges for items & amount */}
            {tab.itemCount > 0 && (
              <span
                className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                  isActive
                    ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-400/30'
                    : 'bg-slate-900 text-emerald-400 border border-slate-700'
                }`}
              >
                {tab.itemCount}
              </span>
            )}

            {/* Close Button */}
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => onCloseTab(tab.id, e)}
                className={`ml-1 p-0.5 rounded-md transition-colors ${
                  isActive
                    ? 'hover:bg-emerald-700/80 text-emerald-100 hover:text-white'
                    : 'hover:bg-slate-600 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100'
                }`}
                title="Hold / Close Bill Tab"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Add New Bill Tab Button */}
      {tabs.length < maxTabs && (
        <button
          type="button"
          onClick={onAddTab}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-bold border border-emerald-500/30 transition-all text-[11px] shrink-0"
          title="New Bill Tab (Alt + N)"
        >
          <Plus className="w-4 h-4" />
          <span>New Bill</span>
        </button>
      )}

      {/* Counter Badge */}
      <div className="ml-auto px-2 py-1 text-[10px] text-slate-400 font-semibold shrink-0">
        Tabs: {tabs.length}/{maxTabs}
      </div>

    </div>
  );
};
