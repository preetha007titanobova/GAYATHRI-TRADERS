import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Printer, Save, RotateCcw, Download, Trash2, Plus, Search, Package, Check, Tag, FileDown } from 'lucide-react';
import Api from '../Api';
import { useLicense } from '../context/LicenseContext';
import { getPrinterStatus, setActivePrinter, printTSPLRaw } from '../services/printService';

interface Product {
  id?: string;
  _id?: string;
  itemCode: string;
  name: string;
  barcode?: string;
  department?: string;
  variety?: string;
  weight?: string;
  mrp?: number;
  price?: number;
  uom?: string;
}

interface SavedBarcodeItem {
  id: string;
  productName: string;
  barcodeValue: string;
  department: string;
  variety: string;
  weight: string;
  batchNo: string;
  mrp: number | '';
  salesPrice: number | '';
  mfgDate: string;
  expDate: string;
  barcodeType: string;
  printCount: number | '';
  createdAt: string;
}

const CODE39_MAP: { [key: string]: string } = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

const CODE128_PATTERNS = [
  "212221","222121","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133113","133311","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211214","211412","2331112"
];

function generateCode128Bars(text: string): { width: number; type: 'bar' | 'space' }[] {
  const clean = text || '100002';
  const patterns: string[] = [];
  
  // Start Code B (103)
  patterns.push(CODE128_PATTERNS[103] || "211214");
  let checksum = 103;

  for (let i = 0; i < clean.length; i++) {
    let charCode = clean.charCodeAt(i);
    let codeVal = charCode - 32;
    if (codeVal < 0 || codeVal > 95) codeVal = 0; // Fallback to space
    patterns.push(CODE128_PATTERNS[codeVal] || "212221");
    checksum += codeVal * (i + 1);
  }

  // Checksum & Stop symbol (105)
  patterns.push(CODE128_PATTERNS[checksum % 103] || "212221");
  patterns.push(CODE128_PATTERNS[105] || "2331112");

  const result: { width: number; type: 'bar' | 'space' }[] = [];
  result.push({ width: 8, type: 'space' });

  patterns.forEach(patStr => {
    if (!patStr) return;
    for (let j = 0; j < patStr.length; j++) {
      const width = parseInt(patStr[j], 10) || 1;
      const isBar = j % 2 === 0;
      result.push({ width, type: isBar ? 'bar' : 'space' });
    }
  });

  result.push({ width: 8, type: 'space' });
  return result;
}

function generateCode39Bars(text: string): { width: number; type: 'bar' | 'space' }[] {
  const cleanText = text.toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, '');
  const formatted = `*${cleanText}*`;
  const result: { width: number; type: 'bar' | 'space' }[] = [];

  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    const pattern = CODE39_MAP[char];
    if (!pattern) continue;

    for (let j = 0; j < 9; j++) {
      const isWide = pattern[j] === '1';
      const isBar = j % 2 === 0;
      result.push({
        width: isWide ? 2.5 : 1,
        type: isBar ? 'bar' : 'space'
      });
    }
    if (i < formatted.length - 1) {
      result.push({
        width: 1,
        type: 'space'
      });
    }
  }
  return result;
}

function generateBarcodeBars(text: string, type: string = 'Code 128'): { width: number; type: 'bar' | 'space' }[] {
  if (type === 'Code 39') {
    return generateCode39Bars(text);
  }
  return generateCode128Bars(text);
}

