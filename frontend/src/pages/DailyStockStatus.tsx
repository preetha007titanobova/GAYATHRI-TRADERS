import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Calendar, PackageSearch, AlertTriangle, Search, FileText } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyStockItem {
  id: string;
  itemCode: string;
  name: string;
  uom: string;
  purchaseRate: number;
  price: number;
  openingStock: number;
  inwardToday: number;
  outwardToday: number;
  closingStock: number;
  valuation: number;
}

const DailyStockStatus = () => {
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
    setGlobalNotification: (notif: {msg: string, type: 'error' | 'success' | 'info' | ''}) => void;
  }>();

  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [inventory, setInventory] = useState<DailyStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);

  const fetchDailyStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${Api}/products/daily-status?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      } else {
        setInventory([]);
        setGlobalNotification({ msg: 'Failed to retrieve stock data.', type: 'error' });
      }
    } catch (err) {
      console.error("Failed to fetch daily status", err);
      setGlobalNotification({ msg: 'Error connecting to database.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyStatus();
  }, [selectedDate]);

  useEffect(() => {
    setToolbarActions({
      onPrint: () => {
        window.print();
        setGlobalNotification({ msg: 'Printing Daily Stock Status...', type: 'info' });
      },
      onFind: () => {
        const searchInput = document.getElementById('daily-stock-search-input');
        if (searchInput) searchInput.focus();
      }
    });
    return () => setToolbarActions({});
  }, [setToolbarActions, setGlobalNotification]);

  const filteredStock = useMemo(() => {
    return inventory.filter(item => {
      const closing = item.closingStock || 0;
      if (hideZero && closing <= 0 && item.openingStock <= 0 && item.inwardToday <= 0 && item.outwardToday <= 0) {
        return false;
      }
      
      if (search) {
        const q = search.toLowerCase();
        const code = item.itemCode?.toLowerCase() || '';
        const name = item.name?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [inventory, search, hideZero]);

  const totals = useMemo(() => {
    return filteredStock.reduce(
      (acc, item) => {
        acc.opening += item.openingStock || 0;
        acc.inward += item.inwardToday || 0;
        acc.outward += item.outwardToday || 0;
        acc.closing += item.closingStock || 0;
        acc.valuation += item.valuation || 0;
        return acc;
      },
      { opening: 0, inward: 0, outward: 0, closing: 0, valuation: 0 }
    );
  }, [filteredStock]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Daily Stock Status Report (Complete)', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    const formattedDate = selectedDate.split('-').reverse().join('-');
    
    // Calculate complete totals for PDF report
    const pdfTotals = inventory.reduce(
      (acc, item) => {
        acc.opening += item.openingStock || 0;
        acc.inward += item.inwardToday || 0;
        acc.outward += item.outwardToday || 0;
        acc.closing += item.closingStock || 0;
        acc.valuation += item.valuation || 0;
        return acc;
      },
      { opening: 0, inward: 0, outward: 0, closing: 0, valuation: 0 }
    );

    doc.text(`Target Date: ${formattedDate} | Total Valuation: Rs. ${(pdfTotals.valuation || 0).toFixed(2)}`, 14, 22);

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
    
    // Map over all inventory items for a complete report
    const rows = inventory.map(item => [
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

    // Summary Row
    rows.push([
      'TOTAL',
      `${inventory.length} Items`,
      '',
      (pdfTotals.opening || 0).toString(),
      (pdfTotals.inward || 0).toString(),
      (pdfTotals.outward || 0).toString(),
      (pdfTotals.closing || 0).toString(),
      '',
      (pdfTotals.valuation || 0).toFixed(2)
    ]);

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
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
  };

  const shareOnWhatsApp = async () => {
    setGlobalNotification({ msg: 'Generating PDF and preparing share link...', type: 'info' });
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Daily Stock Status Report (Complete)', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      
      const pdfTotals = inventory.reduce(
        (acc, item) => {
          acc.opening += item.openingStock || 0;
          acc.inward += item.inwardToday || 0;
          acc.outward += item.outwardToday || 0;
          acc.closing += item.closingStock || 0;
          acc.valuation += item.valuation || 0;
          return acc;
        },
        { opening: 0, inward: 0, outward: 0, closing: 0, valuation: 0 }
      );

      doc.text(`Target Date: ${formattedDate} | Total Valuation: Rs. ${(pdfTotals.valuation || 0).toFixed(2)}`, 14, 22);

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
      
      const rows = inventory.map(item => [
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
        `${inventory.length} Items`,
        '',
        (pdfTotals.opening || 0).toString(),
        (pdfTotals.inward || 0).toString(),
        (pdfTotals.outward || 0).toString(),
        (pdfTotals.closing || 0).toString(),
        '',
        (pdfTotals.valuation || 0).toFixed(2)
      ]);

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Daily_Stock_Status_${dateStr.replace(/-/g, '_')}.pdf`;

      const uploadRes = await fetch(`${Api}/products/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf: pdfBase64,
          filename
        })
      });

      let pdfUrl = '';
      if (uploadRes.ok) {
        const resJson = await uploadRes.json();
        pdfUrl = resJson.pdfUrl || '';
      }

      const text = `*Sri Gayathri Traders - Daily Stock Status Report*\n` +
                   `*Date:* ${formattedDate}\n` +
                   `*Total Items:* ${filteredStock.length}\n` +
                   `*Total Qty In:* ${totals.inward}\n` +
                   `*Total Qty Out:* ${totals.outward}\n` +
                   `*Total Closing Qty:* ${totals.closing}\n` +
                   `*Total Closing Valuation:* Rs. ${(totals.valuation || 0).toFixed(2)}\n\n` +
                   (pdfUrl ? `*Download PDF Report:* ${pdfUrl}\n\n` : '') +
                   `Generated automatically via Billing System.`;

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      setGlobalNotification({ msg: 'WhatsApp sharing opened successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: 'Failed to generate PDF share link.', type: 'error' });
    } finally {
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
          <h5 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-4 mr-2 block"></span>
            Daily Stock Status
          </h5>

          <div className="flex items-center space-x-4 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <Search size={16} className="text-gray-400" />
              <input 
                id="daily-stock-search-input"
                type="text" 
                placeholder="Search item code/name..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm focus:outline-none w-48 placeholder-gray-400"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="hideZero" 
                checked={hideZero} 
                onChange={e => setHideZero(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="hideZero" className="text-sm font-bold text-gray-700 cursor-pointer">Hide Zero Balances</label>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#f0f4f8] border border-[#d1d9e0] p-1.5 rounded-md">
            <span className="font-bold text-[#2b579a] flex items-center text-sm mr-2 pl-2"><Calendar size={16} className="mr-1.5"/> Date:</span>
            <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="border-none bg-transparent text-sm text-gray-800 font-bold focus:outline-none" 
              />
            </div>
          </div>

          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-emerald-700 shadow border border-emerald-800 transition-colors">Download PDF</button>

          <button
            onClick={shareOnWhatsApp}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs font-semibold rounded-md shadow border border-green-700 transition-colors flex items-center space-x-1.5"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.517 2.266 2.27 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-4.51c1.558.924 3.01 1.414 4.887 1.415 5.623 0 10.198-4.543 10.2-10.194.002-2.737-1.06-5.312-2.99-7.245C17.009 1.533 14.437.472 11.719.472c-5.617 0-10.193 4.543-10.197 10.197-.001 2.052.553 3.584 1.502 5.057l-1.013 3.7.1.099 3.847-.98c1.468.844 2.9 1.292 4.102 1.292zm9.032-5.834c-.269-.134-1.594-.787-1.84-.875-.246-.089-.425-.134-.605.134-.179.27-.695.875-.851 1.054-.157.18-.314.202-.583.067-.27-.134-1.138-.42-2.167-1.34-.801-.715-1.342-1.599-1.5-1.868-.157-.269-.016-.414.118-.549.121-.122.27-.314.405-.471.134-.157.179-.27.269-.449.09-.179.045-.337-.022-.471-.068-.134-.605-1.459-.83-1.997-.218-.528-.46-.456-.632-.464-.163-.008-.349-.01-.536-.01-.186 0-.49.07-.746.348-.256.279-.979.957-.979 2.333 0 1.376 1.003 2.705 1.142 2.895.14.19 1.974 3.013 4.78 4.225.667.288 1.189.46 1.594.59.67.213 1.28.183 1.761.111.536-.08 1.594-.65 1.819-1.278.226-.628.226-1.166.157-1.278-.068-.111-.247-.179-.516-.314z"/>
            </svg>
            <span>Share</span>
          </button>
        </div>

      </div>

      {/* DATA GRID */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse min-w-max">
            <thead className="bg-[#1e3f70] text-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24">Item Code</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold">Item Name</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-16 text-center">Unit</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right bg-[#142d54]/20">Opening Stock</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-right text-green-300">Qty In (Inward)</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-right text-red-300">Qty Out (Outward)</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right bg-[#142d54]/20">Closing Stock</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-28 text-right">Pur. Rate (₹)</th>
                <th className="p-2 text-xs font-semibold w-32 text-right">Closing Val (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-500 font-bold">
                    Loading daily stock status data...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <PackageSearch size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No items found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const hasMovements = (item.inwardToday > 0 || item.outwardToday > 0);
                  
                  return (
                    <tr 
                      key={item.id || idx} 
                      className={`border-b border-gray-200 transition-colors ${
                        idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'
                      } ${hasMovements ? 'font-bold bg-yellow-50/30' : ''}`}
                    >
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{item.itemCode}</td>
                      <td className="border-r border-gray-200 p-2 text-gray-800 flex items-center">
                        <span>{item.name}</span>
                        {hasMovements && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded-sm ml-2 font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.uom || 'PCS'}</td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-gray-700 bg-gray-50/20">
                        {item.openingStock}
                      </td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-green-600 bg-green-50/20 font-bold">
                        {item.inwardToday > 0 ? `+${item.inwardToday}` : ''}
                      </td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-red-600 bg-red-50/20 font-bold">
                        {item.outwardToday > 0 ? `-${item.outwardToday}` : ''}
                      </td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-blue-700 bg-blue-50/20 font-bold">
                        {item.closingStock}
                      </td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-xs text-gray-600">
                        {(item.purchaseRate || 0).toFixed(2)}
                      </td>
                      
                      <td className="p-2 text-right font-mono font-bold text-gray-900 bg-gray-50/50">
                        {(item.valuation || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-[#1e3f70] border-t border-[#142d54] p-3 flex justify-between items-center text-white flex-shrink-0 z-20">
          <div className="text-sm font-bold text-blue-200 flex space-x-6">
            <span>Total Items: {filteredStock.length}</span>
            <span>Total In: {totals.inward}</span>
            <span>Total Out: {totals.outward}</span>
          </div>

          <div className="flex space-x-4 items-center">
            <div className="flex items-center bg-[#142d54] px-4 py-1.5 rounded border border-[#0d1e38] shadow-inner">
               <span className="text-xs font-bold text-blue-200 uppercase tracking-widest mr-3">Total Closing Qty</span>
               <span className="font-mono text-lg font-black text-white">{totals.closing}</span>
            </div>
            
            <div className="flex items-center bg-[#142d54] px-5 py-1.5 rounded border border-[#0d1e38] shadow-inner">
               <span className="text-xs font-bold text-blue-200 uppercase tracking-widest mr-3">Total Closing Valuation</span>
               <span className="font-mono text-xl font-black text-yellow-300">₹ {(totals.valuation || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DailyStockStatus;
