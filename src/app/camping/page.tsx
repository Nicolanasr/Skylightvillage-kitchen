'use client';

import React, { Suspense } from 'react';
import CustomerTakeoutPage from '../takeout/page';

export default function CampingOrderingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1c3a1e] flex flex-col items-center justify-center text-white p-4">
          <div className="h-10 w-10 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-extrabold text-sm tracking-wider uppercase">Loading Skylight Camping Menu...</p>
        </div>
      }
    >
      <CustomerTakeoutPage forcedOrderType="camping" />
    </Suspense>
  );
}
