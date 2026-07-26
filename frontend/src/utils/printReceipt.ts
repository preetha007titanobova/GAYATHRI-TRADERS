export interface PrintCartItem {
  itemCode?: string;
  itemDesc: string;
  qty: number;
  rate: number;
  totalAmt: number;
}

export interface PrintReceiptData {
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  paymentMode?: string;
  totalQty?: number;
  subTotal?: number;
  cgst?: number;
  sgst?: number;
  totalAmount: number;
}

export const printReceipt = (cartItems: PrintCartItem[], data: PrintReceiptData) => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const displayDate = data.date || timestamp;
  
  const totalQtyCalc = data.totalQty || cartItems.reduce((acc, it) => acc + (it.qty || 0), 0);
  
  // HTML structure
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>
          /* Base styles for the thermal receipt (approx 80mm width) */
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            margin: 0;
            padding: 0;
            color: #000;
            width: 300px; /* Force approx 80mm width */
          }
          .receipt-container {
            padding: 5px 10px;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .enterprise-name {
            font-size: 16px;
            font-weight: bold;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .contact-info {
            margin: 2px 0;
            font-size: 12px;
            font-weight: bold;
          }
          .divider {
            border-bottom: 1px dashed #000;
            margin: 5px 0;
          }
          .meta-data {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 5px;
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
          }
          .meta-data .left, .meta-data .right {
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 50%;
          }
          .meta-data .right {
            text-align: right;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
            table-layout: fixed;
          }
          th, td {
            text-align: left;
            padding: 3px 1px;
            font-size: 12px;
            font-weight: bold;
            word-wrap: break-word;
            vertical-align: top;
          }
          th {
            border-bottom: 1px dashed #000;
            border-top: 1px dashed #000;
            padding: 4px 1px;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .nowrap {
            white-space: nowrap;
          }
          .summary-section {
            border-top: 1px dashed #000;
            padding-top: 5px;
            margin-top: 5px;
            font-size: 13px;
            font-weight: bold;
          }
          .summary-line {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .summary-line.tax-line {
            font-size: 11px;
          }
          .footer-total {
            text-align: right;
            font-size: 16px;
            font-weight: 900;
            margin-top: 8px;
            padding-top: 5px;
            border-top: 2px dashed #000;
          }
          .thank-you-msg {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }

          /* Print specific styles */
          @media print {
            @page {
              margin: 0;
              size: 80mm auto; /* 80mm width thermal paper */
            }
            body {
              width: 100%;
              margin: 0;
              padding: 0;
            }
            ::-webkit-scrollbar {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <h1 class="enterprise-name">${(data as any).storeName || 'ITHU NAMMA KADA'}</h1>
            <p class="contact-info">Mobile: 8508703636, 8526677999</p>
            <p class="contact-info">TAX INVOICE</p>
          </div>
          
          <div class="meta-data">
            <div class="left">
              <span>Inv: ${data.invoiceNo || 'N/A'}</span>
              <span>Cust: ${data.customerName || 'CASH'}</span>
            </div>
            <div class="right">
              <span>Date: ${displayDate}</span>
              <span>Mode: ${data.paymentMode || 'Cash'}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 8%" class="text-center">#</th>
                <th style="width: 38%">Item</th>
                <th style="width: 12%" class="text-center">Qty</th>
                <th style="width: 19%" class="text-right">Rate</th>
                <th style="width: 23%" class="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${cartItems.map((item, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${item.itemDesc}</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right nowrap">${item.rate.toFixed(2)}</td>
                  <td class="text-right nowrap">${item.totalAmt.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-section">
            <div class="summary-line">
               <span>Items: ${cartItems.length}</span>
               <span>Total Qty: ${totalQtyCalc}</span>
            </div>
            ${data.subTotal !== undefined ? `
            <div class="summary-line tax-line">
               <span>SubTotal:</span>
               <span>₹${data.subTotal.toFixed(2)}</span>
            </div>` : ''}
            ${data.cgst !== undefined && data.cgst > 0 ? `
            <div class="summary-line tax-line">
               <span>CGST:</span>
               <span>₹${data.cgst.toFixed(2)}</span>
            </div>` : ''}
            ${data.sgst !== undefined && data.sgst > 0 ? `
            <div class="summary-line tax-line">
               <span>SGST:</span>
               <span>₹${data.sgst.toFixed(2)}</span>
            </div>` : ''}
            
            <div class="footer-total">
              Grand Total: ₹${Number(data.totalAmount).toFixed(2)}
            </div>
          </div>
          
          <div class="thank-you-msg">
            Thank you for purchasing!<br>Have a great day!
          </div>
        </div>
      </body>
    </html>
  `;

  // If running inside Electron environment, route printing through main process IPC channel
  if ((window as any).api && typeof (window as any).api.send === 'function') {
    (window as any).api.send('print-html', htmlContent);
    return;
  }

  // Remove any existing print iframe
  const existingIframe = document.getElementById('printReceiptIframe');
  if (existingIframe) {
    document.body.removeChild(existingIframe);
  }

  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'printReceiptIframe';
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '80mm';
  iframe.style.height = '100px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Could not access iframe document");
    return;
  }
  
  doc.open();
  doc.write(htmlContent);
  doc.close();
  
  if ((window as any).api) {
    (window as any).api.send('print-html', htmlContent);
  } else {
    // Wait for content to load before printing
    setTimeout(() => {
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error("Iframe print failed, trying popup window fallback:", err);
          const printWindow = window.open('', '_blank', 'width=350,height=600');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 250);
          } else {
            alert("Printing failed. Please enable popups or ensure your browser supports printing.");
          }
        }
      }
    }, 250);
  }
};
