import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { BookOpen, Calendar, Printer } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LedgerMove {
  id: string;
  date: string;
  particulars: string;
  vchType: string;
  vchNo: string;
  dr: number;
  cr: number;
}

interface LedgerAccount {
  id: string;
  _id?: string;
  ledgerCode: string;
  accountName: string;
  accountGroup: string;
  openingBalance: number;
  drCr: string;
}

const ViewLedger = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  // Date defaults: default from 1st April of current year to 31st March of next year
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [selectedLedger, setSelectedLedger] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<LedgerMove[]>([]);
  const [activeLedger, setActiveLedger] = useState<LedgerAccount | null>(null);

  // Load ledgers list
  useEffect(() => {
    fetch(`${Api}/ledgers/search?q=`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((l: any) => ({
            id: l._id || l.id,
            ledgerCode: l.ledgerCode,
            accountName: l.accountName,
            accountGroup: l.accountGroup,
            openingBalance: Number(l.openingBalance) || 0,
            drCr: l.drCr || 'Dr'
          }));
          setLedgers(mapped);
          if (mapped.length > 0) {
            setSelectedLedger(mapped[0].id);
          }
        }
      })
      .catch(err => {
        console.error("Error loading ledgers list:", err);
        setGlobalNotification({ msg: 'Failed to load ledgers catalog.', type: 'error' });
      });
  }, []);

  // Fetch statement data
  const fetchLedgerStatement = () => {
    if (!selectedLedger) return;
    setLoading(true);
    fetch(`${Api}/ledgers/${selectedLedger}/statement?fromDate=${fromDate}&toDate=${toDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.ledger) {
          setActiveLedger(data.ledger);
        }
        if (Array.isArray(data.movements)) {
          setMovements(data.movements);
        } else {
          setMovements([]);
        }
      })
      .catch(err => {
        console.error("Error loading ledger statement:", err);
        setGlobalNotification({ msg: 'Failed to load ledger transactions.', type: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedgerStatement();
  }, [selectedLedger, fromDate, toDate]);

  const downloadPDF = () => {
    if (!activeLedger) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text(`Ledger Statement: ${activeLedger.accountName}`, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${fromDate.split('-').reverse().join('-')} to ${toDate.split('-').reverse().join('-')} | Group: ${activeLedger.accountGroup}`, 14, 22);

    // Opening Balance
    doc.text(`Opening Balance: ${statement.opBalDisplay.amount.toFixed(2)} ${statement.opBalDisplay.type}`, 14, 28);

    const headers = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit (DR)", "Credit (CR)", "Balance"];
    const rows = statement.rows.map(row => [
      row.date ? row.date.split('-').reverse().join('-') : '',
      row.particulars,
      row.vchType,
      row.vchNo,
      row.dr > 0 ? `Rs. ${row.dr.toFixed(2)}` : '',
      row.cr > 0 ? `Rs. ${row.cr.toFixed(2)}` : '',
      `Rs. ${row.balAmt.toFixed(2)} ${row.balType}`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total Debit: Rs. ${statement.totalDr.toFixed(2)}`, 14, finalY);
    doc.text(`Total Credit: Rs. ${statement.totalCr.toFixed(2)}`, 14, finalY + 6);
    doc.setFontSize(12);
    doc.text(`Closing Balance: Rs. ${statement.clBalDisplay.amount.toFixed(2)} ${statement.clBalDisplay.type}`, 14, finalY + 14);

    doc.save(`Ledger_${activeLedger.accountName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`);
  };

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Ledger Statement...', type: 'info' });
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const statement = useMemo(() => {
    // Base Op Bal (Signed: Dr is positive, Cr is negative)
    let runningBal = activeLedger ? (activeLedger.drCr === 'Dr' ? activeLedger.openingBalance : -activeLedger.openingBalance) : 0;

    // Adjust for prior moves (before fromDate)
    const priorMoves = movements.filter(m => m.date < fromDate);
    priorMoves.forEach(m => {
      runningBal += m.dr;
      runningBal -= m.cr;
    });

    const opBalDisplay = {
      amount: Math.abs(runningBal),
      type: runningBal >= 0 ? 'Dr' : 'Cr'
    };

    let totalDr = 0;
    let totalCr = 0;

    const filtered = movements.filter(m => m.date >= fromDate && m.date <= toDate);

    const rows = filtered.map(m => {
      runningBal += m.dr;
      runningBal -= m.cr;
      totalDr += m.dr;
      totalCr += m.cr;
      
      return { 
        ...m, 
        balAmt: Math.abs(runningBal), 
        balType: runningBal >= 0 ? 'Dr' : 'Cr' 
      };
    });

    const clBalDisplay = {
      amount: Math.abs(runningBal),
      type: runningBal >= 0 ? 'Dr' : 'Cr'
    };

    return { opBalDisplay, rows, totalDr, totalCr, clBalDisplay };
  }, [movements, fromDate, toDate, activeLedger]);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
           <h2 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-6 mr-2 block"></span>
            View Ledger Accounts
          </h2>

          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 p-1.5 rounded-md shadow-sm">
             <div className="bg-[#2b579a] p-1.5 rounded text-white flex items-center">
               <BookOpen size={14} />
             </div>
             <select 
               value={selectedLedger} 
               onChange={e => setSelectedLedger(e.target.value)}
               className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none w-64 pr-2 cursor-pointer font-sans"
             >
               <option value="">-- Choose Account --</option>
               {ledgers.map(l => (
                 <option key={l.id} value={l.id}>
                   {l.accountName} ({l.accountGroup})
                 </option>
               ))}
             </select>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-1.5 rounded-md">
             <span className="font-bold text-[#2b579a] flex items-center text-sm mr-3 pl-2"><Calendar size={16} className="mr-1.5"/> Period:</span>
             <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
               <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
               <span className="text-gray-400 text-sm font-medium">to</span>
               <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border-none bg-transparent text-sm text-gray-800 font-medium focus:outline-none focus:ring-0" />
             </div>
          </div>
          <button 
            onClick={downloadPDF}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded text-xs shadow border border-emerald-800 transition-colors"
          >
            <span>Download PDF</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded text-xs shadow border border-blue-800 transition-colors"
          >
            <Printer size={14} />
            <span>Print Ledger</span>
          </button>
        </div>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex justify-center items-center z-50">
            <span className="text-sm font-bold text-gray-500 animate-pulse">Loading transaction logs...</span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Date</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Particulars</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Vch Type</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-center">Vch No.</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right">Debit (₹)</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32 text-right">Credit (₹)</th>
                <th className="p-2 text-xs font-semibold w-36 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr className="bg-[#f8f9fa] border-b border-gray-300">
                 <td colSpan={4} className="p-2 text-right font-bold text-gray-700 italic">Opening Balance as on {fromDate.split('-').reverse().join('-')} :</td>
                 <td className="p-2"></td>
                 <td className="p-2"></td>
                 <td className="p-2 text-right font-mono font-black text-gray-900 bg-gray-200/50">
                    {statement.opBalDisplay.amount.toFixed(2)} <span className={`text-[10px] ml-1 ${statement.opBalDisplay.type === 'Dr' ? 'text-green-700' : 'text-red-700'}`}>{statement.opBalDisplay.type}</span>
                 </td>
              </tr>

              {statement.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <p className="italic text-sm">No transactions found for this period.</p>
                  </td>
                </tr>
              ) : (
                statement.rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'}`}>
                    <td className="border-r border-gray-200 p-2 text-xs font-medium text-gray-600">
                      {row.date ? row.date.split('-').reverse().join('-') : ''}
                    </td>
                    <td className="border-r border-gray-200 p-2 font-bold text-gray-800">{row.particulars}</td>
                    <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500 bg-gray-50/50">{row.vchType}</td>
                    <td className="border-r border-gray-200 p-2 text-xs text-center font-mono text-blue-700">{row.vchNo}</td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-green-700 bg-green-50/10">
                      {row.dr > 0 ? row.dr.toFixed(2) : ''}
                    </td>
                    <td className="border-r border-gray-200 p-2 text-right font-mono font-bold text-red-700 bg-red-50/10">
                      {row.cr > 0 ? row.cr.toFixed(2) : ''}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-gray-900 bg-gray-50/50">
                      {row.balAmt.toFixed(2)} <span className={`text-[10px] ml-1 ${row.balType === 'Dr' ? 'text-green-700' : 'text-red-700'}`}>{row.balType}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
          <div className="flex items-center space-x-12">
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-green-300 font-bold uppercase tracking-widest">Period Total Debit</span>
               <span className="font-mono text-xl font-bold text-green-400">₹ {statement.totalDr.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">Period Total Credit</span>
               <span className="font-mono text-xl font-bold text-red-400">₹ {statement.totalCr.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center bg-[#142d54] px-6 py-2 rounded border border-[#0d1e38] shadow-inner">
             <span className="text-sm font-bold text-blue-200 uppercase tracking-widest mr-4">Closing Balance</span>
             <span className="font-mono text-2xl font-black text-yellow-300 drop-shadow-md">
                {statement.clBalDisplay.amount.toFixed(2)} <span className={`text-sm ml-1 ${statement.clBalDisplay.type === 'Dr' ? 'text-green-400' : 'text-red-400'}`}>{statement.clBalDisplay.type}</span>
             </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ViewLedger;