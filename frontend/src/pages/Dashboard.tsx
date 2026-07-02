import React from 'react';
import { BarChart3 } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
      <BarChart3 size={64} className="opacity-20" />
      <h2 className="text-2xl font-semibold">Dashboard Module</h2>
      <p className="text-gray-400">Analytics and reporting will appear here.</p>
    </div>
  );
};

export default Dashboard;
