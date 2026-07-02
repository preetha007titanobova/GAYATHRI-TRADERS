import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Search } from 'lucide-react';

interface SalesBill {
  _id: string;
  invoiceNo: string;
  invDate: string;
  buyerName: string;
  gstNo: string;
  totalAmount: number;
  cgst: number;
  sgst: number;
  netAmount: number;
}

const SalesRegister = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();
  
  const [salesBills, setSalesBills] = useState<SalesBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/sales-bills/search?q=${searchQuery}`);
      if (response.ok) {
        const data = await response.json();
        setSalesBills(data);
      }
    } catch (error) {
      console.error('Failed to fetch sales bills:', error);
      setGlobalNotification({ msg: 'Failed to load sales register data from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [searchQuery]);

  useEffect(() => {
    setToolbarActions({
      onAdd: () => navigate('/sales-bill'),
      onEdit: () => {
        if (!selectedRowId) {
          setGlobalNotification({ msg: 'Please select a record to edit.', type: 'error' });
          return;
        }
        const selectedBill = salesBills.find(b => b._id === selectedRowId);
        if (selectedBill) {
           setGlobalNotification({ msg: `Editing invoice ${selectedBill.invoiceNo} feature is coming soon!`, type: 'info' });
        }
      },
      onDelete: () => {
        if (!selectedRowId) {
          setGlobalNotification({ msg: 'Please select a record to delete.', type: 'error' });
          return;
        }
        if (window.confirm('Are you sure you want to delete this sales bill?')) {
          setSalesBills(prev => prev.filter(b => b._id !== selectedRowId));
          setSelectedRowId(null);
          setGlobalNotification({ msg: 'Sales bill deleted successfully (Mock).', type: 'success' });
        }
      },
      onFind: () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      },
      onPrint: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to print.', type: 'error' });
        setGlobalNotification({ msg: 'Print layout opened successfully.', type: 'success' });
      },
      onEmail: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to email.', type: 'error' });
        setGlobalNotification({ msg: 'Invoice emailed to client successfully.', type: 'success' });
      },
      onSms: () => {
        if (!selectedRowId) return setGlobalNotification({ msg: 'Please select a record to SMS.', type: 'error' });
        setGlobalNotification({ msg: 'SMS sent to client successfully.', type: 'success' });
      }
    });

    return () => setToolbarActions({});
  }, [setToolbarActions, navigate, selectedRowId, salesBills, setGlobalNotification]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 relative">
      <div className="flex justify-between items-center mb-2 bg-white p-2 border border-gray-300 shadow-sm rounded">
        <h2 className="text-xl font-bold text-gray-700 flex items-center">
          <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
          Sales Register
        </h2>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search Invoice No..." 
              className="border border-gray-400 pl-8 pr-2 py-1 text-sm rounded focus:outline-none focus:border-blue-500 w-64 shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute left-2 top-1.5 text-gray-500" />
          </div>
          <button onClick={fetchBills} className="bg-blue-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-blue-700 shadow border border-blue-800">Refresh</button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-gray-400 shadow-sm overflow-auto">
        <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
          <thead className="bg-[#e0e0e0] text-gray-800 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="border-r border-b border-gray-400 p-2 font-bold w-12 text-center">#</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Invoice No</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Date</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">Customer Name</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold">GSTIN</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Gross Amt</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Tax Amt</th>
              <th className="border-r border-b border-gray-400 p-2 font-bold text-right">Net Amt</th>
              <th className="border-b border-gray-400 p-2 font-bold text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500 font-semibold">Loading data...</td>
              </tr>
            ) : salesBills.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500 font-semibold">No sales records found.</td>
              </tr>
            ) : (
              salesBills.map((bill, index) => {
                const taxAmt = (bill.cgst || 0) + (bill.sgst || 0);
                const isSelected = selectedRowId === bill._id;
                
                return (
                  <tr 
                    key={bill._id} 
                    onClick={() => setSelectedRowId(bill._id)}
                    className={`border-b border-gray-200 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium' : 'hover:bg-blue-50'
                    }`}
                  >
                    <td className="border-r border-gray-300 p-1.5 text-center text-gray-600">{index + 1}</td>
                    <td className="border-r border-gray-300 p-1.5 font-semibold text-[#2b579a]">{bill.invoiceNo}</td>
                    <td className="border-r border-gray-300 p-1.5">{new Date(bill.invDate).toLocaleDateString()}</td>
                    <td className="border-r border-gray-300 p-1.5">{bill.buyerName || 'CASH CUSTOMER'}</td>
                    <td className="border-r border-gray-300 p-1.5">{bill.gstNo || '-'}</td>
                    <td className="border-r border-gray-300 p-1.5 text-right font-mono">₹{bill.totalAmount?.toFixed(2) || '0.00'}</td>
                    <td className="border-r border-gray-300 p-1.5 text-right font-mono text-red-600">₹{taxAmt.toFixed(2)}</td>
                    <td className="border-r border-gray-300 p-1.5 text-right font-mono font-bold text-green-700">₹{bill.netAmount?.toFixed(2) || '0.00'}</td>
                    <td className="p-1.5 text-center">
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-300">CLEARED</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer Totals */}
      <div className="bg-[#e0e0e0] border border-gray-400 mt-2 p-1.5 flex justify-between items-center text-sm font-bold shadow-sm rounded">
        <div className="text-gray-700">Total Records: <span className="text-blue-700">{salesBills.length}</span></div>
        <div className="flex space-x-6 text-gray-800">
          <div>Total Gross: <span className="font-mono ml-1">₹{salesBills.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0).toFixed(2)}</span></div>
          <div className="text-red-700">Total Tax: <span className="font-mono ml-1">₹{salesBills.reduce((acc, curr) => acc + (curr.cgst || 0) + (curr.sgst || 0), 0).toFixed(2)}</span></div>
          <div className="text-green-800 text-base">Total Net Amount: <span className="font-mono ml-1">₹{salesBills.reduce((acc, curr) => acc + (curr.netAmount || 0), 0).toFixed(2)}</span></div>
        </div>
      </div>

    </div>
  );
};

export default SalesRegister;