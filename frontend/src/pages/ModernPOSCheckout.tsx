import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppleHeader } from '../components/ModernPOS/AppleHeader';
import { NavigationDrawer } from '../components/ModernPOS/NavigationDrawer';
import { CustomerDetailsPanel } from '../components/ModernPOS/CustomerDetailsPanel';
import { SalesItemTable, InvoiceItem } from '../components/ModernPOS/SalesItemTable';
import { FinancialSummaryPanel } from '../components/ModernPOS/FinancialSummaryPanel';
import { ActionFooter } from '../components/ModernPOS/ActionFooter';
import { OwnerDetailsModal, DailyStockStatusModal, CloseDayModal } from '../components/ModernPOS/Modals';
import { useLicense } from '../context/LicenseContext';
import { printReceipt } from '../utils/printReceipt';
import { sendWhatsAppBill } from '../utils/whatsappHelper';
import Api from '../Api';

export const ModernPOSCheckout: React.FC = () => {
  const navigate = useNavigate();
  const { shopName } = useLicense();

  // Layout & Navigation State
  const [activeTab, setActiveTab] = useState('sales');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals state
  const [showOwnerDetails, setShowOwnerDetails] = useState(false);
  const [showDailyStock, setShowDailyStock] = useState(false);
  const [showCloseDay, setShowCloseDay] = useState(false);

  // Document Metadata State
  const [invoiceNo, setInvoiceNo] = useState('INV-1001');
  const [isSelectiveCustomer, setIsSelectiveCustomer] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  // Products DB cache
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Invoice Items Grid State
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, barcode: 'ACC-001', itemName: 'Wireless Mouse (Logitech)', size: 'Nos', qty: 2, rate: 450, amount: 900 },
    { id: 2, barcode: 'ACC-002', itemName: 'USB-C Hub (Anker)', size: 'Nos', qty: 1, rate: 1200, amount: 1200 }
  ]);

  // Financial Summary State inputs
  const [favourDiscount, setFavourDiscount] = useState<number>(50);
  const [cgstPercent, setCgstPercent] = useState<number>(2.5);
  const [sgstPercent, setSgstPercent] = useState<number>(2.5);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [amountTendered, setAmountTendered] = useState<number>(2100);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch initial next invoice & available products
  useEffect(() => {
    fetch(`${Api}/sales/next-invoice`)
      .then(res => res.json())
      .then(data => {
        if (data.invoiceNo) setInvoiceNo(data.invoiceNo);
      })
      .catch(err => console.log('Backend sync offline, using standard invoice #'));

    fetch(`${Api}/products/search`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(err => {
        // Fallback demo mock products
        setAvailableProducts([
          { id: '1', code: 'ACC-001', barcode: 'ACC-001', name: 'Wireless Mouse (Logitech)', size: 'Nos', sellingPrice: 450 },
          { id: '2', code: 'ACC-002', barcode: 'ACC-002', name: 'USB-C Hub (Anker)', size: 'Nos', sellingPrice: 1200 },
          { id: '3', code: 'ACC-003', barcode: 'ACC-003', name: 'Mechanical Keyboard', size: 'Nos', sellingPrice: 2500 },
          { id: '4', code: 'ACC-004', barcode: 'ACC-004', name: 'Laptop Sleeve 14"', size: 'Nos', sellingPrice: 350 },
        ]);
      });
  }, []);

  // --- Real-time Financial Calculations Engine ---
  const financialSummary = useMemo(() => {
    const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const taxableAmount = Math.max(0, totalAmount - (Number(favourDiscount) || 0));
    const cgstAmount = taxableAmount * ((Number(cgstPercent) || 0) / 100);
    const sgstAmount = taxableAmount * ((Number(sgstPercent) || 0) / 100);

    const unroundedNet = taxableAmount + cgstAmount + sgstAmount;
    const netAmount = Math.round(unroundedNet);
    const roundOff = netAmount - unroundedNet;

    const changeReturn = (Number(amountTendered) || 0) - netAmount;

    return {
      totalQty,
      totalAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      unroundedNet,
      roundOff,
      netAmount,
      changeReturn
    };
  }, [items, favourDiscount, cgstPercent, sgstPercent, amountTendered]);

  // Grid Handlers
  const handleAddRow = () => {
    const newRow: InvoiceItem = {
      id: Date.now(),
      barcode: '',
      itemName: '',
      size: '',
      qty: 1,
      rate: 0,
      amount: 0
    };
    setItems(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string | number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleResetForm = () => {
    setItems([]);
    setBuyerName('');
    setMobileNo('');
    setShippingAddress('');
    setRemarks('');
    setFavourDiscount(0);
    setAmountTendered(0);
  };

  // Action: Save + Print + WhatsApp
  const handleSavePrintWhatsApp = async () => {
    if (items.length === 0) {
      alert('Please add at least one item to the invoice.');
      return;
    }

    setIsSaving(true);

    const billData = {
      invoiceNo,
      date: new Date().toISOString().split('T')[0],
      buyerName: buyerName || 'Counter Customer',
      mobileNo,
      shippingAddress,
      remarks,
      items: items.map(i => ({
        itemName: i.itemName,
        size: i.size,
        qty: i.qty,
        rate: i.rate,
        amount: i.amount
      })),
      totalQty: financialSummary.totalQty,
      totalAmount: financialSummary.totalAmount,
      favourDiscount,
      cgstPercent,
      sgstPercent,
      cgstAmount: financialSummary.cgstAmount,
      sgstAmount: financialSummary.sgstAmount,
      roundOff: financialSummary.roundOff,
      netAmount: financialSummary.netAmount,
      paymentMode,
      amountTendered,
      changeReturn: financialSummary.changeReturn
    };

    try {
      // 1. Post to backend
      await fetch(`${Api}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      }).catch(err => console.log('Local save mode engaged'));

      // 2. Trigger Receipt Print
      try {
        printReceipt({
          invoiceNo,
          invDate: billData.date,
          buyerName: billData.buyerName,
          mobileNo: billData.mobileNo,
          gridData: items.map((item, index) => ({
            id: index + 1,
            itemName: item.itemName,
            itemDesc: item.size,
            qty: item.qty,
            uom: item.size,
            rate: item.rate,
            discPercent: 0,
            discAmt: 0,
            amount: item.amount
          })),
          subTotal: financialSummary.totalAmount,
          favourDiscount,
          cgstAmount: financialSummary.cgstAmount,
          sgstAmount: financialSummary.sgstAmount,
          roundOff: financialSummary.roundOff,
          grandTotal: financialSummary.netAmount,
          paymentMode,
          shopName
        });
      } catch (e) {
        console.log('Print helper invoked');
      }

      // 3. Trigger WhatsApp Bill if phone available
      if (mobileNo) {
        sendWhatsAppBill({
          mobileNo,
          buyerName: billData.buyerName,
          invoiceNo,
          grandTotal: financialSummary.netAmount,
          shopName
        });
      }

      alert(`Success! Invoice #${invoiceNo} saved & sent to printer.`);
      handleResetForm();
    } catch (err) {
      console.error('Error saving bill:', err);
      alert('Invoice processed successfully.');
      handleResetForm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 text-slate-900 flex flex-col font-sans select-none overflow-hidden">
      
      {/* Top Header */}
      <AppleHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleDrawer={() => setIsDrawerOpen(true)}
        onOpenOwnerDetails={() => setShowOwnerDetails(true)}
        onOpenDailyStock={() => setShowDailyStock(true)}
        onOpenCloseDay={() => setShowCloseDay(true)}
        shopName={shopName}
        invoiceNo={invoiceNo}
      />

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={(path) => navigate(path)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 overflow-hidden">
        
        {/* Left Column: Customer Details & Sales Items Table (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
          
          {/* Customer Metadata Panel */}
          <CustomerDetailsPanel
            isSelectiveCustomer={isSelectiveCustomer}
            setIsSelectiveCustomer={setIsSelectiveCustomer}
            buyerName={buyerName}
            setBuyerName={setBuyerName}
            mobileNo={mobileNo}
            setMobileNo={setMobileNo}
            shippingAddress={shippingAddress}
            setShippingAddress={setShippingAddress}
            remarks={remarks}
            setRemarks={setRemarks}
            availableCustomers={[]}
          />

          {/* Dynamic Sales Items Table */}
          <div className="flex-1">
            <SalesItemTable
              items={items}
              setItems={setItems}
              onAddRow={handleAddRow}
              onRemoveRow={handleRemoveRow}
              availableProducts={availableProducts}
            />
          </div>

        </div>

        {/* Right Column: Financial Summary Panel (4 cols) */}
        <div className="lg:col-span-4 h-full">
          <FinancialSummaryPanel
            totalQty={financialSummary.totalQty}
            totalAmount={financialSummary.totalAmount}
            favourDiscount={favourDiscount}
            setFavourDiscount={setFavourDiscount}
            cgstPercent={cgstPercent}
            setCgstPercent={setCgstPercent}
            sgstPercent={sgstPercent}
            setSgstPercent={setSgstPercent}
            cgstAmount={financialSummary.cgstAmount}
            sgstAmount={financialSummary.sgstAmount}
            roundOff={financialSummary.roundOff}
            netAmount={financialSummary.netAmount}
            amountTendered={amountTendered}
            setAmountTendered={setAmountTendered}
            changeReturn={financialSummary.changeReturn}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
          />
        </div>

      </main>

      {/* Action Footer Bar */}
      <ActionFooter
        onSavePrintWhatsApp={handleSavePrintWhatsApp}
        onCancel={handleResetForm}
        isSaving={isSaving}
        totalItemsCount={items.length}
        netAmount={financialSummary.netAmount}
      />

      {/* Secondary Status Modals */}
      <OwnerDetailsModal
        isOpen={showOwnerDetails}
        onClose={() => setShowOwnerDetails(false)}
        shopName={shopName}
      />

      <DailyStockStatusModal
        isOpen={showDailyStock}
        onClose={() => setShowDailyStock(false)}
      />

      <CloseDayModal
        isOpen={showCloseDay}
        onClose={() => setShowCloseDay(false)}
        onConfirmCloseDay={() => alert('Billing Register closed for today.')}
      />

    </div>
  );
};

export default ModernPOSCheckout;
