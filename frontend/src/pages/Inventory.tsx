import React from 'react';
import { PackageOpen } from 'lucide-react';

const Inventory = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
      <PackageOpen size={64} className="opacity-20" />
      <h2 className="text-2xl font-semibold">Inventory Module</h2>
      <p className="text-gray-400">Inventory management system is under development.</p>
    </div>
  );
};

export default Inventory;
