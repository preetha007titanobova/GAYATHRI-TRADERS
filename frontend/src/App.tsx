import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';

// Modules
import POSCheckout from './pages/POSCheckout';
import LedgerMaster from './pages/LedgerMaster';
import ItemMaster from './pages/ItemMaster';
import Backup from './pages/Backup';
import Quotation from './pages/Quotation';
import SalesOrder from './pages/SalesOrder';
import SalesReturn from './pages/SalesReturn';
import BarcodeGeneration from './pages/BarcodeGeneration';
import SalesRegister from './pages/SalesRegister';
import SalesStatus from './pages/SalesStatus';
import PurchaseBill from './pages/PurchaseBill';
import PurReturn from './pages/PurReturn';
import PurRegister from './pages/PurRegister';
import ShopSalesBill from './pages/ShopSalesBill';
import ShopSalesRegister from './pages/ShopSalesRegister';

import StockStatus from './pages/StockStatus';
import StockValuation from './pages/StockValuation';
import StockRegister from './pages/StockRegister';
import DailyStockStatus from './pages/DailyStockStatus';
import ViewLedger from './pages/ViewLedger';
import StatisticReport from './pages/StatisticReport';
import TrialBS from './pages/TrialBS';
import PLStatement from './pages/PLStatement';
import BalanceSheet from './pages/BalanceSheet';
import StaffMaster from './pages/StaffMaster';
import StaffAttendance from './pages/StaffAttendance';
import ModernErpLayout from './pages/ModernErpLayout';
import Activation from './pages/Activation';

function App() {
  useEffect(() => {
    if ((window as any).api) {
      (window as any).api.send('app-ready');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/sales-bill" replace />} />
          <Route path="pos" element={<Navigate to="/sales-bill" replace />} />
          
          {/* Master */}
          <Route path="ledger-master" element={<LedgerMaster />} />
          <Route path="item-master" element={<ItemMaster />} />
          <Route path="barcode-generation" element={<BarcodeGeneration />} />
          <Route path="backup" element={<Backup />} />
          
          {/* Admin & Staff */}
          <Route path="staff-master" element={<StaffMaster />} />
          <Route path="staff-attendance" element={<StaffAttendance />} />
          
          {/* Sales */}
          <Route path="quotation" element={<Quotation />} />
          <Route path="sales-order" element={<SalesOrder />} />
          <Route path="sales-bill" element={<POSCheckout />} />
          <Route path="sales-return" element={<SalesReturn />} />
          <Route path="sales-register" element={<SalesRegister />} />
          <Route path="sales-status" element={<SalesStatus />} />
          <Route path="shop-sales-bill" element={<ShopSalesBill />} />
          <Route path="shop-sales-register" element={<ShopSalesRegister />} />
          
          {/* Purchase */}
          <Route path="purchase-bill" element={<PurchaseBill />} />
          <Route path="pur-return" element={<PurReturn />} />
          <Route path="pur-register" element={<PurRegister />} />
          
          {/* Stock */}
          <Route path="stock-status" element={<StockStatus />} />
          <Route path="stock-valuation" element={<StockValuation />} />
          <Route path="stock-register" element={<StockRegister />} />
          <Route path="daily-stock-status" element={<DailyStockStatus />} />
          
          {/* Reports */}
          <Route path="view-ledger" element={<ViewLedger />} />
          <Route path="statistic-report" element={<StatisticReport />} />
          <Route path="trial-b-s" element={<TrialBS />} />
          <Route path="p-l-statment" element={<PLStatement />} />
          <Route path="balance-sheet" element={<BalanceSheet />} />
        </Route>
        <Route path="/modern" element={<ModernErpLayout />} />
        <Route path="/activation" element={<Activation />} />
      </Routes>
    </Router>
  );
}

export default App;
