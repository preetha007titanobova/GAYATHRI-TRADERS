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
  customerMobile?: string;
  storeName?: string;
  storePhone?: string;
  receiptTitle?: string;
}

export const printReceipt = (cartItems: PrintCartItem[], data: PrintReceiptData) => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const displayDate = data.date || timestamp;

  const storeName = data.storeName || 'ITHU NAMMA KADA';
  let storePhone = data.storePhone || localStorage.getItem('close_day_whatsapp') || '+919698819482';

  // Format phone number to prepend +91 if user just gave 10 digits
  if (storePhone.length === 10 && !isNaN(Number(storePhone))) {
    storePhone = '+91' + storePhone;
  }

  const receiptTitle = data.receiptTitle || 'TAX INVOICE';

  const totalQtyCalc = data.totalQty || cartItems.reduce((acc, it) => acc + (it.qty || 0), 0);

  // HTML structure
  const LINE_WIDTH = 42;
  const padCenter = (str: string, length: number) => {
    if (str.length >= length) return str.substring(0, length);
    const leftPad = Math.floor((length - str.length) / 2);
    const rightPad = length - str.length - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  };
  const padRight = (str: string, length: number) => {
    if (str.length >= length) return str.substring(0, length);
    return str + ' '.repeat(length - str.length);
  };
  const padLeft = (str: string, length: number) => {
    if (str.length >= length) return str.substring(0, length);
    return ' '.repeat(length - str.length) + str;
  };

  const separator = '-'.repeat(LINE_WIDTH);

  let text = '';
  text += padCenter(storeName, LINE_WIDTH) + '\n';
  text += padCenter(`Mobile: ${storePhone}`, LINE_WIDTH) + '\n';
  text += padCenter(receiptTitle, LINE_WIDTH) + '\n\n';

  const invStr = `Inv: ${data.invoiceNo || 'N/A'}`;
  let shortDate = displayDate.split(' ')[0];
  if (shortDate.length > 10 && displayDate.includes('T')) shortDate = displayDate.split('T')[0];
  const dateStr = `Date: ${shortDate}`;
  text += invStr + ' '.repeat(Math.max(0, LINE_WIDTH - invStr.length - dateStr.length)) + dateStr + '\n';

  const custStr = `Cust: ${data.customerName || 'CASH'}`;
  const modeStr = `Mode: ${data.paymentMode || 'Cash'}`;
  text += custStr + ' '.repeat(Math.max(0, LINE_WIDTH - custStr.length - modeStr.length)) + modeStr + '\n';

  if (data.customerMobile) {
    const telStr = `Tel: ${data.customerMobile}`;
    text += telStr + '\n';
  }

  text += separator + '\n';
  text += padRight('#', 2) + padRight('Item', 16) + ' ' + padLeft('Qty', 4) + padLeft('Rate', 9) + padLeft('Amt', 10) + '\n';
  text += separator + '\n';

  cartItems.forEach((item, index) => {
    const idxStr = String(index + 1);
    let nameStr = item.itemDesc || item.itemCode || '';
    const qtyStr = String(item.qty);
    const rateStr = item.rate.toFixed(2);
    const amtStr = item.totalAmt.toFixed(2);

    if (nameStr.length <= 16) {
      text += padRight(idxStr, 2) + padRight(nameStr, 16) + ' ' + padLeft(qtyStr, 4) + padLeft(rateStr, 9) + padLeft(amtStr, 10) + '\n';
    } else {
      text += padRight(idxStr, 2) + padRight(nameStr.substring(0, 16), 16) + ' ' + padLeft(qtyStr, 4) + padLeft(rateStr, 9) + padLeft(amtStr, 10) + '\n';
      let remaining = nameStr.substring(16);
      while (remaining.length > 0) {
        text += padRight('', 2) + padRight(remaining.substring(0, 16), 16) + '\n';
        remaining = remaining.substring(16);
      }
    }
  });

  text += separator + '\n';
  const itemsStr = `Items: ${cartItems.length}`;
  const totalQtyStr = `Total Qty: ${totalQtyCalc}`;
  text += itemsStr + ' '.repeat(Math.max(0, LINE_WIDTH - itemsStr.length - totalQtyStr.length)) + totalQtyStr + '\n';

  if (data.subTotal !== undefined) {
    const subStr = `SubTotal:`;
    const subAmt = `₹${data.subTotal.toFixed(2)}`;
    text += subStr + ' '.repeat(Math.max(0, LINE_WIDTH - subStr.length - subAmt.length)) + subAmt + '\n';
  }

  if (data.cgst !== undefined && data.cgst > 0) {
    const cgstStr = `CGST:`;
    const cgstAmt = `₹${data.cgst.toFixed(2)}`;
    text += cgstStr + ' '.repeat(Math.max(0, LINE_WIDTH - cgstStr.length - cgstAmt.length)) + cgstAmt + '\n';
  }

  if (data.sgst !== undefined && data.sgst > 0) {
    const sgstStr = `SGST:`;
    const sgstAmt = `₹${data.sgst.toFixed(2)}`;
    text += sgstStr + ' '.repeat(Math.max(0, LINE_WIDTH - sgstStr.length - sgstAmt.length)) + sgstAmt + '\n';
  }

  text += separator + '\n';
  const grandStr = `Grand Total: ₹${Number(data.totalAmount).toFixed(2)}`;
  text += padCenter(grandStr, LINE_WIDTH) + '\n';
  text += separator + '\n';
  
  text += padCenter('Thank you for purchasing!', LINE_WIDTH) + '\n';
  text += padCenter('Have a great day!', LINE_WIDTH) + '\n';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            font-weight: bold;
            margin: 0;
            padding: 10px;
            color: #000;
            background: #fff;
          }
          pre {
            margin: 0;
            font-family: inherit;
            font-size: inherit;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <pre>\${text}</pre>
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
