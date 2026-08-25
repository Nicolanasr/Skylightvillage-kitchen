'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface OrderToastBannerProps {
  message: string | null;
}

export const OrderToastBanner: React.FC<OrderToastBannerProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-20 w-max max-w-[90vw] left-1/2 -translate-x-1/2 z-50 bg-[#1c3a1e] text-white font-black text-xs px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-[#d4af37] animate-in fade-in slide-in-from-top-4">
      <CheckCircle2 className="h-4 w-4 text-[#d4af37] shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
};
