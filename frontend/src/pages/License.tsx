import React, { useState, useEffect } from 'react';
import { useLicense } from '../context/LicenseContext';
import { Key, Shield, Copy, Check, AlertCircle, UploadCloud, Server, Info, RefreshCw, Calendar } from 'lucide-react';

const License: React.FC = () => {
  const {
    isActivated,
    daysRemaining,
    shopName,
    licenseKey,
    expiresAt,
    planType,
    machineId,
  } = useLicense();

  const [copied, setCopied] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [customShopName, setCustomShopName] = useState(shopName || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info' | ''; message: string }>({ type: '', message: '' });

  // Sync shopName from context when it loads
  useEffect(() => {
    if (shopName) {
      setCustomShopName(shopName);
    }
  }, [shopName]);

  const LICENSE_SERVER_URL = import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:5500';

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAndRelaunch = (licenseObject: any) => {
    if ((window as any).api) {
      (window as any).api.send('save-license', licenseObject);
    } else {
      console.log('Dev Mode Mock Save License File:', licenseObject);
      setStatus({ type: 'success', message: 'License saved successfully! (Relaunch bypassed in browser mode)' });
    }
  };

  // 1. Online Activation / Renewal using a specific key
  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const keyToVerify = newKey.trim();
    if (!keyToVerify) {
      setStatus({ type: 'error', message: 'Please enter a valid license key.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Connecting to licensing server...' });

    try {
      const res = await fetch(`${LICENSE_SERVER_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: keyToVerify,
          machineId,
          shopName: customShopName.trim() || shopName || 'Retail Shop',
          softwareVersion: '1.0.0',
          osDetails: 'Windows OS'
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.licenseFile) {
        setStatus({ type: 'success', message: 'License verified! Saving and restarting application...' });
        setTimeout(() => {
          saveAndRelaunch(data.licenseFile);
        }, 1500);
      } else {
        setStatus({ type: 'error', message: data.message || 'Verification failed. Please check the license key.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Could not connect to the licensing server. Please check your internet connection.' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Check for Online updates of the current active license key
  const handleCheckOnlineRenewal = async () => {
    if (!licenseKey) {
      setStatus({ type: 'error', message: 'No active license key found to check for renewal.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Checking for updates on licensing server...' });

    try {
      const res = await fetch(`${LICENSE_SERVER_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          machineId,
          shopName,
          softwareVersion: '1.0.0',
          osDetails: 'Windows OS'
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.licenseFile) {
        setStatus({ type: 'success', message: 'License updated successfully! Reloading application...' });
        setTimeout(() => {
          saveAndRelaunch(data.licenseFile);
        }, 1500);
      } else {
        setStatus({ type: 'error', message: data.message || 'Online update check failed.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Could not connect to the licensing server. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Offline Activation (.lic file upload)
  const handleOfflineUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus({ type: 'info', message: 'Reading license file...' });
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const licenseObject = JSON.parse(text);

        if (!licenseObject.data || !licenseObject.signature) {
          setStatus({ type: 'error', message: 'Invalid file format. The file must contain signed license credentials.' });
          return;
        }

        // Verify machine ID inside license matches local machine ID
        if (licenseObject.data.machineId !== machineId) {
          setStatus({ type: 'error', message: `Machine ID mismatch! This license file is issued for a different PC.` });
          return;
        }

        setStatus({ type: 'success', message: 'License file verified! Installing and reloading...' });
        setTimeout(() => {
          saveAndRelaunch(licenseObject);
        }, 1500);
      } catch (err) {
        setStatus({ type: 'error', message: 'Error reading license file. Ensure it is a valid decrypted .lic JSON file.' });
      }
    };

    reader.readAsText(file);
  };

  const getDaysClass = () => {
    if (daysRemaining <= 3) return 'text-red-600 bg-red-50 border-red-200';
    if (daysRemaining <= 15) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Lifetime / Never Expirable';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-300">
        <div className="bg-[#2b579a] p-2 rounded text-white shadow-sm">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">License Management & Renewal</h1>
          <p className="text-xs text-gray-500 font-medium">Verify, renew and update your system license keys</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Status Overview */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Status Message Panel */}
          {status.message && (
            <div className={`p-4 rounded border text-xs font-semibold flex items-start gap-2.5 ${
              status.type === 'error' ? 'bg-red-100 border-red-300 text-red-800' :
              status.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' :
              status.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' :
              'bg-gray-100 border-gray-300 text-gray-800'
            }`}>
              {status.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
              {status.type === 'success' && <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
              {status.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5 animate-spin flex-shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* Current License Details Card */}
          <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <span className="font-bold text-gray-700 text-sm">Active License Overview</span>
              <span className={`px-2 py-0.5 text-xs font-black rounded uppercase ${isActivated ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                {isActivated ? 'Activated' : 'Not Activated'}
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-700">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Shop Name</span>
                  <span className="text-sm font-bold text-gray-900">{shopName || 'Billing Software'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Plan Type / Tier</span>
                  <span className="text-sm font-bold text-gray-900">{planType || 'Trial / Custom Plan'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Expiry Date</span>
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {formatDate(expiresAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">License Key</span>
                  <code className="text-xs font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-blue-900">
                    {licenseKey ? `${licenseKey.slice(0, 7)}-XXXX-XXXX-XXXX` : 'NOT_AVAILABLE'}
                  </code>
                </div>
              </div>

              {/* Days remaining callout */}
              <div className={`p-4 rounded border flex items-center justify-between ${getDaysClass()}`}>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider opacity-80">Subscription Status</span>
                  <span className="text-lg font-black leading-none">
                    {daysRemaining === 9999 ? 'Lifetime Plan (No Expiry)' : `${daysRemaining} Days Remaining`}
                  </span>
                </div>
                {isActivated && licenseKey && (
                  <button
                    onClick={handleCheckOnlineRenewal}
                    disabled={loading}
                    className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-xs font-bold py-1.5 px-3 rounded shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Check Online Renewal</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Renew / Enter New Key Form */}
          <div className="bg-white border border-gray-300 rounded shadow-sm p-4">
            <h3 className="font-bold text-gray-700 text-sm mb-3">Renew Subscription with License Key</h3>
            <form onSubmit={handleVerifyKey} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Shop Name for Registration</label>
                  <input
                    type="text"
                    value={customShopName}
                    onChange={(e) => setCustomShopName(e.target.value)}
                    placeholder="e.g. Billing Software"
                    className="border border-gray-300 rounded px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">New License Key</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                      placeholder="INK-XXXX-XXXX-XXXX-XXXX"
                      className="w-full border border-gray-300 rounded pl-8 pr-3 py-2 text-xs font-mono font-bold text-gray-900 uppercase focus:outline-none focus:border-blue-500"
                    />
                    <Key className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <p className="text-[11px] text-gray-400 max-w-sm">
                  Entering a new license key will contact the licensing server, verify parameters for this machine, and relaunch the POS system with your new license validity.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2b579a] hover:bg-[#1a3a6c] text-white font-bold text-xs py-2 px-4 rounded transition-all shadow-xs disabled:bg-gray-400 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Server className="w-3.5 h-3.5" />
                      <span>Verify & Apply License Key</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Hardware / Offline activation */}
        <div className="space-y-6">
          
          {/* Hardware fingerprint ID */}
          <div className="bg-white border border-gray-300 rounded shadow-sm p-4">
            <h3 className="font-bold text-gray-700 text-sm mb-2">Hardware Fingerprint</h3>
            <p className="text-xs text-gray-500 mb-3 leading-normal">
              This Machine ID uniquely identifies this hardware setup. Send it to the license administrator to generate your custom offline license file.
            </p>
            <div className="bg-gray-100 rounded border border-gray-200 p-2.5 flex items-center justify-between gap-2 overflow-hidden">
              <code className="text-xs font-mono font-bold text-blue-900 break-all select-all flex-1">
                {machineId || 'FETCHING...'}
              </code>
              <button
                onClick={copyMachineId}
                className="bg-white border border-gray-300 hover:bg-gray-50 p-1.5 rounded text-gray-600 transition-all cursor-pointer flex-shrink-0"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Offline Activation File Upload */}
          <div className="bg-white border border-gray-300 rounded shadow-sm p-4">
            <h3 className="font-bold text-gray-700 text-sm mb-2">Offline License Upload</h3>
            <p className="text-xs text-gray-500 mb-4 leading-normal">
              If this PC does not have internet access, upload the decrypted `.lic` file generated from the admin portal below.
            </p>

            <div className="relative border-2 border-dashed border-gray-300 hover:border-blue-500 rounded p-6 bg-gray-50/50 hover:bg-gray-50 transition-colors text-center cursor-pointer group">
              <input
                type="file"
                accept=".lic"
                onChange={handleOfflineUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 mb-0.5">Upload .lic File</p>
              <p className="text-[10px] text-gray-400">Click or drag & drop license here</p>
            </div>
          </div>

          {/* Support Info */}
          <div className="bg-blue-50/50 border border-blue-200 rounded p-4 flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-blue-900 mb-1">Need assistance?</h4>
              <p className="text-[11px] text-blue-800 leading-normal">
                If you encounter any licensing errors or need your activation count reset, please contact the administrator portal or technical support with your Machine ID.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default License;
