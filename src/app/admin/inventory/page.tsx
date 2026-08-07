'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminInventoryManager } from '@/components/admin/AdminInventoryManager';
import { ArrowLeft } from 'lucide-react';

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialSubTab = searchParams.get('sub') as any || 'ingredients';

  return (
    <div className="min-h-screen bg-[#fafbfa] p-4 sm:p-6 md:p-8 font-sans antialiased text-[#1c3a1e]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Direct Navigation Banner */}
        <div className="flex justify-between items-center bg-white border border-[#1c3a1e]/15 p-4 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-black"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Admin Portal</span>
            </a>
            <div>
              <h1 className="text-lg font-black text-[#1c3a1e]">📦 Inventory & Recipe BOM Hub</h1>
              <p className="text-xs text-gray-500 font-medium">Direct URL route for bookmarking and instant refresh access</p>
            </div>
          </div>
        </div>

        {/* Inventory Hub Manager */}
        <AdminInventoryManager initialSubTab={initialSubTab} />
      </div>
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <StaffAuthGuard pageTitle="Recipe BOM & Inventory Control">
      <Suspense fallback={
        <div className="py-20 text-center font-black text-xs text-[#1c3a1e]">
          Loading Inventory Hub...
        </div>
      }>
        <InventoryContent />
      </Suspense>
    </StaffAuthGuard>
  );
}
