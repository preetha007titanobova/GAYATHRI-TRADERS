import React from 'react';
import { 
  X, Users, Package, FileText, ShoppingBag, Receipt, 
  BarChart, QrCode, Database, Settings, ShieldCheck, 
  ChevronRight, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  if (!isOpen) return null;

  const menuCategories = [
    {
      title: 'Masters & Setup',
      items: [
        { label: 'Ledger Master', path: '/ledger-master', icon: Users, desc: 'Manage customer & vendor accounts' },
        { label: 'Item Master', path: '/item-master', icon: Package, desc: 'Products, inventory & prices' },
        { label: 'Staff Master', path: '/staff-master', icon: ShieldCheck, desc: 'Employees & attendance management' },
        { label: 'Barcode Generation', path: '/barcode-generation', icon: QrCode, desc: 'Print & design item labels' },
      ]
    },
    {
      title: 'Sales & Invoicing',
      items: [
        { label: 'Sales Register', path: '/sales-register', icon: FileText, desc: 'All sales invoice history' },
        { label: 'Quotation / Estimate', path: '/quotation', icon: Receipt, desc: 'Create price estimates' },
        { label: 'Sales Order', path: '/sales-order', icon: ShoppingBag, desc: 'Manage incoming customer orders' },
        { label: 'Sales Return', path: '/sales-return', icon: FileText, desc: 'Process credit notes & returns' },
      ]
    },
    {
      title: 'Purchase & Vendor',
      items: [
        { label: 'Purchase Bill', path: '/purchase-bill', icon: Receipt, desc: 'Record stock purchase entry' },
        { label: 'Purchase Register', path: '/pur-register', icon: FileText, desc: 'Vendor invoices history' },
        { label: 'Purchase Return', path: '/pur-return', icon: FileText, desc: 'Vendor debit note returns' },
      ]
    },
    {
      title: 'Stock & Intelligence',
      items: [
        { label: 'Stock Status', path: '/stock-status', icon: BarChart, desc: 'Real-time quantity valuation' },
        { label: 'Daily Stock Status', path: '/daily-stock-status', icon: Package, desc: 'Day-to-day stock ledger' },
        { label: 'Financial Reports', path: '/p-l-statment', icon: Database, desc: 'P&L, Trial Balance & Balance Sheet' },
      ]
    }
  ];

  const handleLinkClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Glass Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Drawer Panel */}
      <aside className="relative w-80 max-w-full h-full apple-glass-dark text-slate-100 flex flex-col z-10 shadow-2xl border-r border-white/10 overflow-hidden animate-slide-right">
        
        {/* Drawer Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base tracking-tight">Navigation Drawer</h2>
              <p className="text-xs text-slate-400">Quick Access Modules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
          {menuCategories.map((category, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-[11px] uppercase font-bold tracking-wider text-blue-400/90 px-2">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleLinkClick(item.path)}
                      className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all duration-200 group"
                    >
                      <div className="p-2 rounded-lg bg-white/5 text-slate-300 group-hover:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                            {item.label}
                          </span>
                          <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-slate-400">
          <span>v2.5 Modern SPA</span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> System Ready
          </span>
        </div>

      </aside>
    </div>
  );
};
