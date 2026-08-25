'use client';

import React, { use } from 'react';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { AdminContent, AdminTab } from '../page';

const VALID_TABS: Record<string, AdminTab> = {
  menu: 'menu',
  'menu-items': 'menu',
  categories: 'categories',
  crm: 'crm',
  guests: 'crm',
  inventory: 'inventory',
  loyalty: 'loyalty',
  vip: 'loyalty',
  tables: 'tables',
  qr: 'tables',
  staff: 'staff',
  invoices: 'invoices',
  orders: 'invoices',
  reports: 'reports',
  analytics: 'reports',
};

export default function AdminTabPageRoute({ params }: { params: Promise<{ tab: string }> }) {
  const resolvedParams = use(params);
  const rawTab = (resolvedParams.tab || 'menu').toLowerCase();
  const initialTab: AdminTab = VALID_TABS[rawTab] || 'menu';

  return (
    <StaffAuthGuard pageTitle={`Admin — ${rawTab.toUpperCase()}`}>
      <AdminContent initialTab={initialTab} />
    </StaffAuthGuard>
  );
}
