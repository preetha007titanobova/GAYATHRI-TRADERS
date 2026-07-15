import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Api from '../Api';

const ACCOUNT_GROUPS = [
  'Capital Account', 'Current Assets', 'Current Liabilities',
  'Customers', 'Suppliers', 'Direct Expenses',
  'Indirect Expenses', 'Direct Incomes', 'Bank Accounts', 'Cash-in-Hand'
];

const REGISTRATION_TYPES = ['Regular', 'Composition', 'Unregistered', 'Consumer'];
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

  const [registrationType, setRegistrationType] = useState('Regular');
  const [gstNo, setGstNo] = useState('');
  const [panNo, setPanNo] = useState('');

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Abstract State');
  const [pincode, setPincode] = useState('');

  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegular, setIsRegular] = useState(false);
  
  // Layout view modes: 'split' | 'form-only' | 'table-only'
  const [viewMode, setViewMode] = useState<'split' | 'form-only' | 'table-only'>('split');

  // Ledger Transactions Statement Modal States
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerModalLoading, setLedgerModalLoading] = useState(false);
  const [ledgerModalData, setLedgerModalData] = useState<any[]>([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<any | null>(null);

  const handleOpenLedgerModal = async (ledgerObj: any) => {
    setSelectedLedgerCustomer(ledgerObj);
    setLedgerModalOpen(true);
    setLedgerModalLoading(true);
    setLedgerModalData([]);
    
    try {
      const customerName = ledgerObj.accountName;
      
      // 1. Fetch bills for the customer
      let bills: any[] = [];
      try {
        const billsRes = await fetch(`${Api}/sales/bills/search?q=${encodeURIComponent(customerName)}`);
        if (billsRes.ok) {
          const data = await billsRes.json();
          if (Array.isArray(data)) bills = data;
        }
      } catch (e) {
        console.error("Error fetching bills:", e);
      }

      // 2. Fetch returns for the customer
      let returns: any[] = [];
      try {
        const returnsRes = await fetch(`${Api}/sales/returns/search?q=${encodeURIComponent(customerName)}`);
        if (returnsRes.ok) {
          const data = await returnsRes.json();
          if (Array.isArray(data)) returns = data;
        }
      } catch (e) {
        console.error("Error fetching returns:", e);
      }
      
      // Combine moves
      const moves: any[] = [];
      
      // Add Opening Balance
      const opDate = ledgerObj.createdAt ? new Date(ledgerObj.createdAt) : new Date('2026-07-01');
      moves.push({
        date: opDate,
        particulars: 'Opening Balance',
        vchType: 'Opening Balance',
        vchNo: '-',
        dr: ledgerObj.drCr === 'Dr' ? (ledgerObj.openingBalance || 0) : 0,
        cr: ledgerObj.drCr === 'Cr' ? (ledgerObj.openingBalance || 0) : 0,
        isOpening: true
      });
      
      // Add Sales Bills
      if (Array.isArray(bills)) {
        bills.forEach((b: any) => {
          if (b.buyerName === customerName) {
            moves.push({
              date: new Date(b.invDate || b.createdAt),
              particulars: 'Sales Invoice',
              vchType: 'Sales Invoice',
              vchNo: b.invoiceNo,
              dr: b.netAmount || 0,
              cr: 0
            });
            // If paid immediately (not Credit)
            if (b.paymentMode && b.paymentMode !== 'Credit') {
              moves.push({
                date: new Date(b.invDate || b.createdAt),
                particulars: `Payment Received (${b.paymentMode})`,
                vchType: 'Payment Received',
                vchNo: `REC-${b.invoiceNo}`,
                dr: 0,
                cr: b.netAmount || 0
              });
            }
          }
        });
      }
      
      // Add Sales Returns
      if (Array.isArray(returns)) {
        returns.forEach((r: any) => {
          if (r.customerName === customerName) {
            moves.push({
              date: new Date(r.returnDate || r.createdAt),
              particulars: 'Sales Return',
              vchType: 'Sales Return',
              vchNo: r.returnNo,
              dr: 0,
              cr: r.netRefundAmount || 0
            });
          }
        });
      }
      
      // Sort chronologically. Opening balance always comes first.
      moves.sort((a, b) => {
        if (a.isOpening) return -1;
        if (b.isOpening) return 1;
        return a.date.getTime() - b.date.getTime();
      });
      
      // Calculate running balance
      let balance = 0;
      const calculatedMoves = moves.map(m => {
        if (m.isOpening) {
          balance = m.dr - m.cr;
        } else {
          balance += m.dr;
          balance -= m.cr;
        }
        return {
          ...m,
          balance: balance
        };
      });
      
      setLedgerModalData(calculatedMoves);
    } catch (err) {
      console.error("Error generating ledger statement:", err);
    } finally {
      setLedgerModalLoading(false);
    }
  };

  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const isExpense = group.includes('Expenses');
  const isDebtorCreditor = group === 'Customers' || group === 'Suppliers';

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
    setRegistrationType('Regular');
    setGstNo('');
    setPanNo('');
    setAddress('');
    setCity('');
    setState('Abstract State');
    setPincode('');
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
    setRegistrationType(ledger.registrationType || 'Regular');
    setGstNo(ledger.gstNo || '');
    setPanNo(ledger.panNo || '');
    setAddress(ledger.address || '');
    setCity(ledger.city || '');
    setState(ledger.state || 'Abstract State');
    setPincode(ledger.pincode || '');
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

    if (group === 'Suppliers' && registrationType === 'Regular' && !gstNo.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "GSTIN is required for Regular registration types.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 4000);
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
      registrationType,
      gstNo: group === 'Customers' ? '' : gstNo,
      panNo: group === 'Customers' ? '' : panNo,
      address,
      city,
      state,
      pincode,
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
              {/* <span className="text-xs bg-blue-700 px-2 py-0.5 rounded mr-2">Editing: {ledgerCode}</span> */}
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

            {/* 3. Statutory & Taxation */}
            <fieldset className={`border ${isExpense ? 'border-gray-200 bg-gray-100 opacity-60' : 'border-gray-300 bg-white'} p-3 rounded shadow-sm transition-opacity`}>
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Statutory & Taxation</legend>
              <div className="grid grid-cols-3 gap-3">
                <div className={`flex flex-col ${group === 'Customers' ? 'col-span-3' : ''}`}>
                  <label className="text-gray-700 text-xs mb-1">Registration</label>
                  <select className="legacy-input w-full" value={registrationType} onChange={e => setRegistrationType(e.target.value)} disabled={isExpense}>
                    {REGISTRATION_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>

                {group !== 'Customers' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-gray-700 text-xs mb-1">GSTIN / UIN {isDebtorCreditor && registrationType === 'Regular' && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="legacy-input w-full uppercase font-mono" value={gstNo} onChange={e => setGstNo(e.target.value)} disabled={isExpense} maxLength={15} />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-700 text-xs mb-1">PAN Number</label>
                      <input type="text" className="legacy-input w-full uppercase font-mono" value={panNo} onChange={e => setPanNo(e.target.value)} disabled={isExpense} maxLength={10} />
                    </div>
                  </>
                )}
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
           <button 
                onClick={() => setViewMode('form-only')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${viewMode === 'form-only' ? 'bg-blue-600 border border-blue-400 text-white' : 'bg-blue-800 hover:bg-blue-700 text-blue-100'}`}
                title="Hide Table"
              >
                ❌ Hide Table
              </button>
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
                      <td className="p-2 font-bold text-blue-900">
                        {l.accountGroup === 'Customers' ? (
                          <span
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenLedgerModal(l);
                            }}
                          >
                            {l.accountName}
                          </span>
                        ) : (
                          l.accountName
                        )}
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

      {/* Ledger Modal Dialog */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#2b579a] to-[#3a75c4] px-5 py-4 text-white flex justify-between items-center shadow-sm">
              <div>
                <h2 className="text-base font-bold tracking-wide">
                  Customer Ledger (Financial Transactions)
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  Statement for <strong className="text-yellow-300">{selectedLedgerCustomer?.accountName}</strong> ({selectedLedgerCustomer?.ledgerCode})
                </p>
              </div>
              <button 
                onClick={() => setLedgerModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 leading-relaxed shadow-sm">
                <h3 className="font-bold mb-1">Every transaction for that customer should be recorded here.</h3>
                <p>Balances are computed chronologically starting from the customer's opening balance configuration.</p>
              </div>

              {ledgerModalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-xs text-slate-500 font-medium">Generating ledger transactions statement...</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-250 sticky top-0">
                      <tr>
                        <th className="p-3 border-r border-slate-200">Date</th>
                        <th className="p-3 border-r border-slate-200">Voucher Type</th>
                        <th className="p-3 border-r border-slate-200">Voucher No</th>
                        <th className="p-3 border-r border-slate-200 text-right">Debit (₹)</th>
                        <th className="p-3 border-r border-slate-200 text-right">Credit (₹)</th>
                        <th className="p-3 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {ledgerModalData.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50/50 transition-colors ${row.isOpening ? 'bg-amber-50/30 italic font-medium' : ''}`}
                        >
                          <td className="p-3 border-r border-slate-200 font-mono text-xs">
                            {new Date(row.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="p-3 border-r border-slate-200 font-semibold text-xs text-slate-700">
                            {row.particulars}
                          </td>
                          <td className="p-3 border-r border-slate-200 font-mono text-xs text-slate-500">
                            {row.vchNo}
                          </td>
                          <td className="p-3 border-r border-slate-200 text-right font-mono text-green-700 font-medium">
                            {row.dr > 0 ? `₹${row.dr.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-3 border-r border-slate-200 text-right font-mono text-red-600 font-medium">
                            {row.cr > 0 ? `₹${row.cr.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            ₹{Math.abs(row.balance).toLocaleString()} {row.balance >= 0 ? 'Dr' : 'Cr'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-5 py-4 flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0 text-xs">
              <div className="text-slate-500 space-y-1">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Meaning</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>Debit</strong> → Amount the customer owes your shop (sales made on credit).</li>
                  <li><strong>Credit</strong> → Amount the customer paid to your shop.</li>
                  <li><strong>Balance</strong> → Outstanding amount.</li>
                </ul>
              </div>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-colors text-sm self-end"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerMaster;