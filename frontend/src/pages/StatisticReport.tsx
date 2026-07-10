import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToolbarActions } from '../components/Layout';
import { BarChart3, Calendar } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import Api from '../Api';

const StatisticReport = () => {
  const navigate = useNavigate();
  const { setToolbarActions } = useOutletContext<{
    setToolbarActions: (actions: ToolbarActions) => void;
  }>();

  const [fy, setFy] = useState('2026-2027');
  const [stats, setStats] = useState<any[]>([]);

  React.useEffect(() => {
    fetch(`${Api}/statistics`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setStats(data);
      })
      .catch(err => console.error("Failed to fetch stats", err));
  }, []);

  React.useEffect(() => {
    setToolbarActions({
      onPrint: () => window.print()
    });
    return () => setToolbarActions({});
  }, [setToolbarActions]);

  const totalCount = stats.reduce((s, c) => s + (c.count || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#f0f9f4] p-4 overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-4 border border-gray-400 shadow-sm rounded mb-4 flex-shrink-0 flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#2b579a] flex items-center">
          <BarChart3 size={24} className="mr-3" />
          System Statistic Report
        </h2>

        <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 px-3 py-1.5 rounded shadow-sm">
             <Calendar size={16} className="text-gray-500" />
             <span className="text-sm font-bold text-gray-700">Financial Year:</span>
             <select value={fy} onChange={e => setFy(e.target.value)} className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer">
               <option value="2025-2026">2025 - 2026</option>
               <option value="2026-2027">2026 - 2027</option>
             </select>
           </div>
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="flex-1 bg-white border border-gray-400 shadow-sm rounded p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-[#1e3f70] text-white p-4 rounded-t flex justify-between items-center">
            <h3 className="font-bold tracking-wider uppercase">Voucher Statistics Summary</h3>
            <div className="text-sm font-bold text-blue-200">Total Records: {totalCount.toLocaleString()}</div>
          </div>
          
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#f8f9fa] border-b border-gray-300">
              <tr>
                <th className="p-3 text-xs font-bold text-gray-600 uppercase">Voucher Type</th>
                <th className="p-3 text-xs font-bold text-gray-600 uppercase text-right">Total Record Count</th>
                <th className="p-3 text-xs font-bold text-gray-600 uppercase text-right">Last Entry Date</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, idx) => (
                <tr key={stat.id} onClick={() => stat.route && navigate(stat.route)} className="border-b border-gray-200 hover:bg-blue-50 transition-colors group cursor-pointer">
                  <td className="p-3 font-bold text-gray-800 text-base">{stat.type}</td>
                  <td className="p-3 text-right font-mono font-black text-blue-700 text-lg">{stat.count.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono font-medium text-gray-500">{stat.lastEntry.split('-').reverse().join('-')}</td>
                  <td className="p-3 text-center">
                    <div className="opacity-0 group-hover:opacity-100 text-blue-500 font-bold text-xs bg-blue-100 px-2 py-1 rounded transition-opacity">View</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-400">
              <tr>
                <td className="p-3 font-black text-gray-800 uppercase text-right">Grand Total</td>
                <td className="p-3 text-right font-mono font-black text-gray-900 text-xl">{totalCount.toLocaleString()}</td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>

        </div>
      </div>

    </div>
  );
};

export default StatisticReport;