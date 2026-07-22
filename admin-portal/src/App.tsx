import React, { useState, useEffect } from 'react';
import { 
  Lock, Key, RefreshCw, AlertTriangle, ShieldCheck, Download, 
  Trash2, User, Phone, MapPin, CheckCircle, Ban, PlusCircle, Search, LogOut 
} from 'lucide-react';

const API_BASE = 'http://localhost:5500/api';

// Features default config
const DEFAULT_FEATURES = {
  billing: true,
  inventory: true,
  barcode_printing: false,
  thermal_printing: true,
  whatsapp_invoice: false,
  daily_sales_report: true,
  gst_reports: false,
  multiple_users: false,
  cloud_backup: false
};

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('kada_admin_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App Dashboard State
  const [licenses, setLicenses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal Controls
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [activeLicense, setActiveLicense] = useState<any | null>(null);

  // Form State - Create License
  const [shopName, setShopName] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [email, setEmail] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [address, setAddress] = useState('');
  const [planType, setPlanType] = useState('Annual');
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [maxActivations, setMaxActivations] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');

  // Form State - Renew License
  const [renewMonths, setRenewMonths] = useState(12);

  // Form State - Offline License Machine Input
  const [offlineMachineId, setOfflineMachineId] = useState('');
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  // Fetch licenses
  useEffect(() => {
    if (!token) return;

    const fetchLicenses = async () => {
      setIsLoading(true);
      try {
        let url = `${API_BASE}/license/admin/licenses`;
        const params: string[] = [];
        if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
        if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
        if (planFilter) params.push(`plan=${encodeURIComponent(planFilter)}`);
        
        if (params.length > 0) {
          url += `?${params.join('&')}`;
        }

        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setLicenses(data.licenses);
        } else {
          console.error(data.message);
        }
      } catch (err) {
        console.error('Error fetching licenses:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicenses();
  }, [token, searchQuery, statusFilter, planFilter, refreshTrigger]);

  // Handle Admin login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('kada_admin_token', data.token);
        setToken(data.token);
      } else {
        setLoginError(data.message || 'Login failed.');
      }
    } catch (err) {
      setLoginError('Server connection failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kada_admin_token');
    setToken(null);
  };

  // Create License Submit
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/license/admin/licenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shopName, contactName, mobileNo, email, gstNo, address,
          planType, features, maxActivations, expiresAt: expiresAt || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
        // Reset state
        setShopName(''); setContactName(''); setMobileNo(''); setEmail(''); setGstNo(''); setAddress('');
        setPlanType('Annual'); setFeatures(DEFAULT_FEATURES); setMaxActivations(1); setExpiresAt('');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error creating license key.');
    }
  };

  // Toggle Suspend Status
  const toggleSuspendLicense = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`${API_BASE}/license/admin/licenses/${id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      alert('Error toggling suspension.');
    }
  };

  // Reset Machine Fingerprint (Uncoupling)
  const handleResetMachine = async (id: string) => {
    if (!window.confirm('Are you sure you want to decouple all registered computer IDs for this license? The customer will be able to activate the license on a new PC.')) return;
    try {
      const res = await fetch(`${API_BASE}/license/admin/licenses/${id}/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('Machine configurations decoupled successfully!');
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      alert('Error resetting Machine ID.');
    }
  };

  // Renew License Submit
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLicense) return;
    try {
      const res = await fetch(`${API_BASE}/license/admin/licenses/${activeLicense._id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ monthsToAdd: renewMonths })
      });
      const data = await res.json();
      if (data.success) {
        setIsRenewModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      alert('Error renewing license.');
    }
  };

  // Download Offline Signed file
  const handleDownloadOfflineLic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLicense || !offlineMachineId) return;
    try {
      const res = await fetch(`${API_BASE}/license/admin/licenses/${activeLicense._id}/download?machineId=${offlineMachineId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.licenseFile) {
        const fileContent = JSON.stringify(data.licenseFile, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ithu_namma_kada_${activeLicense.licenseKey}.lic`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOfflineModalOpen(false);
        setOfflineMachineId('');
      } else {
        alert(data.message || 'Failed to download activation file.');
      }
    } catch (err) {
      alert('Error generating activation file.');
    }
  };

  // Analytics Metrics
  const totalClients = licenses.length;
  const activeLicenses = licenses.filter(l => l.status === 'Active').length;
  const suspendedLicenses = licenses.filter(l => l.status === 'Suspended').length;
  const expiredLicenses = licenses.filter(l => l.status === 'Expired' || (l.expiresAt && new Date(l.expiresAt) < new Date())).length;

  if (!token) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          maxWidth: '400px', width: '100%', animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              backgroundColor: '#e0e7ff', width: '60px', height: '60px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px'
            }}>
              <ShieldCheck size={32} color="#4f46e5" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>ITHU NAMMA KADA</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '5px' }}>Admin Licensing Dashboard</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>Username</label>
              <input 
                type="text" 
                placeholder="Enter admin username" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>Password</label>
              <input 
                type="password" 
                placeholder="Enter admin password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div style={{
                backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px 14px',
                borderRadius: '6px', fontSize: '13px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              <Lock size={16} />
              <span>Authenticate Portal</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      
      {/* Sidebar Layout */}
      <aside style={{
        width: '280px', backgroundColor: '#0f172a', color: '#f8fafc',
        display: 'flex', flexDirection: 'column', padding: '30px 20px', borderRight: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <ShieldCheck size={28} color="#818cf8" />
          <div>
            <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700' }}>ITHU NAMMA KADA</h1>
            <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: '600', letterSpacing: '1px' }}>LICENSING HUB</span>
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
            backgroundColor: '#1e293b', borderRadius: '8px', color: '#ffffff', cursor: 'pointer'
          }}>
            <Key size={18} />
            <span style={{ fontWeight: '500', fontSize: '14px' }}>License Management</span>
          </div>
        </nav>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{
            width: '100%', backgroundColor: 'transparent', borderColor: '#334155', color: '#94a3b8'
          }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Dashboard */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>License Registry</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Create, search, renew, and manage device activations.</p>
          </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '8px' }}>
            <PlusCircle size={18} />
            <span>Generate New Key</span>
          </button>
        </header>

        {/* Statistical Metrics Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '35px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Licenses</span>
            <h3 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--bg-dark)', marginTop: '8px' }}>{totalClients}</h3>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Active Licenses</span>
            <h3 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--success)', marginTop: '8px' }}>{activeLicenses}</h3>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Suspended Tiers</span>
            <h3 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--warning)', marginTop: '8px' }}>{suspendedLicenses}</h3>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Expired Keys</span>
            <h3 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--danger)', marginTop: '8px' }}>{expiredLicenses}</h3>
          </div>
        </section>

        {/* Filter Bar */}
        <section style={{
          backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '12px' }} />
            <input 
              type="text" 
              placeholder="Search by Shop Name, Key, or Customer Mobile..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '44px' }}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Suspended">Suspended Only</option>
              <option value="Expired">Expired Only</option>
            </select>
          </div>

          <div style={{ width: '180px' }}>
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
              <option value="">All Plans</option>
              <option value="Lifetime">Lifetime</option>
              <option value="Annual">Annual</option>
              <option value="3-Month">3-Month (Quarterly)</option>
              <option value="Monthly">Monthly</option>
              <option value="Trial">Trial</option>
            </select>
          </div>

          <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="btn btn-secondary" style={{ padding: '10px' }}>
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </section>

        {/* License Table Registry */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Shop / Customer</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>License Key</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Plan</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Expiry</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No licenses found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => {
                  const isExpired = lic.expiresAt && new Date(lic.expiresAt) < new Date();
                  const finalStatus = isExpired ? 'Expired' : lic.status;
                  
                  return (
                    <tr key={lic._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{lic.customerId?.shopName || 'N/A'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <User size={12} /> {lic.customerId?.contactName || 'N/A'} | <Phone size={12} /> {lic.customerId?.mobileNo}
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <code style={{
                          backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '4px',
                          fontSize: '13px', fontWeight: '600', color: '#334155', border: '1px solid #e2e8f0'
                        }}>{lic.licenseKey}</code>
                      </td>
                      <td style={{ padding: '18px 20px', fontSize: '14px', fontWeight: '500' }}>
                        {lic.planType}
                      </td>
                      <td style={{ padding: '18px 20px', fontSize: '14px', color: isExpired ? 'var(--danger)' : '#334155' }}>
                        {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('en-GB') : 'Lifetime'}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <span style={{
                          display: 'inline-flex', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: finalStatus === 'Active' ? 'var(--success-light)' : finalStatus === 'Suspended' ? 'var(--warning-light)' : 'var(--danger-light)',
                          color: finalStatus === 'Active' ? '#065f46' : finalStatus === 'Suspended' ? '#92400e' : '#991b1b'
                        }}>{finalStatus}</span>
                      </td>
                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => { setActiveLicense(lic); setIsOfflineModalOpen(true); }}
                            className="btn btn-secondary" 
                            title="Generate Offline File"
                            style={{ padding: '8px 10px' }}
                          >
                            <Download size={14} />
                          </button>
                          
                          <button 
                            onClick={() => { setActiveLicense(lic); setIsRenewModalOpen(true); }}
                            className="btn btn-secondary" 
                            style={{ padding: '8px 12px', fontSize: '12px' }}
                          >
                            Renew
                          </button>

                          <button 
                            onClick={() => handleResetMachine(lic._id)}
                            className="btn btn-secondary" 
                            style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                          >
                            Reset PC
                          </button>

                          <button 
                            onClick={() => toggleSuspendLicense(lic._id, lic.status)}
                            className="btn btn-secondary" 
                            style={{ padding: '8px 10px', color: lic.status === 'Active' ? 'var(--warning)' : 'var(--success)' }}
                          >
                            {lic.status === 'Active' ? <Ban size={14} /> : <CheckCircle size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </main>

      {/* CREATE LICENSE MODAL */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '650px', maxWidth: '90%',
            padding: '30px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Generate Customer License</h3>
            
            <form onSubmit={handleCreateLicense}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Shop Name *</label>
                  <input type="text" required value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Murugan Stores" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Owner Name *</label>
                  <input type="text" required value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Murugan M" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Contact Mobile No *</label>
                  <input type="text" required value={mobileNo} onChange={e => setMobileNo(e.target.value)} placeholder="e.g. +91 9876543210" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. owner@gmail.com" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>GSTIN Number</label>
                  <input type="text" value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="33AAAAA0000A1Z0" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop address details" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>License Plan *</label>
                  <select value={planType} onChange={e => setPlanType(e.target.value)}>
                    <option value="Lifetime">Lifetime Plan</option>
                    <option value="Annual">Annual Subscription (1 Year)</option>
                    <option value="3-Month">3-Month Subscription (Quarterly)</option>
                    <option value="Monthly">Monthly Plan (30 Days)</option>
                    <option value="Trial">Free Trial (7 Days)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Custom Expiry Date (Optional)</label>
                  <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                </div>
              </div>

              {/* Feature Toggle Checklist */}
              <div style={{ marginBottom: '25px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '12px', textTransform: 'uppercase' }}>Package Feature Matrix</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {Object.keys(features).map((featKey) => (
                    <label key={featKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textTransform: 'capitalize', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={(features as any)[featKey]} 
                        onChange={(e) => setFeatures({ ...features, [featKey]: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      <span>{featKey.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Generate License Certificate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW MODAL */}
      {isRenewModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '400px',
            padding: '24px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Renew Subscription</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '18px' }}>
              Extending license validity for <strong>{activeLicense?.customerId?.shopName}</strong>.
            </p>
            <form onSubmit={handleRenewSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Select Extension Period</label>
                <select value={renewMonths} onChange={e => setRenewMonths(parseInt(e.target.value))}>
                  <option value={1}>1 Month (Monthly Roll)</option>
                  <option value={3}>3 Months (Quarterly Renewal)</option>
                  <option value={12}>1 Year (Annual Saver)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsRenewModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Renew Now</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFLINE ACTIVATION DOWNLOAD MODAL */}
      {isOfflineModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '450px',
            padding: '24px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>Generate Offline License (.lic)</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
              Input the physical machine fingerprint provided by the client (via WhatsApp/SMS) to sign a matching license certificate.
            </p>
            <form onSubmit={handleDownloadOfflineLic}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Machine Hardware ID</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Paste SHA-256 Machine fingerprint..." 
                  value={offlineMachineId}
                  onChange={e => setOfflineMachineId(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsOfflineModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Download size={14} />
                  <span>Download .lic File</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
