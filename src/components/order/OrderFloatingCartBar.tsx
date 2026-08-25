'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatUsd } from '@/lib/currency';

interface OrderFloatingCartBarProps {
  itemCount: number;
  subtotalUsd: number;
  isOpen: boolean;
  onOpenCart: () => void;
}

export const OrderFloatingCartBar: React.FC<OrderFloatingCartBarProps> = ({
  itemCount,
  subtotalUsd,
  isOpen,
  onOpenCart,
}) => {
  if (itemCount === 0 || isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 right-20 z-40 animate-in slide-in-from-bottom-4">
      <button
        onClick={onOpenCart}
        className="w-full bg-[#1c3a1e] hover:bg-black text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-[#d4af37]/40 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-[#d4af37] text-[#1c3a1e] rounded-xl font-black text-xs flex items-center justify-center shadow-xs shrink-0">
            {itemCount}
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-white leading-tight">View Your Cart</p>
            <p className="text-[10px] text-gray-300 font-medium truncate max-w-[130px] sm:max-w-none">
              Tap to submit order
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs font-black text-[#d4af37]">{formatUsd(subtotalUsd)}</span>
          <ChevronRight className="h-4 w-4 text-white" />
        </div>
      </button>
    </div>
  );
};