function getBarcodeSVGString(text: string, type: string = 'Code 128'): string {
  const bars = generateBarcodeBars(text, type);
  let totalWidth = 0;
  bars.forEach(b => totalWidth += b.width);

  let currentX = 0;
  let rects = '';
  bars.forEach(b => {
    if (b.type === 'bar') {
      rects += `<rect x="${currentX}" y="0" width="${b.width}" height="100%" fill="#000000" />`;
    }
    currentX += b.width;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 100" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">${rects}</svg>`;
}

const BarcodeGeneration = () => {
  const navigate = useNavigate();
  const { shopName } = useLicense();
  const effectiveShopName = shopName || 'GAYATHRI TRADERS';
  // --- Form States ---
  const [productName, setProductName] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [department, setDepartment] = useState('');
  const [variety, setVariety] = useState('');
  const [weight, setWeight] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [salesPrice, setSalesPrice] = useState<number | ''>('');
  const [barcodeType, setBarcodeType] = useState('Code 128');
  const [printCount, setPrintCount] = useState<number | ''>(1);
  const [labelLayout, setLabelLayout] = useState<'3-UP' | '3-UP-TALL' | '3-UP-WIDE' | '1-UP' | 'A4'>('3-UP');
  const [useSystemPrintDialog, setUseSystemPrintDialog] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<'row' | 'single'>('row');

  // --- Custom Millimeter Dimension & Layout Controls ---
  const [labelWidthMm, setLabelWidthMm] = useState<number>(30);
  const [totalRollWidthMm, setTotalRollWidthMm] = useState<number>(100);
  const [columnGapMm, setColumnGapMm] = useState<number>(2);
  const [rowGapMm, setRowGapMm] = useState<number>(2);
  const [marginTopMm, setMarginTopMm] = useState<number>(1);
  const [barcodeOffsetMm, setBarcodeOffsetMm] = useState<number>(2);
  const [labelHeightMm, setLabelHeightMm] = useState<number>(25);
  const [colsAcross, setColsAcross] = useState<number>(3);
  const [barcodeHeightMm, setBarcodeHeightMm] = useState<number>(6);
  const [labelRotation, setLabelRotation] = useState<0 | 90 | 180 | 270>(0);
  const [startColumn, setStartColumn] = useState<number>(1);
  const [marginLeftMm, setMarginLeftMm] = useState<number>(1.5);
  const [forcePortrait, setForcePortrait] = useState<boolean>(false);
  const [showShopHeader, setShowShopHeader] = useState<boolean>(true);
  const [showMetaLine, setShowMetaLine] = useState<boolean>(true);
  const [showDatesLine, setShowDatesLine] = useState<boolean>(false);
  const [showPriceLine, setShowPriceLine] = useState<boolean>(true);

  const handleLayoutPresetChange = (preset: '3-UP' | '3-UP-TALL' | '3-UP-WIDE' | '1-UP' | 'A4') => {
    setLabelLayout(preset);
    if (preset === '3-UP') {
      setLabelWidthMm(30);
      setTotalRollWidthMm(100);
      setColumnGapMm(2);
      setRowGapMm(2);
      setMarginTopMm(1);
      setLabelHeightMm(25);
      setBarcodeHeightMm(6);
      setColsAcross(3);
      setMarginLeftMm(1.5);
      setLabelRotation(0);
      setForcePortrait(false);
      if (!printCount || printCount === 1) setPrintCount(3);
    } else if (preset === '3-UP-TALL') {
      setLabelWidthMm(32);
      setTotalRollWidthMm(102);
      setColumnGapMm(2);
      setRowGapMm(2);
      setMarginTopMm(1);
      setLabelHeightMm(50);
      setBarcodeHeightMm(10);
      setColsAcross(3);
      setMarginLeftMm(1.5);
      setLabelRotation(0);
      setForcePortrait(false);
      if (!printCount || printCount === 1) setPrintCount(3);
    } else if (preset === '3-UP-WIDE') {
      setLabelWidthMm(38);
      setTotalRollWidthMm(120);
      setColumnGapMm(2);
      setRowGapMm(2);
      setMarginTopMm(1);
      setLabelHeightMm(25);
      setBarcodeHeightMm(6);
      setColsAcross(3);
      setMarginLeftMm(1.5);
      setLabelRotation(0);
      setForcePortrait(false);
      if (!printCount || printCount === 1) setPrintCount(3);
    } else if (preset === '1-UP') {
      setLabelWidthMm(35);
      setTotalRollWidthMm(35);
      setColumnGapMm(0);
      setRowGapMm(2);
      setMarginTopMm(1);
      setLabelHeightMm(25);
      setBarcodeHeightMm(6);
      setColsAcross(1);
      setMarginLeftMm(0);
      setLabelRotation(0);
      setForcePortrait(false);
    } else if (preset === 'A4') {
      setLabelWidthMm(65);
      setTotalRollWidthMm(210);
      setColumnGapMm(5);
      setRowGapMm(5);
      setMarginTopMm(3);
      setLabelHeightMm(35);
      setBarcodeHeightMm(8);
      setColsAcross(3);
      setMarginLeftMm(5);
      setLabelRotation(0);
      setForcePortrait(true);
    }
  };

  // --- Item Master Integration States ---
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- Saved Barcodes Table State ---
  const [savedBarcodes, setSavedBarcodes] = useState<SavedBarcodeItem[]>(() => {
    try {
      const stored = localStorage.getItem('saved_barcodes_list');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: '8901234567890-seed',
        productName: 'GENERAL SAMPLE PRODUCT',
        barcodeValue: '8901234567890',
        department: '',
        variety: 'Standard',
        weight: '1kg',
        batchNo: 'BATCH-1001',
        mrp: 150,
        salesPrice: 150,
        mfgDate: '2025-05-10',
        expDate: '',
        barcodeType: 'Code 128',
        printCount: 3,
        createdAt: new Date().toLocaleString()
      }
    ];
  });

  const [tableSearch, setTableSearch] = useState('');

  // System Printers Detection & Driver Calibration
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>(() => {
    return localStorage.getItem('active_printer') || localStorage.getItem('selected_printer') || 'TSC TE244 Barcode Printer';
  });
  const [connectedPrinters, setConnectedPrinters] = useState<{ name: string; isDefault: boolean }[]>(() => {
    const saved = localStorage.getItem('active_printer') || localStorage.getItem('selected_printer') || 'TSC TE244 Barcode Printer';
    return [{ name: saved, isDefault: true }];
  });
  const [driverRotationFix, setDriverRotationFix] = useState<number>(0);

  // Global Context
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  // Fetch Item Master saved list on mount & Detect System Printers
  useEffect(() => {
    fetch(`${Api}/products/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Error fetching item master:", err));

    getPrinterStatus((status) => {
      if (status) {
        const saved = localStorage.getItem('active_printer') || localStorage.getItem('selected_printer') || '';
        const list = (status.allPrinters && status.allPrinters.length > 0) 
          ? status.allPrinters 
          : [{ name: saved || 'TSC TE244 Barcode Printer', isDefault: true }];
        
        setConnectedPrinters(list);

        const savedMatch = list.find(p => p.name === saved);
        const tscPrinter = list.find(p => {
          const n = p.name.toUpperCase();
          return n.includes('TSC') || n.includes('TE244') || n.includes('BARCODE') || n.includes('LABEL') || n.includes('POS') || n.includes('THERMAL') || n.includes('TVS');
        });

        const activeName = savedMatch ? savedMatch.name : (tscPrinter ? tscPrinter.name : (status.activePrinter || list[0].name));
        if (activeName) {
          setSelectedPrinterName(activeName);
          setActivePrinter(activeName, () => {});
        }
      }
    });

    if ((window as any).api) {
      (window as any).api.receive('print-response', (event: any, res: any) => {
        if (res && res.success) {
          if (setGlobalNotification) {
            setGlobalNotification({ msg: `✓ Barcode label print job sent successfully!`, type: 'success' });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
          }
        } else {
          if (setGlobalNotification) {
            setGlobalNotification({ msg: `❌ Printing error: ${(res && res.error) || 'Check printer connection'}`, type: 'error' });
            setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 5000);
          }
        }
      });
    }
  }, []);

  // Save barcodes list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('saved_barcodes_list', JSON.stringify(savedBarcodes));
    } catch (e) {
      console.error(e);
    }
  }, [savedBarcodes]);

  // Filtered Item Master List
  const filteredItemMaster = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    if (!q) return availableProducts.slice(0, 15);
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      (p as any).vendorItemCode?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.variety?.toLowerCase().includes(q) ||
      p.weight?.toLowerCase().includes(q)
    );
  }, [availableProducts, itemSearch]);

  // Handle selecting item from Item Master
  const handleSelectProduct = (prod: Product) => {
    setProductName(prod.name);
    setBarcodeValue(prod.barcode || prod.itemCode || `BC-${Date.now().toString().slice(-6)}`);
    setDepartment(prod.department || '');
    setVariety(prod.variety || 'Standard');
    setWeight(prod.weight || '1kg');
    setMrp(prod.mrp || prod.price || 0);
    setSalesPrice(prod.price || prod.mrp || 0);
    if ((prod as any).mfgDate) setMfgDate((prod as any).mfgDate);
    if ((prod as any).expDate) setExpDate((prod as any).expDate);
    setBatchNo(`BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowItemDropdown(false);
    setItemSearch('');

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `Loaded product: ${prod.name} (Barcode: ${prod.barcode || prod.itemCode})`, type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Generate random barcode
  const handleGenerateRandomBarcode = () => {
    const randomCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    setBarcodeValue(randomCode);
  };

  const handleClear = () => {
    setProductName('');
    setBarcodeValue('');
    setDepartment('');
    setVariety('');
    setWeight('');
    setMfgDate('');
    setExpDate('');
    setBatchNo('');
    setMrp('');
    setSalesPrice('');
    setBarcodeType('Code 128');
    setPrintCount(1);
    setItemSearch('');
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Form cleared.", type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Calibrate Thermal Printer Gap Sensor via TSPL
  const handleCalibratePrinterGapSensor = () => {
    const calWidth = totalRollWidthMm || 100;
    const calHeight = labelHeightMm || 25;
    const calGap = rowGapMm || 2;

    let tspl = `SIZE ${calWidth} mm, ${calHeight} mm\r\n`;
    tspl += `GAP ${calGap} mm, 0 mm\r\n`;
    tspl += `SPEED 3\r\n`;
    tspl += `DENSITY 10\r\n`;
    tspl += `DIRECTION 1,0\r\n`;
    tspl += `REFERENCE 0,0\r\n`;
    tspl += `SET PEEL OFF\r\n`;
    tspl += `SET TEAR ON\r\n`;
    tspl += `GAPDETECT\r\n`;
    tspl += `HOME\r\n`;

    if ((window as any).api) {
      printTSPLRaw(tspl, { printerName: selectedPrinterName });
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `⚡ Sensor calibration command sent to ${selectedPrinterName || 'printer'}. (If printer doesn't feed, perform Hardware Button Calibration: Turn OFF -> Hold FEED -> Turn ON -> Release when LED flashes GREEN).`, type: 'info' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 6000);
      }
    } else {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Gap calibration requires desktop app connection.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
    }
  };

  // Save Barcode Entry to Table List & Backend Database
  const handleSaveBarcodeToTable = () => {
    if (!productName.trim() || !barcodeValue.trim()) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Product Name and Barcode Number are required to save.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    const newItem: SavedBarcodeItem = {
      id: `${barcodeValue.trim()}-${Date.now()}`,
      productName: productName.trim(),
      barcodeValue: barcodeValue.trim(),
      department: department.trim() || '',
      variety: variety.trim() || 'Standard',
      weight: weight.trim() || '1kg',
      batchNo: batchNo.trim() || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
      mrp: mrp !== '' ? Number(mrp) : 0,
      salesPrice: salesPrice !== '' ? Number(salesPrice) : 0,
      mfgDate: mfgDate,
      expDate: expDate,
      barcodeType: barcodeType,
      printCount: printCount !== '' ? Number(printCount) : 1,
      createdAt: new Date().toLocaleString()
    };

    setSavedBarcodes(prev => [newItem, ...prev.filter(b => b.barcodeValue !== newItem.barcodeValue)]);

    // Sync saved barcode product to backend database for instant POS scanner lookup
    try {
      fetch(`${Api}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode: newItem.barcodeValue,
          barcode: newItem.barcodeValue,
          name: newItem.productName,
          department: newItem.department,
          variety: newItem.variety,
          weight: newItem.weight,
          price: newItem.salesPrice || newItem.mrp || 0,
          mrp: newItem.mrp || newItem.salesPrice || 0,
          stock: 100,
          uom: 'PCS'
        })
      }).catch(err => console.error("Sync product barcode error:", err));
    } catch (e) {
      console.error("Backend product sync failed:", e);
    }

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `✓ Saved barcode [${newItem.barcodeValue}] for ${newItem.productName} in table & database!`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3500);
    }
  };

  // Generate TSPL Native Commands for TSC TE244 Printers
  const generateTSPLCommandString = (itemsToPrint: SavedBarcodeItem[]): string => {
    const calcWidth = totalRollWidthMm || 100;
    const calcHeight = labelHeightMm || 25;
    let tspl = `SIZE ${calcWidth} mm, ${calcHeight} mm\r\n`;
    tspl += `GAP ${rowGapMm || 2} mm, 0 mm\r\n`;
    tspl += `SPEED 3\r\n`;
    tspl += `DENSITY 12\r\n`;
    tspl += `DIRECTION 1,0\r\n`;
    tspl += `REFERENCE 0,0\r\n`;
    tspl += `OFFSET 0 mm\r\n`;
    tspl += `SET PEEL OFF\r\n`;
    tspl += `SET TEAR ON\r\n`;
    tspl += `CLS\r\n`;

    let rawList: SavedBarcodeItem[] = [];
    itemsToPrint.forEach(item => {
      const numLabels = Number(item.printCount) || 1;
      for (let i = 0; i < numLabels; i++) rawList.push(item);
    });

    let labelIdx = 0;
    let currentCol = startColumn - 1;
    const rot = labelRotation || 0;

    while (labelIdx < rawList.length) {
      tspl += `CLS\r\n`;
      for (let col = 0; col < colsAcross; col++) {
        if (col >= currentCol && labelIdx < rawList.length) {
          const item = rawList[labelIdx];
          const mfg = item.mfgDate ? `${item.mfgDate.substring(8, 10)}/${item.mfgDate.substring(5, 7)}/${item.mfgDate.substring(0, 4)}` : '10/05/2025';
          const saleVal = Number(item.salesPrice || item.mrp || 0).toFixed(2);
          const xDot = Math.round((marginLeftMm + col * (labelWidthMm + columnGapMm)) * 8); // 203 DPI = 8 dots/mm
          const labelWidthDots = Math.round(labelWidthMm * 8);
          const labelHeightDots = Math.round(labelHeightMm * 8);

          const shopText = (effectiveShopName || 'GAYATHRI TRADERS').substring(0, 18).toUpperCase();
          const prodText = (item.productName || '').substring(0, 18).toUpperCase();
          const isCustomVar = item.variety && !['standard', 'std', 'default', ''].includes(item.variety.trim().toLowerCase());
          const metaText = isCustomVar
            ? `${item.variety.substring(0, 8)} | Wt:${(item.weight || '1kg').substring(0, 4)}`
            : `Wt:${(item.weight || '1kg').substring(0, 6)}`;
          const pkdText = `pkd:${mfg}`;
          const mrpVal = Number(item.mrp || item.salesPrice || 0).toFixed(2);
          const mrpText = `MRP Rs.${mrpVal} SALE Rs.${saleVal}`;
          const bcVal = item.barcodeType === 'Code 39' ? `* ${item.barcodeValue} *` : item.barcodeValue;
          const bType = item.barcodeType === 'Code 39' ? '39' : '128';
          const barH = Math.round((barcodeHeightMm || 5) * 8);

          const getXCenter = (textStr: string, charWidthDots: number) => {
            const textWidth = (textStr || '').length * charWidthDots;
            return xDot + Math.max(2, Math.round((labelWidthDots - textWidth) / 2));
          };

          if (rot === 90) {
            const xBase = xDot;
            if (showShopHeader) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.85)},10,"2",90,1,1,"${shopText}"\r\n`;
            }
            tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.68)},10,"2",90,1,1,"${prodText}"\r\n`;
            if (showMetaLine) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.52)},10,"1",90,1,1,"${metaText}"\r\n`;
            }
            if (showDatesLine || showPriceLine) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.40)},10,"1",90,1,1,"${pkdText}  ${mrpText}"\r\n`;
            }
            tspl += `BARCODE ${xBase + Math.round(labelWidthDots * 0.22)},10,"${bType}",${barH},0,90,1,2,"${item.barcodeValue}"\r\n`;
            tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.08)},10,"1",90,1,1,"${bcVal}"\r\n`;

          } else if (rot === 270) {
            const xBase = xDot;
            const yEnd = labelHeightDots - 10;
            if (showShopHeader) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.15)},${yEnd},"2",270,1,1,"${shopText}"\r\n`;
            }
            tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.32)},${yEnd},"2",270,1,1,"${prodText}"\r\n`;
            if (showMetaLine) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.48)},${yEnd},"1",270,1,1,"${metaText}"\r\n`;
            }
            if (showDatesLine || showPriceLine) {
              tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.60)},${yEnd},"1",270,1,1,"${pkdText}  ${mrpText}"\r\n`;
            }
            tspl += `BARCODE ${xBase + Math.round(labelWidthDots * 0.78)},${yEnd},"${bType}",${barH},0,270,1,2,"${item.barcodeValue}"\r\n`;
            tspl += `TEXT ${xBase + Math.round(labelWidthDots * 0.92)},${yEnd},"1",270,1,1,"${bcVal}"\r\n`;

          } else if (rot === 180) {
            const xEnd = xDot + labelWidthDots - 10;
            const yEnd = labelHeightDots - 10;
            if (showShopHeader) {
              tspl += `TEXT ${xEnd},${yEnd - 10},"2",180,1,1,"${shopText}"\r\n`;
            }
            tspl += `TEXT ${xEnd},${yEnd - 28},"2",180,1,1,"${prodText}"\r\n`;
            if (showMetaLine) {
              tspl += `TEXT ${xEnd},${yEnd - 46},"1",180,1,1,"${metaText}"\r\n`;
            }
            if (showDatesLine || showPriceLine) {
              tspl += `TEXT ${xEnd},${yEnd - 64},"1",180,1,1,"${pkdText}  ${mrpText}"\r\n`;
            }
            tspl += `BARCODE ${xEnd},${yEnd - 82},"${bType}",${barH},0,180,1,2,"${item.barcodeValue}"\r\n`;
            tspl += `TEXT ${xEnd},${yEnd - 120},"1",180,1,1,"${bcVal}"\r\n`;

          } else {
            // 0° Normal orientation - Balanced vertical spacing with customizable barcode offset
            const topMarginDots = Math.round((marginTopMm !== undefined ? marginTopMm : 1) * 8);
            const offsetDots = Math.round((barcodeOffsetMm || 0) * 8);
            const scaleY = labelHeightDots / 200; // 25mm = 200 dots standard
            const shopY = topMarginDots + Math.round(6 * scaleY);
            const prodY = topMarginDots + Math.round(26 * scaleY);
            const metaY = topMarginDots + Math.round(48 * scaleY);
            const priceY = topMarginDots + Math.round(68 * scaleY);
            const barY = topMarginDots + Math.round((96 + offsetDots) * scaleY);
            const barTextY = barY + barH + Math.round(4 * scaleY);

            if (showShopHeader) {
              const shopX = getXCenter(shopText, 12);
              tspl += `TEXT ${shopX},${shopY},"2",0,1,1,"${shopText}"\r\n`;
            }

            const prodX = getXCenter(prodText, 12);
            tspl += `TEXT ${prodX},${prodY},"2",0,1,1,"${prodText}"\r\n`;

            if (showMetaLine) {
              const metaX = getXCenter(metaText, 8);
              tspl += `TEXT ${metaX},${metaY},"1",0,1,1,"${metaText}"\r\n`;
            }

            if (showDatesLine || showPriceLine) {
              if (showDatesLine && showPriceLine) {
                const leftX = xDot + 4;
                const rightX = xDot + labelWidthDots - (mrpText.length * 8) - 4;
                tspl += `TEXT ${leftX},${priceY},"1",0,1,1,"${pkdText}"\r\n`;
                tspl += `TEXT ${Math.max(leftX + (pkdText.length * 8) + 2, rightX)},${priceY},"1",0,1,1,"${mrpText}"\r\n`;
              } else if (showPriceLine) {
                const mrpX = getXCenter(mrpText, 12);
                tspl += `TEXT ${mrpX},${priceY},"2",0,1,1,"${mrpText}"\r\n`;
              } else if (showDatesLine) {
                const pkdX = getXCenter(pkdText, 8);
                tspl += `TEXT ${pkdX},${priceY},"1",0,1,1,"${pkdText}"\r\n`;
              }
            }

            const bcWidthDots = bType === '39' ? (item.barcodeValue.length + 2) * 13 : 160;
            const barcX = xDot + Math.max(2, Math.round((labelWidthDots - bcWidthDots) / 2));
            tspl += `BARCODE ${barcX},${barY},"${bType}",${barH},0,0,1,2,"${item.barcodeValue}"\r\n`;

            const bcTextX = getXCenter(bcVal, 8);
            tspl += `TEXT ${bcTextX},${barTextY},"1",0,1,1,"${bcVal}"\r\n`;
          }

          labelIdx++;
        }
      }
      tspl += `PRINT 1,1\r\n`;
      currentCol = 0;
    }

    return tspl;
  };

  const handleDownloadTSPLFile = (itemsToPrint: SavedBarcodeItem[]) => {
    const tsplStr = generateTSPLCommandString(itemsToPrint);
    const blob = new Blob([tsplStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TSC_TE244_Barcodes_${Date.now()}.tspl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (setGlobalNotification) {
      setGlobalNotification({ msg: "✓ Downloaded TSC TE244 native TSPL command file!", type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  const handleDirectTSPLHardwarePrint = (itemsToPrint: SavedBarcodeItem[]) => {
    const tsplStr = generateTSPLCommandString(itemsToPrint);
    if ((window as any).api) {
      printTSPLRaw(tsplStr, { printerName: selectedPrinterName });
      if (setGlobalNotification) {
        setGlobalNotification({ msg: `⚡ Direct TSPL raw command sent to ${selectedPrinterName || 'thermal printer'}...`, type: 'info' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
    } else {
      printLabelHTML(itemsToPrint);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "⚡ Browser Mode: Printed barcode labels via Browser Print Engine. (For direct raw TSPL hardware spooling, open in Desktop App).", type: 'info' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
    }
  };

  // Print Labels Function (Supports Custom Millimeter Dimensions, Multi-Column Packaging, Rotation & Column Offset)
  const printLabelHTML = (itemsToPrint: SavedBarcodeItem[]) => {
    let rawLabels: { item: SavedBarcodeItem, mfgFormatted: string, expFormatted: string, mrpFormatted: string, saleFormatted: string, barcodeSvg: string }[] = [];

    itemsToPrint.forEach(item => {
      const numLabels = Number(item.printCount) || 1;
      const mfgFormatted = item.mfgDate ? `${item.mfgDate.substring(8, 10)}/${item.mfgDate.substring(5, 7)}/${item.mfgDate.substring(0, 4)}` : '10/05/2025';
      const expFormatted = item.expDate ? `${item.expDate.substring(8, 10)}/${item.expDate.substring(5, 7)}/${item.expDate.substring(0, 4)}` : '--/--';
      const mrpFormatted = Number(item.mrp || 0).toFixed(2);
      const saleFormatted = Number(item.salesPrice || item.mrp || 0).toFixed(2);
      const barcodeSvg = getBarcodeSVGString(item.barcodeValue || '8901234567890', item.barcodeType || 'Code 128');

      for (let i = 0; i < numLabels; i++) {
        rawLabels.push({ item, mfgFormatted, expFormatted, mrpFormatted, saleFormatted, barcodeSvg });
      }
    });

    const calculatedRollWidth = totalRollWidthMm || (colsAcross > 1 ? (colsAcross * labelWidthMm + (colsAcross - 1) * columnGapMm + marginLeftMm * 2) : labelWidthMm);
    const pageSizeCss = `@page { size: ${calculatedRollWidth}mm ${labelHeightMm}mm; margin: 0; }`;

    const innerWidth = (labelRotation === 90 || labelRotation === 270) ? labelHeightMm : labelWidthMm;
    const innerHeight = (labelRotation === 90 || labelRotation === 270) ? labelWidthMm : labelHeightMm;

    const renderLabelContent = (l: (typeof rawLabels)[0]) => `
      <div class="print-label-outer" style="width: ${labelWidthMm}mm; height: ${labelHeightMm}mm; position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; box-sizing: border-box; padding: 0;">
        <div class="print-label-inner" style="width: ${innerWidth}mm; height: ${innerHeight}mm; ${labelRotation !== 0 ? `transform: rotate(${labelRotation}deg); transform-origin: center;` : ''} display: flex; flex-direction: column; justify-content: flex-start; align-items: center; box-sizing: border-box; padding: ${marginTopMm !== undefined ? marginTopMm : 0.8}mm 1mm 0.5mm 1mm; background-color: #ffffff;">
          ${showShopHeader ? `<div class="header" style="font-size: 5.5pt; font-weight: 800; text-align: center; text-transform: uppercase; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.1px;">${effectiveShopName}</div>` : ''}
          <div class="product" style="font-size: 7pt; font-weight: 900; margin-top: 0.4mm; text-align: center; text-transform: uppercase; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.item.productName}</div>
          ${showMetaLine ? `<div class="meta" style="font-size: 4.8pt; font-weight: 800; margin-top: 0.3mm; text-align: center; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.item.variety && !['standard', 'std', 'default', ''].includes(l.item.variety.trim().toLowerCase()) ? l.item.variety + ' | ' : ''}Wt : ${l.item.weight || '1kg'}</div>` : ''}
          ${showDatesLine ? `
            <div class="dates" style="font-size: 4.8pt; font-weight: 800; margin-top: 0.3mm; text-align: center; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              pkd: ${l.mfgFormatted}${l.expFormatted ? ` &nbsp; exp: ${l.expFormatted}` : ''}
            </div>
          ` : ''}
          ${showPriceLine ? `
            <div class="price" style="font-size: 5.2pt; font-weight: 900; margin-top: 0.3mm; text-align: center; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              MRP ₹${l.mrpFormatted} &nbsp; SALE ₹${l.saleFormatted}
            </div>
          ` : ''}
          <div class="barcode-wrapper" style="height: ${barcodeHeightMm || 5}mm; width: 75%; margin: 0.3mm auto 0 auto; display: flex; justify-content: center; align-items: center; background-color: #ffffff !important;">
             ${l.barcodeSvg}
          </div>
          <div class="barcode-text" style="font-size: 4.5pt; font-family: monospace; font-weight: 900; text-align: center; line-height: 1; color: #000000 !important; letter-spacing: 0.3px; margin-top: 0.2mm;">${l.item.barcodeType === 'Code 39' ? '* ' + l.item.barcodeValue + ' *' : l.item.barcodeValue}</div>
        </div>
      </div>
    `;

    let bodyContent = '';

    if (colsAcross > 1) {
      let currentCol = startColumn - 1; // 0-indexed start column
      let labelIdx = 0;

      while (labelIdx < rawLabels.length) {
        let rowHtml = `<div class="label-row" style="width: ${calculatedRollWidth}mm; height: ${labelHeightMm}mm; padding-left: ${marginLeftMm}mm; margin-bottom: ${rowGapMm || 0}mm; display: flex; flex-direction: row; justify-content: flex-start; align-items: center; gap: ${columnGapMm}mm; box-sizing: border-box; page-break-after: always; break-after: page; overflow: hidden;">`;
        for (let col = 0; col < colsAcross; col++) {
          if (col < currentCol) {
            rowHtml += `<div class="print-label-outer" style="width: ${labelWidthMm}mm; height: ${labelHeightMm}mm; visibility: hidden;"></div>`;
          } else if (labelIdx < rawLabels.length) {
            rowHtml += renderLabelContent(rawLabels[labelIdx]);
            labelIdx++;
          } else {
            rowHtml += `<div class="print-label-outer" style="width: ${labelWidthMm}mm; height: ${labelHeightMm}mm; visibility: hidden;"></div>`;
          }
        }
        rowHtml += '</div>';
        bodyContent += rowHtml;
        currentCol = 0; // reset for subsequent rows
      }
    } else {
      rawLabels.forEach(l => {
        bodyContent += `<div class="single-label-row" style="width: ${calculatedRollWidth}mm; height: ${labelHeightMm}mm; display: flex; justify-content: center; align-items: center; page-break-after: always; break-after: page; overflow: hidden;">${renderLabelContent(l)}</div>`;
      });
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Labels</title>
          <style>
            ${pageSizeCss}
            * {
              box-sizing: border-box;
              color: #000000 !important;
            }
            body { 
              margin: 0; 
              padding: 0; 
              background: #ffffff !important; 
              font-family: Arial, sans-serif;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
            }
            .label-row {
              display: flex;
              flex-direction: row;
              justify-content: flex-start;
              align-items: center;
              box-sizing: border-box;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
              ${driverRotationFix !== 0 ? `transform: rotate(${driverRotationFix}deg); transform-origin: center;` : ''}
            }
            .header { font-size: 6.5pt; font-weight: 800; text-align: center; text-transform: uppercase; color: #000000 !important; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .product { font-size: 9.5pt; font-weight: 900; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.05; width: 100%; color: #000000 !important; }
            .meta { font-size: 5.5pt; font-weight: 700; text-align: center; line-height: 1; color: #000000 !important; }
            .dates-price { display: flex; justify-content: space-between; align-items: baseline; font-size: 5.5pt; font-weight: 900; width: 100%; color: #000000 !important; }
            .mrp { font-size: 6.2pt; font-weight: 900; color: #000000 !important; }
            .barcode-wrapper { display: flex; justify-content: center; align-items: center; overflow: hidden; background-color: #ffffff !important; }
            .barcode-wrapper svg rect { fill: #000000 !important; }
            .barcode-text { font-size: 5.5pt; font-family: monospace; font-weight: 900; margin-top: 0.2mm; color: #000000 !important; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          ${bodyContent}
        </body>
      </html>
    `;

    if ((window as any).api) {
      (window as any).api.send('print-html', fullHtml, { showDialog: useSystemPrintDialog, landscape: false });
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Please allow popups to print labels.", type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        return;
      }
      printWindow.document.write(fullHtml);
      printWindow.document.write(`
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      `);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const handlePrintCurrentForm = () => {
    if (!productName || !barcodeValue) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please fill in Product Name and Barcode Number before printing.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }
    const item: SavedBarcodeItem = {
      id: Date.now().toString(),
      productName,
      barcodeValue,
      department: department || '',
      variety: variety || 'Standard',
      weight: weight || '1kg',
      batchNo,
      mrp,
      salesPrice,
      mfgDate,
      expDate,
      barcodeType,
      printCount: printCount || 1,
      createdAt: new Date().toLocaleString()
    };
    printLabelHTML([item]);
  };

  // Download Barcode Label Image (PNG)
  const handleDownloadLabelImage = (item: SavedBarcodeItem) => {
    const code = item.barcodeValue || '100002';
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 400, 280);

    // Label Border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 388, 268);

    // Header
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(effectiveShopName, 200, 32);

    // Line separator
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 42);
    ctx.lineTo(385, 42);
    ctx.stroke();

    // Product Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(item.productName.toUpperCase(), 200, 70);

    // Category | Variety | Weight
    const metaStr = `${item.department || ''} | ${item.variety || 'Standard'} | Wt: ${item.weight || '1kg'}`;
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(metaStr, 200, 94);

    // Dates
    const mfg = item.mfgDate ? `${item.mfgDate.substring(8, 10)}/${item.mfgDate.substring(5, 7)}/${item.mfgDate.substring(2, 4)}` : '--/--';
    const exp = item.expDate ? `${item.expDate.substring(8, 10)}/${item.expDate.substring(5, 7)}/${item.expDate.substring(2, 4)}` : '--/--';
    ctx.font = '13px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`pkd ${mfg}  Exp ${exp}  |  Batch: ${item.batchNo}`, 200, 118);

    // Prices
    const mrpVal = Number(item.mrp || 0).toFixed(2);
    const saleVal = Number(item.salesPrice || 0).toFixed(2);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Arial';
    ctx.fillText(`MRP: ₹${mrpVal}   SALE: ₹${saleVal}`, 200, 146);

    // Barcode Visual Lines
    const bars = generateBarcodeBars(item.barcodeValue || '100002', item.barcodeType || 'Code 128');
    const barY = 158;
    const barHeight = 75;

    // Calculate total width to center it on the 400px wide canvas
    let totalUnits = 0;
    bars.forEach(bar => totalUnits += bar.width);
    const scale = Math.min(3.0, Math.max(1.0, 360 / totalUnits));
    const totalWidth = totalUnits * scale;
    let currentX = Math.max(10, 200 - totalWidth / 2); // Center the barcode

    bars.forEach(bar => {
      if (bar.type === 'bar') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(currentX, barY, bar.width * scale, barHeight);
      }
      currentX += bar.width * scale;
    });

    // Barcode text
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(item.barcodeType === 'Code 39' ? `* ${code} *` : code, 200, 258);

    // Download PNG
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Barcode_${code}_${item.productName.replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (setGlobalNotification) {
      setGlobalNotification({ msg: `Downloaded barcode image Barcode_${code}.png`, type: 'success' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
    }
  };

  const handleDeleteSaved = (id: string) => {
    setSavedBarcodes(prev => prev.filter(b => b.id !== id));
    if (setGlobalNotification) {
      setGlobalNotification({ msg: "Barcode removed from table.", type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2000);
    }
  };

  // Filtered Saved Barcodes Table List
  const filteredSavedTable = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return savedBarcodes;
    return savedBarcodes.filter(b =>
      b.productName.toLowerCase().includes(q) ||
      b.barcodeValue.toLowerCase().includes(q) ||
      b.department.toLowerCase().includes(q) ||
      b.variety.toLowerCase().includes(q) ||
      b.weight.toLowerCase().includes(q) ||
      b.batchNo.toLowerCase().includes(q)
    );
  }, [savedBarcodes, tableSearch]);

  // Wire Global Toolbar Actions
  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: handleClear,
        onSave: handleSaveBarcodeToTable,
        onPrint: handlePrintCurrentForm,
        onCancel: handleClear
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions, productName, barcodeValue, department, variety, weight, mrp, salesPrice, printCount]);

  return (
    <div className="flex flex-col h-full bg-slate-100 relative overflow-y-auto space-y-4 p-3">

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-3 rounded-md shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-md shadow">
            <Tag size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide">BARCODE GENERATION & ITEM MASTER LABEL MASTER</h1>
            <p className="text-xs text-blue-200">Select Item Master saved products, generate barcodes, print labels, and save to table list.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/barcode-register')}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-md shadow transition-all active:scale-95 cursor-pointer"
          >
            <Tag size={15} />
            <span>Barcode Register (History)</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workstation: Form (Left) & Live Label Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* Left Panel: Item Master Selector & Data Entry Form */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-md shadow-sm">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
            <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={16} className="text-blue-700" />
              1. Select from Item Master Saved List & Edit Details
            </h2>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {availableProducts.length} Items Loaded
            </span>
          </div>

          <div className="p-4 space-y-3 text-xs">

            {/* ITEM MASTER SEARCHABLE SELECTOR */}
            <div className="relative">
              <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                <span>SELECT FROM ITEM MASTER SAVED LIST:</span>
                <span className="text-[10px] text-blue-600 font-normal">Click item to auto-populate category & weight</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full font-bold text-blue-900 bg-blue-50/70 border border-blue-300 py-1.5 px-3 pl-8 rounded focus:outline-none focus:bg-yellow-50 focus:border-blue-600"
                  value={itemSearch}
                  onChange={e => {
                    setItemSearch(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
              </div>

              {/* Item Master Dropdown List */}
              {showItemDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-blue-400 rounded-md shadow-2xl max-h-60 overflow-y-auto z-[999]">
                  <div className="bg-slate-100 p-1.5 text-[11px] font-bold text-slate-600 border-b flex justify-between">
                    <span>SAVED ITEM MASTER PRODUCTS ({filteredItemMaster.length})</span>
                    <button type="button" className="text-red-500" onClick={() => setShowItemDropdown(false)}>Close ✕</button>
                  </div>
                  {filteredItemMaster.length === 0 ? (
                    <div className="p-3 text-slate-500 italic text-center">No products found matching "{itemSearch}"</div>
                  ) : (
                    filteredItemMaster.map((prod, idx) => (
                      <div
                        key={prod.id || prod._id || idx}
                        onClick={() => handleSelectProduct(prod)}
                        className="p-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{prod.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Code: <strong className="font-mono text-blue-700">{prod.itemCode}</strong></span>
                            {prod.barcode && <span>Barcode: <strong className="font-mono text-emerald-700">{prod.barcode}</strong></span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">₹{prod.price || prod.mrp || 0}</div>
                          <div className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {prod.department || ''} | {prod.variety || 'Standard'} | Wt: <strong>{prod.weight || '1kg'}</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 my-2"></div>

            {/* FORM INPUT FIELDS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1 flex justify-between">
                  <span>Barcode Number <span className="text-red-500">*</span></span>
                  <button type="button" onClick={handleGenerateRandomBarcode} className="text-[10px] text-blue-600 font-bold hover:underline">
                    ⚡ Auto Code
                  </button>
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-mono font-bold text-blue-900 bg-yellow-50 focus:border-blue-600 focus:outline-none"
                  value={barcodeValue}
                  onChange={e => setBarcodeValue(e.target.value)}
                />
              </div>

              {/* CATEGORY / DEPARTMENT, VARIETY, WEIGHT */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category / Department</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Variety / Sub-Category</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={variety}
                  onChange={e => setVariety(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Weight (Net Wt) <span className="text-blue-600 font-bold">*</span></label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-900 bg-blue-50 focus:border-blue-600 focus:outline-none"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Batch Number</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 uppercase focus:border-blue-600 focus:outline-none"
                  value={batchNo}
                  onChange={e => setBatchNo(e.target.value.toUpperCase())}
                />
              </div>

              {/* DATES */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mfg Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={mfgDate}
                  onChange={e => setMfgDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exp Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                />
              </div>

              {/* PRICE */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={mrp}
                  onChange={e => setMrp(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sales Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-emerald-700 focus:border-blue-600 focus:outline-none"
                  value={salesPrice}
                  onChange={e => setSalesPrice(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              {/* TYPE & QUANTITY & ROLL FORMAT */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode Standard</label>
                <select
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded text-slate-800 focus:border-blue-600 focus:outline-none font-bold text-blue-900"
                  value={barcodeType}
                  onChange={e => setBarcodeType(e.target.value)}
                >
                  <option value="Code 128">Code 128 (Standard POS)</option>
                  <option value="Code 39">Code 39 (Alphanumeric)</option>
                  <option value="EAN-13">EAN-13 (Numeric)</option>
                  <option value="UPC-A">UPC-A (Numeric)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Print Label Qty</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  value={printCount}
                  onChange={e => setPrintCount(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              {/* LABEL ROLL FORMAT & PRINTER SELECTION */}
              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1">Sticker Paper Roll Preset</label>
                <select
                  className="w-full border border-blue-400 bg-blue-50/80 py-1.5 px-2.5 rounded font-bold text-blue-950 focus:border-blue-700 focus:outline-none"
                  value={labelLayout}
                  onChange={e => handleLayoutPresetChange(e.target.value as any)}
                >
                  <option value="3-UP">3-UP Roll (3 Labels across - 102mm x 25mm TSC TE244/TVS)</option>
                  <option value="3-UP-TALL">3-UP Tall Sticker Roll (102mm x 50mm - 90° Rotated Barcode)</option>
                  <option value="3-UP-WIDE">3-UP Wide Roll (120mm x 25mm)</option>
                  <option value="1-UP">1-UP Single Roll (35mm x 25mm Continuous Roll)</option>
                  <option value="A4">A4 Sticker Sheet (24 Labels per A4 Page)</option>
                </select>
              </div>

              {/* TARGET PRINTER SELECTOR */}
              <div className="col-span-2 md:col-span-1">
                <label className="font-semibold text-slate-700 block mb-1 flex justify-between">
                  <span>Target Barcode Printer</span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    🟢 {connectedPrinters.length} Printer{connectedPrinters.length > 1 ? 's' : ''} Ready
                  </span>
                </label>
                <select
                  className="w-full border border-emerald-500 bg-emerald-50 py-1.5 px-2.5 rounded font-bold text-slate-900 focus:border-emerald-700 focus:outline-none"
                  value={selectedPrinterName}
                  onChange={e => {
                    setSelectedPrinterName(e.target.value);
                    setActivePrinter(e.target.value, () => {});
                  }}
                >
                  {connectedPrinters.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                  {!connectedPrinters.some(p => p.name === selectedPrinterName) && selectedPrinterName && (
                    <option value={selectedPrinterName}>{selectedPrinterName}</option>
                  )}
                </select>
              </div>

              <div className="col-span-2 flex items-center pt-2">
                <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={useSystemPrintDialog}
                    onChange={e => setUseSystemPrintDialog(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Show Printer Driver Selection Dialog (Force Manual Printer Window)</span>
                </label>
              </div>

              {/* CUSTOM MILLIMETER DIMENSION CONTROLS */}
              <div className="col-span-2 bg-slate-50 border border-slate-300 p-3 rounded-md space-y-3">
                <div className="font-extrabold text-[11px] text-blue-900 uppercase tracking-wide flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span>📐 Custom Sticker Dimension & Calibration</span>
                  <span className="text-[10px] text-slate-500 font-normal">Fine-tune sticker dimensions, gaps, margins & orientation</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Sticker Width in millimeters">Sticker W (mm)</label>
                    <input
                      type="number"
                      min="15"
                      max="150"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={labelWidthMm}
                      onChange={e => setLabelWidthMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Sticker Height in millimeters">Sticker H (mm)</label>
                    <input
                      type="number"
                      min="10"
                      max="150"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={labelHeightMm}
                      onChange={e => setLabelHeightMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Total Roll Width in millimeters">Roll W (mm)</label>
                    <input
                      type="number"
                      min="30"
                      max="220"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={totalRollWidthMm}
                      onChange={e => setTotalRollWidthMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Column Gap in millimeters">Col Gap (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={columnGapMm}
                      onChange={e => setColumnGapMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-emerald-800 block mb-1 truncate" title="Vertical Gap Between Sticker Rows">Row Gap (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      className="w-full border border-emerald-400 bg-emerald-50 py-1.5 px-2.5 rounded font-bold text-emerald-950 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={rowGapMm}
                      onChange={e => setRowGapMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Top Margin in millimeters">Top Margin (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={marginTopMm}
                      onChange={e => setMarginTopMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Left Margin in millimeters">Left Margin (mm)</label>
                    <input
                      type="number"
                      min="-10"
                      max="30"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={marginLeftMm}
                      onChange={e => setMarginLeftMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate" title="Barcode Lines Height in millimeters">Barcode H (mm)</label>
                    <input
                      type="number"
                      min="3"
                      max="30"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={barcodeHeightMm}
                      onChange={e => setBarcodeHeightMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-indigo-900 block mb-1 truncate" title="Barcode Shift Y Offset in millimeters">Barcode Shift Y</label>
                    <input
                      type="number"
                      min="-10"
                      max="20"
                      className="w-full border border-indigo-300 bg-indigo-50 py-1.5 px-2.5 rounded font-bold text-indigo-950 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={barcodeOffsetMm}
                      onChange={e => setBarcodeOffsetMm(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate">Columns</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      className="w-full border border-slate-300 py-1.5 px-2.5 rounded font-bold text-blue-950 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={colsAcross}
                      onChange={e => setColsAcross(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate">Start Column</label>
                    <select
                      className="w-full border border-slate-300 py-1.5 px-2 rounded font-bold text-slate-800 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={startColumn}
                      onChange={e => setStartColumn(Number(e.target.value))}
                    >
                      <option value={1}>Col 1 (Left)</option>
                      <option value={2}>Col 2 (Mid)</option>
                      <option value={3}>Col 3 (Right)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-slate-700 block mb-1 truncate">Orientation</label>
                    <select
                      className="w-full border border-slate-300 py-1.5 px-2 rounded font-bold text-slate-800 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={labelRotation}
                      onChange={e => setLabelRotation(Number(e.target.value) as any)}
                    >
                      <option value={0}>0° Normal</option>
                      <option value={90}>90° Right</option>
                      <option value={270}>270° Left</option>
                      <option value={180}>180° Invert</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-purple-900 block mb-1 truncate">Driver 90° Fix</label>
                    <select
                      className="w-full border border-purple-300 bg-purple-50 py-1.5 px-2 rounded font-bold text-purple-950 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      value={driverRotationFix}
                      onChange={e => setDriverRotationFix(Number(e.target.value))}
                    >
                      <option value={0}>Off (0°)</option>
                      <option value={-90}>-90° (Fix)</option>
                      <option value={90}>+90°</option>
                      <option value={180}>180°</option>
                    </select>
                  </div>
                </div>

                {/* ELEMENT VISIBILITY TOGGLES */}
                <div className="flex flex-wrap items-center gap-4 pt-2.5 border-t border-slate-200 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer text-indigo-900 font-bold" title="Forces portrait print mode">
                    <input type="checkbox" checked={forcePortrait} onChange={e => setForcePortrait(e.target.checked)} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500" />
                    <span>Lock Portrait (TSC Roll)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showShopHeader} onChange={e => setShowShopHeader(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500" />
                    <span>Store Name</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showMetaLine} onChange={e => setShowMetaLine(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500" />
                    <span>Category/Variety</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showDatesLine} onChange={e => setShowDatesLine(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500" />
                    <span>Dates/Batch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showPriceLine} onChange={e => setShowPriceLine(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500" />
                    <span>MRP / Sale Price</span>
                  </label>
                </div>
              </div>

            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 mt-2">
              <button
                type="button"
                onClick={handleSaveBarcodeToTable}
                className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Save size={14} />
                <span>Save to Table</span>
              </button>

              <button
                type="button"
                title="Re-sync the printer's gap sensor to the actual physical label pitch on the roll"
                onClick={handleCalibratePrinterGapSensor}
                className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Tag size={14} />
                <span>Calibrate Sensor</span>
              </button>

              <button
                type="button"
                onClick={handlePrintCurrentForm}
                className="h-9 px-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Printer size={14} />
                <span>Print (HTML)</span>
              </button>

              <button
                type="button"
                title="Send raw TSPL command directly to thermal barcode printer spooler without dialogs"
                onClick={() => {
                  if (!productName || !barcodeValue) return;
                  const item: SavedBarcodeItem = {
                    id: Date.now().toString(),
                    productName,
                    barcodeValue,
                    department: department || '',
                    variety: variety || 'Standard',
                    weight: weight || '1kg',
                    batchNo,
                    mrp,
                    salesPrice,
                    mfgDate,
                    expDate,
                    barcodeType,
                    printCount: printCount || 1,
                    createdAt: new Date().toLocaleString()
                  };
                  handleDirectTSPLHardwarePrint([item]);
                }}
                className="h-9 px-3.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Printer size={14} />
                <span>TSPL Direct Print</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-9 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Clear</span>
              </button>
            </div>

          </div>
        </div>

        {/* Right Panel: Live Thermal Barcode Label Preview */}
        <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-md shadow-md p-4 text-white flex flex-col items-center justify-center relative min-h-[480px]">
          <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1">
              <Tag size={12} className="text-yellow-400" />
              <span>2. Live Thermal Label Preview ({colsAcross}-UP Row)</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-700">
              <button
                type="button"
                onClick={() => setPreviewViewMode('row')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${previewViewMode === 'row' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                3-Col Row View
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewMode('single')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${previewViewMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Single Sticker Zoom
              </button>
            </div>
          </div>

          <div className="flex justify-center items-center w-full py-14 px-2 my-2 overflow-x-auto overflow-y-visible">
            {previewViewMode === 'row' && colsAcross > 1 ? (
              <div
                className="bg-slate-300 border-2 border-dashed border-slate-400 rounded-sm shadow-2xl transition-all flex flex-row items-center justify-start"
                style={{
                  width: `${totalRollWidthMm || 102}mm`,
                  height: `${labelHeightMm}mm`,
                  gap: `${columnGapMm}mm`,
                  paddingLeft: `${marginLeftMm}mm`,
                  boxSizing: 'border-box',
                  transform: 'scale(1.85)',
                  transformOrigin: 'center'
                }}
              >
                {Array.from({ length: colsAcross }).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="bg-white shadow relative border border-slate-300 transition-all duration-300 flex flex-col justify-between items-center"
                    style={{
                      width: `${labelWidthMm}mm`,
                      height: `${labelHeightMm}mm`,
                      boxSizing: 'border-box',
                      padding: '0.5mm 0.8mm',
                      fontFamily: 'Arial, sans-serif',
                      color: '#000',
                      transform: `rotate(${labelRotation}deg)`,
                      transformOrigin: 'center'
                    }}
                  >
                    {showShopHeader && (
                      <div className="w-full text-center">
                        <h1 className="text-[6.5pt] font-extrabold uppercase leading-none m-0 p-0 whitespace-nowrap tracking-tight text-black">
                          {effectiveShopName}
                        </h1>
                      </div>
                    )}
                    <div className="w-full text-center">
                      <h2 className="text-[9pt] font-black uppercase leading-tight truncate m-0 p-0 w-full text-black">
                        {productName || 'GENERAL SAMPLE PRODUCT'}
                      </h2>
                    </div>
                    {showMetaLine && (
                      <div className="w-full text-center">
                        <span className="text-[5.5pt] font-bold leading-none m-0 p-0 text-slate-900 block truncate">
                          {variety && !['standard', 'std', 'default', ''].includes(variety.trim().toLowerCase()) ? `${variety} | ` : ''}Wt : <strong className="text-black font-extrabold">{weight || '1kg'}</strong>
                        </span>
                      </div>
                    )}
                    {showDatesLine && (
                      <div className="w-full text-center">
                        <span className="text-[4.8pt] font-extrabold leading-none m-0 p-0 text-black block truncate">
                          pkd: {mfgDate ? `${mfgDate.substring(8, 10)}/${mfgDate.substring(5, 7)}/${mfgDate.substring(2, 4)}` : '10/05/25'}
                          {expDate ? `  exp: ${expDate.substring(8, 10)}/${expDate.substring(5, 7)}/${expDate.substring(2, 4)}` : ''}
                        </span>
                      </div>
                    )}
                    {showPriceLine && (
                      <div className="w-full text-center">
                        <span className="text-[5.2pt] font-black leading-none m-0 p-0 text-black block truncate">
                          MRP ₹{mrp !== '' ? Number(mrp).toFixed(2) : (salesPrice !== '' ? Number(salesPrice).toFixed(2) : '450.00')} &nbsp; SALE ₹{salesPrice !== '' ? Number(salesPrice).toFixed(2) : '450.00'}
                        </span>
                      </div>
                    )}
                    <div className="w-[75%] flex justify-center items-center bg-white" style={{ height: `${barcodeHeightMm}mm` }}>
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ __html: getBarcodeSVGString(barcodeValue || '8901234567890', barcodeType) }}
                      />
                    </div>
                    <div className="w-full text-center">
                      <span className="text-[5.5pt] font-mono font-extrabold leading-none block text-black tracking-wider">
                        {barcodeType === 'Code 39' ? `* ${barcodeValue || '8901234567890'} *` : barcodeValue || '8901234567890'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="bg-white shadow-2xl relative border border-slate-300 transition-all duration-300 flex flex-col justify-between items-center my-4"
                style={{
                  width: `${(labelWidthMm || 30) * 1.8}mm`,
                  height: `${(labelHeightMm || 25) * 1.8}mm`,
                  boxSizing: 'border-box',
                  padding: '2mm 3mm',
                  fontFamily: 'Arial, sans-serif',
                  color: '#000',
                  transform: `rotate(${labelRotation}deg)`,
                  transformOrigin: 'center'
                }}
              >
                {showShopHeader && (
                  <div className="w-full text-center">
                    <h1 className="text-[11pt] font-extrabold uppercase leading-tight m-0 p-0 whitespace-nowrap tracking-tight text-black">
                      {shopName}
                    </h1>
                  </div>
                )}
                <div className="w-full text-center">
                  <h2 className="text-[14pt] font-black uppercase leading-tight truncate m-0 p-0 w-full text-black">
                    {productName || 'GENERAL SAMPLE PRODUCT'}
                  </h2>
                </div>
                {showMetaLine && (
                  <div className="w-full text-center">
                    <span className="text-[9.5pt] font-bold leading-tight m-0 p-0 text-slate-900 block truncate">
                      {variety && !['standard', 'std', 'default', ''].includes(variety.trim().toLowerCase()) ? `${variety} | ` : ''}Wt : <strong className="text-black font-extrabold">{weight || '1kg'}</strong>
                    </span>
                  </div>
                )}
                {(showDatesLine || showPriceLine) && (
                  <div className={`w-full flex ${showDatesLine ? 'justify-between' : 'justify-center'} items-baseline px-1`}>
                    {showDatesLine && (
                      <span className="text-[9.5pt] font-extrabold leading-tight m-0 p-0 text-black">
                        pkd : {mfgDate ? `${mfgDate.substring(8, 10)}/${mfgDate.substring(5, 7)}/${mfgDate.substring(0, 4)}` : '10/05/2025'}
                      </span>
                    )}
                    {showPriceLine && (
                      <span className="text-[11pt] font-black leading-tight m-0 p-0 text-black">
                        MRP ₹{salesPrice !== '' ? Number(salesPrice).toFixed(2) : '450.00'}
                      </span>
                    )}
                  </div>
                )}
                <div className="w-[75%] flex justify-center items-center bg-white my-0.5" style={{ height: `${(barcodeHeightMm || 6) * 1.8}mm` }}>
                  <div
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{ __html: getBarcodeSVGString(barcodeValue || '8901234567890', barcodeType) }}
                  />
                </div>
                <div className="w-full text-center">
                  <span className="text-[9.5pt] font-mono font-extrabold leading-tight block text-black tracking-wider">
                    {barcodeType === 'Code 39' ? `* ${barcodeValue || '8901234567890'} *` : barcodeValue || '8901234567890'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-300 font-semibold bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 mt-4">
            <Check size={14} className="text-emerald-400" />
            <span>Ready to generate & print {printCount || 1} label(s) for <strong>{productName || 'Item'}</strong> in 3-column horizontal row</span>
          </div>

        </div>

      </div>

    </div>
  );
};

export default BarcodeGeneration;
