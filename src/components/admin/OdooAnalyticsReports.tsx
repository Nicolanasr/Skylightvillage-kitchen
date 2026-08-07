'use client';

import React from 'react';
import { TableSession, OrderItem, MenuCategory, MenuItem } from '@/lib/types';
import { StatusLogEntry } from '@/app/actions/report-actions';
import { calculateBillTotals, getInvoiceReference } from '@/lib/currency';
import {
  BarChart3,
  DollarSign,
  Utensils,
  Receipt,
  TrendingUp,
  Clock,
  Zap,
  Award,
  Eye,
} from 'lucide-react';

interface OdooAnalyticsReportsProps {
  sessions: TableSession[];
  orderItems: OrderItem[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  tables: any[];
  payments: any[];
  statusLogs: StatusLogEntry[];
  reportDateFilter: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  setReportDateFilter: (filter: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom') => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;
  reportCategoryFilter: string;
  setReportCategoryFilter: (cat: string) => void;
  reportStationFilter: string;
  setReportStationFilter: (st: string) => void;
  onViewOrderDetails: (sess: TableSession) => void;
}

export const OdooAnalyticsReports: React.FC<OdooAnalyticsReportsProps> = ({
  sessions,
  orderItems,
  categories,
  menuItems,
  tables,
  payments,
  statusLogs,
  reportDateFilter,
  setReportDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  reportCategoryFilter,
  setReportCategoryFilter,
  reportStationFilter,
  setReportStationFilter,
  onViewOrderDetails,
}) => {
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    const now = new Date();

    if (reportDateFilter === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (reportDateFilter === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      return itemDate.toDateString() === yest.toDateString();
    }
    if (reportDateFilter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return itemDate >= weekAgo;
    }
    if (reportDateFilter === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      return itemDate >= monthAgo;
    }
    if (reportDateFilter === 'custom') {
      if (customStartDate && itemDate < new Date(customStartDate)) return false;
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
      return true;
    }
    return true;
  };

  const filteredReportItems = orderItems.filter((i) => {
    if (i.status === 'cancelled') return false;
    if (!isDateInRange(i.created_at)) return false;
    if (reportCategoryFilter !== 'all') {
      const menuObj = menuItems.find((m) => m.id === i.menu_item_id);
      if (!menuObj || menuObj.category_id !== reportCategoryFilter) return false;
    }
    if (reportStationFilter !== 'all' && i.station !== reportStationFilter) return false;
    return true;
  });

  const filteredReportSessions = sessions.filter((sess) => {
    if (!isDateInRange(sess.created_at)) return false;
    const sessItems = orderItems.filter((i) => i.session_id === sess.id && i.status !== 'cancelled');
    if (sessItems.length === 0) return false;
    if (reportCategoryFilter !== 'all' || reportStationFilter !== 'all') {
      return sessItems.some((i) => filteredReportItems.some((f) => f.id === i.id));
    }
    return true;
  });

  const totalGrossRevenueUsd = filteredReportItems.reduce(
    (sum, i) => sum + (i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity),
    0
  );
  const totalItemsSold = filteredReportItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalOrdersCount = filteredReportSessions.length;
  const avgOrderValueUsd = totalOrdersCount > 0 ? totalGrossRevenueUsd / totalOrdersCount : 0;

  const statusLogsFiltered = statusLogs.filter((l) => isDateInRange(l.created_at));
  const prepLogs = statusLogsFiltered.filter((l) => l.to_status === 'preparing' || l.to_status === 'ready');
  const totalPrepSeconds = prepLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const avgPrepMinutes = prepLogs.length > 0 ? (totalPrepSeconds / prepLogs.length / 60).toFixed(1) : '0.0';

  const deliveryLogs = statusLogsFiltered.filter((l) => l.to_status === 'delivered');
  const totalDeliverySeconds = deliveryLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const avgDeliveryMinutes = deliveryLogs.length > 0 ? (totalDeliverySeconds / deliveryLogs.length / 60).toFixed(1) : '0.0';

  // Product Sales Table Map
  const itemSalesMap = new Map<
    string,
    {
      name: string;
      categoryName: string;
      station: string;
      qtySold: number;
      revenueUsd: number;
      avgPriceUsd: number;
    }
  >();

  filteredReportItems.forEach((i) => {
    const key = i.item_name;
    const lineRevenue = i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity;
    const menuObj = menuItems.find((m) => m.id === i.menu_item_id);
    const catObj = categories.find((c) => c.id === menuObj?.category_id);
    const categoryName = catObj?.name || 'General';

    if (itemSalesMap.has(key)) {
      const existing = itemSalesMap.get(key)!;
      existing.qtySold += i.quantity;
      existing.revenueUsd += lineRevenue;
    } else {
      itemSalesMap.set(key, {
        name: i.item_name,
        categoryName,
        station: i.station,
        qtySold: i.quantity,
        revenueUsd: lineRevenue,
        avgPriceUsd: Number(i.unit_price_usd),
      });
    }
  });

  const productSalesList = Array.from(itemSalesMap.values()).sort((a, b) => b.revenueUsd - a.revenueUsd);

  return (
    <div className="space-y-6">
      {/* Odoo Filter Control Bar */}
      <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs text-[#1c3a1e] space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-[#1c3a1e] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#d4af37]" />
              <span>Odoo Advanced Analytics & Multi-Filter Reports</span>
            </h2>
            <p className="text-xs text-gray-600 font-semibold mt-0.5">
              Filter sales, item volumes, station prep durations, and order timelines
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Date' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setReportDateFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  reportDateFilter === f.id
                    ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                    : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/15'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[#1c3a1e]/15">
          {reportDateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">Filter by Category</label>
            <select
              value={reportCategoryFilter}
              onChange={(e) => setReportCategoryFilter(e.target.value)}
              className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-2 text-xs font-extrabold"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">Filter by Station</label>
            <select
              value={reportStationFilter}
              onChange={(e) => setReportStationFilter(e.target.value)}
              className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-2 text-xs font-extrabold"
            >
              <option value="all">All Stations</option>
              <option value="mezza">Cold & Hot Mezza</option>
              <option value="grill">BBQ Grill</option>
              <option value="sajj">Sajj Bakery</option>
              <option value="subs_sandwiches">Sandwiches</option>
              <option value="bar">Bar & Drinks</option>
              <option value="shisha">Shisha Hub</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <DollarSign className="h-5 w-5 text-emerald-700 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Gross Revenue</span>
          <span className="text-lg font-black text-[#1c3a1e]">${totalGrossRevenueUsd.toFixed(2)}</span>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <Utensils className="h-5 w-5 text-blue-700 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Dish Volume</span>
          <span className="text-lg font-black text-[#1c3a1e]">{totalItemsSold} Sold</span>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <Receipt className="h-5 w-5 text-purple-700 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Total Orders</span>
          <span className="text-lg font-black text-[#1c3a1e]">{totalOrdersCount} Sessions</span>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <TrendingUp className="h-5 w-5 text-amber-600 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Avg Check / Order</span>
          <span className="text-lg font-black text-[#1c3a1e]">${avgOrderValueUsd.toFixed(2)}</span>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Avg Kitchen Prep</span>
          <span className="text-lg font-black text-[#1c3a1e]">{avgPrepMinutes} mins</span>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 text-center shadow-xs">
          <Zap className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Avg Waiter Delivery</span>
          <span className="text-lg font-black text-[#1c3a1e]">{avgDeliveryMinutes} mins</span>
        </div>
      </div>

      {/* Product Sales Breakdown Table */}
      <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 shadow-xs text-[#1c3a1e]">
        <h3 className="text-base font-black text-[#1c3a1e] mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-[#d4af37]" />
          <span>Product Sales Breakdown & Dish Performance</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c3a1e]/15 text-[11px] font-black uppercase text-gray-600">
                <th className="py-2.5 px-3">Dish / Item Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3 text-center">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Avg Price</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
                <th className="py-2.5 px-3 text-right">% Revenue Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold">
              {productSalesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No sales items match the selected report filter.
                  </td>
                </tr>
              ) : (
                productSalesList.map((prod, idx) => {
                  const share =
                    totalGrossRevenueUsd > 0 ? ((prod.revenueUsd / totalGrossRevenueUsd) * 100).toFixed(1) : '0';
                  return (
                    <tr key={idx} className="hover:bg-[#fafbfa] transition-colors">
                      <td className="py-2.5 px-3 font-extrabold text-[#1c3a1e]">{prod.name}</td>
                      <td className="py-2.5 px-3 text-gray-700">{prod.categoryName}</td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-gray-600 font-bold">{prod.station}</td>
                      <td className="py-2.5 px-3 text-center font-black">{prod.qtySold}</td>
                      <td className="py-2.5 px-3 text-right">${prod.avgPriceUsd.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-800">${prod.revenueUsd.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-purple-900">{share}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtered Orders History List */}
      <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-6 shadow-xs text-[#1c3a1e]">
        <h3 className="text-base font-black text-[#1c3a1e] mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#1c3a1e]" />
          <span>Filtered Orders History List ({filteredReportSessions.length})</span>
        </h3>

        <div className="space-y-3">
          {filteredReportSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-semibold text-xs">
              No order sessions match the selected date / category / station filters.
            </div>
          ) : (
            filteredReportSessions.map((sess) => {
              const primaryTbl = tables.find((t) => t.id === sess.primary_table_id);
              const tblNum = primaryTbl?.table_number || 1;
              const sessItems = orderItems.filter((i) => i.session_id === sess.id && i.status !== 'cancelled');
              const sessPayments = payments.filter((p) => p.session_id === sess.id);
              const bill = calculateBillTotals(sessItems, [], sessPayments, 89500);
              const invoiceRef = getInvoiceReference(tblNum, sess.id);

              return (
                <div
                  key={sess.id}
                  className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-[#1c3a1e] transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#1c3a1e] text-sm">{invoiceRef}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                          sess.status === 'closed'
                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                        }`}
                      >
                        {sess.status === 'closed' ? 'CLOSED (PAID)' : 'ACTIVE TABLE SESSION'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 font-medium mt-1">
                      Table #{tblNum} • {new Date(sess.created_at).toLocaleString('en-GB')} •{' '}
                      <strong className="text-[#1c3a1e]">{sessItems.length} Dishes</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-black text-[#1c3a1e] block">${bill.finalTotalUsd.toFixed(2)}</span>
                      <span className="text-[10.5px] font-bold text-emerald-800">Paid: ${bill.paidUsd.toFixed(2)}</span>
                    </div>

                    <button
                      onClick={() => onViewOrderDetails(sess)}
                      className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
