export interface ProductPackagingLevel {
  id?: string;
  packagingName?: string;
  conversionFactor?: number;
  unit?: string;
  sellingPrice?: number;
}

/**
 * Formats a stock quantity or billed quantity with Box/Bottle packaging unit breakdown.
 * Example outputs:
 *  - 1 Box with 24 bottles inside: "1 Box (24 bottle)"
 *  - 2 Boxes with 24 bottles inside: "2 Box (48 bottle)"
 *  - 24 Bottles (when 1 Box = 24 bottles): "24 bottle (1 Box)"
 *  - 30 Bottles (when 1 Box = 24 bottles): "30 bottle (1 Box + 6 bottle)"
 */
export const formatPackagingQty = (
  qty: number,
  uom?: string,
  baseUnit?: string,
  packagings?: ProductPackagingLevel[],
  conversionFactor?: number
): string => {
  if (!qty && qty !== 0) return '0';
  const currentUom = (uom || baseUnit || 'PCS').trim();

  // Find valid packaging conversion
  let factor = Number(conversionFactor) || 0;
  let pkgName = 'Box';
  let innerUnit = (baseUnit || 'bottle').trim();

  if (packagings && Array.isArray(packagings) && packagings.length > 0) {
    const pkg = packagings[0];
    if (pkg) {
      if (pkg.conversionFactor && Number(pkg.conversionFactor) > 1) {
        factor = Number(pkg.conversionFactor);
      }
      if (pkg.packagingName) pkgName = pkg.packagingName.trim();
      if (pkg.unit) innerUnit = pkg.unit.trim();
    }
  }

  if (factor > 1) {
    const lowerUom = currentUom.toLowerCase();
    const lowerPkgName = pkgName.toLowerCase();

    // Case A: The item is measured in Boxes/Packs (e.g. qty = 1, uom = "Box")
    if (lowerUom === lowerPkgName || lowerUom === 'box' || lowerUom === 'pack' || lowerUom === 'carton') {
      const totalInner = Math.round(qty * factor);
      return `${qty} ${currentUom} (${totalInner} ${innerUnit})`;
    }

    // Case B: The item is measured in Bottles/Pcs/baseUnits (e.g. qty = 24, uom = "bottle")
    if (qty >= factor) {
      const boxes = Math.floor(qty / factor);
      const rem = qty % factor;
      const boxBreakdown = `${boxes} ${pkgName}${rem > 0 ? ` + ${rem} ${innerUnit}` : ''}`;
      return `${qty} ${currentUom} (${boxBreakdown})`;
    } else {
      return `${qty} ${currentUom}`;
    }
  }

  return `${qty} ${currentUom}`;
};

/**
 * Returns Cash & UPI payment breakdown details.
 */
export const getPaymentBreakdown = (bill: any) => {
  const mode = bill?.paymentMode || 'Cash';
  const net = Number(bill?.netAmount !== undefined ? bill.netAmount : (bill?.totalAmount || bill?.grandTotal || 0));

  let cashAmt = Number(bill?.cashAmount) || 0;
  let upiAmt = Number(bill?.upiAmount) || 0;

  const isSplit = mode.toLowerCase().includes('split') || (cashAmt > 0 && upiAmt > 0);

  if (!isSplit) {
    if (mode.toLowerCase().includes('cash')) {
      cashAmt = net;
      upiAmt = 0;
    } else if (mode.toLowerCase().includes('upi') || mode.toLowerCase().includes('online')) {
      upiAmt = net;
      cashAmt = 0;
    }
  }

  return {
    isSplit,
    paymentMode: mode,
    cashAmount: cashAmt,
    upiAmount: upiAmt,
    displayString: isSplit
      ? `Cash: ₹${cashAmt.toFixed(2)} | UPI: ₹${upiAmt.toFixed(2)}`
      : mode.toLowerCase().includes('cash')
        ? `Cash: ₹${net.toFixed(2)}`
        : mode.toLowerCase().includes('upi') || mode.toLowerCase().includes('online')
          ? `UPI: ₹${net.toFixed(2)}`
          : mode
  };
};
