'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { useRealtimePOS } from '@/hooks/useRealtimePOS';
import {
  createCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  addStaffMember,
  deleteStaffMember,
  seedDatabaseMenu,
  wipeAllDatabaseTestDataAction,
} from '../actions/admin-actions';
import { getStaffRoster } from '../actions/audit-actions';
import { MenuItem, StationType, TableSession, StaffMember, ModifierGroup } from '@/lib/types';
import { calculateBillTotals, getInvoiceReference } from '@/lib/currency';
import { getDetailedOdooReportData, StatusLogEntry } from '../actions/report-actions';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminMenuManager } from '@/components/admin/AdminMenuManager';
import { AdminCategoryManager } from '@/components/admin/AdminCategoryManager';
import { AdminCRMManager } from '@/components/admin/AdminCRMManager';
import { AdminInventoryManager } from '@/components/admin/AdminInventoryManager';
import { AdminLoyaltyManager } from '@/components/admin/AdminLoyaltyManager';
import { AdminTableManager } from '@/components/admin/AdminTableManager';
import { OrderHistoryTracker } from '@/components/admin/OrderHistoryTracker';
import { OdooAnalyticsReports } from '@/components/admin/OdooAnalyticsReports';
import { OrderDetailsDrawer } from '@/components/admin/OrderDetailsDrawer';
import { PlusCircle, Trash2, Plus, X } from 'lucide-react';

export type AdminTab = 'menu' | 'categories' | 'crm' | 'inventory' | 'loyalty' | 'tables' | 'staff' | 'invoices' | 'reports';

export default function AdminPage() {
  return (
    <StaffAuthGuard pageTitle="Skylight Village Admin Manager">
      <AdminContent initialTab="menu" />
    </StaffAuthGuard>
  );
}

