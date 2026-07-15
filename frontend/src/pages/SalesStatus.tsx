import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search } from 'lucide-react';
import Api from '../Api';

interface SalesStatusRecord {
  id: string;
  invoiceNo: string;
  invDate: string;
  buyerName: string;
  originalSale: number;
  returned: number;
  exchanged: number;
  refunded: number;
  extraReceived: number;
  netSale: number;
  status: string;
}

const SalesStatus = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: { msg: string, type: 'error' | 'success' | 'info' | '' }) => void;
  }>() || {};

  const [records, setRecords] = useState<SalesStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Return/Exchange Details
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [selectedBuyerName, setSelectedBuyerName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [returnVouchers, setReturnVouchers] = useState<any[]>([]);

  const handleInvoiceClick = async (invoiceNo: string, buyerName: string) => {
    setSelectedInvoiceNo(invoiceNo);
    setSelectedBuyerName(buyerName);
    setIsDetailModalOpen(true);
    setModalLoading(true);
    setReturnVouchers([]);
    try {
      const res = await fetch(`${Api}/sales/returns/invoice/${invoiceNo}`);
      if (res.ok) {
        const data = await res.json();
        setReturnVouchers(data);
      }
    } catch (err) {
      console.error("Error loading return details:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${Api}/sales/status/report`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      } else {
        if (setGlobalNotification) setGlobalNotification({ msg: 'Failed to fetch sales status records.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) setGlobalNotification({ msg: 'Failed to load sales status report.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onPrint: () => {
          window.print();
          if (setGlobalNotification) setGlobalNotification({ msg: 'Printing Sales Status Report...', type: 'info' });
        }
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions, setGlobalNotification]);

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        rec.invoiceNo.toLowerCase().includes(q) ||
        rec.buyerName.toLowerCase().includes(q) ||
        rec.status.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery]);

  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, rec) => {
      acc.original += rec.originalSale || 0;
      acc.returned += rec.returned || 0;
      acc.exchanged += rec.exchanged || 0;
      acc.refunded += rec.refunded || 0;
      acc.extra += rec.extraReceived || 0;
      acc.net += rec.netSale || 0;
      return acc;
    }, { original: 0, returned: 0, exchanged: 0, refunded: 0, extra: 0, net: 0 });
  }, [filteredRecords]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Partially Returned':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Fully Returned':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Partially Exchanged':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Fully Exchanged':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f7f6] p-2 overflow-hidden space-y-2">
      
      {/* Search Header Ribbon */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded flex justify-between items-center print:hidden">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-700 text-sm">Invoice Search:</span>
          <div className="relative">
            <input
              type="text"
              placeholder="Search Invoice or Buyer..."
              className="border border-gray-400 pl-8 pr-2 py-1.5 text-sm rounded focus:outline-none focus:border-blue-500 w-64 shadow-inner"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-2.5 top-2 text-gray-500" />
          </div>
        </div>

        <div className="flex space-x-2">
          <button 
            onClick={fetchRecords} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm transition-all"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="bg-[#f8f9fa] border-b border-gray-300 p-2 flex justify-between items-center px-4 shadow-sm z-10">
          <div className="font-bold text-gray-700 text-xs uppercase tracking-wider">
            Sales Invoice Lifecycle & Status Report
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-12 text-center">#</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Invoice No</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-center">Date</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Customer Name</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-32">Original Sale</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-32 text-red-300">Returned Value</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-32 text-green-300">Exchanged Value</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-28 text-yellow-300">Refunded</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-28 text-orange-300">Extra Received</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold text-right w-36 bg-[#142d54]/25">Net Sale Value</th>
                <th className="p-2 text-xs font-semibold text-center w-40">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-gray-500 font-bold">
                    Loading sales invoice lifecycle data...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-gray-400 italic">
                    No sales invoice history matches the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => (
                  <tr 
                    key={rec.id} 
                    className={`border-b border-gray-200 transition-colors ${
                      idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-[#fcfdfd] hover:bg-blue-50/40'
                    }`}
                  >
                    <td className="border-r border-gray-200 p-2 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                    <td 
                      onClick={() => handleInvoiceClick(rec.invoiceNo, rec.buyerName)}
                      className="border-r border-gray-200 p-2 font-bold text-blue-600 font-mono text-xs hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {rec.invoiceNo}
                    </td>
                    <td className="border-r border-gray-200 p-2 text-center text-xs">{new Date(rec.invDate).toLocaleDateString()}</td>
                    <td className="border-r border-gray-200 p-2 font-medium text-gray-800">{rec.buyerName}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono text-gray-700">₹{rec.originalSale.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono text-red-600 bg-red-50/10">₹{rec.returned.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono text-green-600 bg-green-50/10">₹{rec.exchanged.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono text-orange-600 bg-orange-50/10">₹{rec.refunded.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono text-emerald-600 bg-emerald-50/10">₹{rec.extraReceived.toFixed(2)}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono font-black text-blue-900 bg-blue-50/20">₹{rec.netSale.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusClass(rec.status)}`}>
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
          <div className="text-xs font-bold text-blue-200">
            Total Invoices: {filteredRecords.length}
          </div>
          <div className="flex space-x-3 items-center">
            <div className="flex items-center bg-[#142d54] px-3 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Original:</span>
              <span className="font-mono text-white">₹{totals.original.toFixed(2)}</span>
            </div>
            <div className="flex items-center bg-[#142d54] px-3 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Returned:</span>
              <span className="font-mono text-red-300">₹{totals.returned.toFixed(2)}</span>
            </div>
            <div className="flex items-center bg-[#142d54] px-3 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Exchanged:</span>
              <span className="font-mono text-green-300">₹{totals.exchanged.toFixed(2)}</span>
            </div>
            <div className="flex items-center bg-[#142d54] px-3 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Refunded:</span>
              <span className="font-mono text-orange-300">₹{totals.refunded.toFixed(2)}</span>
            </div>
            <div className="flex items-center bg-[#142d54] px-3 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Extra Recv:</span>
              <span className="font-mono text-emerald-300">₹{totals.extra.toFixed(2)}</span>
            </div>
            <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] text-xs font-bold text-blue-200">
              <span className="uppercase mr-1.5">Net Sales:</span>
              <span className="font-mono text-yellow-300 text-sm font-black">₹{totals.net.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Invoice Return / Exchange Details Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setIsDetailModalOpen(false)}>
          <div className="bg-white shadow-2xl flex flex-col border border-gray-500 rounded-md w-3/4 max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1e3f70] text-white px-4 py-3 flex justify-between items-center shadow-sm">
              <div>
                <span className="font-bold text-sm uppercase tracking-wider block">Return & Exchange Lifecycle Details</span>
                <span className="text-[10px] text-blue-200 font-semibold font-mono">Invoice No: {selectedInvoiceNo} | Customer: {selectedBuyerName}</span>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-white hover:text-red-300 font-bold text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-6 bg-slate-50">
              {modalLoading ? (
                <div className="text-center py-12 text-gray-500 font-bold italic animate-pulse">Loading return items details...</div>
              ) : returnVouchers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-bold italic">
                  No returns or exchanges found for this invoice.
                </div>
              ) : (
                returnVouchers.map((vch: any, vchIdx: number) => {
                  const taxAmt = (vch.cgstReturn || 0) + (vch.sgstReturn || 0) + (vch.igstReturn || 0);
                  const isExchange = vch.returnType === 'Exchange (Replacement)';
                  return (
                    <div key={vch._id || vchIdx} className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-gray-700 uppercase">Voucher: </span>
                          <span className="font-mono font-bold text-blue-700">{vch.returnNo}</span>
                        </div>
                        <div className="flex space-x-3 items-center">
                          <span>Date: <span className="font-semibold text-gray-700">{new Date(vch.returnDate).toLocaleDateString()}</span></span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isExchange 
                              ? 'bg-purple-100 text-purple-800 border-purple-300' 
                              : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          }`}>
                            {vch.returnType ? vch.returnType.toUpperCase() : 'RETURN'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 space-y-4">
                        {/* Metadata row */}
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 border-b border-gray-100 pb-2">
                          <div>
                            <span className="font-bold block uppercase text-[10px] text-gray-400">Return Reason</span>
                            <span className="font-semibold text-gray-800">{vch.reason || 'Not Specified'}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold block uppercase text-[10px] text-gray-400">Total Returned Items Value (Before Tax)</span>
                            <span className="font-mono font-bold text-gray-800">₹{(vch.totalReturnAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Returned Items Table */}
                        <div>
                          <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Returned Products</span>
                          <table className="w-full text-left text-xs border-collapse rounded border border-gray-200">
                            <thead className="bg-red-50 text-red-900">
                              <tr className="border-b border-gray-200">
                                <th className="p-1.5 border-r border-gray-200 w-8 text-center">#</th>
                                <th className="p-1.5 border-r border-gray-200 w-24">Item Code</th>
                                <th className="p-1.5 border-r border-gray-200">Name</th>
                                <th className="p-1.5 border-r border-gray-200 w-20 text-center">Return Qty</th>
                                <th className="p-1.5 border-r border-gray-200 w-24 text-right">Rate</th>
                                <th className="p-1.5 border-r border-gray-200 w-20 text-center">Tax %</th>
                                <th className="p-1.5 border-r border-gray-200 w-24 text-right">Taxable</th>
                                <th className="p-1.5 border-r border-gray-200 w-32">Disposition</th>
                                <th className="p-1.5 text-right w-24">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vch.items && vch.items.map((item: any, itemIdx: number) => (
                                <tr key={item._id || itemIdx} className="border-b border-gray-100 hover:bg-slate-50">
                                  <td className="p-1.5 border-r border-gray-100 text-center font-mono text-gray-500">{itemIdx + 1}</td>
                                  <td className="p-1.5 border-r border-gray-100 font-mono text-gray-600">{item.itemCode}</td>
                                  <td className="p-1.5 border-r border-gray-100 font-bold text-gray-800">{item.itemName}</td>
                                  <td className="p-1.5 border-r border-gray-100 text-center font-bold text-red-700 bg-red-50/20">{item.returnQty}</td>
                                  <td className="p-1.5 border-r border-gray-100 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                                  <td className="p-1.5 border-r border-gray-100 text-center font-mono text-gray-600">{item.taxPercent.toFixed(1)}%</td>
                                  <td className="p-1.5 border-r border-gray-100 text-right font-mono text-gray-600">₹{item.taxableAmt.toFixed(2)}</td>
                                  <td className="p-1.5 border-r border-gray-100 text-gray-600 font-semibold">{item.disposition}</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-red-800 bg-red-50/5">₹{item.subtotal.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Replacement Items (for Exchange only) */}
                        {isExchange && (
                          <div>
                            <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Replacement Products Purchased</span>
                            <table className="w-full text-left text-xs border-collapse rounded border border-gray-200">
                              <thead className="bg-green-50 text-green-900">
                                <tr className="border-b border-gray-200">
                                  <th className="p-1.5 border-r border-gray-200 w-8 text-center">#</th>
                                  <th className="p-1.5 border-r border-gray-200 w-24">Item Code</th>
                                  <th className="p-1.5 border-r border-gray-200">Name</th>
                                  <th className="p-1.5 border-r border-gray-200 w-20 text-center">Qty</th>
                                  <th className="p-1.5 border-r border-gray-200 w-24 text-right">Unit Price</th>
                                  <th className="p-1.5 border-r border-gray-200 w-20 text-center">Tax %</th>
                                  <th className="p-1.5 border-r border-gray-200 w-24 text-right">Taxable</th>
                                  <th className="p-1.5 text-right w-24">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vch.replacementItems && vch.replacementItems.map((item: any, itemIdx: number) => (
                                  <tr key={item._id || itemIdx} className="border-b border-gray-100 hover:bg-slate-50">
                                    <td className="p-1.5 border-r border-gray-100 text-center font-mono text-gray-500">{itemIdx + 1}</td>
                                    <td className="p-1.5 border-r border-gray-100 font-mono text-gray-600">{item.itemCode}</td>
                                    <td className="p-1.5 border-r border-gray-100 font-bold text-gray-800">{item.itemName}</td>
                                    <td className="p-1.5 border-r border-gray-100 text-center font-bold text-green-700 bg-green-50/20">{item.qty}</td>
                                    <td className="p-1.5 border-r border-gray-100 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                                    <td className="p-1.5 border-r border-gray-100 text-center font-mono text-gray-600">{item.taxPercent.toFixed(1)}%</td>
                                    <td className="p-1.5 border-r border-gray-100 text-right font-mono text-gray-600">₹{item.taxableAmt.toFixed(2)}</td>
                                    <td className="p-1.5 text-right font-mono font-bold text-green-800 bg-green-50/5">₹{item.subtotal.toFixed(2)}</td>
                                  </tr>
                                ))}
                                {(!vch.replacementItems || vch.replacementItems.length === 0) && (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-400 italic">No replacement products recorded.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Financial offsets summary */}
                        <div className="bg-slate-50 p-2.5 rounded border border-gray-200 flex justify-between items-center text-xs">
                          <div className="flex space-x-4">
                            <span>Tax Return: <span className="font-mono font-bold text-slate-800">₹{taxAmt.toFixed(2)}</span></span>
                            {isExchange && (
                              <>
                                <span>Extra Collected: <span className="font-mono font-bold text-emerald-700">₹{(vch.extraReceived || 0).toFixed(2)} ({vch.paymentMode})</span></span>
                                <span>Refunded/Credit: <span className="font-mono font-bold text-red-700">₹{(vch.refundAmount || 0).toFixed(2)} ({vch.refundMethod})</span></span>
                              </>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 mr-2 uppercase text-[10px]">Net Adjustment:</span>
                            <span className="font-mono font-extrabold text-[#1e3f70] text-sm">
                              ₹{(isExchange ? (vch.extraReceived - vch.refundAmount) : vch.netRefundAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-300 p-3 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-1.5 rounded text-xs shadow transition-all"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesStatus;
