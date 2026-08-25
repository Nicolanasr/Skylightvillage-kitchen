'use client';

import React, { useState } from 'react';
import { Bell, Flame, Receipt } from 'lucide-react';

interface OrderServiceBellFABProps {
  onCallWaiter: (type: 'waiter' | 'charcoal' | 'bill') => void;
}

export const OrderServiceBellFAB: React.FC<OrderServiceBellFABProps> = ({ onCallWaiter }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border border-[#d4af37]/30 cursor-pointer"
      >
        <Bell className="h-5 w-5" />
      </button>

      {/* Service Options Popover */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-64 bg-white border border-[#1c3a1e]/15 rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider px-2 py-1">
            Call Service
          </div>
          <button
            onClick={() => {
              onCallWaiter('waiter');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4 text-[#1c3a1e]" />
            <span>Call Waiter</span>
          </button>
          <button
            onClick={() => {
              onCallWaiter('charcoal');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Flame className="h-4 w-4 text-orange-600" />
            <span>Request Charcoal Change</span>
          </button>
          <button
            onClick={() => {
              onCallWaiter('bill');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Receipt className="h-4 w-4 text-emerald-700" />
            <span>Request Bill</span>
          </button>
        </div>
      )}
    </div>
  );
};
