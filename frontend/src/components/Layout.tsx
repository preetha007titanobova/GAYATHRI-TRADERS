import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, ArrowLeft, ArrowRight, Search, Printer, Mail, Paperclip, MessageSquare, Power } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [toolbarActions, setToolbarActions] = useState<ToolbarActions>({});
  const [globalNotification, setGlobalNotification] = useState<{msg: string, type: 'error' | 'success' | 'info' | ''}>({msg: '', type: ''});
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isGstCalcOpen, setIsGstCalcOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState({
    isSelectedCustomer: false,
    isChallan: false,
    isTaxBill: true,
    isRetailBill: false
  });
  const location = useLocation();

  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState(false);
  const [closeDayLoading, setCloseDayLoading] = useState(false);
  const [ownerWhatsApp, setOwnerWhatsApp] = useState(() => localStorage.getItem('close_day_whatsapp') || '+919876543210');
  const [ownerEmail, setOwnerEmail] = useState(() => localStorage.getItem('close_day_email') || 'titanobovapvt@gmail.com');

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
      let totalClosing = 0;
      let totalValuation = 0;
      
      data.forEach((item: any) => {
        totalOpening += item.openingStock || 0;
        totalInward += item.inwardToday || 0;
        totalOutward += item.outwardToday || 0;
        totalClosing += item.closingStock || 0;
        totalValuation += item.valuation || 0;
      });

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Daily Stock Status Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Close Day Date: ${formattedDate} | Total Valuation: Rs. ${(totalValuation || 0).toFixed(2)}`, 14, 22);

      const headers = [
        "Item Code", 
        "Item Name", 
        "Unit", 
        "Opening Qty", 
        "Qty In", 
        "Qty Out", 
        "Closing Qty", 
        "Pur. Rate (Rs.)", 
        "Closing Val (Rs.)"
      ];
      
      const rows = data.map((item: any) => [
        item.itemCode || '',
        item.name || '',
        item.uom || 'PCS',
        item.openingStock || 0,
        item.inwardToday || 0,
        item.outwardToday || 0,
        item.closingStock || 0,
        (item.purchaseRate || 0).toFixed(2),
        (item.valuation || 0).toFixed(2)
      ]);

      rows.push([
        'TOTAL',
        `${data.length} Items`,
        '',
        (totalOpening || 0).toString(),
        (totalInward || 0).toString(),
        (totalOutward || 0).toString(),
        (totalClosing || 0).toString(),
        '',
        (totalValuation || 0).toFixed(2)
      ]);

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8 },
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

      const whatsappText = `*Sri Gayathri Traders - Close Day Report*\n` +
                           `*Date:* ${formattedDate}\n` +
                           `*Total Items:* ${data.length}\n` +
                           `*Total Qty In:* ${totalInward}\n` +
                           `*Total Qty Out:* ${totalOutward}\n` +
                           `*Total Closing Qty:* ${totalClosing}\n` +
                           `*Total Closing Valuation:* Rs. ${(totalValuation || 0).toFixed(2)}\n\n` +
                           (pdfUrl ? `*Download PDF Report:* ${pdfUrl}\n\n` : '') +
                           (emailFailed 
                             ? `*Note:* Emailed PDF report failed to send due to email credentials error.\n\n`
                             : `*Notification:* Daily PDF stock report has been generated and emailed to ${ownerEmail}.\n\n`) +
                           `Generated automatically via Billing System.`;

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, '_blank');

      if (emailFailed) {
        setGlobalNotification({ msg: `Day closed! WhatsApp opened, but daily report email failed to send (please check SMTP credentials).`, type: 'error' });
      } else {
        setGlobalNotification({ msg: `Day closed successfully! Report emailed and WhatsApp opened.`, type: 'success' });
      }
      setIsCloseDayModalOpen(false);
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

  const handleAction = (actionName: keyof ToolbarActions) => {
    if (toolbarActions[actionName]) {
      toolbarActions[actionName]!();
    } else {
      setGlobalNotification({ msg: "Feature not implemented or not applicable for the current module.", type: 'info' });
      setTimeout(() => setGlobalNotification({msg: '', type: ''}), 4000);
    }
  };

  const handleFeatureNotImplemented = (featureName: string) => {
    setGlobalNotification({ msg: `${featureName} feature is coming soon!`, type: 'info' });
    setTimeout(() => setGlobalNotification({msg: '', type: ''}), 4000);
  };

  const getPageTitle = (pathname: string) => {
    const routeTitles: Record<string, string> = {
      '/ledger-master': 'Ledger Master',
      '/item-master': 'Item Master',
      '/barcode-generation': 'Barcode Generation',
      '/backup': 'Backup',
      '/quotation': 'Quotation',
      '/sales-order': 'Sales Order',
      '/sales-bill': 'Sales Bill',
      '/sales-return': 'Sales Return',
      '/sales-register': 'Sales Register',
      '/purchase-bill': 'Purchase Bill',
      '/pur-return': 'Pur. Return',
      '/pur-register': 'Pur. Register',
      '/cash-book': 'Cash Book',
      '/bank-book': 'Bank Book',
      '/journal-entry': 'Journal Entry',
      '/cheque-printing': 'Cheque Printing',
      '/stock-status': 'Stock Status',
      '/daily-stock-status': 'Daily Stock Status',
      '/stock-register': 'Stock Register',
      '/view-ledger': 'View Ledger',
      '/statistic-report': 'Statistic Report',
      '/trial-b-s': 'Trial B & S',
      '/p-l-statment': 'P & L Statment',
      '/balance-sheet': 'Balance Sheet'
    };
    return routeTitles[pathname] || 'Dashboard';
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const displayYear = currentMonth < 3 ? `${currentYear - 1}-${currentYear}` : `${currentYear}-${currentYear + 1}`;

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
        <div className={`absolute top-0 left-0 w-full z-[100] px-4 py-2 text-sm font-bold text-center shadow-md border-b ${
          globalNotification.type === 'success' ? 'bg-[#d4edda] text-[#155724] border-[#c3e6cb]' : 
          globalNotification.type === 'error' ? 'bg-[#f8d7da] text-[#721c24] border-[#f5c6cb]' :
          'bg-[#cce5ff] text-[#004085] border-[#b8daff]'
        }`}>
          {globalNotification.msg}
        </div>
      )}
      
      {/* 1. Window Title */}
      <div className="bg-[#2b579a] text-white px-2 py-1 flex items-center text-sm font-semibold">
        <span className="mr-2">SRI GAYATHRI TRADERS BILLING COUNTER - [{getPageTitle(location.pathname)}]</span>
      </div>

      {/* 2. Main Menu Bar */}
      <div className="bg-[#f0f0f0] border-b border-gray-300 flex px-2 py-1 text-sm space-x-2 relative z-50">
        
        {/* MASTER */}
        <div className="relative">
          <span onClick={() => toggleMenu('Master')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Master' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Master</span>
          {activeMenu === 'Master' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/ledger-master" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Ledger Master</Link>
               <Link to="/item-master" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Item Master</Link>
               <Link to="/barcode-generation" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Barcode Generation</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/backup" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Backup</Link>
            </div>
          )}
        </div>

        {/* SALES */}
        <div className="relative">
          <span onClick={() => toggleMenu('Sales')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Sales' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Sales</span>
          {activeMenu === 'Sales' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/quotation" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Quotation</Link>
               <Link to="/sales-order" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Order</Link>
               <Link to="/sales-bill" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Bill</Link>
               <Link to="/sales-return" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Return</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/sales-register" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Sales Register</Link>
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

        {/* PRODUCTION */}
        <div className="relative">
          <span onClick={() => handleFeatureNotImplemented('Production')} className="px-3 py-1 cursor-pointer select-none rounded hover:bg-blue-100">Production</span>
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

        {/* ACCOUNT */}
        <div className="relative">
          <span onClick={() => toggleMenu('Account')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Account' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Account</span>
          {activeMenu === 'Account' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/cash-book" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Cash Book</Link>
               <Link to="/bank-book" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Bank Book</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/journal-entry" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Journal Entry</Link>
               <Link to="/cheque-printing" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Cheque Printing</Link>
            </div>
          )}
        </div>

        {/* REPORT */}
        <div className="relative">
          <span onClick={() => toggleMenu('Report')} className={`px-3 py-1 cursor-pointer select-none rounded ${activeMenu === 'Report' ? 'bg-blue-200 shadow-inner' : 'hover:bg-blue-100'}`}>Report</span>
          {activeMenu === 'Report' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-xl w-48 flex flex-col py-1 z-50">
               <Link to="/view-ledger" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">View Ledger</Link>
               <Link to="/statistic-report" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Statistic Report</Link>
               <div className="border-t border-gray-300 my-1"></div>
               <Link to="/trial-b-s" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Trial B & S</Link>
               <Link to="/p-l-statment" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">P & L Statement</Link>
               <Link to="/balance-sheet" onClick={closeMenu} className="px-4 py-1.5 hover:bg-blue-500 hover:text-white cursor-pointer font-medium">Balance Sheet</Link>
            </div>
          )}
        </div>
        
        {/* WINDOWS */}
        <div className="relative">
          <span onClick={() => handleFeatureNotImplemented('Windows')} className="px-3 py-1 cursor-pointer select-none rounded hover:bg-blue-100">Windows</span>
        </div>

        {/* CONTACT US */}
        <div className="relative">
          <span onClick={() => handleFeatureNotImplemented('Contact Us')} className="px-3 py-1 cursor-pointer select-none rounded hover:bg-blue-100">Contact Us</span>
        </div>

      </div>

      {/* Invisible Overlay to catch clicks outside dropdowns */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={closeMenu}></div>
      )}

      {/* 3. Green Header Bar & Status Indicators */}
      <div className="bg-[#a8d08d] border-b border-[#8ab870] flex items-center justify-between px-2 py-1 shadow-sm">
        {/* Action Buttons */}
        <div className="flex space-x-1">
          <button onClick={() => handleAction('onAdd')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Plus size={16} />
            <span className="text-[10px] mt-1 font-bold">ADD</span>
          </button>
          <button onClick={() => handleAction('onEdit')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Edit size={16} />
            <span className="text-[10px] mt-1 font-bold">EDIT</span>
          </button>
          <button onClick={() => handleAction('onDelete')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Trash2 size={16} />
            <span className="text-[10px] mt-1 font-bold">DELETE</span>
          </button>
          
          <div className="w-[1px] bg-[#8ab870] mx-1 h-8 self-center"></div>
          
          <button onClick={() => handleAction('onPrev')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[40px] focus:outline-none transition-colors">
            <ArrowLeft size={16} />
            <span className="text-[10px] mt-1 font-bold">PREV</span>
          </button>
          <button onClick={() => handleAction('onNext')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[40px] focus:outline-none transition-colors">
            <ArrowRight size={16} />
            <span className="text-[10px] mt-1 font-bold">NEXT</span>
          </button>

          <div className="w-[1px] bg-[#8ab870] mx-1 h-8 self-center"></div>

          <button onClick={() => handleAction('onFind')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Search size={16} />
            <span className="text-[10px] mt-1 font-bold">FIND</span>
          </button>
          <button onClick={() => handleAction('onPrint')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Printer size={16} />
            <span className="text-[10px] mt-1 font-bold">PRINT</span>
          </button>
          <button onClick={() => handleAction('onEmail')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Mail size={16} />
            <span className="text-[10px] mt-1 font-bold">EMAIL</span>
          </button>
          <button onClick={() => handleAction('onAttach')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <Paperclip size={16} />
            <span className="text-[10px] mt-1 font-bold">ATTACH</span>
          </button>
          <button onClick={() => handleAction('onSms')} className="flex flex-col items-center justify-center p-1 hover:bg-[#8ab870] rounded min-w-[50px] focus:outline-none transition-colors">
            <MessageSquare size={16} />
            <span className="text-[10px] mt-1 font-bold">SMS</span>
          </button>

          <div className="w-[1px] bg-[#8ab870] mx-1 h-8 self-center"></div>

          <button onClick={() => setIsCloseDayModalOpen(true)} className="flex flex-col items-center justify-center p-1 bg-red-600 hover:bg-red-700 text-white rounded min-w-[70px] focus:outline-none transition-colors shadow">
            <Power size={16} />
            <span className="text-[10px] mt-1 font-bold">CLOSE DAY</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex space-x-4 items-center bg-[#d1e8e2] px-3 py-1 border border-gray-400 shadow-inner text-sm font-semibold">
          <label className="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" className="form-checkbox" checked={globalSettings.isSelectedCustomer} onChange={e => setGlobalSettings({...globalSettings, isSelectedCustomer: e.target.checked})} />
            <span>Selected Customer ?</span>
          </label>
          <label className="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" className="form-checkbox" checked={globalSettings.isChallan} onChange={e => setGlobalSettings({...globalSettings, isChallan: e.target.checked})} />
            <span>Challan</span>
          </label>
          <label className="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" className="form-checkbox" checked={globalSettings.isTaxBill} onChange={e => setGlobalSettings({...globalSettings, isTaxBill: e.target.checked})} />
            <span>Tax Bill</span>
          </label>
          <label className="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" className="form-checkbox" checked={globalSettings.isRetailBill} onChange={e => setGlobalSettings({...globalSettings, isRetailBill: e.target.checked})} />
            <span>Retail Bill</span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Split Content (Outlet handles the POS Checkout form) */}
        <div className="flex-1 overflow-auto bg-[#d1e8e2] p-2">
          <Outlet context={{ setToolbarActions, setGlobalNotification, globalSettings }} />
        </div>

        {/* Right-Hand Sidebar Menu */}
        <div className="w-48 bg-white border-l border-gray-400 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ul className="text-sm font-semibold text-blue-900">
              {[
                { name: 'Ledger Master', path: '/ledger-master' },
                { name: 'Item Master', path: '/item-master' },
                { name: 'Barcode Generation', path: '/barcode-generation' },
                { name: 'Backup', path: '/backup' },
                { name: 'Quotation', path: '/quotation' },
                { name: 'Sales Order', path: '/sales-order' },
                { name: 'Sales Bill', path: '/sales-bill' },
                { name: 'Sales Return', path: '/sales-return' },
                { name: 'Sales Register', path: '/sales-register' },
                { name: 'Purchase Bill', path: '/purchase-bill' },
                { name: 'Pur. Return', path: '/pur-return' },
                { name: 'Pur. Register', path: '/pur-register' },
                { name: 'Stock Status', path: '/stock-status' },
                { name: 'Daily Stock Status', path: '/daily-stock-status' },
                { name: 'Stock Register', path: '/stock-register' },
                { name: 'View Ledger', path: '/view-ledger' },
                { name: 'Statistic Report', path: '/statistic-report' },
                { name: 'Trial B & S', path: '/trial-b-s' },
                { name: 'P & L Statment', path: '/p-l-statment' },
                { name: 'Balance Sheet', path: '/balance-sheet' }
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
        {/* Control/Shortcut Bar */}
        <div className="bg-[#e0e0e0] border-t border-gray-400 px-2 py-1 text-[11px] flex space-x-4 font-semibold text-gray-700">
          <span>CTRL+N-Add</span>
          <span>CTRL+E-Edit</span>
          <span>CTRL+D-Delete</span>
          <span>CTRL+S-Save</span>
          <span>ESC-Cancel</span>
          <span>CTRL+P-Print</span>
          <span>F2-Item Master</span>
          <span>F3-Ledger Master</span>
        </div>
        
        {/* Bottom Status Bar */}
        <div className="bg-[#2b579a] text-white text-[10px] flex justify-between items-center px-2 py-0.5">
        <div className="flex space-x-6">
          <span>Company Name: SRI GAYATHRI TRADERS</span>
          <span>Welcome: Administrator</span>
          <span>Year: {displayYear}</span>
        </div>
          <div className="flex space-x-2">
            <button onClick={() => handleFeatureNotImplemented('Change Year')} className="bg-gray-200 text-black px-2 hover:bg-gray-300 border border-gray-400 text-[10px]">Change Year</button>
            <button onClick={() => handleFeatureNotImplemented('Change Company')} className="bg-gray-200 text-black px-2 hover:bg-gray-300 border border-gray-400 text-[10px]">Change Company</button>
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
                <span>Close Day Report & Exit</span>
              </span>
              <button 
                onClick={() => setIsCloseDayModalOpen(false)}
                className="text-white hover:text-red-300 font-bold focus:outline-none text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCloseDay} className="p-4 space-y-4 text-left">
              <p className="text-sm font-semibold text-gray-700">
                Are you sure you want to close the day? This will download the daily stock status PDF, email it to the owner, and open WhatsApp to share the status.
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
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseDayModalOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeDayLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2 rounded text-sm transition-colors border border-red-700 shadow"
                >
                  {closeDayLoading ? 'Closing Day...' : 'Send & Close Day'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Layout;
