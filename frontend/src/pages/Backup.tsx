import React, { useRef, useState } from 'react';
import { Database, Download, Upload, AlertTriangle, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Api from '../Api';

const Backup = () => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    window.location.href = `${Api}/backup/export`;
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${Api}/backup/export`);
      const data = await res.json();
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text('ERP Database Backup Report', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      // Products Table
      let currentY = 40;
      if (data.products && data.products.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text('Inventory & Products Master', 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Barcode', 'Product Name', 'Price', 'Stock']],
          body: data.products.map((p: any) => [p.barcode || 'N/A', p.name, p.price.toFixed(2), p.stock]),
          theme: 'grid',
          headStyles: { fillColor: [43, 87, 154] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Ledgers Table
      if (data.ledgers && data.ledgers.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text('Ledger Master Accounts', 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Ledger Code', 'Account Name', 'Group', 'Balance']],
          body: data.ledgers.map((l: any) => [l.ledgerCode, l.accountName, l.accountGroup, `${l.openingBalance.toFixed(2)} ${l.drCr}`]),
          theme: 'grid',
          headStyles: { fillColor: [43, 87, 154] }
        });
      }

      doc.save(`ERP_Backup_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF backup.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("WARNING: Restoring from a JSON backup will PERMANENTLY ERASE all current data in the cloud database. Are you absolutely sure you want to proceed?")) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch(`${Api}/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Database successfully restored from JSON backup!");
      } else {
        alert("Error restoring backup: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Invalid backup file format or network error.");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2 p-2">
      <div className="bg-[#2b579a] text-white px-2 py-1 flex items-center text-sm font-semibold mb-4 shadow-sm">
        <Database size={16} className="mr-2" /> Backup & Restore Management
      </div>

      <div className="grid grid-cols-3 gap-6 p-4">
        {/* EXPORT JSON PANEL */}
        <div className="border border-gray-400 bg-white p-6 shadow-md flex flex-col items-center text-center">
          <Download size={48} className="text-blue-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">System Backup (JSON)</h2>
          <p className="text-gray-600 text-sm mb-6">
            Download a raw JSON snapshot for system restoration. Required for database recovery.
          </p>
          <button 
            onClick={handleExportJSON}
            className="legacy-button bg-blue-100 border-blue-400 font-bold px-4 py-2 w-full mt-auto"
          >
            Download JSON Backup
          </button>
        </div>

        {/* EXPORT PDF PANEL */}
        <div className="border border-gray-400 bg-white p-6 shadow-md flex flex-col items-center text-center">
          <FileText size={48} className="text-green-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Printable Backup (PDF)</h2>
          <p className="text-gray-600 text-sm mb-6">
            Generate a human-readable, multi-page PDF document containing all inventory and ledger accounts.
          </p>
          <button 
            onClick={handleExportPDF}
            disabled={loading}
            className="legacy-button bg-green-100 border-green-500 text-green-900 font-bold px-4 py-2 w-full mt-auto"
          >
            {loading ? "Generating..." : "Download PDF Report"}
          </button>
        </div>

        {/* IMPORT PANEL */}
        <div className="border border-gray-400 bg-white p-6 shadow-md flex flex-col items-center text-center">
          <Upload size={48} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Restore Database</h2>
          <p className="text-gray-600 text-sm mb-2">
            Upload a JSON snapshot to restore the cloud database.
          </p>
          <div className="flex items-center text-red-600 text-xs mb-4 font-semibold">
            <AlertTriangle size={14} className="mr-1" /> Overwrites existing data!
          </div>
          
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden" 
          />
          
          <button 
            onClick={handleImportClick}
            disabled={loading}
            className="legacy-button bg-red-100 border-red-400 font-bold px-4 py-2 w-full mt-auto"
          >
            {loading ? "Restoring..." : "Upload JSON Backup"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Backup;