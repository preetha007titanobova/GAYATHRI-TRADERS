import React from 'react';
import { User, MapPin, FileText, ToggleLeft, ToggleRight, Phone, Search } from 'lucide-react';

interface CustomerDetailsPanelProps {
  isSelectiveCustomer: boolean;
  setIsSelectiveCustomer: (val: boolean) => void;
  buyerName: string;
  setBuyerName: (val: string) => void;
  mobileNo: string;
  setMobileNo: (val: string) => void;
  shippingAddress: string;
  setShippingAddress: (val: string) => void;
  remarks: string;
  setRemarks: (val: string) => void;
  availableCustomers?: any[];
  onSelectCustomer?: (customer: any) => void;
}

export const CustomerDetailsPanel: React.FC<CustomerDetailsPanelProps> = ({
  isSelectiveCustomer,
  setIsSelectiveCustomer,
  buyerName,
  setBuyerName,
  mobileNo,
  setMobileNo,
  shippingAddress,
  setShippingAddress,
  remarks,
  setRemarks,
  availableCustomers = [],
  onSelectCustomer
}) => {
  return (
    <div className="apple-glass-card rounded-2xl p-4 md:p-5 space-y-4 transition-all duration-300">
      
      {/* Panel Header & Selective Customer Switch */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <User size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Customer & Order Details</h3>
            <p className="text-[11px] text-slate-400">Configure buyer metadata and dispatch info</p>
          </div>
        </div>

        {/* Selective Customer Toggle */}
        <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <span className="text-xs font-medium text-slate-600">Selective Customer</span>
          <button
            onClick={() => setIsSelectiveCustomer(!isSelectiveCustomer)}
            className="text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
            title="Toggle Selective Customer Mode"
          >
            {isSelectiveCustomer ? (
              <ToggleRight size={28} className="text-blue-600" />
            ) : (
              <ToggleLeft size={28} className="text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Customer Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <User size={13} className="text-slate-400" />
            Buyer Name {isSelectiveCustomer && <span className="text-blue-500 font-bold">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="apple-input w-full pr-8"
            />
            {availableCustomers.length > 0 && (
              <Search size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Mobile Number */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Phone size={13} className="text-slate-400" />
            Mobile No
          </label>
          <input
            type="text"
            value={mobileNo}
            onChange={(e) => setMobileNo(e.target.value)}
            className="apple-input w-full"
          />
        </div>

        {/* Shipping Address */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-400" />
            Shipping Addr
          </label>
          <input
            type="text"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            className="apple-input w-full"
          />
        </div>

        {/* Remarks */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <FileText size={13} className="text-slate-400" />
            Remarks
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="apple-input w-full"
          />
        </div>

      </div>
    </div>
  );
};
