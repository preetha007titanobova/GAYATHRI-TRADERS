import React from 'react';
import type { ReceiptPayload, PaperWidth } from '../../types/receipt';
import './ThermalReceipt.css';

interface ThermalReceiptProps {
  payload: ReceiptPayload;
  paperWidth?: PaperWidth;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  payload,
  paperWidth = '80mm'
}) => {
  const storeName = payload.storeName || 'ITHU NAMMA KADA';
  const storeMobile = payload.storeMobile || '8270691757';
  const receiptTitle = payload.receiptTitle || 'TAX INVOICE';
  const invoiceNo = payload.invoiceNo || 'INV-2026-0026';
  const date = payload.date || new Date().toISOString().split('T')[0];
  const customerName = payload.customerName || 'karunya';
  const paymentMode = payload.paymentMode || 'Cash';

  const items = payload.items || [];
  const totalItemsCount = items.length;
  const totalQtyCalc = payload.totalQty || items.reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0);
  const subTotalCalc = payload.subTotal !== undefined 
    ? payload.subTotal 
    : items.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);
  const grandTotalCalc = payload.netAmount !== undefined ? payload.netAmount : subTotalCalc;

  return (
    <div className={`thermal-receipt-container width-${paperWidth}`}>
      
      {/* 1. Store Header Section */}
      <div className="thermal-header">
        <div className="thermal-title">{storeName}</div>
        <div className="thermal-subtitle">Mobile: {storeMobile}</div>
        <div className="thermal-tax-invoice">{receiptTitle}</div>
      </div>

      {/* 2. Transaction Metadata Section */}
      <div className="thermal-meta-grid">
        <div className="thermal-meta-col">
          <span>Inv: {invoiceNo}</span>
          <span>Cust: {customerName}</span>
          {payload.customerMobile && <span>Tel: {payload.customerMobile}</span>}
        </div>
        <div className="thermal-meta-col" style={{ textAlign: 'right' }}>
          <span>Date: {date}</span>
          <span>Mode: {paymentMode}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="dashed-divider" />

      {/* 3. Itemized Table Section */}
      <table className="thermal-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: paperWidth === '58mm' ? '45%' : '52%' }}># Item</th>
            <th style={{ textAlign: 'right', width: '15%' }}>Qty</th>
            <th style={{ textAlign: 'right', width: '18%' }}>Rate</th>
            <th style={{ textAlign: 'right', width: '20%' }}>Amt</th>
          </tr>
        </thead>
      </table>

      {/* Divider under table header */}
      <div className="dashed-divider" />

      <table className="thermal-table">
        <tbody>
          {items.map((item: any, index: number) => {
            const idx = item.index || index + 1;
            const rate = Number(item.rate) || 0;
            const amt = Number(item.amount) || 0;

            return (
              <tr key={index}>
                <td style={{ textAlign: 'left', width: paperWidth === '58mm' ? '45%' : '52%' }}>
                  {idx} {item.itemName}
                </td>
                <td style={{ textAlign: 'right', width: '15%' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', width: '18%' }}>{rate.toFixed(2)}</td>
                <td style={{ textAlign: 'right', width: '20%' }}>{amt.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Divider under items */}
      <div className="dashed-divider" />

      {/* 4. Totals & Summary Section */}
      <div className="thermal-summary-row">
        <span>Items: {totalItemsCount}</span>
        <span>Total Qty: {totalQtyCalc}</span>
      </div>

      <div className="thermal-summary-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
        <span>SubTotal:</span>
        <span>₹{subTotalCalc.toFixed(2)}</span>
      </div>

      {payload.cgstAmount !== undefined && payload.cgstAmount > 0 && (
        <div className="thermal-summary-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          <span>CGST:</span>
          <span>₹{payload.cgstAmount.toFixed(2)}</span>
        </div>
      )}

      {payload.sgstAmount !== undefined && payload.sgstAmount > 0 && (
        <div className="thermal-summary-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          <span>SGST:</span>
          <span>₹{payload.sgstAmount.toFixed(2)}</span>
        </div>
      )}

      {/* Divider before Grand Total */}
      <div className="dashed-divider" />

      {/* Prominent Grand Total Banner */}
      <div className="thermal-grand-total">
        Grand Total: ₹{grandTotalCalc.toFixed(2)}
      </div>

      {/* Divider after Grand Total */}
      <div className="dashed-divider" />

      {/* 5. Footer Section */}
      <div className="thermal-footer">
        <div>Thank you for purchasing!</div>
        <div>Have a great day!</div>
      </div>

    </div>
  );
};
