import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';

const ACCOUNT_GROUPS = [
  'Capital Account', 'Current Assets', 'Current Liabilities', 
  'Customers', 'Suppliers', 'Direct Expenses', 
  'Indirect Expenses', 'Direct Incomes', 'Bank Accounts', 'Cash-in-Hand'
];

const REGISTRATION_TYPES = ['Regular', 'Composition', 'Unregistered', 'Consumer'];
const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Abstract State'];



const LedgerMaster = () => {
  // --- Form State ---
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

  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const isExpense = group.includes('Expenses');
  const isDebtorCreditor = group === 'Customers' || group === 'Suppliers';

  const fetchNextCode = () => {
    fetch('http://localhost:5000/api/ledgers/next-code')
      .then(res => res.json())
      .then(data => {
        if (data.ledgerCode) setLedgerCode(data.ledgerCode);
      })
      .catch(err => {
        console.error("Failed to fetch ledger code", err);
      });
  };

  const loadLedgers = () => {
    fetch('http://localhost:5000/api/ledgers/search')
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
    fetchNextCode();
  };

  const handleRowClick = (ledger: any) => {
    setLedgerCode(ledger.ledgerCode || '');
    setAccountName(ledger.accountName || '');
    setAlias(ledger.alias || '');
    setGroup(ledger.accountGroup || 'Customers');
    setOpeningBal(ledger.openingBalance || 0);
    setDrCr(ledger.drCr || 'Dr');
    setCreditLimit(ledger.creditLimit || 0);
    setDefaultCreditPeriod(ledger.defaultCreditPeriod || 0);
    setRegistrationType(ledger.registrationType || 'Unregistered');
    setGstNo(ledger.gstNo || '');
    setPanNo(ledger.panNo || '');
    setAddress(ledger.address || '');
    setCity(ledger.city || '');
    setState(ledger.state || 'Abstract State');
    setPincode(ledger.pincode || '');
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "Account Name is required.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
      return;
    }

    if (isDebtorCreditor && registrationType === 'Regular' && !gstNo.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({msg: "GSTIN is mandatory for Regular Debtors/Creditors.", type: 'error'});
        setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
      }
      return;
    }

    setLoading(true);
    
    const payload = {
      ledgerCode, accountName, alias, accountGroup: group, 
      openingBalance: Number(openingBal) || 0, drCr, creditLimit: Number(creditLimit) || 0, defaultCreditPeriod: Number(defaultCreditPeriod) || 0,
      registrationType: isExpense ? 'Unregistered' : registrationType, 
      gstNo: isExpense ? '' : gstNo, 
      panNo, address, city, state, pincode
    };

    try {
      const res = await fetch('http://localhost:5000/api/ledgers', {
        method: 'POST',
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
          setGlobalNotification({msg: "Error saving: " + (data.details || data.error || "Unknown error"), type: 'error'});
          setTimeout(() => setGlobalNotification({msg: '', type: ''}), 3000);
        }
      }
    } catch (err: any) {
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
    onDelete: handleClear,
  });

  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleClear,
      onSave: handleSave,
      onDelete: handleClear,
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
  }, [setToolbarActions]);

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
        <div className="w-1/2 flex flex-col border-r border-gray-400 bg-[#f4f7f6] overflow-y-auto">
          <div className="bg-[#2b579a] text-white px-3 py-1.5 text-sm font-bold shadow-sm sticky top-0 z-10 flex justify-between items-center">
            <span>Ledger Master (Data Entry)</span>
            <span className="text-xs bg-blue-700 px-2 py-0.5 rounded">Editing: {ledgerCode}</span>
          </div>

          <div className="p-4 space-y-4 text-sm font-semibold">
            {/* 1. Primary Information */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Primary Information</legend>
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <label className="text-right text-gray-700 pr-2">Ledger Name <span className="text-red-500">*</span></label>
                <input type="text" className="legacy-input w-full" value={accountName} onChange={e => setAccountName(e.target.value)} autoFocus />
                
                <label className="text-right text-gray-700 pr-2">Alias / Short</label>
                <input type="text" className="legacy-input w-2/3" value={alias} onChange={e => setAlias(e.target.value)} />
                
                <label className="text-right text-gray-700 pr-2">Under Group</label>
                <select className="legacy-input w-full font-bold text-blue-900 bg-blue-50" value={group} onChange={e => setGroup(e.target.value)}>
                  {ACCOUNT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </fieldset>

            {/* 2. Financial Parameters */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Financial Parameters</legend>
              <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-2 items-center">
                <label className="text-right text-gray-700 pr-2">Opening Bal</label>
                <div className="flex">
                  <input type="number" className="legacy-input w-full text-right font-mono" value={openingBal} onChange={e => setOpeningBal(e.target.value)} />
                  <select className="legacy-input w-16 ml-1" value={drCr} onChange={e => setDrCr(e.target.value)}>
                    <option>Dr</option>
                    <option>Cr</option>
                  </select>
                </div>

                <label className="text-right text-gray-700 pr-2">Credit Limit (₹)</label>
                <input type="number" className="legacy-input w-full text-right" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />

                <label className="text-right text-gray-700 pr-2">Credit Days</label>
                <input type="number" className="legacy-input w-full text-right" value={defaultCreditPeriod} onChange={e => setDefaultCreditPeriod(e.target.value)} />
              </div>
            </fieldset>

            {/* 3. Statutory & Taxation */}
            <fieldset className={`border ${isExpense ? 'border-gray-200 bg-gray-100 opacity-60' : 'border-gray-300 bg-white'} p-3 rounded shadow-sm transition-opacity`}>
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Statutory & Taxation</legend>
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <label className="text-right text-gray-700 pr-2">Registration</label>
                <select className="legacy-input w-2/3" value={registrationType} onChange={e => setRegistrationType(e.target.value)} disabled={isExpense}>
                  {REGISTRATION_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>

                <label className="text-right text-gray-700 pr-2">GSTIN / UIN {isDebtorCreditor && registrationType === 'Regular' && <span className="text-red-500">*</span>}</label>
                <input type="text" className="legacy-input w-full uppercase font-mono" value={gstNo} onChange={e => setGstNo(e.target.value)} disabled={isExpense} maxLength={15} />

                <label className="text-right text-gray-700 pr-2">PAN Number</label>
                <input type="text" className="legacy-input w-2/3 uppercase font-mono" value={panNo} onChange={e => setPanNo(e.target.value)} disabled={isExpense} maxLength={10} />
              </div>
            </fieldset>

            {/* 4. Location & Mailing */}
            <fieldset className="border border-gray-300 p-3 rounded bg-white shadow-sm">
              <legend className="text-blue-800 font-bold px-1 text-xs uppercase tracking-wider">Location / Mailing</legend>
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <label className="text-right text-gray-700 pr-2">Address L1</label>
                <textarea className="legacy-input w-full h-12 resize-none" value={address} onChange={e => setAddress(e.target.value)}></textarea>
                
                <label className="text-right text-gray-700 pr-2">City & State</label>
                <div className="flex space-x-1">
                  <input type="text" className="legacy-input w-1/2" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                  <select className="legacy-input w-1/2" value={state} onChange={e => setState(e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <label className="text-right text-gray-700 pr-2">Pincode</label>
                <input type="text" className="legacy-input w-1/3" value={pincode} onChange={e => setPincode(e.target.value)} />
              </div>
            </fieldset>

            {/* Action Buttons inside form */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-300">
              <button className={`legacy-button font-bold w-24 ${loading ? 'bg-gray-300' : 'bg-[#e6f2ff] hover:bg-[#cce5ff] border-[#b3d4fc] text-[#004085]'}`} onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save (Ctrl+S)'}
              </button>
              <button className="legacy-button bg-gray-200 hover:bg-gray-300 font-bold border-gray-400 w-24 text-gray-800" onClick={handleClear} disabled={loading}>
                Clear
              </button>
            </div>
            
          </div>
        </div>

        {/* RIGHT PANE: Ledger Directory Grid */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="bg-[#1e3f70] text-white px-3 py-1.5 text-sm font-bold flex justify-between items-center shadow-sm">
            <span>Ledger Directory Grid</span>
            <span className="bg-blue-800 px-2 py-0.5 rounded text-xs">Total: {filteredLedgers.length}</span>
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
                {filteredLedgers.map((l, i) => (
                  <tr 
                    key={l._id || i} 
                    className="border-b border-gray-200 hover:bg-[#d1e8e2] cursor-pointer transition-colors"
                    onClick={() => handleRowClick(l)}
                  >
                    <td className="p-2 font-bold text-blue-900">{l.accountName}</td>
                    <td className="p-2 text-gray-700">{l.accountGroup}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {l.openingBalance?.toLocaleString()} <span className="text-[10px] text-gray-500">{l.drCr}</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {l.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredLedgers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500 font-bold">No ledgers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LedgerMaster;