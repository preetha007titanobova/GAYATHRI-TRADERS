import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Payment {
  _id?: string;
  customerName: string;
  amount: number;
  paymentMode: string;
  date: string;
  notes?: string;
}

interface Invoice {
  _id?: string;
  invoiceNo: string;
  invDate: string;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentMode?: string;
}

interface Customer {
  _id?: string;
  ledgerCode: string;
  accountName: string;
  mobileNo?: string;
  email?: string;
  address?: string;
  gstNo?: string;
  creditLimit?: number;
  openingBalance: number;
  drCr?: string;
}

const CustomerLedger = () => {
  const { setGlobalNotification } = useOutletContext<{ setGlobalNotification?: any }>() || {};

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states for Payment Entry
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Load available customer accounts
  const loadCustomers = () => {
    fetch(`${Api}/ledgers/search?group=Customers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCustomers(data);
        }
      })
      .catch(err => console.error("Error loading customers:", err));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Find selected customer object
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.accountName === selectedCustomerName) || null;
  }, [customers, selectedCustomerName]);

  // Load customer statements and bills
  const loadStatementData = async (name: string) => {
    if (!name) {
      setInvoices([]);
      setPayments([]);
      return;
    }
    setLoading(true);
    try {
      // Fetch invoices filtered by customer name
      const invRes = await fetch(`${Api}/sales/bills/search?customer=${encodeURIComponent(name)}`);
      const invData = await invRes.json();
      
      // Fetch custom payments filtered by customer name
      const payRes = await fetch(`${Api}/payments?customerName=${encodeURIComponent(name)}`);
      const payData = await payRes.json();

      setInvoices(Array.isArray(invData) ? invData : []);
      setPayments(Array.isArray(payData) ? payData : []);
    } catch (err) {
      console.error("Error fetching statement data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatementData(selectedCustomerName);
  }, [selectedCustomerName]);

  // Compute statement transaction array dynamically
  const statementRecords = useMemo(() => {
    const list: any[] = [];
    
    // 1. Invoices (Debits)
    invoices.forEach(inv => {
      list.push({
        date: new Date(inv.invDate),
        type: 'Sales Invoice',
        docNo: inv.invoiceNo,
        debit: inv.netAmount,
        credit: 0,
        remarks: inv.paymentMode ? `Payment Mode: ${inv.paymentMode}` : ''
      });
    });

    // 2. Payments (Credits)
    payments.forEach(pay => {
      list.push({
        date: new Date(pay.date),
        type: pay.notes?.startsWith('Auto-payment') ? 'Invoice Payment' : 'Payment Received',
        docNo: pay.notes?.startsWith('Auto-payment') ? pay.notes.split('Invoice ')[1] || 'PAY' : 'COLLECTION',
        debit: 0,
        credit: pay.amount,
        remarks: `Mode: ${pay.paymentMode}${pay.notes ? ` - ${pay.notes}` : ''}`
      });
    });

    // Sort chronologically
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return list;
  }, [invoices, payments]);

  // Outstanding/Current Balance calculations
  const summaryBalances = useMemo(() => {
    const opening = activeCustomer ? Number(activeCustomer.openingBalance) || 0 : 0;
    
    let totalDebit = 0;
    let totalCredit = 0;

    statementRecords.forEach(r => {
      totalDebit += r.debit;
      totalCredit += r.credit;
    });

    const outstanding = opening + totalDebit - totalCredit;

    return {
      opening,
      totalDebit,
      totalCredit,
      outstanding
    };
  }, [activeCustomer, statementRecords]);

  // Compute running balance column for layout table
  const tableDataWithRunningBalance = useMemo(() => {
    let bal = summaryBalances.opening;
    return statementRecords.map(r => {
      bal = bal + r.debit - r.credit;
      return {
        ...r,
        runningBalance: bal
      };
    });
  }, [statementRecords, summaryBalances.opening]);

  // Save payment handler
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerName) {
      alert("Please select a customer first.");
      return;
    }
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    setSubmitLoading(true);
    const payload = {
      customerName: selectedCustomerName,
      amount: amt,
      paymentMode: payMode,
      date: payDate,
      notes: payNotes
    };

    try {
      const res = await fetch(`${Api}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Payment of ₹${amt} collected successfully!`, type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
        setPayAmount('');
        setPayNotes('');
        // Reload data
        loadStatementData(selectedCustomerName);
      } else {
        alert("Failed to save payment: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error collection process failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Professional PDF Exporter
  const handleDownloadPDF = () => {
    if (!activeCustomer) return;
    
    const doc = new jsPDF();
    const formattedDate = new Date().toLocaleDateString('en-IN');

    // Header Panel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154); // Navy Blue
    doc.text("SRI GAYATHRI TRADERS", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text("Customer Account Ledger Statement", 14, 25);
    doc.text(`Generated Date: ${formattedDate}`, 150, 20);
    
    doc.line(14, 28, 196, 28);

    // Customer profile info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`CUSTOMER DETAILS:`, 14, 36);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Name: ${activeCustomer.accountName}`, 14, 42);
    doc.text(`Ledger Code: ${activeCustomer.ledgerCode}`, 14, 47);
    doc.text(`Mobile: ${activeCustomer.mobileNo || 'N/A'}`, 14, 52);
 
    doc.text(`Opening Balance: Rs. ${summaryBalances.opening.toFixed(2)}`, 110, 42);
    doc.text(`Credit Limit: Rs. ${activeCustomer.creditLimit ? activeCustomer.creditLimit.toFixed(2) : 'N/A'}`, 110, 47);
    doc.text(`Outstanding Due: Rs. ${summaryBalances.outstanding.toFixed(2)}`, 110, 52);

    // Build statement table
    const tableHeaders = ["Date", "Transaction Type", "Doc/Inv No", "Debit (Rs.)", "Credit (Rs.)", "Balance (Rs.)"];
    
    const tableRows = [];
    
    // Add opening row
    tableRows.push([
      activeCustomer.openingBalance ? 'Migrated' : '-',
      "Opening Balance",
      "-",
      summaryBalances.opening > 0 ? summaryBalances.opening.toFixed(2) : "-",
      "-",
      summaryBalances.opening.toFixed(2)
    ]);

    tableDataWithRunningBalance.forEach(r => {
      tableRows.push([
        new Date(r.date).toLocaleDateString('en-IN'),
        r.type,
        r.docNo,
        r.debit > 0 ? r.debit.toFixed(2) : "-",
        r.credit > 0 ? r.credit.toFixed(2) : "-",
        r.runningBalance.toFixed(2)
      ]);
    });

    autoTable(doc, {
      startY: 65,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8.5 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    doc.save(`Statement_${activeCustomer.accountName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      
      {/* Search Header panel */}
      <div className="bg-[#2b579a] text-white px-3 py-2 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-sm">Customer Ledger Directory & Statement</span>
          <div className="flex items-center space-x-2 text-black">
            <span className="text-white font-semibold">Select Customer:</span>
            <select 
              className="legacy-input w-64 font-bold py-0.5" 
              value={selectedCustomerName} 
              onChange={e => setSelectedCustomerName(e.target.value)}
            >
              <option value="">-- Choose a Customer --</option>
              {customers.map(c => (
                <option key={c._id} value={c.accountName}>{c.accountName} ({c.ledgerCode})</option>
              ))}
            </select>
          </div>
        </div>
        {activeCustomer && (
          <button 
            onClick={handleDownloadPDF} 
            className="bg-[#e6f2ff] hover:bg-[#cce5ff] text-blue-900 border border-[#b3d4fc] font-bold py-1 px-3 rounded shadow-xs"
          >
            📥 Download Statement PDF
          </button>
        )}
      </div>

      {!selectedCustomerName ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500 font-bold text-sm italic">
          Please select a customer ledger from the dropdown above to view balances and statement.
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: Customer profile cards and Payment Collector */}
          <div className="w-[30%] bg-[#f4f7f6] border-r border-gray-400 p-4 space-y-4 overflow-y-auto">
            
            {/* profile details */}
            <div className="bg-white border border-gray-300 rounded p-3 shadow-xs space-y-2">
              <h3 className="font-bold text-blue-900 border-b border-gray-200 pb-1 text-sm flex justify-between">
                <span>Account Profile</span>
                <span className="text-[10px] text-gray-500 font-mono">{activeCustomer?.ledgerCode}</span>
              </h3>
              <div className="space-y-1 font-semibold text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="text-gray-900">{activeCustomer?.accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mobile:</span>
                  <span>{activeCustomer?.mobileNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span>{activeCustomer?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1">
                  <span className="text-gray-500">Opening Bal:</span>
                  <span className="font-mono">₹{summaryBalances.opening.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Credit Limit:</span>
                  <span className="font-mono">₹{activeCustomer?.creditLimit ? activeCustomer.creditLimit.toLocaleString() : 'No Limit'}</span>
                </div>
              </div>
            </div>

            {/* Outstanding status */}
            <div className="bg-white border border-rose-300 rounded p-3 shadow-xs space-y-2">
              <h3 className="font-bold text-rose-800 border-b border-rose-100 pb-1 text-xs uppercase">
                Outstanding Due
              </h3>
              <div className="text-center py-2">
                <div className="text-[22px] font-bold font-mono text-rose-600">
                  ₹{summaryBalances.outstanding.toLocaleString()}
                </div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase mt-0.5">
                  Real-time Outstanding Balance
                </div>
              </div>
            </div>

            {/* Payment entry collection form */}
            <form onSubmit={handleSavePayment} className="bg-white border border-emerald-300 rounded p-3 shadow-xs space-y-3">
              <h3 className="font-bold text-emerald-800 border-b border-emerald-100 pb-1 text-xs uppercase flex items-center space-x-1">
                <span>💵 Payment Collection Entry</span>
              </h3>
              
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 font-bold mb-1">Receipt Date</label>
                <input 
                  type="date" 
                  className="legacy-input w-full p-1" 
                  value={payDate} 
                  onChange={e => setPayDate(e.target.value)} 
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 font-bold mb-1">Received Amount (₹)</label>
                <input 
                  type="number" 
                  className="legacy-input w-full p-1 font-bold text-right text-emerald-800 focus:bg-yellow-50" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                  placeholder="Enter amount"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 font-bold mb-1">Payment Mode</label>
                <select 
                  className="legacy-input w-full p-1" 
                  value={payMode} 
                  onChange={e => setPayMode(e.target.value)}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Bank</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 font-bold mb-1">Notes / Remarks</label>
                <input 
                  type="text" 
                  className="legacy-input w-full p-1" 
                  value={payNotes} 
                  onChange={e => setPayNotes(e.target.value)} 
                  placeholder="e.g. Received by cashier"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded border border-emerald-700 shadow-sm transition-all focus:ring-2 focus:ring-emerald-500"
              >
                {submitLoading ? 'Saving...' : 'Record Payment Collection'}
              </button>
            </form>

          </div>

          {/* RIGHT: Statement Tables list */}
          <div className="w-[70%] bg-white flex flex-col overflow-hidden p-3 space-y-3">
            <div className="bg-[#1e3f70] text-white px-3 py-1.5 font-bold flex justify-between items-center rounded-t shadow-xs">
              <span>Account Statement Ledger</span>
              <span>Transactions: {tableDataWithRunningBalance.length}</span>
            </div>

            <div className="flex-1 overflow-auto border border-gray-300 rounded-b">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500 italic">
                  Loading statement records...
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#e9ecef] sticky top-0 shadow-xs z-10">
                    <tr>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase">Date</th>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase">Transaction Type</th>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase">Doc No</th>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase text-right">Debit (₹)</th>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase text-right">Credit (₹)</th>
                      <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Opening Balance Row */}
                    <tr className="border-b border-gray-200 bg-gray-50 font-semibold italic">
                      <td className="p-2 text-gray-500">-</td>
                      <td className="p-2 text-gray-800">Opening Balance</td>
                      <td className="p-2 text-gray-500">-</td>
                      <td className="p-2 text-right text-gray-700">
                        {summaryBalances.opening > 0 ? summaryBalances.opening.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 text-right text-gray-500">-</td>
                      <td className="p-2 text-right text-blue-900">
                        ₹{summaryBalances.opening.toLocaleString()}
                      </td>
                    </tr>
                    
                    {tableDataWithRunningBalance.map((r, idx) => {
                      const isInvoice = r.type === 'Sales Invoice';
                      return (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-[#d1e8e2] transition-colors">
                          <td className="p-2">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2 font-semibold">
                            <span className={isInvoice ? 'text-indigo-800' : 'text-emerald-800'}>
                              {r.type}
                            </span>
                            {r.remarks && <div className="text-[10px] text-gray-500 font-normal">{r.remarks}</div>}
                          </td>
                          <td className="p-2 font-mono font-bold text-gray-600">{r.docNo}</td>
                          <td className="p-2 text-right font-mono font-bold text-gray-800">
                            {r.debit > 0 ? `₹${r.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-700">
                            {r.credit > 0 ? `₹${r.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-blue-900">
                            ₹{r.runningBalance.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold sticky bottom-0 border-t border-gray-400">
                    <tr>
                      <td colSpan={3} className="p-2 text-right text-gray-600">Totals</td>
                      <td className="p-2 text-right font-mono text-gray-800">₹{summaryBalances.totalDebit.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-emerald-800">₹{summaryBalances.totalCredit.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-rose-600">₹{summaryBalances.outstanding.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default CustomerLedger;
