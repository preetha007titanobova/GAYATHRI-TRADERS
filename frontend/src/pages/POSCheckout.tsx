import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, ArrowLeft, ArrowRight, Search, Printer, Mail, Paperclip, MessageSquare } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';
import Api from '../Api';

// Types for our grid
interface GridRow {
  id: number;
  itemName: string;
  itemDesc: string;
  qty: number;
  uom: string;
  rate: number;
  discPercent: number;
  discAmt: number;
  amount: number;
}

const POSCheckout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingPayload = location.state?.quotationPayload;
  const orderToConvert = location.state?.orderToConvert;

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [fromSalesOrderId, setFromSalesOrderId] = useState<string | null>(null);

  // --- State for Document Input Panel ---
  const [invoiceNo, setInvoiceNo] = useState('Loading...'); // Fetched from backend
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDays, setPayDays] = useState(0);
  const [buyerName, setBuyerName] = useState(incomingPayload?.buyerName || orderToConvert?.buyerName || '');
  const [salesman, setSalesman] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [rapidBarcode, setRapidBarcode] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [address, setAddress] = useState(orderToConvert?.address || '');
  const [eType, setEType] = useState('Local');
  const [mobileNo, setMobileNo] = useState(orderToConvert?.mobileNo || '');
  const [gstNo, setGstNo] = useState('');
  const [printIn, setPrintIn] = useState('Blank A4');
  const [invoiceFormat, setInvoiceFormat] = useState('GSTFormat Full Page');

  // Searchable Buyer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [favourDiscount, setFavourDiscount] = useState<number>(0);

  useEffect(() => {
    if (buyerName !== customerSearch) {
      setCustomerSearch(buyerName);
    }
  }, [buyerName]);

  useEffect(() => {
    if (customerSearch !== buyerName) {
      setBuyerName(customerSearch || '');
    }
  }, [customerSearch]);

  const filteredCustomersList = useMemo(() => {
    const q = customerSearch.toLowerCase();
    const matches = availableCustomers.filter(c =>
      c.accountName.toLowerCase().includes(q) ||
      (c.ledgerCode && c.ledgerCode.toLowerCase().includes(q))
    );
    if (!q || 'cash'.includes(q)) {
      if (!matches.some(m => m.accountName === 'CASH')) {
        return [{ accountName: 'CASH' }, ...matches];
      }
    }
    return matches;
  }, [availableCustomers, customerSearch]);

  // --- State for Data Entry Grid ---
  const initialGridData = useMemo(() => {
    const payload = incomingPayload || orderToConvert;
    if (payload?.items?.length > 0) {
      return payload.items.map((item: any, idx: number) => {
        const qty = Number(item.qty) || Number(item.quantityOrdered) || 0;
        const rate = Number(item.rate) || Number(item.unitPrice) || 0;
        const discPercent = Number(item.discPercent) || Number(item.discountPercentage) || 0;
        const baseAmount = qty * rate;
        const discAmt = (baseAmount * discPercent) / 100;
        return {
          id: idx + 1,
          itemName: item.itemName || item.itemDescription || '',
          itemDesc: item.itemDesc || item.itemCode || '',
          qty,
          uom: item.uom || 'PCS',
          rate,
          discPercent,
          discAmt: discAmt,
          amount: baseAmount - discAmt
        };
      });
    }
    return [{ id: 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }];
  }, [incomingPayload, orderToConvert]);

  const [gridData, setGridData] = useState<GridRow[]>(initialGridData);

  useEffect(() => {
    if (initialGridData.length > 0 && (initialGridData[0].itemName !== '' || initialGridData.length > 1)) {
      setGridData(initialGridData);
    }
  }, [initialGridData]);

  // --- Totals State ---
  const [totalQty, setTotalQty] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [cgstPercent, setCgstPercent] = useState(0);
  const [sgstPercent, setSgstPercent] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [tendered, setTendered] = useState(0);

  // --- Modal Search State ---
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeRowId, setActiveRowId] = useState<number>(1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean,
    action: (() => void) | null,
    cancelAction?: (() => void) | null,
    message?: string,
    title?: string,
    yesText?: string,
    noText?: string
  }>({ isOpen: false, action: null });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Global Context ---
  const { setToolbarActions, setGlobalNotification } = useOutletContext<{ setToolbarActions?: any, setGlobalNotification?: any }>() || {};

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  useEffect(() => {
    // Fetch available products
    fetch(`${Api}/products/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => console.error("Error fetching products:", err));

    // Fetch available customers
    fetch(`${Api}/ledgers/search?group=Customers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableCustomers(data);
      })
      .catch(err => console.error("Error fetching customers:", err));

    const invoiceToEdit = location.state?.invoiceToEdit;
    if (invoiceToEdit) {
      setEditingBillId(invoiceToEdit._id || invoiceToEdit.id);
      setInvoiceNo(invoiceToEdit.invoiceNo);
      setInvDate(new Date(invoiceToEdit.invDate).toISOString().split('T')[0]);
      setPayDays(invoiceToEdit.payDays || 0);
      setBuyerName(invoiceToEdit.buyerName || '');
      setSalesman(invoiceToEdit.salesman || '');
      setPaymentMode(invoiceToEdit.paymentMode || 'Cash');
      setAddress(invoiceToEdit.address || '');
      setEType(invoiceToEdit.eType || 'Local');
      setMobileNo(invoiceToEdit.mobileNo || '');
      setGstNo(invoiceToEdit.gstNo || '');
      setPrintIn(invoiceToEdit.printIn || 'Blank A4');
      setInvoiceFormat(invoiceToEdit.invFormat || invoiceToEdit.invoiceFormat || 'GSTFormat Full Page');

      // Fetch full details with items                                                                                                  
      fetch(`${Api}/sales/bills/${invoiceToEdit.invoiceNo}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.items)) {
            setGridData(data.items.map((item: any, idx: number) => ({
              id: idx + 1,
              itemName: item.itemName,
              itemDesc: item.itemDesc || '',
              qty: item.qty,
              uom: item.uom || 'PCS',
              rate: item.rate,
              discPercent: item.discPercent || 0,
              discAmt: item.discAmt || 0,
              amount: item.amount
            })));
          }
        })
        .catch(err => console.error("Error fetching full bill details:", err));
    } else {
      // Fetch next invoice number
      fetch(`${Api}/sales/next-invoice`)
        .then(res => res.json())
        .then(data => {
          if (data.invoiceNo) setInvoiceNo(data.invoiceNo);
        })
        .catch(err => console.error("Error fetching invoice no:", err));

      if (orderToConvert) {
        setFromSalesOrderId(orderToConvert.id || orderToConvert._id || null);
        setBuyerName(orderToConvert.buyerName || '');
        setMobileNo(orderToConvert.mobileNo || '');
        setAddress(orderToConvert.address || '');
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (isSearchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  const selectedCustomerObj = useMemo(() => {
    return availableCustomers.find(c => c.accountName === buyerName);
  }, [availableCustomers, buyerName]);

  const filteredProducts = availableProducts
    .filter(p => {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const openSearchModal = (rowId: number, targetElem?: HTMLElement) => {
    setActiveRowId(rowId);
    setSearchQuery('');
    setHighlightedIndex(0);

    if (targetElem) {
      const rect = targetElem.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 2, left: Math.max(10, rect.left) });
    } else {
      setDropdownPosition({ top: 150, left: 100 });
    }

    setIsSearchModalOpen(true);
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    // Return focus to grid
    setTimeout(() => {
      document.getElementById(`grid-input-${activeRowId - 1}-0`)?.focus();
    }, 100);
  };

  const selectProductFromModal = (product: any) => {
    setGridData(prev => prev.map(row => {
      if (row.id !== activeRowId) return row;

      let updatedRow = {
        ...row,
        itemName: product.name,
        itemDesc: product.itemCode || product.barcode || '',
        uom: product.uom || 'PCS',
        rate: product.price || 0,
        qty: row.qty === 0 ? 1 : row.qty
      };

      let baseAmount = updatedRow.qty * updatedRow.rate;
      updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
      updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
      return updatedRow;
    }));

    // Auto-add new row if it's the last row
    if (activeRowId === gridData.length) {
      setGridData(prev => [...prev, {
        id: prev.length + 1,
        itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0
      }]);
    }

    setIsSearchModalOpen(false);

    // Move focus to Qty
    setTimeout(() => {
      const rowIndex = gridData.findIndex(r => r.id === activeRowId);
      document.getElementById(`grid-input-${rowIndex}-1`)?.focus();
    }, 150);
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[highlightedIndex]) {
        selectProductFromModal(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchModal();
    }
  };

  // --- API Integrations ---

  const handleTenderedEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const validItems = gridData.filter(row => row.itemName && row.qty > 0 && row.rate > 0);
      if (validItems.length === 0) {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Please add at least one valid item to the grid before saving.", type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
        return;
      }
      setConfirmModalState({
        isOpen: true,
        title: "Print Bill",
        message: "Do you want to print the bill before saving?",
        yesText: "Yes, Print & Save",
        noText: "No, Save Only",
        action: () => {
          const formattedItems = validItems.map(item => ({
            itemCode: item.itemDesc || item.itemName,
            itemDesc: item.itemName,
            qty: item.qty,
            rate: item.rate,
            totalAmt: item.amount
          }));

          printReceipt(formattedItems, {
            invoiceNo: invoiceNo,
            date: invDate,
            customerName: buyerName,
            paymentMode: paymentMode,
            totalQty: totalQty,
            subTotal: totalAmount,
            cgst: cgst,
            sgst: sgst,
            totalAmount: netAmount
          });
          executeSave(validItems);
        },
        cancelAction: () => {
          executeSave(validItems);
        }
      });
    }
  };

  const handleSaveClick = () => {
    // Filter out empty rows
    const validItems = gridData.filter(row => row.itemName && row.qty > 0 && row.rate > 0);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Please add at least one valid item to the grid before saving.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
      return;
    }

    setConfirmModalState({
      isOpen: true,
      action: () => executeSave(validItems)
    });
  };

  const executeSave = async (validItems: any[]) => {
    setConfirmModalState({ isOpen: false, action: null });

    const payload = {
      invoiceNo, invDate, payDays, buyerName, address, eType,
      mobileNo, gstNo, printIn, invoiceFormat, totalQty, totalAmount,
      favourDiscount: Number(favourDiscount) || 0,
      cgst, sgst, roundOff, netAmount,
      salesman, paymentMode,
      fromSalesOrderId,
      items: validItems.map(item => ({
        itemName: item.itemName,
        itemDesc: item.itemDesc,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        discPercent: item.discPercent,
        discAmt: item.discAmt,
        amount: item.amount
      }))
    };

    try {
      const url = editingBillId ? `${Api}/sales/${editingBillId}` : `${Api}/sales`;
      const method = editingBillId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (setGlobalNotification) setGlobalNotification({ msg: `Sales Bill ${invoiceNo} saved successfully!`, type: 'success' });
        if (editingBillId) {
          setTimeout(() => navigate('/sales-register'), 1500);
        } else {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: "Error saving: " + data.error, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
        }
      }
    } catch (err) {
      console.error(err);
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "Network error while saving.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 4000);
      }
    }
  };

  // --- Auxiliary Actions ---
  const handleCancelClick = () => {
    setConfirmModalState({
      isOpen: true,
      action: () => {
        setGridData([{ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }]);
        setBuyerName('');
        setAddress('');
        setMobileNo('');
        setGstNo('');
        setTendered(0);
        setFavourDiscount(0);
        setConfirmModalState({ isOpen: false, action: null });
        if (setGlobalNotification) {
          setGlobalNotification({ msg: 'Invoice data cleared successfully.', type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
        }
      },
      message: "Are you sure you want to cancel and clear all data? All unsaved work will be lost."
    });
  };

  const handlePrintAction = (docType: string) => {
    if (setGlobalNotification) setGlobalNotification({ msg: `Preparing ${docType} for printing...`, type: 'success' });

    // Format items for the print utility
    const formattedItems = gridData
      .filter(item => item.itemName) // Only print valid items
      .map(item => ({
        itemCode: item.itemDesc || item.itemName,
        itemDesc: item.itemName,
        qty: item.qty,
        rate: item.rate,
        totalAmt: item.amount
      }));

    printReceipt(formattedItems, {
      invoiceNo: invoiceNo,
      date: invDate,
      customerName: buyerName,
      paymentMode: paymentMode,
      totalQty: totalQty,
      subTotal: totalAmount,
      cgst: cgst,
      sgst: sgst,
      totalAmount: netAmount
    });

    setTimeout(() => {
      if (setGlobalNotification) setGlobalNotification({ msg: '', type: '' });
    }, 2000);
  };

  const handleExportCSV = () => {
    const validItems = gridData.filter(row => row.itemName);
    if (validItems.length === 0) {
      if (setGlobalNotification) {
        setGlobalNotification({ msg: "No items to export.", type: 'error' });
        setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 3000);
      }
      return;
    }

    if (setGlobalNotification) setGlobalNotification({ msg: "Generating CSV Export...", type: 'success' });

    // Create CSV content
    const headers = ["Item Name", "Qty", "UOM", "Rate", "Discount %", "Discount Amt", "Total Amount"];
    const rows = validItems.map(item => [
      `"${item.itemName}"`, item.qty, `"${item.uom}"`, item.rate, item.discPercent, item.discAmt, item.amount
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // Download logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `SalesBill_${invoiceNo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      if (setGlobalNotification) setGlobalNotification({ msg: '', type: '' });
    }, 3000);
  };

  // --- Global Toolbar Wiring (Layout Bridge) ---
  // Note: setGlobalNotification is destructured above
  const actionHandlers = useRef({
    onAdd: handleCancelClick,
    onDelete: handleCancelClick,
    onFind: () => openSearchModal(gridData[gridData.length - 1].id),
    onPrint: () => handlePrintAction('Sales Bill')
  });

  // Keep ref updated with fresh closures on every render
  useEffect(() => {
    actionHandlers.current = {
      onAdd: handleCancelClick,
      onDelete: handleCancelClick,
      onFind: () => openSearchModal(gridData[gridData.length - 1].id),
      onPrint: () => handlePrintAction('Sales Bill')
    };
  });

  // Register the proxy handlers exactly once with Layout
  useEffect(() => {
    if (setToolbarActions) {
      setToolbarActions({
        onAdd: () => actionHandlers.current.onAdd(),
        onDelete: () => actionHandlers.current.onDelete(),
        onFind: () => actionHandlers.current.onFind(),
        onPrint: () => actionHandlers.current.onPrint()
      });
    }
    return () => {
      if (setToolbarActions) setToolbarActions({});
    };
  }, [setToolbarActions]);

  // --- Calculation Engine ---
  useEffect(() => {
    let tQty = 0;
    let tAmt = 0;

    // Calculate sums
    gridData.forEach(row => {
      tQty += row.qty || 0;
      tAmt += row.amount || 0;
    });

    setTotalQty(tQty);
    setTotalAmount(tAmt);

    // Apply favour discount
    const discountedTotal = Math.max(0, tAmt - favourDiscount);

    // Dynamic CGST & SGST logic
    const cgstVal = Number((discountedTotal * (cgstPercent / 100)).toFixed(2));
    const sgstVal = Number((discountedTotal * (sgstPercent / 100)).toFixed(2));
    setCgst(cgstVal);
    setSgst(sgstVal);

    // Calculate rounding
    const rawTotal = discountedTotal + cgstVal + sgstVal;
    const roundedTotal = Math.round(rawTotal);
    const roundDiff = Number((roundedTotal - rawTotal).toFixed(2));

    setRoundOff(roundDiff);
    setNetAmount(roundedTotal);
  }, [gridData, cgstPercent, sgstPercent, favourDiscount]);

  // --- Data Entry Grid Auto-Row Logic & Product Auto-Fill ---
  const handleGridChange = (id: number, field: keyof GridRow, value: string) => {
    setGridData(prev => {
      const newGrid = prev.map(row => {
        if (row.id !== id) return row;

        let updatedRow = { ...row, [field]: field === 'itemName' || field === 'itemDesc' || field === 'uom' ? value : Number(value) };

        let baseAmount = updatedRow.qty * updatedRow.rate;
        if (field === 'discPercent') {
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
        } else if (field === 'discAmt') {
          updatedRow.discPercent = baseAmount > 0 ? Number(((updatedRow.discAmt / baseAmount) * 100).toFixed(2)) : 0;
        } else if (field === 'qty' || field === 'rate') {
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
        }

        updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
        return updatedRow;
      });

      // Auto-add new empty row if the last row's item name was just modified
      const isLastRow = newGrid[newGrid.length - 1].id === id;
      if (isLastRow && field === 'itemName' && value.trim() !== '') {
        newGrid.push({
          id: Date.now(),
          itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0
        });
      }

      return newGrid;
    });
  };

  const handleDeleteRow = (rowId: number) => {
    setGridData(prev => {
      const newGrid = prev.filter(r => r.id !== rowId);
      if (newGrid.length === 0) {
        return [{ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }];
      }
      return newGrid;
    });
    if (setGlobalNotification) {
      setGlobalNotification({ msg: 'Row deleted', type: 'info' });
      setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 1500);
    }
  };

  // Duplicate useEffect removed

  const handleItemBlur = async (id: number, itemName: string) => {
    if (!itemName.trim()) return;
    try {
      const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(itemName)}`);
      const products = await res.json();

      const product = products.find((p: any) => p.name.toLowerCase() === itemName.trim().toLowerCase()) || products[0];

      if (product) {
        setGridData(prev => prev.map(row => {
          if (row.id !== id) return row;

          let updatedRow = {
            ...row,
            itemName: product.name,
            itemDesc: product.itemCode || product.barcode || '',
            uom: product.uom || 'PCS',
            rate: product.price || 0,
            qty: row.qty === 0 ? 1 : row.qty
          };

          let baseAmount = updatedRow.qty * updatedRow.rate;
          updatedRow.discAmt = Number(((baseAmount * updatedRow.discPercent) / 100).toFixed(2));
          updatedRow.amount = Number((baseAmount - updatedRow.discAmt).toFixed(2));
          return updatedRow;
        }));
      } else {
        // Unrecognized ad-hoc item, just set qty to 1 so math works if they manual enter a rate
        setGridData(prev => prev.map(row => {
          if (row.id !== id) return row;
          return { ...row, qty: row.qty === 0 ? 1 : row.qty };
        }));
      }
    } catch (err) {
      console.error('Error auto-filling item', err);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number, rowId: number, itemName: string) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex}-${colIndex + 1}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex}-${colIndex - 1}`)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex + 1}-${colIndex}`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      document.getElementById(`grid-input-${rowIndex - 1}-${colIndex}`)?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('tendered-input')?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = gridData[rowIndex];
      if (colIndex === 0) {
        const barcode = row.itemDesc?.trim();
        if (!barcode) {
          document.getElementById(`grid-input-${rowIndex}-1`)?.focus();
          return;
        }
        try {
          let product = availableProducts.find(p => p.barcode === barcode || p.itemCode === barcode);
          if (!product) {
            const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(barcode)}`);
            const data = await res.json();
            product = data.find((p: any) => p.barcode === barcode || p.itemCode === barcode);
          }
          if (product) {
            setGridData(prev => {
              const newGrid = prev.map(r => {
                if (r.id === rowId) {
                  const qty = r.qty || 1;
                  const rate = product.price || 0;
                  const baseAmount = qty * rate;
                  const discAmt = Number(((baseAmount * r.discPercent) / 100).toFixed(2));
                  return {
                    ...r,
                    itemName: product.name,
                    uom: product.uom || 'PCS',
                    rate: rate,
                    qty: qty,
                    amount: Number((baseAmount - discAmt).toFixed(2))
                  };
                }
                return r;
              });
              // Auto-append a new row if we just filled the last row
              if (newGrid[newGrid.length - 1].id === rowId) {
                newGrid.push({ id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 });
              }
              return newGrid;
            });
            setTimeout(() => {
              document.getElementById(`grid-input-${rowIndex}-2`)?.focus();
            }, 50);
            if (setGlobalNotification) {
              setGlobalNotification({ msg: `Found ${product.name}`, type: 'success' });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 1500);
            }
          } else {
            if (setGlobalNotification) {
              setGlobalNotification({ msg: `Barcode not found: ${barcode}`, type: 'error' });
              setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2500);
            }
          }
        } catch (err) { console.error(err); }
      } else if (colIndex === 1) {
        if (!itemName.trim()) {
          openSearchModal(rowId, e.currentTarget);
        } else {
          // Trigger autocomplete on Item Name then jump to Qty
          handleItemBlur(rowId, itemName);
          setTimeout(() => {
            document.getElementById(`grid-input-${rowIndex}-2`)?.focus();
          }, 150); // slight delay to allow row generation if it was the last row
        }
      } else {
        // Move to next column
        const nextInput = document.getElementById(`grid-input-${rowIndex}-${colIndex + 1}`);
        if (nextInput) {
          nextInput.focus();
        } else {
          // If at the end of the row, move to the Barcode of the next row
          if (rowIndex === gridData.length - 1) {
            setGridData(prev => [...prev, { id: Date.now(), itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 }]);
            setTimeout(() => {
              document.getElementById(`grid-input-${rowIndex + 1}-0`)?.focus();
            }, 50);
          } else {
            document.getElementById(`grid-input-${rowIndex + 1}-0`)?.focus();
          }
        }
      }
    } else if (e.key === 'F2' && colIndex === 1) {
      e.preventDefault();
      openSearchModal(rowId, e.currentTarget);
    } else if (e.key === 'F9') {
      e.preventDefault();
      handleDeleteRow(rowId);
    }
  };

  const handleRapidBarcodeScan = async (barcode: string) => {
    try {
      let product = availableProducts.find(p => p.barcode === barcode || p.itemCode === barcode);
      if (!product) {
        const res = await fetch(`${Api}/products/search?q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        product = data.find((p: any) => p.barcode === barcode || p.itemCode === barcode);
      }

      if (product) {
        setGridData(prev => {
          let newGrid = [...prev];
          const existingRowIdx = newGrid.findIndex(r => r.itemName === product.name);
          if (existingRowIdx !== -1) {
            let row = { ...newGrid[existingRowIdx] };
            row.qty = Number(row.qty) + 1;
            let baseAmount = row.qty * row.rate;
            row.discAmt = Number(((baseAmount * row.discPercent) / 100).toFixed(2));
            row.amount = Number((baseAmount - row.discAmt).toFixed(2));
            newGrid[existingRowIdx] = row;
          } else {
            const emptyRowIdx = newGrid.findIndex(r => !r.itemName.trim());
            const newRow = {
              id: emptyRowIdx !== -1 ? newGrid[emptyRowIdx].id : Date.now(),
              itemName: product.name,
              itemDesc: product.itemCode || product.barcode || '',
              uom: product.uom || 'PCS',
              rate: product.price || 0,
              qty: 1,
              discPercent: 0,
              discAmt: 0,
              amount: product.price || 0
            };

            if (emptyRowIdx !== -1) {
              newGrid[emptyRowIdx] = newRow;
              if (emptyRowIdx === newGrid.length - 1) {
                newGrid.push({ id: Date.now() + 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 });
              }
            } else {
              newGrid.push(newRow);
              newGrid.push({ id: Date.now() + 1, itemName: '', itemDesc: '', qty: 0, uom: '', rate: 0, discPercent: 0, discAmt: 0, amount: 0 });
            }
          }
          return newGrid;
        });

        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Added ${product.name}`, type: 'success' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 1500);
        }
      } else {
        if (setGlobalNotification) {
          setGlobalNotification({ msg: `Barcode not found: ${barcode}`, type: 'error' });
          setTimeout(() => setGlobalNotification({ msg: '', type: '' }), 2500);
        }
      }
    } catch (err) {
      console.error("Barcode scan error", err);
    }
    setRapidBarcode('');
  };

  return (
    <div className="flex flex-col h-full space-y-2">

      {/* 1. Header & Rapid Scan */}
      <div className="bg-blue-50 border border-blue-200 p-1.5 rounded-sm shadow-sm flex items-center space-x-2">
        <div className="flex items-center space-x-1 pr-3 border-r border-blue-200">
          <Search size={16} className="text-blue-600" />
          <h2 className="font-bold text-sm text-blue-900 whitespace-nowrap">Sales Bill</h2>
        </div>
        <div className="text-xs text-blue-800">Scan barcodes directly in the active grid row.</div>
      </div>

      {/* 2. Main Document Input Panel */}
      <div className="legacy-panel p-1 text-xs grid grid-cols-12 gap-x-2 gap-y-1 items-center">
        <label className="legacy-label text-right">Buyer</label>
        <div className="col-span-3 relative">
          <input
            type="text"
            className="legacy-input w-full font-bold text-blue-900 bg-blue-50 py-0.5 px-2 pr-6 focus:bg-yellow-50 outline-none border border-gray-300 rounded-sm"
            value={customerSearch}
            onChange={e => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => {
              // Short delay to let onMouseDown run first
              setTimeout(() => setShowCustomerDropdown(false), 200);
            }}
            placeholder="Search / select buyer..."
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 font-bold">▾</span>

          {showCustomerDropdown && (
            <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-gray-300 max-h-48 overflow-y-auto z-[999] shadow-lg rounded text-left">
              {filteredCustomersList.length === 0 ? (
                <div className="p-2 text-xs text-gray-500 italic">No matching customers</div>
              ) : (
                filteredCustomersList.map((c, i) => (
                  <button
                    key={c._id || i}
                    type="button"
                    onMouseDown={() => {
                      setBuyerName(c.accountName);
                      setCustomerSearch(c.accountName);
                      if (c.accountName === 'CASH') {
                        setAddress('');
                        setMobileNo('');
                        setGstNo('');
                      } else {
                        setAddress(c.address || '');
                        setMobileNo(c.mobileNo || '');
                        setGstNo(c.gstNo || '');
                      }
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 text-gray-800 font-semibold border-b border-gray-100 last:border-b-0 flex justify-between"
                  >
                    <span>{c.accountName}</span>
                    {c.ledgerCode && <span className="text-[10px] text-gray-400 font-mono">{c.ledgerCode}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <label className="legacy-label text-right">Inv No</label>
        <input type="text" className="legacy-input col-span-2 font-bold py-0.5" value={invoiceNo} disabled />

        <label className="legacy-label text-right">Inv Date</label>
        <input type="date" className="legacy-input col-span-2 py-0.5" value={invDate} onChange={e => setInvDate(e.target.value)} />

        <label className="legacy-label text-right">E.Type</label>
        <select className="legacy-input col-span-2 py-0.5" value={eType} onChange={e => setEType(e.target.value)}>
          <option>Local</option>
          <option>Interstate</option>
        </select>

        {/* <label className="legacy-label text-right">Address</label>
          <input type="text" className="legacy-input col-span-3 py-0.5" value={address} onChange={e => setAddress(e.target.value)} /> */}

        <label className="legacy-label text-right">Mobile</label>
        <input type="text" className="legacy-input col-span-2 py-0.5" value={mobileNo} onChange={e => setMobileNo(e.target.value)} />

        <label className="legacy-label text-right">Salesman</label>
        <input type="text" className="legacy-input col-span-2 bg-yellow-50 py-0.5" value={salesman} onChange={e => setSalesman(e.target.value)} placeholder="Billed By" />
      </div>

      {/* Selected Customer Status Banner */}
      {selectedCustomerObj && (
        <div className="bg-[#e2f0d9] border border-[#a8d08d] mx-1 mt-1 p-1.5 px-3 flex items-center justify-between text-xs font-bold text-[#385623] shadow-sm rounded">
          <div className="flex items-center space-x-1">
            <span className="bg-[#385623] w-1.5 h-4 block"></span>
            <span>CUSTOMER CREDIT STATUS ({selectedCustomerObj.ledgerCode}):</span>
            {selectedCustomerObj.isRegular && (
              <span className="ml-2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                ⭐ REGULAR PRIVILEGED
              </span>
            )}
          </div>
          <div className="flex space-x-6">
            <div>Current Balance: <span className="font-mono text-[#c55a11]">₹{selectedCustomerObj.openingBalance?.toLocaleString() || 0} {selectedCustomerObj.drCr || 'Dr'}</span></div>
            <div>Credit Limit: <span className="font-mono">₹{selectedCustomerObj.creditLimit?.toLocaleString() || 0}</span></div>
            <div>Allowed Period: <span>{selectedCustomerObj.defaultCreditPeriod || 0} Days</span></div>
          </div>
        </div>
      )}

      {/* 3. Data Entry Grid */}
      <div className="flex-1 min-h-[400px] bg-white border border-gray-400 overflow-auto mx-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="legacy-grid-header w-10">S.No</th>
              <th className="legacy-grid-header w-32">Barcode Number</th>
              <th className="legacy-grid-header">Item Name</th>
              <th className="legacy-grid-header w-16">Quantity</th>
              <th className="legacy-grid-header w-16">UOM</th>
              <th className="legacy-grid-header w-24">Rate</th>
              <th className="legacy-grid-header w-16">Disc %</th>
              <th className="legacy-grid-header w-20">DiscAmt</th>
              <th className="legacy-grid-header w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {gridData.map((row, idx) => (
              <tr key={row.id} className="hover:bg-blue-50">
                <td className="legacy-grid-cell text-center font-semibold text-gray-700">{idx + 1}</td>
                <td className="legacy-grid-cell p-0">
                  <input
                    id={`grid-input-${idx}-0`}
                    type="text"
                    placeholder="Barcode..."
                    className="w-full h-full p-1 pl-2 border-none outline-none focus:bg-yellow-100 font-mono text-blue-900"
                    value={row.itemDesc}
                    onChange={e => handleGridChange(row.id, 'itemDesc', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx, 0, row.id, row.itemName)}
                  />
                </td>
                <td className="legacy-grid-cell p-0 relative">
                  <input
                    id={`grid-input-${idx}-1`}
                    type="text"
                    placeholder="Press Enter to search..."
                    className="w-full h-full p-1 pl-2 border-none outline-none focus:bg-yellow-100 placeholder-gray-300"
                    value={row.itemName}
                    onChange={e => handleGridChange(row.id, 'itemName', e.target.value)}
                    onBlur={e => handleItemBlur(row.id, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx, 1, row.id, row.itemName)}
                  />
                  {!row.itemName && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
                      <Search size={14} />
                    </div>
                  )}
                </td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-2`} type="number" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.qty || ''} onChange={e => handleGridChange(row.id, 'qty', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 2, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-3`} type="text" className="w-full h-full p-1 border-none outline-none focus:bg-yellow-100" value={row.uom} onChange={e => handleGridChange(row.id, 'uom', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 3, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-4`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.rate || ''} onChange={e => handleGridChange(row.id, 'rate', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 4, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-5`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.discPercent || ''} onChange={e => handleGridChange(row.id, 'discPercent', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 5, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell p-0"><input id={`grid-input-${idx}-6`} type="number" step="0.01" className="w-full h-full p-1 text-right border-none outline-none focus:bg-yellow-100" value={row.discAmt || ''} onChange={e => handleGridChange(row.id, 'discAmt', e.target.value)} onKeyDown={e => handleKeyDown(e, idx, 6, row.id, row.itemName)} /></td>
                <td className="legacy-grid-cell text-right bg-gray-50 font-semibold">{row.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Totals & Terms Panel */}
      <div className="grid grid-cols-3 gap-2">
        {/* Left: Terms and Actions */}
        <div className="col-span-2 flex flex-col space-y-1">

          <div className="legacy-panel p-1 flex space-x-2">
            <div className="flex-1 flex items-center">
              <label className="legacy-label whitespace-nowrap mr-2">Shipping Addr.</label>
              <input type="text" className="legacy-input w-full py-0.5" />
            </div>
            <div className="flex-1 flex items-center">
              <label className="legacy-label whitespace-nowrap mr-2">Remarks</label>
              <input type="text" className="legacy-input w-full py-0.5" />
            </div>
          </div>

          <div className="flex space-x-2 mt-auto pb-1">
            <button className="legacy-button py-1 hover:bg-gray-200 transition-colors" onClick={handleExportCSV}>Export</button>
            <button className="legacy-button py-1 hover:bg-gray-200 transition-colors" onClick={() => handlePrintAction('Packing List')}>Packing List</button>
            <button className="legacy-button py-1 hover:bg-gray-200 transition-colors" onClick={() => handlePrintAction('Receipt')}>Receipt</button>
            <div className="flex-1"></div>
            <button id="save-button" className="legacy-button py-1 bg-blue-100 font-bold border-blue-400 hover:bg-blue-200 focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all" onClick={handleSaveClick}>Save</button>
            <button className="legacy-button py-1 bg-red-100 font-bold border-red-400 hover:bg-red-200 transition-colors" onClick={handleCancelClick}>Cancel</button>
            <button className="legacy-button py-1 hover:bg-gray-200 transition-colors" onClick={() => handlePrintAction('Challan')}>Print Challan</button>
          </div>
        </div>

        {/* Right: Calculations */}
        <div className="legacy-panel p-1 grid grid-cols-4 gap-x-2 gap-y-0.5 items-center text-xs">
          <label className="legacy-label col-span-2 text-right">Total Qty</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5" value={totalQty.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 text-right">Total Amount</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold py-0.5" value={totalAmount.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 text-right text-emerald-700 font-bold flex items-center justify-end">
            {selectedCustomerObj?.isRegular && <span className="text-yellow-600 mr-1">⭐</span>}
            Favour Disc (₹)
          </label>
          <input
            type="number"
            className={`legacy-input col-span-2 text-right py-0.5 font-bold focus:bg-yellow-100 ${selectedCustomerObj?.isRegular ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : ''}`}
            value={favourDiscount || ''}
            onChange={e => setFavourDiscount(Number(e.target.value))}
            placeholder="Special Discount"
          />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            CGST <input type="number" className="ml-1 w-10 text-center border border-gray-400 py-0 text-[10px]" value={cgstPercent} onChange={e => setCgstPercent(Number(e.target.value))} /> %
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={cgst.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            SGST <input type="number" className="ml-1 w-10 text-center border border-gray-400 py-0 text-[10px]" value={sgstPercent} onChange={e => setSgstPercent(Number(e.target.value))} /> %
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={sgst.toFixed(2)} disabled />

          <label className="legacy-label col-span-2 flex items-center justify-end">
            Round Off
            <select className="legacy-input py-0 text-[10px] ml-1">
              <option>Auto</option>
              <option>Manual</option>
            </select>
          </label>
          <input type="text" className="legacy-input col-span-2 text-right py-0.5" value={roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)} disabled />

          <div className="col-span-4 border-t border-gray-400 my-0.5"></div>

          <label className="legacy-label col-span-2 text-right text-sm">Net Amount</label>
          <input type="text" className="legacy-input col-span-2 text-right text-sm font-bold bg-[#e6f2ff] border-blue-500 text-blue-900 py-0.5" value={netAmount.toFixed(2)} disabled />

          <div className="col-span-4 border-t border-gray-400 my-0.5"></div>

          <label className="legacy-label col-span-2 text-right text-blue-900 font-bold">Pay Mode</label>
          <select className="legacy-input col-span-2 font-bold py-0.5" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option>Cash</option>
            <option>UPI</option>
            <option>Credit Card</option>
            <option>Bank Transfer</option>
            <option>Split / Other</option>
          </select>

          <label className="legacy-label col-span-2 text-right text-blue-900">Amt Tendered</label>
          <input
            id="tendered-input"
            type="number"
            className="legacy-input col-span-2 text-right font-bold bg-white border-blue-400 py-0.5"
            value={tendered || ''}
            onChange={e => setTendered(Number(e.target.value))}
            onKeyDown={handleTenderedEnter}
            placeholder="Cash given..."
          />

          <label className="legacy-label col-span-2 text-right text-green-700">Change Return</label>
          <input type="text" className="legacy-input col-span-2 text-right font-bold bg-green-100 text-green-900 border-green-500 py-0.5" value={(tendered > 0 ? tendered - netAmount : 0).toFixed(2)} disabled />
        </div>
      </div>

      {/* Enterprise-styled Inline Dropdown Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50" onClick={closeSearchModal}>
          <div
            className="fixed bg-white shadow-2xl flex flex-col border border-gray-500 rounded-sm overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: '750px',
              maxHeight: '400px'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header - Matching Image 1 Navy Blue Theme */}
            <div className="bg-[#385386] text-white px-3 py-1.5 flex justify-between items-center shadow-sm z-10 cursor-default">
              <div className="flex items-center space-x-2">
                <Search size={16} className="text-white" />
                <span className="font-bold tracking-wide text-sm">Product Search Lookup</span>
              </div>
              <button onClick={closeSearchModal} className="text-white hover:text-red-300 font-bold focus:outline-none">
                ✕
              </button>
            </div>

            {/* Search Input Area */}
            <div className="p-3 bg-[#f0f0f0] border-b border-gray-300 flex items-center space-x-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by product name, code, or barcode... (Sorted Alphabetically)"
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-400 focus:border-[#385386] focus:ring-1 focus:ring-[#385386] outline-none text-sm text-gray-800"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleModalKeyDown}
                />
              </div>
              <div className="text-xs text-gray-700 flex space-x-4 bg-white px-3 py-1.5 border border-gray-300 shadow-sm">
                <span><kbd className="font-bold">↑</kbd> <kbd className="font-bold">↓</kbd> Navigate</span>
                <span><kbd className="font-bold">Enter</kbd> Select</span>
              </div>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-[#e8ecef] border-b border-gray-400 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              <div className="col-span-2">Code</div>
              <div className="col-span-6">Product Details</div>
              <div className="col-span-2 text-center">Stock</div>
              <div className="col-span-2 text-right">Price (₹)</div>
            </div>

            {/* List Body */}
            <div className="overflow-y-auto flex-1 bg-white">
              {filteredProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-gray-200 cursor-pointer items-center text-sm ${idx === highlightedIndex ? 'bg-[#a3c293] text-black font-semibold' : 'hover:bg-[#eaf1e6] text-gray-800'}`}
                  onClick={() => selectProductFromModal(p)}
                >
                  <div className="col-span-2 text-xs">
                    {p.itemCode || '-'}
                  </div>
                  <div className="col-span-6 flex flex-col justify-center">
                    <span className="leading-tight font-medium">
                      {p.name}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-0.5 text-[10px]">
                      {p.department && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#f0f9eb] text-[#2b579a]' : 'bg-[#e8f4fd] text-blue-800'}`}>{p.department}</span>}
                      {p.variety && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#f3e8ff] text-[#2b579a]' : 'bg-purple-100 text-purple-800'}`}>{p.variety}</span>}
                      {p.size && <span className={`px-1 rounded font-bold ${idx === highlightedIndex ? 'bg-[#fef3c7] text-[#2b579a]' : 'bg-amber-100 text-amber-800'}`}>Size: {p.size}</span>}
                      {p.barcode && <span className={idx === highlightedIndex ? 'text-gray-800 ml-1' : 'text-gray-500 ml-1'}>Barcode: {p.barcode}</span>}
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`px-1.5 py-0.5 text-xs font-bold ${idx === highlightedIndex ? '' : p.stock > 10 ? 'text-green-700' : p.stock > 0 ? 'text-yellow-700' : 'text-red-700'}`}>
                      {p.stock} {p.uom}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-bold text-sm">
                    {p.price.toFixed(2)}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <Search size={32} className="mb-2 text-gray-300" />
                  <p className="text-sm font-bold">No products found</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="bg-[#f0f0f0] px-3 py-1.5 border-t border-gray-300 text-[11px] text-gray-600 flex justify-between">
              <span>Showing {filteredProducts.length} enrolled products in alphabetical order.</span>
              <span>Use <kbd className="font-bold border border-gray-300 px-1 bg-white">ESC</kbd> to close</span>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise-styled Confirmation Modal */}
      {confirmModalState.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white shadow-2xl w-[400px] flex flex-col border border-gray-500 rounded-sm overflow-hidden">
            <div className="bg-[#385386] text-white px-3 py-1.5 flex justify-between items-center shadow-sm">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-white" />
                <span className="font-bold tracking-wide text-sm">{confirmModalState.title || "Save Confirmation"}</span>
              </div>
            </div>
            <div className="p-4 bg-[#f0f0f0] border-b border-gray-300">
              <p className="text-sm text-gray-800 font-semibold mb-2">{confirmModalState.message || "Do you want to save these changes permanently?"}</p>
              {!confirmModalState.title && <p className="text-xs text-gray-600">This action cannot be undone.</p>}
            </div>
            <div className="bg-gray-100 px-4 py-2 flex justify-end space-x-2 border-t border-gray-300">
              <button
                id="confirm-cancel-btn"
                className="px-4 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-sm text-sm border border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => {
                  if (confirmModalState.cancelAction) confirmModalState.cancelAction();
                  else setConfirmModalState({ isOpen: false, action: null });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') document.getElementById('confirm-save-btn')?.focus();
                  if (e.key === 'Escape') setConfirmModalState({ isOpen: false, action: null });
                }}
              >
                {confirmModalState.noText || "No, Cancel"}
              </button>
              <button
                id="confirm-save-btn"
                autoFocus
                className="px-4 py-1.5 bg-[#a3c293] hover:bg-[#8eb07d] text-black font-bold rounded-sm text-sm border border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-700"
                onClick={() => {
                  if (confirmModalState.action) confirmModalState.action();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') document.getElementById('confirm-cancel-btn')?.focus();
                  if (e.key === 'Escape') setConfirmModalState({ isOpen: false, action: null });
                }}
              >
                {confirmModalState.yesText || "Yes, Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSCheckout;
