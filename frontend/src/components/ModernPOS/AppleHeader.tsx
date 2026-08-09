import React from 'react';
import { 
  Menu, Sparkles, UserCheck, PackageCheck, Lock, 
  Layers, ShoppingBag, ShoppingCart, Box, BarChart3, ChevronRight 
} from 'lucide-react';

interface AppleHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleDrawer: () => void;
  onOpenOwnerDetails: () => void;
  onOpenDailyStock: () => void;
  onOpenCloseDay: () => void;
  shopName?: string;
  invoiceNo?: string;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  activeTab,
  setActiveTab,
  onToggleDrawer,
  onOpenOwnerDetails,
  onOpenDailyStock,
  onOpenCloseDay,
  shopName = 'Namma Kada POS',
  invoiceNo = 'INV-001'
}) => {
  const primaryNavItems = [
    { id: 'master', label: 'Master', icon: Layers },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
    { id: 'stock', label: 'Stock', icon: Box },
    { id: 'report', label: 'Report', icon: BarChart3 }
  ];

  return (
    <header className="sticky top-0 z-30 w-full apple-glass border-b border-white/40 shadow-sm transition-all duration-300">
      <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Drawer Toggle & Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDrawer}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 active:scale-95 transition-all duration-200"
            title="Toggle Navigation Menu"
            aria-label="Toggle Menu"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2.5 pl-1 border-l border-slate-200/80">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm tracking-tight">{shopName}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-200/50">
                  Next POS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Invoice: #{invoiceNo}</p>
            </div>
          </div>
        </div>

        {/* Center: Primary Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 backdrop-blur-md p-1 rounded-2xl border border-slate-200/60 shadow-inner">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-md shadow-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Secondary Status Buttons */}
        <div className="flex items-center gap-2">
          {/* Owner Details Button */}
          <button
            onClick={onOpenOwnerDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100/80 hover:bg-white hover:shadow-sm text-slate-700 border border-slate-200/70 transition-all duration-200 active:scale-95"
            title="View Owner Details"
          >
            <UserCheck size={14} className="text-emerald-500" />
            <span className="hidden sm:inline">Owner Details</span>
          </button>

          {/* Daily Stock Status Button */}
          <button
            onClick={onOpenDailyStock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100/80 hover:bg-white hover:shadow-sm text-slate-700 border border-slate-200/70 transition-all duration-200 active:scale-95"
            title="Check Daily Stock Status"
          >
            <PackageCheck size={14} className="text-blue-500" />
            <span className="hidden sm:inline">Daily Stock Status</span>
          </button>

          {/* Close Day Button */}
          <button
            onClick={onOpenCloseDay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-200/70 transition-all duration-200 active:scale-95"
            title="Register End of Day Close"
          >
            <Lock size={14} className="text-rose-500" />
            <span>Close Day</span>
          </button>
        </div>

      </div>
    </header>
  );
};
