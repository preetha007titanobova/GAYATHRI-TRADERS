import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { Calendar, PackageSearch, Search, FileText } from 'lucide-react';
import Api from '../Api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendWhatsAppTextMessage, getRegisteredShopName } from '../utils/whatsappHelper';

interface DailyStockItem {
  id: string;
  itemCode: string;
  name: string;
  barcode?: string;
  category?: string;
  size?: string;
  uom: string;
  purchaseRate: number;
  price: number;
  openingStock: number;
  inwardToday: number;
  outwardToday: number;
  returnsToday: number;
  closingStock: number;
  valuation: number;
  status?: string;
  paymentMode?: string;
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
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [salesOnly, setSalesOnly] = useState(true);

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

  const fetchDailySales = async () => {
    try {
      const res = await fetch(`${Api}/sales/search`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const filtered = data.filter(bill => {
            if (!bill.invDate) return false;
            const billDate = new Date(bill.invDate).toISOString().split('T')[0];
            return billDate === selectedDate;
          });
          setDailySales(filtered);
        }
      }
    } catch (err) {
      console.error("Failed to fetch daily sales for payment summary", err);
    }
  };

  useEffect(() => {
    fetchDailyStatus();
    fetchDailySales();
  }, [selectedDate]);

  const paymentSummary = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let credit = 0;
    let total = 0;

    dailySales.forEach(bill => {
      const mode = bill.paymentMode || 'Cash';
      const amt = Number(bill.netAmount) || Number(bill.totalAmount) || 0;
      total += amt;

      if (mode.includes('UPI') || mode.includes('Online')) {
        upi += amt;
      } else if (mode.includes('Card') || mode.includes('Bank')) {
        card += amt;
      } else if (mode.includes('Credit') || mode.includes('Ledger')) {
        credit += amt;
      } else {
        cash += amt;
      }
    });

    return { cash, upi, card, credit, total, count: dailySales.length };
  }, [dailySales]);

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
      if (salesOnly && (item.outwardToday <= 0 && item.inwardToday <= 0 && (item.returnsToday || 0) <= 0)) {
        return false;
      }

      const closing = item.closingStock || 0;
      if (hideZero && closing <= 0 && item.openingStock <= 0 && item.inwardToday <= 0 && item.outwardToday <= 0 && (item.returnsToday || 0) <= 0) {
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
  }, [inventory, search, hideZero, salesOnly]);

  const totals = useMemo(() => {
    return filteredStock.reduce(
      (acc, item) => {
        acc.opening += item.openingStock || 0;
        acc.inward += item.inwardToday || 0;
        acc.outward += item.outwardToday || 0;
        acc.returns += item.returnsToday || 0;
        acc.closing += item.closingStock || 0;
        acc.valuation += item.valuation || 0;
        return acc;
      },
      { opening: 0, inward: 0, outward: 0, returns: 0, closing: 0, valuation: 0 }
    );
  }, [filteredStock]);

  const hasInward = useMemo(() => {
    return filteredStock.some(item => (item.inwardToday || 0) > 0);
  }, [filteredStock]);

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait' });
    doc.setFontSize(16);
    doc.setTextColor(43, 87, 154);
    doc.text('Daily Sales Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    const formattedDate = selectedDate.split('-').reverse().join('-');
    
    // Calculate totals for PDF report from filtered stock
    const pdfTotals = filteredStock.reduce(
      (acc, item) => {
        acc.inward += item.inwardToday || 0;
        acc.outward += item.outwardToday || 0;
        acc.returns += item.returnsToday || 0;
        return acc;
      },
      { inward: 0, outward: 0, returns: 0 }
    );

    doc.text(`Target Date: ${formattedDate}`, 14, 22);

    const headers = [
      "Item Code", 
      "Product Name",
      "Category",
      "Unit"
    ];
    if (hasInward) {
      headers.push("Qty In (Pur)");
    }
    headers.push("Qty Out (Sold)", "Returns");
    
    const rows = filteredStock.map(item => {
      const row = [
        item.itemCode || '',
        item.name || '',
        item.category || '',
        item.uom || 'PCS'
      ];
      if (hasInward) {
        row.push((item.inwardToday || 0).toString());
      }
      row.push((item.outwardToday || 0).toString(), (item.returnsToday || 0).toString());
      return row;
    });

    const totalRow = [
      'TOTAL',
      `${filteredStock.length} Items`,
      '',
      ''
    ];
    if (hasInward) {
      totalRow.push((pdfTotals.inward || 0).toString());
    }
    totalRow.push((pdfTotals.outward || 0).toString(), (pdfTotals.returns || 0).toString());
    rows.push(totalRow);

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 87, 154] },
      styles: { fontSize: 8, cellPadding: 2 },
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
    link.download = `Daily_Sales_Report_${formattedDate}.pdf`;
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
      const doc = new jsPDF({ orientation: 'portrait' });
      doc.setFontSize(16);
      doc.setTextColor(43, 87, 154);
      doc.text('Daily Sales Report', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      
      const pdfTotals = filteredStock.reduce(
        (acc, item) => {
          acc.inward += item.inwardToday || 0;
          acc.outward += item.outwardToday || 0;
          acc.returns += item.returnsToday || 0;
          return acc;
        },
        { inward: 0, outward: 0, returns: 0 }
      );

      doc.text(`Target Date: ${formattedDate}`, 14, 22);

      const headers = [
        "Item Code", 
        "Product Name", 
        "Category",
        "Unit"
      ];
      if (hasInward) {
        headers.push("Qty In (Pur)");
      }
      headers.push("Qty Out (Sold)", "Returns");
      
      const rows = filteredStock.map(item => {
        const row = [
          item.itemCode || '',
          item.name || '',
          item.category || '',
          item.uom || 'PCS'
        ];
        if (hasInward) {
          row.push((item.inwardToday || 0).toString());
        }
        row.push((item.outwardToday || 0).toString(), (item.returnsToday || 0).toString());
        return row;
      });

      const totalRow = [
        'TOTAL',
        `${filteredStock.length} Items`,
        '',
        ''
      ];
      if (hasInward) {
        totalRow.push((pdfTotals.inward || 0).toString());
      }
      totalRow.push((pdfTotals.outward || 0).toString(), (pdfTotals.returns || 0).toString());
      rows.push(totalRow);

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [43, 87, 154] },
        styles: { fontSize: 8, cellPadding: 2 },
        didParseCell: (data) => {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Daily_Sales_Report_${dateStr.replace(/-/g, '_')}.pdf`;

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

      const activeShopName = getRegisteredShopName();
      const reportText = `*${activeShopName} - Daily Sales Report*\n` +
                         `*Date:* ${formattedDate}\n` +
                         `*Total Items:* ${filteredStock.length}\n` +
                         (hasInward ? `*Total Qty In (Pur):* ${totals.inward}\n` : '') +
                         `*Total Qty Out (Sold):* ${totals.outward}\n` +
                         `*Total Qty Returned:* ${totals.returns}\n` +
                         `*Total Sales Amount:* Rs. ${paymentSummary.total.toFixed(2)}\n\n` +
                         (pdfUrl ? `*Download PDF Report:* ${pdfUrl}\n\n` : '') +
                         `Generated automatically via ${activeShopName} Billing System.`;

      sendWhatsAppTextMessage('', reportText);
      setGlobalNotification({ msg: 'WhatsApp sharing triggered successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({ msg: 'Failed to generate PDF share link.', type: 'error' });
    } finally {
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 5000);
    }
  };

  const colSpanCount = hasInward ? 7 : 6;

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-2 overflow-hidden">
      
      {/* DAILY SALES PAYMENT METHODS SUMMARY BANNER (TOP ROW) */}
      <div className="bg-[#1e3f70] text-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex flex-col space-y-2.5 text-xs print:hidden">
        {/* Top Row: Title and Total Sales */}
        <div className="flex justify-between items-center border-b border-blue-900/60 pb-2">
          <span className="text-blue-200 font-extrabold uppercase tracking-wider text-[11px] flex items-center">
            <FileText size={15} className="mr-1.5 text-blue-300" /> Daily Sales Payment Method Breakdown ({paymentSummary.count} Bills)
          </span>
          <div className="bg-yellow-400 text-slate-900 px-3 py-1 rounded font-black flex items-center space-x-1.5 shadow border border-yellow-500">
            <span className="text-[10px] uppercase tracking-wider text-slate-800">Total Sales:</span>
            <span className="font-mono text-sm font-extrabold">₹{paymentSummary.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Bottom Row: Breakdown tags */}
        <div className="flex items-center space-x-2.5 font-semibold flex-wrap justify-end">
          <div className="bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md text-emerald-800 flex items-center space-x-1">
            <span>💵 Cash:</span>
            <span className="font-mono font-bold text-sm text-emerald-950">₹{paymentSummary.cash.toFixed(2)}</span>
          </div>

          <div className="bg-blue-50 border border-blue-300 px-2.5 py-1 rounded-md text-blue-800 flex items-center space-x-1">
            <span>📱 UPI / Online:</span>
            <span className="font-mono font-bold text-sm text-blue-950">₹{paymentSummary.upi.toFixed(2)}</span>
          </div>

          <div className="bg-purple-50 border border-purple-300 px-2.5 py-1 rounded-md text-purple-800 flex items-center space-x-1">
            <span>💳 Card / Bank:</span>
            <span className="font-mono font-bold text-sm text-purple-950">₹{paymentSummary.card.toFixed(2)}</span>
          </div>

          <div className="bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-md text-rose-800 flex items-center space-x-1">
            <span>📜 Credit / Ledger:</span>
            <span className="font-mono font-bold text-sm text-rose-950">₹{paymentSummary.credit.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* HEADER RIBBON */}
      <div className="bg-white p-3 border border-gray-400 shadow-sm rounded mb-2 flex-shrink-0 flex justify-between items-center print:hidden">
        
        <div className="flex items-center space-x-6">
          <h5 className="text-xl font-bold text-[#2b579a] flex items-center">
            <span className="bg-[#2b579a] w-2 h-4 mr-2 block"></span>
            Daily Stock Status
          </h5>

          <div className="flex items-center space-x-4 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm">
            <div className="flex items-center space-x-2">
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
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-40">Product</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-32">Category</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-16 text-center">Unit</th>
                {hasInward && <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-right text-green-300">Inward</th>}
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-right text-amber-300">Sold</th>
                <th className="border-r border-[#142d54] p-2 text-xs font-semibold w-24 text-right text-red-300">Return</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpanCount} className="p-12 text-center text-gray-500 font-bold">
                    Loading daily stock status data...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={colSpanCount} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <PackageSearch size={32} className="mb-2 opacity-50" />
                      <p className="italic text-sm">No items found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const hasMovements = (item.inwardToday > 0 || item.outwardToday > 0 || item.returnsToday > 0);
                  
                  return (
                    <tr 
                      key={item.id || idx} 
                      className={`border-b border-gray-200 transition-colors ${
                        idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-[#fcfdfd] hover:bg-blue-50'
                      } ${hasMovements ? 'font-bold bg-yellow-50/30' : ''}`}
                    >
                      <td className="border-r border-gray-200 p-2 font-mono text-xs font-bold text-gray-600">{item.itemCode}</td>
                      <td className="border-r border-gray-200 p-2 text-gray-800">{item.name}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-gray-700">{item.category || '-'}</td>
                      <td className="border-r border-gray-200 p-2 text-xs text-center text-gray-500">{item.uom || 'PCS'}</td>
                      
                      {hasInward && (
                        <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-green-600 bg-green-50/20 font-bold">
                          {item.inwardToday > 0 ? `+${item.inwardToday}` : ''}
                        </td>
                      )}
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-amber-600 bg-amber-50/20 font-bold">
                        {item.outwardToday > 0 ? `${item.outwardToday}` : ''}
                      </td>
                      
                      <td className="border-r border-gray-200 p-2 text-right font-mono text-sm text-red-600 bg-red-50/20 font-bold">
                        {item.returnsToday > 0 ? `+${item.returnsToday}` : ''}
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
            {hasInward && <span>Total Inward: {totals.inward}</span>}
            <span>Total Sold: {totals.outward}</span>
            <span>Total Returned: {totals.returns}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DailyStockStatus;
