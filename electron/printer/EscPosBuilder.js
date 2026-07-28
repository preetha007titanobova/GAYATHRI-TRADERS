class EscPosBuilder {
  constructor(options = {}) {
    this.paperWidth = options.paperWidth || '80mm';
    this.buffer = [];
    this.init();
  }

  init() {
    this.buffer.push(0x1B, 0x40); // ESC @
    return this;
  }

  alignCenter() {
    this.buffer.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1B, 0x61, 0x02);
    return this;
  }

  setBold(enable) {
    this.buffer.push(0x1B, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  setDoubleSize() {
    this.buffer.push(0x1D, 0x21, 0x11);
    return this;
  }

  setNormalSize() {
    this.buffer.push(0x1D, 0x21, 0x00);
    return this;
  }

  text(str) {
    const bytes = Buffer.from(str, 'utf8');
    for (const b of bytes) {
      this.buffer.push(b);
    }
    return this;
  }

  lineFeed(lines = 1) {
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  openCashDrawer() {
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  cutPaper(partial = false) {
    this.lineFeed(3);
    this.buffer.push(0x1D, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  getLineWidth() {
    return this.paperWidth === '58mm' ? 32 : 48;
  }

  drawDivider(char = '-') {
    const width = this.getLineWidth();
    this.alignLeft();
    this.text(char.repeat(width) + '\n');
    return this;
  }

  drawDoubleDivider() {
    return this.drawDivider('=');
  }

  printTwoColumns(left, right) {
    const width = this.getLineWidth();
    if (left.length + right.length >= width) {
      this.text(left + ' ' + right + '\n');
    } else {
      const spaces = width - left.length - right.length;
      this.text(left + ' '.repeat(spaces) + right + '\n');
    }
    return this;
  }

  printReceipt(payload) {
    const is58mm = this.paperWidth === '58mm';

    // Header
    this.alignCenter();
    this.setBold(true);
    if (payload.storeName) {
      this.text(payload.storeName + '\n');
    }
    this.setNormalSize();
    this.setBold(false);

    if (payload.storeMobile) {
      this.text(`Mobile: ${payload.storeMobile}\n`);
    }

    this.setBold(true);
    this.text((payload.receiptTitle || 'TAX INVOICE') + '\n');
    this.setBold(false);
    this.lineFeed(1);

    // Metadata
    this.alignLeft();
    const invStr = `Inv: ${payload.invoiceNo}`;
    const dateStr = `Date: ${payload.date || new Date().toISOString().split('T')[0]}`;
    this.printTwoColumns(invStr, dateStr);

    const custStr = `Cust: ${payload.customerName || 'Cash'}`;
    const modeStr = `Mode: ${payload.paymentMode || 'Cash'}`;
    this.printTwoColumns(custStr, modeStr);

    if (payload.customerMobile) {
      this.text(`Tel: ${payload.customerMobile}\n`);
    }

    this.drawDivider('-');

    if (is58mm) {
      this.text(`# Item          Qty   Rate    Amt\n`);
      this.drawDivider('-');

      (payload.items || []).forEach((item, idx) => {
        const num = (idx + 1).toString().padEnd(2);
        const qty = item.qty.toString().padStart(3);
        const rate = (Number(item.rate) || 0).toFixed(2).padStart(6);
        const amt = (Number(item.amount) || 0).toFixed(2).padStart(7);

        const nameMax = 12;
        let name = item.itemName || 'Item';
        if (name.length > nameMax) {
          const first = name.substring(0, nameMax).padEnd(nameMax);
          this.text(`${num}${first}${qty}${rate}${amt}\n`);
          let rest = name.substring(nameMax);
          while (rest.length > 0) {
            const part = rest.substring(0, nameMax);
            rest = rest.substring(nameMax);
            this.text(`  ${part}\n`);
          }
        } else {
          this.text(`${num}${name.padEnd(nameMax)}${qty}${rate}${amt}\n`);
        }
      });
    } else {
      this.text(`# Item                   Qty      Rate       Amt\n`);
      this.drawDivider('-');

      (payload.items || []).forEach((item, idx) => {
        const num = (idx + 1).toString().padEnd(2);
        const qty = item.qty.toString().padStart(5);
        const rate = (Number(item.rate) || 0).toFixed(2).padStart(9);
        const amt = (Number(item.amount) || 0).toFixed(2).padStart(10);

        const nameMax = 20;
        let name = item.itemName || 'Item';
        if (name.length > nameMax) {
          const first = name.substring(0, nameMax).padEnd(nameMax);
          this.text(`${num}${first}${qty}${rate}${amt}\n`);
          let rest = name.substring(nameMax);
          while (rest.length > 0) {
            const part = rest.substring(0, nameMax);
            rest = rest.substring(nameMax);
            this.text(`  ${part}\n`);
          }
        } else {
          this.text(`${num}${name.padEnd(nameMax)}${qty}${rate}${amt}\n`);
        }
      });
    }

    this.drawDivider('-');

    const totalQty = payload.totalQty || (payload.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    this.printTwoColumns(`Items: ${(payload.items || []).length}`, `Total Qty: ${totalQty}`);

    if (payload.subTotal !== undefined) {
      this.printTwoColumns('SubTotal:', `₹${payload.subTotal.toFixed(2)}`);
    }

    this.drawDoubleDivider();

    this.alignCenter();
    this.setBold(true);
    this.setDoubleSize();
    this.text(`Grand Total: ₹${(Number(payload.netAmount) || 0).toFixed(2)}\n`);
    this.setNormalSize();
    this.setBold(false);

    this.drawDivider('-');

    this.alignCenter();
    this.text((payload.footerNote || 'Thank you for purchasing!\nHave a great day!') + '\n');
    this.lineFeed(2);

    this.cutPaper(false);

    return Buffer.from(this.buffer);
  }
}

module.exports = EscPosBuilder;
