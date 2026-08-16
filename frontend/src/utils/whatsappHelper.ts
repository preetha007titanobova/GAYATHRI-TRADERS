import type { BillData } from './downloadPdfBill';

export const checkWhatsAppLicenseAllowed = (): { allowed: boolean; message: string } => {
  const isValid = localStorage.getItem('license_valid');
  const daysStr = localStorage.getItem('license_days_remaining');

  if (isValid === 'false') {
    return {
      allowed: false,
      message: '⚠️ License Key Inactive or Expired! WhatsApp feature is blocked across all modules. Please renew your software license to resume WhatsApp sharing.'
    };
  }

  if (daysStr !== null) {
    const days = parseInt(daysStr, 10);
    if (!isNaN(days) && days <= 0) {
      return {
        allowed: false,
        message: '⚠️ Subscription License Expired! WhatsApp sharing is disabled in all modules. Please renew your plan to unlock WhatsApp messaging.'
      };
    }
  }

  return { allowed: true, message: '' };
};

export const sendWhatsAppBill = (data: BillData, overridePhone?: string, useNativeApp: boolean = true) => {
  const licenseStatus = checkWhatsAppLicenseAllowed();
  if (!licenseStatus.allowed) {
    alert(licenseStatus.message);
    return {
      success: false,
      error: licenseStatus.message
    };
  }

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

  const storeName = data.storeName || localStorage.getItem('registered_shop_name') || localStorage.getItem('shop_name') || '';

  const headerLine = storeName ? `🧾 *${storeName} - TAX INVOICE*` : `🧾 *TAX INVOICE*`;

  const text =
    `${headerLine}
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

export const sendWhatsAppTextMessage = (rawPhone: string, text: string) => {
  const licenseStatus = checkWhatsAppLicenseAllowed();
  if (!licenseStatus.allowed) {
    alert(licenseStatus.message);
    return {
      success: false,
      error: licenseStatus.message
    };
  }

  let phone = (rawPhone || '').replace(/\D/g, '');
  if (phone.length === 10) {
    phone = `91${phone}`;
  }

  const encodedText = encodeURIComponent(text);
  const nativeAppUrl = phone ? `whatsapp://send?phone=${phone}&text=${encodedText}` : `whatsapp://send?text=${encodedText}`;
  const webAppUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`;

  // Launch WhatsApp protocol link
  try {
    const a = document.createElement('a');
    a.href = nativeAppUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.error('Native WhatsApp launch error:', e);
  }

  // Also trigger window.open fallback for browser/Electron compatibility
  setTimeout(() => {
    window.open(webAppUrl, '_blank');
  }, 400);

  return {
    success: true,
    url: webAppUrl,
    phone
  };
};
