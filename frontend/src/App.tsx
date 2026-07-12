import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import PurchaseBill from './pages/PurchaseBill';
import PurReturn from './pages/PurReturn';
import PurRegister from './pages/PurRegister';

import StockStatus from './pages/StockStatus';
import StockRegister from './pages/StockRegister';
import DailyStockStatus from './pages/DailyStockStatus';
import ViewLedger from './pages/ViewLedger';
import StatisticReport from './pages/StatisticReport';
import TrialBS from './pages/TrialBS';
import PLStatement from './pages/PLStatement';
import BalanceSheet from './pages/BalanceSheet';
import ModernErpLayout from './pages/ModernErpLayout';

function App() {
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
          
          {/* Sales */}
          <Route path="quotation" element={<Quotation />} />
          <Route path="sales-order" element={<SalesOrder />} />
          <Route path="sales-bill" element={<POSCheckout />} />
          <Route path="sales-return" element={<SalesReturn />} />
          <Route path="sales-register" element={<SalesRegister />} />
          
          {/* Purchase */}
          <Route path="purchase-bill" element={<PurchaseBill />} />
          <Route path="pur-return" element={<PurReturn />} />
          <Route path="pur-register" element={<PurRegister />} />
          
          {/* Accounts */}
        
          
          {/* Stock */}
          <Route path="stock-status" element={<StockStatus />} />
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
      </Routes>
    </Router>
  );
}

export default App;