export function AdminContent({ initialTab = 'menu' }: { initialTab?: AdminTab }) {
  const { categories, menuItems, orderItems, tables, sessions, discounts, payments, refreshPOSData } =
    useRealtimePOS();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  // Database Action Banners
  const [isSeeding, setIsSeeding] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Odoo Analytics & Status Logs
  const [reportDateFilter, setReportDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>('all');
  const [reportStationFilter, setReportStationFilter] = useState<string>('all');
  const [statusLogs, setStatusLogs] = useState<StatusLogEntry[]>([]);
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<TableSession | null>(null);

  // Invoice Tracker Filters
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sessionDiscountFilter, setSessionDiscountFilter] = useState<'all' | 'with_discount' | 'no_discount'>('all');
  const [sessionDateFilter, setSessionDateFilter] = useState<'all' | 'today' | 'yesterday' | 'month'>('all');

  // Dish Modals State
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [newItemCatId, setNewItemCatId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemPriceCamping, setNewItemPriceCamping] = useState('');
  const [newItemStation, setNewItemStation] = useState<StationType>('mezza');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemSortOrder, setNewItemSortOrder] = useState('0');
  const [newItemIsBestseller, setNewItemIsBestseller] = useState(false);
  const [newItemIsStaffOnly, setNewItemIsStaffOnly] = useState(false);
  const [newItemModifierGroups, setNewItemModifierGroups] = useState<ModifierGroup[]>([]);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPriceCamping, setEditPriceCamping] = useState('');
  const [editStation, setEditStation] = useState<StationType>('mezza');
  const [editDesc, setEditDesc] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('0');
  const [editIsBestseller, setEditIsBestseller] = useState(false);
  const [editIsStaffOnly, setEditIsStaffOnly] = useState(false);
  const [editModifierGroups, setEditModifierGroups] = useState<ModifierGroup[]>([]);

  // Staff Management State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Waiter' | 'Cashier' | 'Chef' | 'Manager'>('Waiter');

  const fetchStaffRoster = () => {
    getStaffRoster().then((list) => {
      if (list) setStaffMembers(list);
    });
  };

  useEffect(() => {
    fetchStaffRoster();
    getDetailedOdooReportData().then((res) => {
      if (res.statusLogs) {
        setStatusLogs(res.statusLogs);
      }
    });
  }, [activeTab]);

  const handleSyncClick = async () => {
    setIsSeeding(true);
    setSeedStatus('Syncing default menu catalog to PostgreSQL...');
    try {
      const res = await seedDatabaseMenu();
      setSeedStatus(res.message || 'Synced menu successfully');
      refreshPOSData();
    } catch (e: any) {
      setSeedStatus(`Error: ${e.message}`);
    } finally {
      setIsSeeding(false);
      setTimeout(() => setSeedStatus(null), 5000);
    }
  };

  const handleWipeClick = async () => {
    if (confirm('🚨 WIPE ALL TEST ORDERS & RESET DATABASE?\n\nThis will clear all orders, sessions, and payments!')) {
      setIsWiping(true);
      setSeedStatus('Wiping test data...');
      try {
        const res = await wipeAllDatabaseTestDataAction();
        setSeedStatus(res.message || 'Wiped test data successfully');
        refreshPOSData();
      } catch (e: any) {
        setSeedStatus(`Error: ${e.message}`);
      } finally {
        setIsWiping(false);
        setTimeout(() => setSeedStatus(null), 5000);
      }
    }
  };

  const getSessionDetails = (sess: TableSession) => {
    const primaryTbl = tables.find((t) => t.id === sess.primary_table_id);
    const primaryNum = primaryTbl?.table_number || 1;

    let mergedTblNums: number[] = [];
    if (sess.merged_table_ids) {
      let rawArr: string[] = [];
      if (Array.isArray(sess.merged_table_ids)) {
        rawArr = sess.merged_table_ids;
      } else if (typeof sess.merged_table_ids === 'string') {
        try {
          const formattedStr = (sess.merged_table_ids as string)
            .replace(/^{/, '[')
            .replace(/}$/, ']');
          rawArr = JSON.parse(formattedStr);
        } catch (e) {}
      }

      mergedTblNums = rawArr
        .map((tid) => tables.find((t) => t.id === tid)?.table_number)
        .filter((num): num is number => num !== undefined);
    }

    const allTableNums = [primaryNum, ...mergedTblNums].sort((a, b) => a - b);
    const isMerged = allTableNums.length > 1;
    const tableLabel = isMerged ? `Merged Tables #${allTableNums.join(' + #')}` : `Table #${primaryNum}`;

    const validSessionIds = [
      sess.id,
      ...(sess.merged_table_ids && Array.isArray(sess.merged_table_ids)
        ? sess.merged_table_ids
        : []),
    ];

    const sessItems = orderItems.filter(
      (i) => validSessionIds.includes(i.session_id || '') && i.status !== 'cancelled'
    );
    const sessDiscounts = discounts.filter((d) => validSessionIds.includes(d.session_id || ''));
    const sessPayments = payments.filter((p) => validSessionIds.includes(p.session_id || ''));

    const bill = calculateBillTotals(sessItems, sessDiscounts, sessPayments, 89500);

    return {
      primaryNum,
      mergedTblNums,
      allTableNums,
      isMerged,
      tableLabel,
      sessItems,
      sessDiscounts,
      sessPayments,
      bill,
    };
  };

  const filteredSessions = sessions.filter((sess) => {
    const details = getSessionDetails(sess);
    const invoiceRef = getInvoiceReference(details.primaryNum, sess.id).toLowerCase();
    const term = invoiceSearchTerm.toLowerCase().trim();

    if (sessionStatusFilter === 'active' && sess.status !== 'active') return false;
    if (sessionStatusFilter === 'closed' && sess.status !== 'closed') return false;

    if (sessionDiscountFilter === 'with_discount' && details.bill.discountUsd <= 0) return false;
    if (sessionDiscountFilter === 'no_discount' && details.bill.discountUsd > 0) return false;

    if (sessionDateFilter !== 'all') {
      const sessDate = new Date(sess.created_at);
      const now = new Date();
      if (sessionDateFilter === 'today' && sessDate.toDateString() !== now.toDateString()) return false;
      if (sessionDateFilter === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        if (sessDate.toDateString() !== yest.toDateString()) return false;
      }
      if (sessionDateFilter === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        if (sessDate < monthAgo) return false;
      }
    }

    if (!term) return true;

    const matchesRef = invoiceRef.includes(term) || sess.id.toLowerCase().includes(term);
    const matchesTable = details.tableLabel.toLowerCase().includes(term);
    const matchesItems = details.sessItems.some(
      (i) => i.item_name.toLowerCase().includes(term) || (i.guest_name && i.guest_name.toLowerCase().includes(term))
    );

    return matchesRef || matchesTable || matchesItems;
  });

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCatId(item.category_id);
    setEditPrice(String(item.price_usd));
    setEditPriceCamping(String(item.price_camping_usd ?? item.price_usd));
    setEditStation(item.station);
    setEditDesc(item.description || '');
    setEditImageUrl(item.image_url || '');
    setEditSortOrder(String(item.sort_order ?? 0));
    setEditIsBestseller(!!item.is_bestseller);
    setEditIsStaffOnly(!!item.is_staff_only);
    setEditModifierGroups(Array.isArray(item.modifier_groups) ? JSON.parse(JSON.stringify(item.modifier_groups)) : []);
  };

  const handleSaveFullEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum)) return alert('Invalid price');
    const priceCampingNum = parseFloat(editPriceCamping);

    await updateMenuItem(editingItem.id, {
      name: editName.trim(),
      categoryId: editCatId,
      priceUsd: priceNum,
      priceCampingUsd: !isNaN(priceCampingNum) ? priceCampingNum : priceNum,
      station: editStation,
      description: editDesc.trim(),
      imageUrl: editImageUrl.trim(),
      sortOrder: parseInt(editSortOrder, 10) || 0,
      isBestseller: editIsBestseller,
      isStaffOnly: editIsStaffOnly,
      modifierGroups: editModifierGroups,
    });

    setEditingItem(null);
    refreshPOSData();
  };

  const handleCreateMenuItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice || !newItemCatId) return;
    const priceNum = parseFloat(newItemPrice);
    if (isNaN(priceNum)) return alert('Invalid price');
    const priceCampingNum = parseFloat(newItemPriceCamping);

    await createMenuItem({
      name: newItemName.trim(),
      categoryId: newItemCatId,
      priceUsd: priceNum,
      priceCampingUsd: !isNaN(priceCampingNum) ? priceCampingNum : priceNum,
      station: newItemStation,
      description: newItemDesc.trim(),
      imageUrl: newItemImage.trim(),
      sortOrder: parseInt(newItemSortOrder, 10) || 0,
      isBestseller: newItemIsBestseller,
      isStaffOnly: newItemIsStaffOnly,
      modifierGroups: newItemModifierGroups,
    });

    setNewItemName('');
    setNewItemPrice('');
    setNewItemPriceCamping('');
    setNewItemDesc('');
    setNewItemImage('');
    setNewItemSortOrder('0');
    setNewItemIsBestseller(false);
    setNewItemIsStaffOnly(false);
    setNewItemModifierGroups([]);
    setIsAddItemModalOpen(false);
    refreshPOSData();
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || newStaffPin.length !== 4) return alert('Name & 4-digit PIN required');
    const res = await addStaffMember(newStaffName.trim(), newStaffPin.trim(), newStaffRole);
    if (res.success) {
      setNewStaffName('');
      setNewStaffPin('');
      fetchStaffRoster();
      refreshPOSData();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfa] p-4 sm:p-6 md:p-8 font-sans antialiased text-[#1c3a1e]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Navigation & DB Actions */}
        <AdminHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSeeding={isSeeding}
          isWiping={isWiping}
          seedStatus={seedStatus}
          handleSyncClick={handleSyncClick}
          handleWipeClick={handleWipeClick}
        />

        {/* TAB 1: MENU ITEMS MANAGER */}
        {activeTab === 'menu' && (
          <AdminMenuManager
            categories={categories}
            menuItems={menuItems}
            refreshPOSData={refreshPOSData}
            onOpenAddItemModal={() => {
              if (categories.length > 0) setNewItemCatId(categories[0].id);
              setIsAddItemModalOpen(true);
            }}
            onOpenEditModal={handleOpenEditModal}
          />
        )}

        {/* TAB 2: CATEGORIES MANAGER */}
        {activeTab === 'categories' && (
          <AdminCategoryManager
            categories={categories}
            menuItems={menuItems}
            refreshPOSData={refreshPOSData}
          />
        )}

        {/* TAB 3: GUESTS & CRM MANAGER */}
        {activeTab === 'crm' && (
          <AdminCRMManager />
        )}

        {/* TAB 4: INVENTORY & RECIPE BOM MANAGER */}
        {activeTab === 'inventory' && (
          <AdminInventoryManager />
        )}

        {/* TAB 4: LOYALTY & VIP REWARDS MANAGER */}
        {activeTab === 'loyalty' && (
          <AdminLoyaltyManager />
        )}

        {/* TAB 4: TABLES & QR CODES */}
        {activeTab === 'tables' && (
          <AdminTableManager tables={tables} refreshPOSData={refreshPOSData} />
        )}

        {/* TAB 4: STAFF MEMBERS */}
        {activeTab === 'staff' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-[#1c3a1e] mb-1">Staff Roster & PIN Codes</h2>
              <p className="text-xs text-gray-600 font-medium">
                Assign staff members individual PIN codes for login activity tracking
              </p>
            </div>

            <form
              onSubmit={handleAddStaffSubmit}
              className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 shadow-xs text-[#1c3a1e]"
            >
              <h3 className="text-sm font-extrabold text-[#1c3a1e] mb-4">Add New Staff Member</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Staff Name</label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Michel"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">4-Digit PIN Code</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    placeholder="e.g. 1004"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-mono font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Staff Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e: any) => setNewStaffRole(e.target.value)}
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  >
                    <option value="Waiter">Waiter</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Chef">Chef</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Save Staff Member</span>
              </button>
            </form>

            <div className="space-y-3">
              {staffMembers.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white border border-[#1c3a1e]/15 rounded-2xl p-4 flex items-center justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#1c3a1e]">{staff.name}</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                        {staff.role}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono block mt-0.5">PIN: ****{staff.pin.slice(-2)}</span>
                  </div>

                  <button
                    onClick={async () => {
                      if (confirm(`Remove staff member "${staff.name}"?`)) {
                        await deleteStaffMember(staff.id);
                        fetchStaffRoster();
                        refreshPOSData();
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: INVOICE TRACKER */}
        {activeTab === 'invoices' && (
          <OrderHistoryTracker
            filteredSessions={filteredSessions}
            getSessionDetails={getSessionDetails}
            invoiceSearchTerm={invoiceSearchTerm}
            setInvoiceSearchTerm={setInvoiceSearchTerm}
            sessionStatusFilter={sessionStatusFilter}
            setSessionStatusFilter={setSessionStatusFilter}
            sessionDiscountFilter={sessionDiscountFilter}
            setSessionDiscountFilter={setSessionDiscountFilter}
            sessionDateFilter={sessionDateFilter}
            setSessionDateFilter={setSessionDateFilter}
            onViewOrderDetails={(sess) => setSelectedOrderForDrawer(sess)}
          />
        )}

        {/* TAB 6: ODOO REPORTS */}
        {activeTab === 'reports' && (
          <OdooAnalyticsReports
            sessions={sessions}
            orderItems={orderItems}
            categories={categories}
            menuItems={menuItems}
            tables={tables}
            payments={payments}
            statusLogs={statusLogs}
            reportDateFilter={reportDateFilter}
            setReportDateFilter={setReportDateFilter}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            reportCategoryFilter={reportCategoryFilter}
            setReportCategoryFilter={setReportCategoryFilter}
            reportStationFilter={reportStationFilter}
            setReportStationFilter={setReportStationFilter}
            onViewOrderDetails={(sess) => setSelectedOrderForDrawer(sess)}
          />
        )}
      </div>

      {/* ORDER DETAILS DRAWER MODAL */}
      <OrderDetailsDrawer
        selectedOrderForDrawer={selectedOrderForDrawer}
        onClose={() => setSelectedOrderForDrawer(null)}
        tables={tables}
        menuItems={menuItems}
        statusLogs={statusLogs}
        getSessionDetails={getSessionDetails}
      />

      {/* FULL EDIT DISH MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-lg font-black text-[#1c3a1e]">Edit Menu Item & Variations</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-500 hover:text-black font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFullEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e] font-extrabold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={editCatId}
                  onChange={(e) => setEditCatId(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Dine-In Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Camping Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editPriceCamping}
                    onChange={(e) => setEditPriceCamping(e.target.value)}
                    placeholder={editPrice || '0.00'}
                    className="w-full bg-emerald-50/50 border border-emerald-600/30 rounded-xl p-3 text-xs text-emerald-900 font-black focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Sort Order #</label>
                  <input
                    type="number"
                    step="1"
                    value={editSortOrder}
                    onChange={(e) => setEditSortOrder(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kitchen Station Routing</label>
                <select
                  value={editStation}
                  onChange={(e: any) => setEditStation(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                >
                  <option value="mezza">Mezza (Hot/Cold & Salads)</option>
                  <option value="sajj">Sajj Station</option>
                  <option value="grill">BBQ (Grill)</option>
                  <option value="subs_sandwiches">Subs, Sandwiches & Kids Meals</option>
                  <option value="bar">Bar & Refreshments</option>
                  <option value="shisha">Shisha Lounge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Item Image (Upload File or Paste Google Drive / Web Link)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEditImageUrl(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs text-[#1c3a1e] font-bold file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#1c3a1e] file:text-white hover:file:bg-[#d4af37] hover:file:text-[#1c3a1e] file:cursor-pointer cursor-pointer"
                    />
                  </div>

                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="Or paste https://drive.google.com/... or web image link"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                  />

                  {editImageUrl && (
                    <div className="flex items-center gap-3 pt-1 bg-emerald-50/60 p-2 rounded-xl border border-emerald-500/20">
                      <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-emerald-500/30 shrink-0 bg-white">
                        <Image src={transformGoogleDriveUrl(editImageUrl)} alt="Preview" fill unoptimized className="h-full w-full object-cover" />
                      </div>
                      <span className="text-[11px] font-extrabold text-emerald-950">✅ Image Linked & Ready</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsBestseller"
                    checked={editIsBestseller}
                    onChange={(e) => setEditIsBestseller(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#d4af37] bg-[#fafbfa] border-[#1c3a1e]/20 cursor-pointer"
                  />
                  <label
                    htmlFor="editIsBestseller"
                    className="text-xs font-black text-[#1c3a1e] cursor-pointer flex items-center gap-1"
                  >
                    ⭐ Mark as Speciality / Chef's Special (Displays gold badge on menu)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsStaffOnly"
                    checked={editIsStaffOnly}
                    onChange={(e) => setEditIsStaffOnly(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1c3a1e] bg-[#fafbfa] border-[#1c3a1e]/20 cursor-pointer"
                  />
                  <label htmlFor="editIsStaffOnly" className="text-xs font-extrabold text-purple-900 cursor-pointer">
                    🔒 Waiter / Staff-Only Item (Hidden from Customer QR menu)
                  </label>
                </div>
              </div>

              {/* VARIATIONS & MODIFIER GROUPS EDITOR */}
              <ModifierGroupsEditor groups={editModifierGroups} setGroups={setEditModifierGroups} />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3.5 rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs shadow-xs transition-all cursor-pointer"
                >
                  Save Dish Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DISH MODAL */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-lg font-black text-[#1c3a1e]">Add New Skylight Menu Item</h3>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="text-gray-500 hover:text-black font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMenuItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={newItemCatId}
                  onChange={(e) => setNewItemCatId(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Labneh b Toum"
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Dine-In Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Camping Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemPriceCamping}
                    onChange={(e) => setNewItemPriceCamping(e.target.value)}
                    placeholder={newItemPrice || '0.00'}
                    className="w-full bg-emerald-50/50 border border-emerald-600/30 rounded-xl p-3 text-xs text-emerald-900 font-black focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Sort Order #</label>
                  <input
                    type="number"
                    step="1"
                    value={newItemSortOrder}
                    onChange={(e) => setNewItemSortOrder(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-black focus:outline-none focus:border-[#1c3a1e]"
                  />
                </div>
              </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kitchen Station</label>
                  <select
                    value={newItemStation}
                    onChange={(e: any) => setNewItemStation(e.target.value)}
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  >
                    <option value="mezza">Mezza (Hot/Cold & Salads)</option>
                    <option value="sajj">Sajj Station</option>
                    <option value="grill">BBQ (Grill)</option>
                    <option value="subs_sandwiches">Subs, Sandwiches & Kids Meals</option>
                    <option value="bar">Bar & Refreshments</option>
                    <option value="shisha">Shisha Lounge</option>
                  </select>
                </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Short description..."
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Item Image (Upload File or Paste Google Drive / Web Link)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setNewItemImage(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs text-[#1c3a1e] font-bold file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#1c3a1e] file:text-white hover:file:bg-[#d4af37] hover:file:text-[#1c3a1e] file:cursor-pointer cursor-pointer"
                    />
                  </div>

                  <input
                    type="text"
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(e.target.value)}
                    placeholder="Or paste https://drive.google.com/... or web image link"
                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                  />

                  {newItemImage && (
                    <div className="flex items-center gap-3 pt-1 bg-emerald-50/60 p-2 rounded-xl border border-emerald-500/20">
                      <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-emerald-500/30 shrink-0 bg-white">
                        <Image src={transformGoogleDriveUrl(newItemImage)} alt="Preview" fill unoptimized className="h-full w-full object-cover" />
                      </div>
                      <span className="text-[11px] font-extrabold text-emerald-950">✅ Image Linked & Ready</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newItemIsBestseller"
                    checked={newItemIsBestseller}
                    onChange={(e) => setNewItemIsBestseller(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#d4af37] bg-[#fafbfa] border-[#1c3a1e]/20 cursor-pointer"
                  />
                  <label
                    htmlFor="newItemIsBestseller"
                    className="text-xs font-black text-[#1c3a1e] cursor-pointer flex items-center gap-1"
                  >
                    ⭐ Mark as Speciality / Chef's Special (Displays gold badge on menu)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newItemIsStaffOnly"
                    checked={newItemIsStaffOnly}
                    onChange={(e) => setNewItemIsStaffOnly(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1c3a1e] bg-[#fafbfa] border-[#1c3a1e]/20 cursor-pointer"
                  />
                  <label htmlFor="newItemIsStaffOnly" className="text-xs font-extrabold text-purple-900 cursor-pointer">
                    🔒 Waiter / Staff-Only Item (Hidden from Customer QR menu)
                  </label>
                </div>
              </div>

              {/* VARIATIONS & MODIFIER GROUPS EDITOR */}
              <ModifierGroupsEditor groups={newItemModifierGroups} setGroups={setNewItemModifierGroups} />

              <button
                type="submit"
                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs shadow-xs transition-all cursor-pointer mt-4"
              >
                Create Menu Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ModifierGroupsEditor({
  groups,
  setGroups,
}: {
  groups: ModifierGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ModifierGroup[]>>;
}) {
  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      { group_name: 'Choice / Option Group', required: false, options: [{ name: 'Option 1', price_extra_usd: 0 }] },
    ]);
  };

  const removeGroup = (gIdx: number) => {
    setGroups((prev) => prev.filter((_, idx) => idx !== gIdx));
  };

  const updateGroupName = (gIdx: number, val: string) => {
    setGroups((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[gIdx].group_name = val;
      return copy;
    });
  };

  const toggleGroupRequired = (gIdx: number) => {
    setGroups((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[gIdx].required = !copy[gIdx].required;
      return copy;
    });
  };

  const addOption = (gIdx: number) => {
    setGroups((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[gIdx].options.push({ name: '', price_extra_usd: 0 });
      return copy;
    });
  };

  const removeOption = (gIdx: number, oIdx: number) => {
    setGroups((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[gIdx].options = copy[gIdx].options.filter((_: any, idx: number) => idx !== oIdx);
      return copy;
    });
  };

  const updateOption = (gIdx: number, oIdx: number, field: 'name' | 'price_extra_usd', val: any) => {
    setGroups((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[gIdx].options[oIdx][field] = val;
      return copy;
    });
  };

  return (
    <div className="space-y-4 border-t border-[#1c3a1e]/15 pt-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <label className="block text-xs font-black text-[#1c3a1e] uppercase tracking-wider">
            🎨 Dish Variations & Extra Options (Modifiers)
          </label>
          <p className="text-[11px] text-gray-500 font-medium">
            Add custom options like size, doneness, extra cheese, or sauce
          </p>
        </div>
        <button
          type="button"
          onClick={addGroup}
          className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ Add Group</span>
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-[#fafbfa] border border-dashed border-[#1c3a1e]/20 rounded-2xl p-4 text-center text-xs text-gray-500 font-bold">
          No variation options configured for this dish. Tap "+ Add Group" to add choices.
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={group.group_name}
                  onChange={(e) => updateGroupName(gIdx, e.target.value)}
                  placeholder="Group Name (e.g. Size, Extra Toppings)"
                  className="bg-white border border-[#1c3a1e]/20 rounded-xl px-3 py-1.5 text-xs font-black text-[#1c3a1e] w-full focus:outline-none focus:border-[#1c3a1e]"
                />
                <label className="flex items-center gap-1 text-[11px] font-extrabold shrink-0 text-[#1c3a1e] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={group.required}
                    onChange={() => toggleGroupRequired(gIdx)}
                    className="h-3.5 w-3.5 accent-[#1c3a1e]"
                  />
                  <span>Required</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeGroup(gIdx)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-lg shrink-0 transition-colors cursor-pointer"
                  title="Remove Group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Options List */}
              <div className="space-y-1.5 pl-2 border-l-2 border-[#1c3a1e]/20 pt-1">
                {group.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(gIdx, oIdx, 'name', e.target.value)}
                      placeholder="Choice Name (e.g. Large, Extra Cheese)"
                      className="bg-white border border-[#1c3a1e]/15 rounded-lg px-2.5 py-1 text-xs text-[#1c3a1e] font-bold w-full focus:outline-none"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-black text-gray-500">$+</span>
                      <input
                        type="number"
                        step="0.25"
                        value={opt.price_extra_usd}
                        onChange={(e) => updateOption(gIdx, oIdx, 'price_extra_usd', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-white border border-[#1c3a1e]/15 rounded-lg px-2 py-1 text-xs font-black text-[#1c3a1e] w-20 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(gIdx, oIdx)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded-lg shrink-0 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addOption(gIdx)}
                  className="text-[11px] font-extrabold text-[#1c3a1e] hover:text-[#d4af37] pt-1 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Option Choice</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
