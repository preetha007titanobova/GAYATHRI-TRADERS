import type { BillData } from './downloadPdfBill';

export const sendWhatsAppBill = (data: BillData, overridePhone?: string, useNativeApp: boolean = true) => {
  const rawPhone = overridePhone || data.mobileNo || '';
  let phone = rawPhone.replace(/\D/g, ''); // strip non-digits

  if (!phone) {
    return {
      success: false,
      error: 'Please enter a valid mobile number for WhatsApp.'
    };
  }

  // Prepend 91 for 10-digit Indian numbers if missing country code
  if (phone.length === 10) {
    phone = `91${phone}`;
  }

  const validItems = data.items.filter(item => item.itemName && item.itemName.trim() !== '');

  const itemsFormatted = validItems.map((item, idx) => {
    const sizeStr = item.size ? ` (Size: ${item.size})` : '';
    return `${idx + 1}. *${item.itemName}*${sizeStr}\n   ${item.qty} ${item.uom || 'PCS'} x ₹${item.rate.toFixed(2)} = *₹${item.amount.toFixed(2)}*`;
  }).join('\n');

  const storeName = data.storeName || 'ITHU NAMMA KADA';

  const text = 
`🧾 *${storeName} - TAX INVOICE*
----------------------------------------
📄 *Invoice No:* ${data.invoiceNo}
📅 *Date:* ${data.invDate}
👤 *Customer:* ${data.buyerName || 'Valued Customer'}
📱 *Mobile:* ${data.mobileNo || rawPhone}
💳 *Payment Mode:* ${data.paymentMode || 'Cash'}
----------------------------------------
*ITEMS:*
${itemsFormatted}
----------------------------------------
📦 *Total Qty:* ${data.totalQty}
💵 *SubTotal:* ₹${data.totalAmount.toFixed(2)}` +
(data.favourDiscount ? `\n🏷️ *Discount:* -₹${data.favourDiscount.toFixed(2)}` : '') +
(data.cgst || data.sgst ? `\n🏛️ *GST Total:* ₹${((data.cgst || 0) + (data.sgst || 0)).toFixed(2)}` : '') +
`\n💰 *GRAND TOTAL:* *₹${data.netAmount.toFixed(2)}*
----------------------------------------
Thank you for shopping with us! 🙏 Have a great day!`;

  const encodedText = encodeURIComponent(text);
  const nativeAppUrl = `whatsapp://send?phone=${phone}&text=${encodedText}`;
  const webAppUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

  if (useNativeApp) {
    // Launch WhatsApp Desktop App / Mobile App instantly without opening browser web tab
    const a = document.createElement('a');
    a.href = nativeAppUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(webAppUrl, '_blank');
  }

  return {
    success: true,
    url: useNativeApp ? nativeAppUrl : webAppUrl,
    phone
  };
};
