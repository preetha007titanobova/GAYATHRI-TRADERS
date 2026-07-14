import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Api from '../Api';

const ACCOUNT_GROUPS = [
  'Capital Account', 'Current Assets', 'Current Liabilities',
  'Customers', 'Suppliers', 'Direct Expenses',
  'Indirect Expenses', 'Direct Incomes', 'Bank Accounts', 'Cash-in-Hand'
];

const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Abstract State'];

const LedgerMaster = () => {
  const navigate = useNavigate();
  // --- Form State ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ledgerCode, setLedgerCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [alias, setAlias] = useState('');
  const [group, setGroup] = useState('Customers');

  const [openingBal, setOpeningBal] = useState<number | string>(0);
  const [drCr, setDrCr] = useState('Dr');
  const [creditLimit, setCreditLimit] = useState<number | string>(0);
  const [defaultCreditPeriod, setDefaultCreditPeriod] = useState<number | string>(0);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Abstract State');
  const [pincode, setPincode] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegular, setIsRegular] = useState(false);
  
  // Layout view modes: 'split' | 'form-only' | 'table-only'
  const [viewMode, setViewMode] = useState<'split' | 'form-only' | 'table-only'>('split');

  // States for detailed customer profile modal
  const [selectedDetailCust, setSelectedDetailCust] = useState<any | null>(null);
  const [custDetailDues, setCustDetailDues] = useState<{
    opening: number;
    sales: number;
    payments: number;
    outstanding: number;
  }>({ opening: 0, sales: 0, payments: 0, outstanding: 0 });
  const [custDetailHistory, setCustDetailHistory] = useState<any[]>([]);
  const [custDetailLoading, setCustDetailLoading] = useState(false);

  const handleNameClick = async (e: React.MouseEvent, ledger: any) => {
    e.stopPropagation(); // Prevent row click select
    setSelectedDetailCust(ledger);
    setCustDetailLoading(true);
    
    try {
      const [invoiceRes, paymentRes] = await Promise.all([
        fetch(`${Api}/sales/search?customer=${encodeURIComponent(ledger.accountName)}`),
        fetch(`${Api}/payments?customer=${encodeURIComponent(ledger.accountName)}`)
      ]);
      
      const invoices = await invoiceRes.json();
      const payments = await paymentRes.json();
      
      const opening = ledger.openingBalance || 0;
      let salesTotal = 0;
      const historyItems: any[] = [];
      
      if (Array.isArray(invoices)) {
        invoices.forEach(inv => {
          salesTotal += inv.netAmount || 0;
          historyItems.push({
            date: inv.invDate,
            ref: inv.invoiceNo,
            type: 'Credit Sale',
            debit: inv.netAmount,
            credit: 0
          });
        });
      }
      
      let paymentsTotal = 0;
      if (Array.isArray(payments)) {
        payments.forEach(pay => {
          paymentsTotal += pay.amount || 0;
          historyItems.push({
            date: pay.date || pay.createdAt,
            ref: pay.paymentMode || 'Payment',
            type: 'Payment Collected',
            debit: 0,
            credit: pay.amount
          });
        });
      }
      
      // Sort chronologically
      historyItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const outstanding = ledger.drCr === 'Dr' 
        ? (opening + salesTotal - paymentsTotal) 
        : (salesTotal - (opening + paymentsTotal));
        
      setCustDetailDues({
        opening,
        sales: salesTotal,
        payments: paymentsTotal,
        outstanding
      });
      
      setCustDetailHistory(historyItems);
    } catch (err) {
      console.error("Failed to load customer details history:", err);
    } finally {
      setCustDetailLoading(false);
    }
  };

  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const fetchNextCode = () => {
    fetch(`${Api}/ledgers/next-code`)
      .then(res => res.json())
      .then(data => {
        if (data.ledgerCode) setLedgerCode(data.ledgerCode);
      })
      .catch(err => {
        console.error("Failed to fetch ledger code", err);
      });
  };

  const loadLedgers = () => {
    fetch(`${Api}/ledgers/search`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setLedgers(data);
        }
      })
      .catch(err => console.error("Failed to fetch ledgers", err));
  };

  useEffect(() => {
    fetchNextCode();
    loadLedgers();
  }, []);

  const handleClear = () => {
    setSelectedId(null);
    setAccountName('');
    setAlias('');
    setGroup('Customers');
    setOpeningBal(0);
    setDrCr('Dr');
    setCreditLimit(0);
    setDefaultCreditPeriod(0);
    setAddress('');
    setCity('');
    setState('Abstract State');
    setPincode('');
    setMobileNo('');
    setEmail('');
    setIsRegular(false);
    fetchNextCode();
  };

  const handleRowClick = (ledger: any) => {
    setSelectedId(ledger._id || ledger.id || null);
    setLedgerCode(ledger.ledgerCode || '');
    setAccountName(ledger.accountName || '');
    setAlias(ledger.alias || '');
    setGroup(ledger.accountGroup || 'Customers');
    setOpeningBal(ledger.openingBalance || 0);
    setDrCr(ledger.drCr || 'Dr');
    setCreditLimit(ledger.creditLimit || 0);
    setDefaultCreditPeriod(ledger.defaultCreditPeriod || 0);
    setAddress(ledger.address || '');
    setCity(ledger.city || '');
    setState(ledger.state || 'Abstract State');
    setPincode(ledger.pincode || '');
    setMobileNo(ledger.mobileNo || '');
    setEmail(ledger.email || '');
    setIsRegular(!!ledger.isRegular);
  };

  const handleDelete = async () => {
    if (!selectedId) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Please select a ledger to delete.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
      return;
    }
    if (!window.confirm("Are you sure you want to delete this ledger?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${Api}/ledgers/${selectedId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Ledger deleted successfully!", type: 'success'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
        handleClear();
        loadLedgers();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Error deleting: " + data.error, type: 'error'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Network error while deleting.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Ledger Name is required.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
      return;
    }

    setLoading(true);
    const payload = {
      ledgerCode,
      accountName,
      alias,
      accountGroup: group,
      openingBalance: Number(openingBal) || 0,
      drCr,
      creditLimit: Number(creditLimit) || 0,
      defaultCreditPeriod: Number(defaultCreditPeriod) || 0,
      address,
      city,
      state,
      pincode,
      mobileNo,
      email,
      isRegular: group === 'Customers' ? isRegular : false
    };

    try {
      const url = selectedId ? `${Api}/ledgers/${selectedId}` : `${Api}/ledgers`;
      const method = selectedId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (setGlobalNotification) {
          setGlobalNotification({msg: `Ledger ${accountName} saved successfully!`, type: 'success'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
        handleClear();
        loadLedgers();
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({msg: "Error saving: " + data.error, type: 'error'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Network error while saving.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Global Toolbar Wiring ---
  const actionHandlers = useRef({
    onAdd: handleClear,
    onSave: handleSave,
    onDelete: handleDelete,
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleClear,
      onSave: handleSave,
      onDelete: handleDelete,
    };
  });

  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        onSave: () => actionHandlers.current.onSave(),
        onDelete: () => actionHandlers.current.onDelete(),
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions, selectedId]);

  const filteredLedgers = useMemo(() => {
    if (!searchQuery) return ledgers;
    return ledgers.filter(l =>
      (l.accountName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.accountGroup || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ledgers, searchQuery]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANE: Master Form Area */}
        <div className={`${viewMode === 'table-only' ? 'hidden' : viewMode === 'form-only' ? 'w-full' : 'w-[58%]'} flex flex-col border-r border-gray-400 bg-[#f4f7f6] overflow-y-auto`}>
          <div className="bg-[#2b579a] text-white px-3 py-1.5 text-sm font-bold shadow-sm sticky top-0 z-10 flex justify-between items-center">
            <span>Ledger Master (Data Entry)</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-blue-700 px-2 py-0.5 rounded mr-2">Editing: {ledgerCode}</span>
              <button 
                onClick={() => setViewMode('split')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${viewMode === 'split' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
                title="Split Screen View"
              >
                ◧ Split View
              </button>
              <button 
                onClick={() => setViewMode('table-only')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${viewMode === 'table-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
                title="Maximize Table"
              >
                👁 View Full Table
              </button>
              <button 
                onClick={() => setViewMode('form-only')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${viewMode === 'form-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
                title="Hide Table"
              >
                ❌ Hide Table
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 text-sm font-semibold">
            {/* 1. Primary Information */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Primary Information</legend>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col col-span-2">
                  <label className="text-gray-700 text-xs mb-1">Ledger Name <span className="text-red-500">*</span></label>
                  <input type="text" className="legacy-input w-full" value={accountName} onChange={e => setAccountName(e.target.value)} autoFocus />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">Alias / Short</label>
                  <input type="text" className="legacy-input w-full" value={alias} onChange={e => setAlias(e.target.value)} />
                </div>
                <div className="flex flex-col col-span-3">
                  <label className="text-gray-700 text-xs mb-1">Under Group</label>
                  <select className="legacy-input w-full font-bold text-blue-900 bg-blue-50" value={group} onChange={e => setGroup(e.target.value)}>
                    {ACCOUNT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {group === 'Customers' && (
                  <>
                    <div className="flex flex-col col-span-2">
                      <label className="text-gray-700 text-xs mb-1 font-bold text-blue-900">Phone Number (Mobile)</label>
                      <input 
                        type="text" 
                        className="legacy-input w-full font-mono font-bold" 
                        placeholder="e.g. 9876543210" 
                        value={mobileNo} 
                        onChange={e => setMobileNo(e.target.value)} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-gray-700 text-xs mb-1">Email Address</label>
                      <input 
                        type="email" 
                        className="legacy-input w-full" 
                        placeholder="e.g. customer@mail.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                      />
                    </div>
                  </>
                )}
                {group === 'Customers' && (
                  <div className="flex items-center space-x-2 mt-1.5 col-span-3">
                    <input 
                      type="checkbox" 
                      id="isRegularCheckbox" 
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      checked={isRegular}
                      onChange={e => setIsRegular(e.target.checked)}
                    />
                    <label htmlFor="isRegularCheckbox" className="text-xs font-bold text-gray-700 select-none cursor-pointer">
                      ⭐ Mark as Regular Customer (Eligible for special discounts & favors)
                    </label>
                  </div>
                )}
              </div>
            </fieldset>

            {/* 2. Financial Parameters */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Financial Parameters</legend>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">Opening Bal</label>
                  <div className="flex">
                    <input type="number" className="legacy-input w-full text-right font-mono" value={openingBal} onChange={e => setOpeningBal(e.target.value)} />
                    <select className="legacy-input w-14 ml-1" value={drCr} onChange={e => setDrCr(e.target.value)}>
                      <option>Dr</option>
                      <option>Cr</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">Credit Limit (₹)</label>
                  <input type="number" className="legacy-input w-full text-right" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">Credit Days</label>
                  <input type="number" className="legacy-input w-full text-right" value={defaultCreditPeriod} onChange={e => setDefaultCreditPeriod(e.target.value)} />
                </div>
              </div>
            </fieldset>

            {/* 4. Location & Mailing */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Location / Mailing</legend>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col col-span-3">
                  <label className="text-gray-700 text-xs mb-1">Address L1</label>
                  <input type="text" className="legacy-input w-full" value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter full address" />
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">City</label>
                  <input type="text" className="legacy-input w-full" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">State</label>
                  <select className="legacy-input w-full" value={state} onChange={e => setState(e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-700 text-xs mb-1">Pincode</label>
                  <input type="text" className="legacy-input w-full" value={pincode} onChange={e => setPincode(e.target.value)} />
                </div>
              </div>
            </fieldset>

            {/* Action Buttons inside form */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <div>
                {selectedId && group === 'Customers' && (
                  <button 
                    onClick={() => {
                      navigate('/sales-register', { state: { selectedCustomerName: accountName } });
                    }}
                    className="legacy-button bg-yellow-100 hover:bg-yellow-200 border-yellow-400 font-bold text-yellow-800 text-xs py-1 px-3 rounded shadow-sm flex items-center space-x-1"
                  >
                    <span>📜 View Sales History</span>
                  </button>
                )}
              </div>
              <div className="flex space-x-2">
                <button className={`legacy-button font-bold w-24 ${loading ? 'bg-gray-300' : 'bg-[#e6f2ff] hover:bg-[#cce5ff] border-[#b3d4fc] text-[#004085]'}`} onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : selectedId ? 'Update' : 'Save (Ctrl+S)'}
                </button>
                {selectedId && (
                  <button className="legacy-button bg-red-600 hover:bg-red-700 font-bold border-red-800 w-24 text-white" onClick={handleDelete} disabled={loading}>
                    Delete
                  </button>
                )}
                <button className="legacy-button bg-gray-200 hover:bg-gray-300 font-bold border-gray-400 w-24 text-gray-800" onClick={handleClear} disabled={loading}>
                  Clear
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT PANE: Ledger Directory Grid */}
        <div className={`${viewMode === 'form-only' ? 'hidden' : viewMode === 'table-only' ? 'w-full' : 'w-[42%]'} flex flex-col bg-white overflow-hidden`}>
          <div className="bg-[#1e3f70] text-white px-3 py-1.5 text-sm font-bold flex justify-between items-center shadow-sm">
            <span>Ledger Directory Grid</span>
            <div className="flex items-center space-x-2">
              <span className="bg-blue-800 px-2 py-0.5 rounded text-xs mr-2">Total: {filteredLedgers.length}</span>
        
            </div>
          </div>

          <div className="p-2 bg-gray-100 border-b border-gray-300 flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-700">Search:</span>
            <input
              type="text"
              className="legacy-input flex-1"
              placeholder="Filter by Ledger Name or Group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#e9ecef] sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase">Ledger Name</th>
                  <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase">Under Group</th>
                  <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase text-right">Balance (₹)</th>
                  <th className="border-b border-gray-300 p-2 font-bold text-gray-700 uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedgers.map((l, i) => {
                  const isSelected = selectedId === (l._id || l.id);
                  return (
                    <tr
                      key={l._id || i}
                      className={`border-b border-gray-200 hover:bg-[#d1e8e2] cursor-pointer transition-colors ${isSelected ? 'bg-[#cce5ff] text-[#004085] font-medium' : ''}`}
                      onClick={() => handleRowClick(l)}
                    >
                      <td className="p-2 font-bold">
                        <button
                          type="button"
                          onClick={(e) => handleNameClick(e, l)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left focus:outline-none"
                          title="Click to view complete details statement"
                        >
                          {l.accountName}
                        </button>
                        {l.isRegular && (
                          <span className="ml-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-[9px] font-bold px-1 rounded inline-flex items-center shadow-xs">
                            ⭐ Regular
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-gray-700">{l.accountGroup}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {l.openingBalance?.toLocaleString()} <span className="text-[10px] text-gray-500">{l.drCr}</span>
                      </td>
                      <td className="p-2 text-center">
                        <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-300 uppercase">Active</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Complete Customer Details Modal */}
      {selectedDetailCust && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-[#f0f4f8] w-[650px] max-h-[85vh] border border-gray-400 rounded shadow-2xl flex flex-col overflow-hidden text-gray-800 text-xs">
            {/* Header */}
            <div className="bg-[#1e3f70] text-white px-4 py-2.5 font-bold flex justify-between items-center text-sm">
              <span>👤 Customer Complete Profile & Dues Statement</span>
              <button onClick={() => setSelectedDetailCust(null)} className="text-white hover:text-red-200 font-bold text-lg">✕</button>
            </div>
            
            {/* Body */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              
              {/* Profile Card */}
              <div className="bg-white border border-gray-300 rounded p-3 grid grid-cols-2 gap-3 shadow-xs">
                <div>
                  <span className="text-gray-500 font-bold">Ledger Code:</span>
                  <span className="ml-2 font-mono text-gray-900">{selectedDetailCust.ledgerCode}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-bold">Account Name:</span>
                  <span className="ml-2 font-bold text-blue-900">{selectedDetailCust.accountName}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-bold">Contact Phone:</span>
                  <span className="ml-2 text-gray-900">{selectedDetailCust.mobileNo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-bold">Email Address:</span>
                  <span className="ml-2 text-gray-900">{selectedDetailCust.email || 'N/A'}</span>
                </div>
                <div className="col-span-2 border-t border-gray-100 pt-2">
                  <span className="text-gray-500 font-bold">Mailing Address:</span>
                  <span className="ml-2 text-gray-900">
                    {[selectedDetailCust.address, selectedDetailCust.city, selectedDetailCust.state, selectedDetailCust.pincode].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2 border-t border-gray-100 pt-2 flex space-x-6">
                  <div>
                    <span className="text-gray-500 font-bold">Regular Customer:</span>
                    <span className="ml-2">{selectedDetailCust.isRegular ? '⭐ Yes (Regular)' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold">Credit Limit:</span>
                    <span className="ml-2 font-mono">₹{selectedDetailCust.creditLimit?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
              
              {/* Balances Card */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white border border-gray-300 p-2.5 rounded text-center shadow-xs">
                  <div className="text-gray-500 font-bold uppercase text-[9px]">Opening Dues</div>
                  <div className="text-sm font-bold font-mono text-gray-800 mt-1">₹{custDetailDues.opening.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-300 p-2.5 rounded text-center shadow-xs">
                  <div className="text-gray-500 font-bold uppercase text-[9px]">Total Credit Sales</div>
                  <div className="text-sm font-bold font-mono text-rose-600 mt-1">₹{custDetailDues.sales.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-300 p-2.5 rounded text-center shadow-xs">
                  <div className="text-gray-500 font-bold uppercase text-[9px]">Total Received</div>
                  <div className="text-sm font-bold font-mono text-green-700 mt-1">₹{custDetailDues.payments.toLocaleString()}</div>
                </div>
                <div className="bg-rose-50 border border-rose-300 p-2.5 rounded text-center shadow-sm">
                  <div className="text-rose-800 font-bold uppercase text-[9px]">Outstanding Balance</div>
                  <div className="text-base font-bold font-mono text-rose-600 mt-0.5">₹{custDetailDues.outstanding.toLocaleString()}</div>
                </div>
              </div>
              
              {/* History Table */}
              <div className="bg-white border border-gray-300 rounded shadow-xs overflow-hidden flex flex-col">
                <div className="bg-gray-100 p-2 border-b border-gray-200 font-bold text-gray-700">Chronological Transactions History</div>
                <div className="max-h-40 overflow-y-auto">
                  {custDetailLoading ? (
                    <div className="p-4 text-center font-bold text-gray-500 animate-pulse">Loading statement details...</div>
                  ) : custDetailHistory.length === 0 ? (
                    <div className="p-4 text-center italic text-gray-400">No transaction records found for this customer.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                          <th className="p-1.5 pl-3">Date</th>
                          <th className="p-1.5">Ref / Mode</th>
                          <th className="p-1.5">Type</th>
                          <th className="p-1.5 text-right">Debit (₹)</th>
                          <th className="p-1.5 text-right pr-3">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {custDetailHistory.map((h, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 font-medium">
                            <td className="p-1.5 pl-3 font-semibold text-gray-500">{new Date(h.date).toLocaleDateString('en-IN')}</td>
                            <td className="p-1.5 font-mono text-gray-700">{h.ref}</td>
                            <td className="p-1.5 text-gray-600">{h.type}</td>
                            <td className="p-1.5 text-right font-mono font-bold text-rose-600">{h.debit > 0 ? `₹${h.debit.toFixed(2)}` : '-'}</td>
                            <td className="p-1.5 text-right font-mono font-bold text-green-700 pr-3">{h.credit > 0 ? `₹${h.credit.toFixed(2)}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 flex justify-end">
              <button onClick={() => setSelectedDetailCust(null)} className="px-4 py-1 bg-gray-200 hover:bg-gray-300 font-bold border border-gray-400 rounded-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerMaster;