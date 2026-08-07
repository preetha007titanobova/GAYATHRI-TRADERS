import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Edit, Power, TrendingUp, Lock, Unlock, ChevronDown, ChevronUp, Shield, RefreshCw, Calendar } from 'lucide-react';
import Api from '../Api';
import { useLicense } from '../context/LicenseContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PrinterStatus from './PrinterStatus';
import { OpeningCashModal } from './OpeningCashModal';
import { sendWhatsAppTextMessage } from '../utils/whatsappHelper';

export type ToolbarActions = {
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFind?: () => void;
  onPrint?: () => void;
  onEmail?: () => void;
  onAttach?: () => void;
  onSms?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
};

const Layout = () => {
  const { shopName, daysRemaining, isActivated, loading } = useLicense();
  const [toolbarActions, setToolbarActions] = useState<ToolbarActions>({});
  const [globalNotification, setGlobalNotification] = useState<{msg: string, type: 'error' | 'success' | 'info' | ''}>({msg: '', type: ''});
  const [indianTime, setIndianTime] = useState('');

  // Clock in Asia/Kolkata (IST) 24h
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const year = parts.find(p => p.type === 'year')?.value || '';
      const hour = parts.find(p => p.type === 'hour')?.value || '';
      const minute = parts.find(p => p.type === 'minute')?.value || '';
      const second = parts.find(p => p.type === 'second')?.value || '';
      setIndianTime(`${day}-${month}-${year} ${hour}:${minute}:${second}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (globalNotification.msg) {
      const timer = setTimeout(() => {
        setGlobalNotification({ msg: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [globalNotification.msg]);

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isGstCalcOpen, setIsGstCalcOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState({
    isSelectiveCustomer: false
  });
  const location = useLocation();
  const navigate = useNavigate();

  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState(false);
  const [isCloseRequested, setIsCloseRequested] = useState(false);
  const [closeDayLoading, setCloseDayLoading] = useState(false);
  const [ownerWhatsApp, setOwnerWhatsApp] = useState(() => localStorage.getItem('close_day_whatsapp') || '');
  const [ownerEmail, setOwnerEmail] = useState(() => localStorage.getItem('close_day_email') || '');
  const [isOwnerSettingsModalOpen, setIsOwnerSettingsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Security PIN/Password State
  const [ownerPin, setOwnerPin] = useState(() => localStorage.getItem('owner_details_pin') || '1234');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Lock Screen & Locked Routes State
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isLockSectionOpen, setIsLockSectionOpen] = useState(true);
  const [unlockedReports, setUnlockedReports] = useState<Record<string, boolean>>({});
  const [pendingLockedPath, setPendingLockedPath] = useState<string | null>(null);
  const [reportPinInput, setReportPinInput] = useState('');
  const [reportPinError, setReportPinError] = useState('');

  const lockedPaths = ['/statistic-report', '/trial-b-s', '/p-l-statment', '/balance-sheet', '/stock-valuation'];

  useEffect(() => {
    if (lockedPaths.includes(location.pathname)) {
      if (!unlockedReports[location.pathname]) {
        setPendingLockedPath(location.pathname);
        setReportPinInput('');
        setReportPinError('');
      } else {
        setPendingLockedPath(null);
      }
    } else {
      setPendingLockedPath(null);
      if (Object.keys(unlockedReports).length > 0) {
        setUnlockedReports({});
      }
    }
  }, [location.pathname, unlockedReports]);

  const [isBackendConnecting, setIsBackendConnecting] = useState(true);
  const [backendAttempts, setBackendAttempts] = useState(0);

  useEffect(() => {
    let mounted = true;
    const checkServerHealth = async () => {
      try {
        const res = await fetch(`${Api}/health`);
        if (res.ok && mounted) {
          setIsBackendConnecting(false);
        } else if (mounted) {
          setBackendAttempts(prev => prev + 1);
        }
      } catch (err) {
        if (mounted) setBackendAttempts(prev => prev + 1);
      }
    };

    checkServerHealth();
    const interval = setInterval(() => {
      checkServerHealth();
    }, 1200);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if ((window as any).api) {
      (window as any).api.receive('app-close-requested', () => {
        setIsCloseRequested(true);
        setIsCloseDayModalOpen(true);
      });
    }
  }, []);

  // Trigger warning to renew the plan: on open and every 4 hours when daysRemaining <= 4
  useEffect(() => {
    if (!loading && isActivated && daysRemaining !== undefined && daysRemaining !== null && daysRemaining <= 4 && daysRemaining >= 0) {
      const showRenewalNotification = () => {
        setGlobalNotification({
          msg: `⚠️ Attention: Your license will expire in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Please renew the plan.`,
          type: 'error'
        });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 10000);
      };

      // 1. Show notification immediately when software opens/loads
      showRenewalNotification();

      // 2. Show notification every 4 hours
      const interval = setInterval(showRenewalNotification, 4 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [daysRemaining, isActivated, loading]);


  const handleVerifyReportPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportPinInput === ownerPin) {
      if (pendingLockedPath) {
        setUnlockedReports(prev => ({ ...prev, [pendingLockedPath]: true }));
        setPendingLockedPath(null);
      }
      setReportPinInput('');
      setReportPinError('');
    } else {
      setReportPinError('Invalid PIN! Access Denied.');
    }
  };

  const handleCancelReportPin = () => {
    setPendingLockedPath(null);
    navigate('/sales-bill');
  };

  const handleLockScreen = () => {
    setIsAppLocked(true);
    setUnlockedReports({});
    setEnteredPin('');
    setPinError('');
    closeMenu();
  };

  const saveOwnerSettings = (whatsapp: string, email: string, newPin?: string) => {
    localStorage.setItem('close_day_whatsapp', whatsapp);
    localStorage.setItem('close_day_email', email);
    setOwnerWhatsApp(whatsapp);
    setOwnerEmail(email);
    if (newPin) {
      localStorage.setItem('owner_details_pin', newPin);
      setOwnerPin(newPin);
    }
    setIsOwnerSettingsModalOpen(false);
  };

  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseDayLoading(true);
    
    localStorage.setItem('close_day_whatsapp', ownerWhatsApp);
    localStorage.setItem('close_day_email', ownerEmail);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    try {
      const res = await fetch(`${Api}/products/daily-status?date=${dateStr}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve daily stock status from backend.');
      }
      const data = await res.json();

      let totalOpening = 0;
      let totalInward = 0;
      let totalOutward = 0;
      let totalReturns = 0;
      let totalClosing = 0;
      let totalValuation = 0;
      
      data.forEach((item: any) => {
        totalOpening += item.openingStock || 0;
        totalInward += item.inwardToday || 0;
        totalOutward += item.outwardToday || 0;
        totalReturns += item.returnsToday || 0;
        totalClosing += item.closingStock || 0;
        totalValuation += item.valuation || 0;
      });

      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Daily Stock Status Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Close Day Date: ${formattedDate} | Total Valuation: Rs. ${(totalValuation || 0).toFixed(2)}`, 14, 22);

      const headers = [
        "Item Code", 
        "Product Name", 
        "Barcode",
        "Category",
        "Size",
        "Unit", 
        "Opening Qty", 
        "Qty In (Pur)", 
        "Qty Out (Sold)", 
        "Returns",
        "Closing Qty", 
        "Pur. Rate (Rs.)", 
        "Closing Val (Rs.)",
        "Status",
        "Payment Mode"
      ];
      
      const rows = data.map((item: any) => [
        item.itemCode || '',
        item.name || '',
        item.barcode || '',
        item.category || '',
        item.size || '',
        item.uom || 'PCS',
        item.openingStock || 0,
        item.inwardToday || 0,
        item.outwardToday || 0,
        item.returnsToday || 0,
        item.closingStock || 0,
        (item.purchaseRate || 0).toFixed(2),
        (item.valuation || 0).toFixed(2),
        item.status || 'Inactive',
        item.paymentMode || '-'
      ]);

      rows.push([
        'TOTAL',
        `${data.length} Items`,
        '',
        '',
        '',
        '',
        (totalOpening || 0).toString(),
        (totalInward || 0).toString(),
        (totalOutward || 0).toString(),
        (totalReturns || 0).toString(),
        (totalClosing || 0).toString(),
        '',
        (totalValuation || 0).toFixed(2),
        '',
        ''
      ]);

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 7, cellPadding: 1.5 },
        didParseCell: (cellData) => {
          if (cellData.row.index === rows.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Daily_Stock_Status_${formattedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const pdfBase64 = doc.output('datauristring');

      let emailFailed = false;
      let pdfUrl = '';
      try {
        const closeDayRes = await fetch(`${Api}/products/close-day`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formattedDate,
            pdf: pdfBase64,
            email: ownerEmail
          })
        });

        if (closeDayRes.ok) {
          const resJson = await closeDayRes.json();
          pdfUrl = resJson.pdfUrl || '';
        } else {
          emailFailed = true;
        }
      } catch (e) {
        emailFailed = true;
      }

      const whatsappText = `*🧾 ${shopName || 'ITHU NAMMA KADA'} - CLOSE DAY REPORT*\n` +
                           `📅 *Date:* ${formattedDate}\n` +
                           `----------------------------------------\n` +
                           `📦 *Total Items In Stock Master:* ${data.length}\n` +
                           `📥 *Total Purchased Today (Inward):* ${totalInward} PCS\n` +
                           `📤 *Total Sold Today (Outward):* ${totalOutward} PCS\n` +
                           `🔄 *Total Returns Today:* ${totalReturns} PCS\n` +
                           `📊 *Current Closing Stock Qty:* ${totalClosing} PCS\n` +
                           `💰 *Total Stock Valuation:* ₹${(totalValuation || 0).toFixed(2)}\n` +
                           `----------------------------------------\n` +
                           (pdfUrl ? `📄 *Download Full PDF Report:* ${pdfUrl}\n\n` : '') +
                           (emailFailed 
                             ? `⚠️ *Email Status:* PDF report generate complete.\n\n`
                             : `✅ *Email Status:* PDF report generated & emailed to ${ownerEmail}.\n\n`) +
                           `Generated automatically via Billing System.`;

      // Dispatch Close Day summary to owner's WhatsApp number
      sendWhatsAppTextMessage(ownerWhatsApp, whatsappText);

      setGlobalNotification({ msg: `✓ Day closed! Report sent to owner's WhatsApp [${ownerWhatsApp}]`, type: 'success' });
      setIsCloseDayModalOpen(false);

      if (isCloseRequested) {
        setTimeout(() => {
          if ((window as any).api) {
            (window as any).api.send('app-close-confirmed');
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: err.message || 'Error executing Close Day process.', type: 'error' });
    } finally {
      setCloseDayLoading(false);
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 6000);
    }
  };

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const closeMenu = () => setActiveMenu(null);





  const getPageTitle = (pathname: string) => {
    const routeTitles: Record<string, string> = {
      '/ledger-master': 'Ledger Master',
      '/item-master': 'Item Master',
      '/barcode-generation': 'Barcode Generation',
      '/backup': 'Backup',
      '/quotation': 'Quotation',
      '/quotation-register': 'Quotation Register',
      '/sales-order': 'Sales Order',
      '/sales-bill': 'Sales Bill',
      '/sales-return': 'Sales Return',
      '/sales-register': 'Sales Register',
      '/sales-status': 'Sales Status',
      '/purchase-bill': 'Purchase Bill',
      '/pur-return': 'Pur. Return',
      '/pur-register': 'Pur. Register',
      '/cash-book': 'Cash Book',
      '/bank-book': 'Bank Book',
      '/journal-entry': 'Journal Entry',
      '/cheque-printing': 'Cheque Printing',
      '/stock-status': 'Stock Status',
      '/stock-valuation': 'Stock Valuation',
      '/daily-stock-status': 'Daily Stock Status',
      '/stock-register': 'Stock Register',
      '/view-ledger': 'View Ledger',
      '/statistic-report': 'Statistic Report',
      '/trial-b-s': 'Trial B & S',
      '/p-l-statment': 'P & L Statment',
      '/balance-sheet': 'Balance Sheet',
      '/staff-master': 'Staff Master (Admin)',
      '/staff-attendance': 'Staff Attendance',
      '/shop-sales-bill': 'Wholesale Sales Bill',
      '/shop-sales-register': 'Wholesale Sales Register',
      '/license': 'License & Renewal'
    };
    return routeTitles[pathname] || 'Dashboard';
  };


  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          // ESC is usually safe to trigger cancel even from inputs
          if (toolbarActions.onCancel) {
            e.preventDefault();
            toolbarActions.onCancel();
          }
        }
        // For other shortcuts, only trigger if it's a Ctrl combo
      }

      if (e.ctrlKey) {
        if (e.key.toLowerCase() === 'n' && toolbarActions.onAdd) { e.preventDefault(); toolbarActions.onAdd(); }
        else if (e.key.toLowerCase() === 'e' && toolbarActions.onEdit) { e.preventDefault(); toolbarActions.onEdit(); }
        else if (e.key.toLowerCase() === 'd' && toolbarActions.onDelete) { e.preventDefault(); toolbarActions.onDelete(); }
        else if (e.key.toLowerCase() === 's' && toolbarActions.onSave) { e.preventDefault(); toolbarActions.onSave(); }
        else if (e.key.toLowerCase() === 'p' && toolbarActions.onPrint) { e.preventDefault(); toolbarActions.onPrint(); }
      } else if (e.key === 'Escape' && toolbarActions.onCancel) {
        e.preventDefault();
        toolbarActions.onCancel();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toolbarActions]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#d1e8e2] text-black overflow-hidden font-sans select-none relative">
      
      {/* Global Notification Banner */}
      {globalNotification.msg && (
        <div className={`absolute top-0 left-0 w-full z-[100] px-10 py-2 text-sm font-bold text-center shadow-md border-b flex justify-center items-center ${
          globalNotification.type === 'success' ? 'bg-[#d4edda] text-[#155724] border-[#c3e6cb]' : 
          globalNotification.type === 'error' ? 'bg-[#f8d7da] text-[#721c24] border-[#f5c6cb]' :
          'bg-[#cce5ff] text-[#004085] border-[#b8daff]'
        }`}>
          <span>{globalNotification.msg}</span>
          <button 
            onClick={() => setGlobalNotification({ msg: '', type: '' })}
            className="absolute right-4 top-1/2 -translate-y-1/2 font-bold hover:opacity-75 focus:outline-none text-lg leading-none cursor-pointer p-1"
            aria-label="Close notification"
            style={{ border: 'none', background: 'transparent' }}
          >
            &times;
          </button>
        </div>
      )}
      
      {/* 1. Window Title */}
      <div className="bg-[#2b579a] text-white px-2 py-1 flex items-center text-sm font-semibold">
        <span className="mr-2">{shopName} BILLING COUNTER - [{getPageTitle(location.pathname)}]</span>
      </div>

      {/* Server Startup Health Check Loading Overlay */}
      {isBackendConnecting && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-900/90 text-white backdrop-blur-md">
          <div className="bg-white text-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <RefreshCw size={44} className="text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Starting POS Database Engine</h2>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Initializing offline database and background billing services... Please wait.
            </p>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold py-2 px-3 rounded-lg">
              Status: Connecting to offline server (Attempt {backendAttempts + 1})
            </div>
            <button
              onClick={() => {
                fetch(`${Api}/health`)
                  .then(res => { if (res.ok) setIsBackendConnecting(false); })
                  .catch(() => {});
              }}
              className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer"
            >
              Retry Connection Now
            </button>
          </div>
        </div>
      )}

      {/* License Renewal Warning Banner (Indication for renewal - only shown if 4 days or fewer remaining) */}
      {!loading && isActivated && daysRemaining !== undefined && daysRemaining !== null && daysRemaining <= 4 && daysRemaining >= 0 && (
        <div className="bg-amber-600 text-white font-semibold text-xs px-4 py-2 text-center flex justify-center items-center gap-3 select-text border-b border-amber-700 shadow-sm">
          <span className="flex items-center gap-1">
            <Shield size={14} className="animate-pulse" />
            <span>Attention: Your subscription license will expire in <strong>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong>. Please renew to avoid service disruption.</span>
          </span>
          <Link to="/license" className="bg-white text-amber-900 px-2.5 py-0.5 rounded font-black hover:bg-gray-100 transition-colors shadow-xs no-underline text-[10px]">
            RENEW NOW
          </Link>
        </div>
      )}

      {/* 2. Main Menu Bar */}
   

      {/* Invisible Overlay to catch clicks outside dropdowns */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={closeMenu}></div>
      )}

      {/* 3. Green Header Bar & Status Indicators */}
      <div className="bg-[#a8d08d] border-b border-[#8ab870] flex items-center justify-between px-2 py-1 shadow-sm">
           <div className= "border-gray-300 flex px-2 py-1 text-sm space-x-2 relative z-50">
        
        {/* MASTER */}
        <div className="relative">
          <span onClick={() => toggleMenu('Master')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Master' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Master</span>
          {activeMenu === 'Master' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-52 flex flex-col py-1 z-50">
               <Link to="/ledger-master" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Ledger Master</Link>
               <Link to="/item-master" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Item Master</Link>
               <Link to="/barcode-generation" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Barcode Generation</Link>
               <Link to="/barcode-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Barcode Register</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/opening-cash" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-bold text-emerald-700 hover:text-white">Cash Drawer Opening</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/staff-master" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between">
                 <span>Staff Master (Admin)</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <Link to="/staff-attendance" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Staff Attendance</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/backup" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Backup</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/license" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between">
                 <span>License & Renewal</span>
                 <Shield size={12} className="text-blue-600" />
               </Link>
            </div>
          )}
        </div>

        {/* SALES */}
        <div className="relative">
          <span onClick={() => toggleMenu('Sales')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Sales' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Sales</span>
          {activeMenu === 'Sales' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/sales-bill" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Bill</Link>
               <Link to="/sales-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Register</Link>
               <Link to="/sales-return" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Return</Link>
               <Link to="/sales-status" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Status</Link>
               <Link to="/sales-order" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Order</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/quotation" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Quotation</Link>
               <Link to="/quotation-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Quotation Register</Link>
               <Link to="/shop-sales-bill" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Wholesale Sales Bill</Link>
               <Link to="/shop-sales-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Wholesale Sales Register</Link>
            </div>
          )}
        </div>

        {/* PURCHASE */}
        <div className="relative">
          <span onClick={() => toggleMenu('Purchase')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Purchase' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Purchase</span>
          {activeMenu === 'Purchase' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/purchase-bill" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Purchase Bill</Link>
               <Link to="/pur-return" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Pur. Return</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/pur-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Pur. Register</Link>
            </div>
          )}
        </div>

      
        {/* STOCK */}
        <div className="relative">
          <span onClick={() => toggleMenu('Stock')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Stock' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Stock</span>
          {activeMenu === 'Stock' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
                <Link to="/stock-status" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Stock Status</Link>
                <Link to="/daily-stock-status" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Daily Stock Status</Link>
                <Link to="/stock-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Stock Register</Link>
            </div>
          )}
        </div>

        {/* REPORT */}
        <div className="relative">
          <span onClick={() => toggleMenu('Report')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Report' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Report</span>
          {activeMenu === 'Report' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-52 flex flex-col py-1 z-50">
               <Link to="/view-ledger" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">View Ledger</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <div className="px-3 py-1 text-xs font-bold text-amber-900 bg-amber-100 flex items-center justify-between border-y border-amber-300">
                 <span className="flex items-center space-x-1">
                   <Lock size={12} className="text-amber-800" />
                   <span>Lock Screen Modules</span>
                 </span>
               </div>
               <Link to="/statistic-report" onClick={closeMenu} className="px-5 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between text-xs">
                 <span>Statistic Report</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <Link to="/trial-b-s" onClick={closeMenu} className="px-5 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between text-xs">
                 <span>Trial B & S</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <Link to="/p-l-statment" onClick={closeMenu} className="px-5 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between text-xs">
                 <span>P & L Statement</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <Link to="/balance-sheet" onClick={closeMenu} className="px-5 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between text-xs">
                 <span>Balance Sheet</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <Link to="/stock-valuation" onClick={closeMenu} className="px-5 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium flex items-center justify-between text-xs">
                 <span>Stock Valuation</span>
                 <Lock size={12} className="text-amber-600" />
               </Link>
               <div className="border-t border-gray-300 my-1"></div>
               <button onClick={handleLockScreen} className="w-full text-left px-4 py-1.5 hover:bg-red-600 hover:text-white text-red-700 font-bold cursor-pointer flex items-center space-x-2">
                 <Lock size={14} />
                 <span>Lock Screen</span>
               </button>
            </div>
          )}
        </div>
        
      

     

      </div>
      

        {/* Status Indicators - Selective Customer appears ONLY on Sales Bill page */}
        {location.pathname === '/sales-bill' && (
          <div className="flex space-x-4 items-center bg-[#d1e8e2] px-3 py-1 border border-gray-400 shadow-inner text-sm font-semibold">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input type="checkbox" className="form-checkbox" checked={globalSettings.isSelectiveCustomer} onChange={e => setGlobalSettings({...globalSettings, isSelectiveCustomer: e.target.checked})} />
              <span>Selective Customer ?</span>
            </label>
          </div>
        )}
          <div className="flex space-x-1">
          <button 
            onClick={() => {
              setEnteredPin('');
              setPinError('');
              setIsPinModalOpen(true);
            }} 
            className="flex flex-col items-center justify-center p-1 bg-slate-600 hover:bg-slate-700 text-white rounded min-w-[70px] focus:outline-none transition-colors shadow"
          >
            <Edit size={16} />
            <span className="text-[10px] mt-1 font-bold">OWNER DETAILS</span>
          </button>
          <Link to="/daily-stock-status" className="flex flex-col items-center justify-center p-1 bg-[#2b579a] hover:bg-[#1a3a6c] text-white rounded min-w-[90px] focus:outline-none transition-colors shadow no-underline text-center">
            <TrendingUp size={16} />
            <span className="text-[10px] mt-1 font-bold">DAILY STOCK STATUS</span>
          </Link>
          <Link to="/opening-cash" className="flex flex-col items-center justify-center p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded min-w-[85px] focus:outline-none transition-colors shadow no-underline text-center">
            <RefreshCw size={16} />
            <span className="text-[10px] mt-1 font-bold">OPENING CASH</span>
          </Link>
          <button onClick={() => setIsCloseDayModalOpen(true)} className="flex flex-col items-center justify-center p-1 bg-red-600 hover:bg-red-700 text-white rounded min-w-[70px] focus:outline-none transition-colors shadow">
            <Power size={16} />
            <span className="text-[10px] mt-1 font-bold">CLOSE DAY</span>
          </button>
        </div>
      </div>

      {/* Daily Startup Opening Cash Prompt Modal */}
      <OpeningCashModal />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left/Center Split Content (Outlet handles the POS Checkout form) */}
        <div className="flex-1 overflow-auto bg-[#d1e8e2] p-2">
          <Outlet context={{ 
            setToolbarActions, 
            setGlobalNotification, 
            globalSettings, 
            setGlobalSettings,
            ownerWhatsApp, 
            ownerEmail, 
            openOwnerSettings: () => setIsOwnerSettingsModalOpen(true) 
          }} />
        </div>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-1/2 -translate-y-1/2 bg-white border border-gray-400 hover:bg-blue-50 text-blue-900 w-4 h-16 flex items-center justify-center rounded-l-md shadow-md cursor-pointer z-40 focus:outline-none transition-all duration-300"
          style={{ right: isSidebarOpen ? '192px' : '0px' }}
          title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
          <span className="text-xs font-black">{isSidebarOpen ? '›' : '‹'}</span>
        </button>

        {/* Right-Hand Sidebar Menu */}
        <div className={`bg-white border-l border-gray-400 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-48' : 'w-0 overflow-hidden border-l-0'}`}>
          <div className="flex-1 overflow-y-auto">
            <ul className="text-sm font-semibold text-blue-900">
              {[
                { name: 'Ledger Master', path: '/ledger-master' },
                { name: 'Item Master', path: '/item-master' },
                { name: 'Barcode Generation', path: '/barcode-generation' },
                { name: 'Backup', path: '/backup' },
                { name: 'Sales Bill', path: '/sales-bill' },
                { name: 'Sales Register', path: '/sales-register' },
                { name: 'Sales Return', path: '/sales-return' },
                { name: 'Sales Status', path: '/sales-status' },
                { name: 'Sales Order', path: '/sales-order' },
                { name: 'Quotation', path: '/quotation' },
                { name: 'Quotation Register', path: '/quotation-register' },
                { name: 'Wholesale Sales Bill', path: '/shop-sales-bill' },
                { name: 'Wholesale Sales Register', path: '/shop-sales-register' },
                { name: 'Purchase Bill', path: '/purchase-bill' },
                { name: 'Pur. Return', path: '/pur-return' },
                { name: 'Pur. Register', path: '/pur-register' },
                // STAFF & ATTENDANCE
                { name: 'Staff Master (Admin)', path: '/staff-master' },
                { name: 'Staff Attendance', path: '/staff-attendance' },
                { name: 'Stock Status', path: '/stock-status' },
                { name: 'Daily Stock Status', path: '/daily-stock-status' },
                { name: 'Stock Register', path: '/stock-register' },
                { name: 'View Ledger', path: '/view-ledger' },
                { name: 'License & Renewal', path: '/license' }
              ].map((item, idx) => {
                const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/sales-register'); // default to sales register
                return (
                  <Link 
                    key={idx} 
                    to={item.path} 
                    className={`block px-3 py-1 cursor-pointer border-b border-gray-100 transition-colors ${
                      isActive ? 'bg-[#2b579a] text-white font-bold' : 'hover:bg-blue-100 hover:text-blue-700 text-blue-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </ul>

            {/* Lock Screen Accordion Section */}
            <div className="mt-3 border-t-2 border-amber-400 bg-amber-50/70 py-1">
              <div 
                onClick={() => setIsLockSectionOpen(!isLockSectionOpen)}
                className="px-3 py-1.5 bg-amber-200/90 hover:bg-amber-300/80 border-b border-amber-300 flex items-center justify-between text-amber-950 font-bold text-xs cursor-pointer select-none transition-colors"
              >
                <span className="flex items-center space-x-1.5">
                  <Lock size={13} className="text-amber-800" />
                  <span>Lock Screen</span>
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockScreen();
                    }}
                    className="text-[9px] bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded font-black cursor-pointer shadow transition-colors"
                    title="Lock System Screen"
                  >
                    LOCK
                  </button>
                  {isLockSectionOpen ? (
                    <ChevronUp size={14} className="text-amber-900" />
                  ) : (
                    <ChevronDown size={14} className="text-amber-900" />
                  )}
                </div>
              </div>

              {isLockSectionOpen && (
                <>
                  <div className="py-0.5">
                    {[
                      { name: 'Statistic Report', path: '/statistic-report' },
                      { name: 'Trial B & S', path: '/trial-b-s' },
                      { name: 'P & L Statment', path: '/p-l-statment' },
                      { name: 'Balance Sheet', path: '/balance-sheet' },
                      { name: 'Stock Valuation', path: '/stock-valuation' }
                    ].map((item, idx) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link 
                          key={idx} 
                          to={item.path} 
                          className={`px-3 py-1 cursor-pointer border-b border-amber-200/50 transition-colors flex items-center justify-between text-xs ${
                            isActive ? 'bg-[#2b579a] text-white font-bold' : 'hover:bg-amber-100 text-blue-950 font-semibold'
                          }`}
                        >
                          <span>{item.name}</span>
                          <span title="PIN Protected Screen">
                            <Lock size={11} className={isActive ? 'text-amber-300' : 'text-amber-700'} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="p-1 px-2 mt-1">
                    <button
                      onClick={handleLockScreen}
                      className="w-full text-center px-2 py-1.5 cursor-pointer rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow transition-colors"
                    >
                      <Lock size={13} />
                      <span>Lock Screen</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* <div className="p-2 border-t border-gray-400 bg-gray-100">
            <button className="w-full bg-black text-white font-bold py-2 text-sm hover:bg-gray-800 shadow shadow-gray-500">
              Open Anydesk
            </button>
          </div> */}
        </div>
      </div>

      {/* Bottom Status & Control Bars */}
      <div className="flex flex-col">
      
        <div className="bg-[#2b579a] text-white text-[10px] flex justify-between items-center px-2 py-0.5">
        {/* <div className="flex space-x-6">
          <span>Company Name: {shopName}</span>
          <span>Welcome: Administrator</span>
          <span>Year: {displayYear}</span>
        </div> */}
          <div className="flex space-x-2">
           
            <button onClick={() => setIsCalcOpen(!isCalcOpen)} className="bg-gray-200 text-black px-2 hover:bg-gray-300 border border-gray-400 text-[10px] relative">
              Calculator
              {isCalcOpen && (
                <div className="absolute bottom-8 right-0 w-48 bg-white border border-gray-400 shadow-xl p-2 text-left cursor-default z-50 text-sm" onClick={e => e.stopPropagation()}>
                  <div className="font-bold border-b pb-1 mb-2 text-blue-900 flex justify-between">
                    Calculator <span className="cursor-pointer text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setIsCalcOpen(false); }}>✕</span>
                  </div>
                  <div className="bg-gray-100 p-2 text-right text-lg border border-gray-300 mb-2 font-mono">0.00</div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+'].map(btn => (
                      <div key={btn} className="bg-gray-200 hover:bg-gray-300 p-1 border border-gray-300 cursor-pointer">{btn}</div>
                    ))}
                  </div>
                </div>
              )}
            </button>
            <button onClick={() => setIsGstCalcOpen(!isGstCalcOpen)} className="bg-gray-200 text-black px-2 hover:bg-gray-300 border border-gray-400 text-[10px] relative">
              GST Calculator
              {isGstCalcOpen && (
                <div className="absolute bottom-8 right-0 w-56 bg-white border border-gray-400 shadow-xl p-2 text-left cursor-default z-50 text-sm" onClick={e => e.stopPropagation()}>
                  <div className="font-bold border-b pb-1 mb-2 text-blue-900 flex justify-between">
                    GST Calc <span className="cursor-pointer text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setIsGstCalcOpen(false); }}>✕</span>
                  </div>
                  <div className="space-y-2">
                    <div><label className="text-xs">Amount</label><input type="number" className="w-full border p-1 text-xs" placeholder="0.00" /></div>
                    <div><label className="text-xs">GST %</label>
                      <select className="w-full border p-1 text-xs">
                        <option>5%</option>
                        <option>12%</option>
                        <option>18%</option>
                        <option>28%</option>
                      </select>
                    </div>
                    <div className="bg-green-50 p-1 border text-xs">
                      <div>CGST: 0.00</div>
                      <div>SGST: 0.00</div>
                      <div className="font-bold mt-1">Total: 0.00</div>
                    </div>
                  </div>
                </div>
              )}
            </button>
            <PrinterStatus />
          </div>
        </div>
      </div>

      {/* Close Day Modal */}
      {isCloseDayModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-gray-400 shadow-2xl rounded-lg w-full max-w-md overflow-hidden">
            <div className="bg-[#2b579a] text-white p-3 font-bold flex justify-between items-center">
              <span className="flex items-center space-x-2">
                <Power size={18} />
                <span>{isCloseRequested ? 'Confirm Application Exit' : 'Close Day Report & Exit'}</span>
              </span>
              <button 
                onClick={() => {
                  setIsCloseDayModalOpen(false);
                  setIsCloseRequested(false);
                }}
                className="text-white hover:text-red-300 font-bold focus:outline-none text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCloseDay} className="p-4 space-y-4 text-left">
              {!loading && isActivated && daysRemaining !== undefined && daysRemaining !== null && daysRemaining <= 4 && daysRemaining >= 0 && (
                <div className="bg-red-100 border border-red-300 text-red-700 px-3.5 py-2.5 rounded-lg text-xs font-bold mb-3 shadow-xs">
                  <p className="flex items-center gap-1.5 text-sm mb-1 text-red-800 font-extrabold">⚠️ ATTENTION: LICENSE EXPIRING SOON</p>
                  <p className="text-red-700">
                    Your subscription license expires in <strong>{daysRemaining === 0 ? 'Today (0 days)' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}</strong>. Please renew your plan to prevent software lockout.
                  </p>
                </div>
              )}
              <p className="text-sm font-semibold text-gray-700">
                {isCloseRequested 
                  ? 'Would you like to send the daily stock status report via WhatsApp before exiting the application?' 
                  : 'Are you sure you want to close the day? This will download the daily stock status PDF, email it to the owner, and open WhatsApp to share the status.'}
              </p>
              
              <div className="space-y-3 bg-gray-50 p-3 border border-gray-200 rounded">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Owner's WhatsApp Number</label>
                  <input 
                    type="tel"
                    required
                    value={ownerWhatsApp}
                    onChange={e => setOwnerWhatsApp(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Owner's Email Address</label>
                  <input 
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={e => setOwnerEmail(e.target.value)}
                    placeholder="e.g. owner@example.com"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white text-black"
                  />
                </div>
              </div>
              
              <div className="flex flex-col space-y-2 pt-2">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCloseDayModalOpen(false);
                      setIsCloseRequested(false);
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm transition-colors border border-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={closeDayLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2 rounded text-sm transition-colors border border-red-700 shadow"
                  >
                    {closeDayLoading 
                      ? 'Processing...' 
                      : isCloseRequested 
                        ? 'Send & Exit' 
                        : 'Send & Close Day'}
                  </button>
                </div>
                {isCloseRequested && (
                  <button
                    type="button"
                    onClick={() => {
                      if ((window as any).api) {
                        (window as any).api.send('app-close-confirmed');
                      }
                    }}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded text-sm transition-colors border border-gray-700 shadow"
                  >
                    Exit Without Sending
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Settings Modal */}
      {isOwnerSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
          <div className="bg-white border border-gray-400 shadow-2xl rounded-lg w-full max-w-md overflow-hidden">
            <div className="bg-[#2b579a] text-white p-3 font-bold flex justify-between items-center">
              <span className="flex items-center space-x-2">
                <Edit size={18} />
                <span>Owner Contact Settings</span>
              </span>
              <button 
                onClick={() => setIsOwnerSettingsModalOpen(false)}
                className="text-white hover:text-red-300 font-bold focus:outline-none text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const whatsapp = formData.get('whatsapp') as string;
              const email = formData.get('email') as string;
              const pin = formData.get('pin') as string;
              saveOwnerSettings(whatsapp, email, pin);
              setGlobalNotification({ msg: 'Owner contact details updated successfully!', type: 'success' });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
            }} className="p-4 space-y-4 text-left">
              <p className="text-xs text-gray-500">
                Update the owner's WhatsApp number, email and security PIN. These values will be used as defaults.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Owner's WhatsApp Number</label>
                  <input 
                    type="tel"
                    name="whatsapp"
                    required
                    defaultValue={ownerWhatsApp}
                    placeholder="e.g. +919876543210"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Owner's Email Address</label>
                  <input 
                    type="email"
                    name="email"
                    required
                    defaultValue={ownerEmail}
                    placeholder="e.g. owner@example.com"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white text-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Access PIN / Password</label>
                  <input 
                    type="password"
                    name="pin"
                    required
                    defaultValue={ownerPin}
                    placeholder="e.g. 1234"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white text-black"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOwnerSettingsModalOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors border border-blue-700 shadow"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[120] p-4">
          <div className="bg-white border border-gray-400 shadow-2xl rounded-lg w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#2b579a] text-white p-3 font-bold flex justify-between items-center">
              <span>Security Access PIN Required</span>
              <button 
                onClick={() => setIsPinModalOpen(false)}
                className="text-white hover:text-red-300 font-bold focus:outline-none"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (enteredPin === ownerPin) {
                setIsPinModalOpen(false);
                setIsOwnerSettingsModalOpen(true);
              } else {
                setPinError('Invalid PIN! Please check and try again.');
              }
            }} className="p-4 space-y-4 text-left">
              <p className="text-xs text-gray-600 font-medium">
                Please enter the security PIN to access the Owner Contact Settings.
              </p>
              
              <div>
                <input 
                  type="password"
                  required
                  autoFocus
                  value={enteredPin}
                  onChange={e => {
                    setEnteredPin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="Enter PIN (Default is 1234)"
                  className="w-full border border-gray-300 rounded px-2.5 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-white text-black"
                />
                {pinError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5 text-center">{pinError}</p>
                )}
              </div>
              
              <div className="flex space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors border border-blue-700 shadow"
                >
                  Verify PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Full Lock Screen Modal */}
      {isAppLocked && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-[999] p-4 text-white animate-in fade-in duration-200">
          <div className="bg-white/10 border border-white/20 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center">
            <div className="bg-blue-600/30 p-4 rounded-full mb-4 border border-blue-400/40 text-blue-300 shadow-inner">
              <Lock size={44} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">{shopName}</h2>
            <p className="text-xs text-blue-200 uppercase font-bold tracking-wider mb-6">System Screen Locked</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (enteredPin === ownerPin) {
                setIsAppLocked(false);
                setEnteredPin('');
                setPinError('');
              } else {
                setPinError('Invalid PIN! Access Denied.');
              }
            }} className="w-full space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="Enter PIN to Unlock"
                  className="w-full px-4 py-3 bg-black/50 border border-white/30 rounded-xl text-center text-xl font-bold tracking-widest text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
                {pinError && <p className="text-xs text-red-400 font-bold mt-2">{pinError}</p>}
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-colors border border-blue-400/50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Unlock size={18} />
                <span>Unlock Application</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Locked Screen PIN Verification Modal */}
      {pendingLockedPath && !isAppLocked && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4">
          <div className="bg-white border border-gray-400 shadow-2xl rounded-lg w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#2b579a] text-white p-3 font-bold flex justify-between items-center">
              <span className="flex items-center space-x-2">
                <Lock size={16} className="text-amber-300" />
                <span>Locked Screen - Security PIN Required</span>
              </span>
              <button 
                onClick={handleCancelReportPin}
                className="text-white hover:text-red-300 font-bold focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleVerifyReportPin} className="p-4 space-y-4 text-left">
              <p className="text-xs text-gray-700 font-semibold">
                Access to <span className="text-blue-900 font-bold">{getPageTitle(pendingLockedPath)}</span> is protected. Enter security PIN to unlock.
              </p>
              
              <div>
                <input 
                  type="password"
                  required
                  autoFocus
                  value={reportPinInput}
                  onChange={e => {
                    setReportPinInput(e.target.value);
                    if (reportPinError) setReportPinError('');
                  }}
                  placeholder="Enter PIN (Default 1234)"
                  className="w-full border border-gray-300 rounded px-2.5 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-white text-black"
                />
                {reportPinError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5 text-center">{reportPinError}</p>
                )}
              </div>
              
              <div className="flex space-x-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancelReportPin}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm transition-colors border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded text-sm transition-colors border border-amber-700 shadow flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Unlock size={14} />
                  <span>Unlock Screen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Indian Date & Time Footer */}
      <div className="bg-[#2b579a] text-white border-t border-[#1d3f70] px-4 py-1.5 flex justify-between items-center text-xs font-bold shadow-inner z-10 flex-shrink-0">
        <span>© Ithu Namma Kada - Professional Billing Counter System</span>
        <div className="flex items-center space-x-2 bg-slate-900/40 border border-indigo-400/20 px-3 py-1 rounded-lg text-yellow-350 font-mono tracking-wider shadow-inner">
          <Calendar size={12} className="text-yellow-400 mr-1" />
          <span>{indianTime}</span>
        </div>
      </div>

    </div>
  );
};

export default Layout;
