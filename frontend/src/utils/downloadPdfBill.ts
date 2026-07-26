import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BillItem {
  id?: number | string;
  itemName: string;
  itemDesc?: string; // Barcode or Item Code
  size?: string;
  qty: number;
  uom?: string;
  rate: number;
  discPercent?: number;
  discAmt?: number;
  amount: number;
}

export interface BillData {
  invoiceNo: string;
  invDate: string;
  buyerName: string;
  mobileNo?: string;
  address?: string;
  gstNo?: string;
  paymentMode: string;
  salesman?: string;
  items: BillItem[];
  totalQty: number;
  totalAmount: number;
  favourDiscount?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  cgst?: number;
  sgst?: number;
  roundOff?: number;
  netAmount: number;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
}

export const downloadPdfBill = (data: BillData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const storeName = data.storeName || 'ITHU NAMMA KADA';
  const storePhone = data.storePhone || `Mobile: ${localStorage.getItem('close_day_whatsapp') || '+91 8508703636, +91 8526677999'}`;
  const storeAddress = data.storeAddress || 'Main Road, Commercial Complex, Tamil Nadu';

  // --- Header ---
  doc.setFillColor(30, 58, 138); // Blue header banner
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(storeName, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(storeAddress, 14, 18);
  doc.text(storePhone, 14, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TAX INVOICE', 196, 16, { align: 'right' });

  // --- Invoice Metadata Box ---
  let startY = 34;

  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, startY, 182, 28, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);

  // Left Column - Customer Details
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 18, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(data.buyerName || 'CASH CUSTOMER', 18, startY + 12);
  if (data.mobileNo) doc.text(`Phone: ${data.mobileNo}`, 18, startY + 17);
  if (data.gstNo) doc.text(`GSTIN: ${data.gstNo}`, 18, startY + 22);

  // Right Column - Bill Details
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', 110, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${data.invoiceNo}`, 110, startY + 12);
  doc.text(`Date: ${data.invDate}`, 110, startY + 17);
  doc.text(`Payment Mode: ${data.paymentMode || 'Cash'}`, 110, startY + 22);

  startY += 32;

  // --- Items Table ---
  const validItems = data.items.filter(item => item.itemName && item.itemName.trim() !== '');

  const tableBody = validItems.map((item, index) => [
    (index + 1).toString(),
    item.itemDesc || '-',
    item.itemName,
    item.size || '-',
    `${item.qty} ${item.uom || 'PCS'}`,
    item.rate.toFixed(2),
    item.discPercent ? `${item.discPercent}%` : '0%',
    item.amount.toFixed(2)
  ]);

  autoTable(doc, {
    startY: startY,
    head: [['#', 'Barcode/Code', 'Item Description', 'Size', 'Qty', 'Rate (Rs.)', 'Disc', 'Amount (Rs.)']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 30 },
      2: { halign: 'left', cellWidth: 62 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 26 }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    margin: { left: 14, right: 14 }
  });

  // Get table final Y position
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // --- Totals Summary Box ---
  const summaryX = 114;
  const summaryWidth = 82;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(summaryX, finalY, summaryWidth, 42, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  let currentY = finalY + 6;
  doc.text('Total Qty:', summaryX + 4, currentY);
  doc.text(`${data.totalQty}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });

  currentY += 5;
  doc.text('SubTotal:', summaryX + 4, currentY);
  doc.text(`Rs. ${data.totalAmount.toFixed(2)}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });

  if (data.favourDiscount && data.favourDiscount > 0) {
    currentY += 5;
    doc.text('Discount:', summaryX + 4, currentY);
    doc.text(`-Rs. ${data.favourDiscount.toFixed(2)}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });
  }

  if (data.cgst && data.cgst > 0) {
    currentY += 5;
    doc.text(`CGST (${data.cgstPercent || 0}%):`, summaryX + 4, currentY);
    doc.text(`+Rs. ${data.cgst.toFixed(2)}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });
  }

  if (data.sgst && data.sgst > 0) {
    currentY += 5;
    doc.text(`SGST (${data.sgstPercent || 0}%):`, summaryX + 4, currentY);
    doc.text(`+Rs. ${data.sgst.toFixed(2)}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });
  }

  if (data.roundOff) {
    currentY += 5;
    doc.text('Round Off:', summaryX + 4, currentY);
    doc.text(`${data.roundOff >= 0 ? '+' : ''}Rs. ${data.roundOff.toFixed(2)}`, summaryX + summaryWidth - 4, currentY, { align: 'right' });
  }

  // Grand Total Line
  currentY += 7;
  doc.setFillColor(30, 58, 138);
  doc.rect(summaryX, currentY - 4, summaryWidth, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL:', summaryX + 4, currentY + 2);
  doc.text(`Rs. ${data.netAmount.toFixed(2)}`, summaryX + summaryWidth - 4, currentY + 2, { align: 'right' });

  // --- Terms & Footer ---
  const footerY = Math.max(finalY + 50, 270);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, 196, footerY);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for purchasing with us! Goods once sold cannot be returned.', 14, footerY + 5);
  doc.text('Authorized Signatory', 196, footerY + 5, { align: 'right' });

  // Save PDF file
  const fileName = `Sales_Bill_${data.invoiceNo || 'INV'}.pdf`;
  doc.save(fileName);
  return fileName;
};
