import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, CheckCircle, XCircle, ShieldAlert, Calendar, ShoppingBag } from 'lucide-react';
import Api from '../Api';

interface DashboardStats {
  totalOpenOrders: number;
  totalPartialOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingDeliveryAmount: number;
  todaysOrders: number;
  thisMonthsOrders: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalOpenOrders: 0,
    totalPartialOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    pendingDeliveryAmount: 0,
    todaysOrders: 0,
    thisMonthsOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${Api}/statistics/dashboard`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading dashboard statistics:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3 bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading Dashboard Metrics...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-6 overflow-y-auto space-y-6 text-slate-800">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Store Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of Sales Orders, fulfillment registers, and logistics value.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-semibold text-slate-600">
          <Calendar className="w-4 h-4 mr-2 text-slate-400" />
          <span>As of {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
        </div>
      </div>

      {/* METRIC CARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Open Orders */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Open Orders</span>
            <div className="text-3xl font-black text-slate-900">{stats.totalOpenOrders}</div>
            <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 px-2 py-0.5 rounded">Awaiting fulfillment</span>
          </div>
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Partial Deliveries */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Partial Deliveries</span>
            <div className="text-3xl font-black text-slate-900">{stats.totalPartialOrders}</div>
            <span className="text-[10px] text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded">Partially invoiced</span>
          </div>
          <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Delivery Value */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all col-span-1 md:col-span-2 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Delivery Value</span>
            <div className="text-3xl font-black text-emerald-600">
              ₹{stats.pendingDeliveryAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Unbilled outstanding balances</span>
          </div>
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* SECONDARY ROW METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Completed & Cancelled orders card */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fulfillment Registry Summary</h2>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-slate-700">Completed Orders</span>
              </div>
              <span className="font-bold font-mono text-slate-900">{stats.completedOrders}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center space-x-2.5">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium text-slate-700">Cancelled Orders</span>
              </div>
              <span className="font-bold font-mono text-slate-900">{stats.cancelledOrders}</span>
            </div>
          </div>
        </div>

        {/* Time-based metrics card */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Order Volume Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Today's Orders */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase block">Today's Orders</span>
                <span className="text-2xl font-black text-slate-800">{stats.todaysOrders}</span>
              </div>
              <div className="text-slate-400 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* This Month's Orders */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase block">This Month's Orders</span>
                <span className="text-2xl font-black text-slate-800">{stats.thisMonthsOrders}</span>
              </div>
              <div className="text-slate-400 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
