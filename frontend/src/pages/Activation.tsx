import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicense } from '../context/LicenseContext';
import { Key, Shield, Copy, Check, AlertCircle, UploadCloud, Server, Info, RefreshCw } from 'lucide-react';

const Activation = () => {
  const { machineId, isActivated } = useLicense();
  const navigate = useNavigate();
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info' | ''; message: string }>({ type: '', message: '' });
  
  // Licensing Server Base API Url (Port 5500)
  const LICENSE_SERVER_URL = import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:5500';

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOnlineActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setStatus({ type: 'error', message: 'Please enter a valid license key.' });
      return;
    }
    
    setLoading(true);
    setStatus({ type: 'info', message: 'Connecting to activation server...' });

    try {
      const res = await fetch(`${LICENSE_SERVER_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          machineId,
          shopName: shopName.trim() || 'Retail Shop',
          softwareVersion: '1.0.0',
          osDetails: 'Windows 11'
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.licenseFile) {
        setStatus({ type: 'success', message: 'License verified! Saving and launching application...' });
        
        // Send to Electron main process to write file and relaunch
        if ((window as any).api) {
          setTimeout(() => {
            (window as any).api.send('save-license', data.licenseFile);
          }, 1500);
        } else {
          console.log('Dev Mode Mock Save License File:', data.licenseFile);
        }
      } else {
        setStatus({ type: 'error', message: data.message || 'Activation failed. Please check your key or limit.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Could not reach the activation server. Please check your internet connection or try Offline Activation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineActivation = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        setStatus({ type: 'success', message: 'License file verified! Installing license...' });

        // Save license via Electron IPC
        if ((window as any).api) {
          setTimeout(() => {
            (window as any).api.send('save-license', licenseObject);
          }, 1500);
        } else {
          console.log('Dev Mode Mock Save Offline License File:', licenseObject);
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Error reading license file. Ensure it is a valid decrypted .lic JSON file.' });
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-[#1e1b4b] via-[#0f172a] to-[#020617] text-slate-100 p-4 font-sans antialiased overflow-y-auto">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Activation Card */}
      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Back Option if Already Activated */}
        {isActivated && (
          <button
            onClick={() => navigate('/')}
            type="button"
            className="mb-5 inline-flex items-center text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer gap-1"
          >
            &larr; Back to Dashboard
          </button>
        )}

        {/* Top Header Banner */}
        <div className="flex items-center space-x-3.5 mb-8 pb-5 border-b border-slate-800/60">
          <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30">
            <Shield className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">BILLING SOFTWARE</h1>
            <p className="text-xs text-slate-400 font-medium">Software Activation & Security Guard</p>
          </div>
        </div>

        {/* Machine ID Info Section */}
        <div className="mb-6 bg-slate-950/80 rounded-xl p-4.5 border border-slate-800/50 flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Hardware Fingerprint (Machine ID)</span>
            {copied ? (
              <span className="flex items-center text-emerald-400 space-x-1 select-none">
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 bg-slate-900/90 rounded-lg p-3 border border-slate-800">
            <code className="text-sm font-mono text-indigo-300 break-all select-all font-semibold flex-1 leading-relaxed">
              {machineId || 'FETCHING...'}
            </code>
            <button
              onClick={copyMachineId}
              type="button"
              className="bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white p-2 rounded-lg text-indigo-400 transition-all cursor-pointer flex-shrink-0"
              title="Copy ID to Clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400/95 leading-relaxed">
            <Info className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
            Please share this Machine ID with support to generate your signed license file.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-800/80 mb-6 bg-slate-950/40 rounded-lg p-1.5 border border-slate-900">
          <button
            onClick={() => { setMode('online'); setStatus({ type: '', message: '' }); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all cursor-pointer ${
              mode === 'online'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Online Activation
          </button>
          <button
            onClick={() => { setMode('offline'); setStatus({ type: '', message: '' }); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all cursor-pointer ${
              mode === 'offline'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Offline File (.lic) Upload
          </button>
        </div>

        {/* Status Messages */}
        {status.message ? (
          <div
            className={`mb-6 p-4 rounded-xl text-xs font-medium border flex items-start space-x-3.5 ${
              status.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
              status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
              status.type === 'info' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
              'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            {status.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
            {status.type === 'success' && <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />}
            {status.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-400 mt-0.5 animate-spin flex-shrink-0" />}
            <span>{status.message}</span>
          </div>
        ) : null}

        {/* Forms depending on mode */}
        {mode === 'online' ? (
          <form onSubmit={handleOnlineActivation} className="space-y-4">
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="shopNameInput" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shop Name</label>
              <input
                id="shopNameInput"
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Murugan Stores"
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="licenseKeyInput" className="text-xs font-bold text-slate-400 uppercase tracking-wider">License Key</label>
              <div className="relative">
                <input
                  id="licenseKeyInput"
                  required
                  type="text"
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value)}
                  placeholder="INK-PRO-XXXX-XXXX-XXXX"
                  className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono tracking-wider font-semibold uppercase"
                />
                <Key className="w-5.5 h-5.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-indigo-500/20 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer mt-6"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Key...</span>
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" />
                  <span>Activate Software Online</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-left">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-8 bg-slate-950/20 hover:bg-slate-950/40 transition-colors relative cursor-pointer group">
              <input
                id="licenseFileInput"
                type="file"
                accept=".lic"
                onChange={handleOfflineActivation}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-12 h-12 text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
              <p className="text-sm font-semibold text-slate-200 mb-1">Upload License File (.lic)</p>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Click here or drag & drop the signed license file <br />
                received from the administrator.
              </p>
            </div>
            
            <div className="bg-slate-950/40 rounded-xl p-4.5 border border-slate-800/40">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5">Offline Process Summary:</h2>
              <ol className="list-decimal pl-4.5 text-xs text-slate-400 space-y-2 leading-relaxed font-medium">
                <li>Copy your <strong className="text-indigo-300">Hardware Fingerprint</strong> above.</li>
                <li>Send it to support with your license invoice.</li>
                <li>Download the generated <strong className="text-indigo-300">ithu_namma_kada.lic</strong> file.</li>
                <li>Upload that file above to unlock all billing features.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Activation;
