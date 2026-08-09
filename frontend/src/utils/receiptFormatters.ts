export const formatCurrency = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};

export const padRight = (str: string, length: number): string => {
  if (str.length >= length) return str.substring(0, length);
  return str + ' '.repeat(length - str.length);
};

export const padLeft = (str: string, length: number): string => {
  if (str.length >= length) return str;
  return ' '.repeat(length - str.length) + str;
};

export const centerText = (str: string, length: number): string => {
  if (str.length >= length) return str.substring(0, length);
  const leftPad = Math.floor((length - str.length) / 2);
  const rightPad = length - str.length - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
};

export const formatTwoColumns = (left: string, right: string, width: number = 32): string => {
  if (left.length + right.length >= width) {
    return left + ' ' + right;
  }
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(spaces) + right;
};

export interface FormattedItemRow {
  indexStr: string;
  nameStr: string;
  qtyStr: string;
  rateStr: string;
  amtStr: string;
  extraLines: string[];
}

export const formatTableRow = (
  index: number,
  itemName: string,
  qty: number,
  rate: number,
  amount: number,
  paperWidth: '58mm' | '80mm' = '80mm'
): FormattedItemRow => {
  const is58 = paperWidth === '58mm';
  const nameMax = is58 ? 12 : 22;

  const indexStr = `${index} `;
  const qtyStr = qty.toString().padStart(is58 ? 3 : 5);
  const rateStr = rate.toFixed(2).padStart(is58 ? 6 : 9);
  const amtStr = amount.toFixed(2).padStart(is58 ? 7 : 10);

  let extraLines: string[] = [];
  let nameStr = itemName;

  if (itemName.length > nameMax) {
    nameStr = itemName.substring(0, nameMax);
    let remaining = itemName.substring(nameMax);
    while (remaining.length > 0) {
      extraLines.push(remaining.substring(0, nameMax));
      remaining = remaining.substring(nameMax);
    }
  }

  return {
    indexStr,
    nameStr,
    qtyStr,
    rateStr,
    amtStr,
    extraLines
  };
};
