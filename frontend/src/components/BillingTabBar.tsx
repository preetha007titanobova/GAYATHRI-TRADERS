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
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-2.5 bg-slate-900/95 rounded-xl border border-slate-800 shadow-xl text-xs font-sans scrollbar-none min-h-[46px]">
      
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
            className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all duration-200 select-none min-w-[135px] max-w-[200px] border ${
              isActive
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold border-emerald-300/60 shadow-lg shadow-emerald-950/50 scale-[1.01]'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/60'
            }`}
          >
            <span className="flex items-center gap-1.5 shrink-0">
              <ShoppingBag className={`w-4 h-4 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`} />
              <span className="font-bold text-xs truncate tracking-wide">{displayName}</span>
            </span>

            {/* Badges for items & amount */}
            {tab.itemCount > 0 && (
              <span
                className={`ml-auto text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  isActive
                    ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-400/40'
                    : 'bg-slate-950 text-emerald-400 border border-slate-700'
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
                className={`ml-1 p-1 rounded-md transition-colors ${
                  isActive
                    ? 'hover:bg-emerald-700/90 text-emerald-100 hover:text-white'
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
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 font-extrabold border border-emerald-500/40 transition-all text-xs shrink-0 shadow-sm"
          title="New Bill Tab (Alt + N)"
        >
          <Plus className="w-4 h-4" />
          <span>New Bill</span>
        </button>
      )}

      {/* Counter Badge */}
      <div className="ml-auto px-3 py-1.5 text-xs text-slate-400 font-bold shrink-0">
        Tabs: {tabs.length}/{maxTabs}
      </div>

    </div>
  );
};
