'use client';

import { useState, useEffect } from 'react';
import { dbStore } from '@/lib/db';
import { formatLbp, formatUsd } from '@/lib/currency';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { getStaffActivityLogs } from '@/app/actions/audit-actions';
import { ActivityLog } from '@/lib/types';
import {
  FileSpreadsheet,
  Printer,
  DollarSign,
  CreditCard,
  Percent,
  Utensils,
  Flame,
  Wine,
  ChefHat,
  ArrowLeft,
  ShieldCheck,
  User,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export default function ZReportPage() {
  return (
    <StaffAuthGuard pageTitle="End-of-Day Z-Report & Audit Trail">
      <ZReportContent />
    </StaffAuthGuard>
  );
}

function ZReportContent() {
  const [reportDate] = useState<string>(new Date().toLocaleDateString());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await getStaffActivityLogs();
      setActivityLogs(logs);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate metrics from dbStore
  const allPayments = dbStore.payments;
  const allOrderItems = dbStore.orderItems.filter((i) => i.status !== 'cancelled');
  const allDiscounts = dbStore.discounts;

  const totalGrossSalesUsd = allOrderItems.reduce((acc, item) => {
    if (item.is_comped) return acc;
    const modifierExtra = (item.selected_modifiers || []).reduce(
      (mAcc, mod) => mAcc + (mod.price_extra || 0),
      0
    );
    return acc + (item.unit_price_usd + modifierExtra) * item.quantity;
  }, 0);

  const totalDiscountsUsd = allDiscounts.reduce((acc, d) => {
    if (d.type === 'fixed') return acc + Number(d.value);
    if (d.type === 'percentage') return acc + totalGrossSalesUsd * (Number(d.value) / 100);
    return acc;
  }, 0);

  const totalNetSalesUsd = Math.max(0, totalGrossSalesUsd - totalDiscountsUsd);

  // Payments breakdown
  const usdCashCollected = allPayments
    .filter((p) => p.payment_method === 'cash' && p.currency === 'USD')
    .reduce((acc, p) => acc + Number(p.amount_usd), 0);

  const lbpCashCollectedUsd = allPayments
    .filter((p) => p.payment_method === 'cash' && p.currency === 'LBP')
    .reduce((acc, p) => acc + Number(p.amount_usd), 0);

  const cardCollectedUsd = allPayments
    .filter((p) => p.payment_method === 'card')
    .reduce((acc, p) => acc + Number(p.amount_usd), 0);

  // Station Volume Breakdown
  const stationVolume = {
    cold_mezza: allOrderItems
      .filter((i) => i.station === 'cold_mezza')
      .reduce((acc, i) => acc + i.quantity, 0),
    hot_mezza: allOrderItems
      .filter((i) => i.station === 'hot_mezza')
      .reduce((acc, i) => acc + i.quantity, 0),
    grill: allOrderItems
      .filter((i) => i.station === 'grill')
      .reduce((acc, i) => acc + i.quantity, 0),
    bar: allOrderItems
      .filter((i) => i.station === 'bar')
      .reduce((acc, i) => acc + i.quantity, 0),
    shisha: allOrderItems
      .filter((i) => i.station === 'shisha')
      .reduce((acc, i) => acc + i.quantity, 0),
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">End-of-Day Z-Report</h1>
            <p className="text-xs text-slate-400 font-medium">Daily Shift Revenue & Staff Audit Activity Logs &bull; {reportDate}</p>
          </div>
        </div>

        <button
          onClick={handlePrintReport}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all print:hidden"
        >
          <Printer className="h-4 w-4" />
          <span>Print Shift Report</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto w-full space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Gross Sales
            </span>
            <div className="text-3xl font-black text-slate-100 mb-1">{formatUsd(totalGrossSalesUsd)}</div>
            <div className="text-xs text-amber-400 font-semibold">
              {formatLbp(totalGrossSalesUsd, dbStore.exchangeRate)}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Total Discounts & Comps
            </span>
            <div className="text-3xl font-black text-emerald-400 mb-1">-{formatUsd(totalDiscountsUsd)}</div>
            <div className="text-xs text-slate-500 font-medium">
              {allDiscounts.length} discount(s) applied
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Net Revenue
            </span>
            <div className="text-3xl font-black text-amber-400 mb-1">{formatUsd(totalNetSalesUsd)}</div>
            <div className="text-xs text-amber-300 font-semibold">
              {formatLbp(totalNetSalesUsd, dbStore.exchangeRate)}
            </div>
          </div>
        </div>

        {/* Payments Tender Breakdown */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800">
          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <span>Tender & Cash Drawer Breakdown</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block mb-1">USD Cash Collected</span>
              <div className="text-xl font-bold text-slate-100">{formatUsd(usdCashCollected)}</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block mb-1">LBP Cash Collected</span>
              <div className="text-xl font-bold text-amber-400">{formatUsd(lbpCashCollectedUsd)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {formatLbp(lbpCashCollectedUsd, dbStore.exchangeRate)}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block mb-1">Credit Card Payments</span>
              <div className="text-xl font-bold text-blue-400">{formatUsd(cardCollectedUsd)}</div>
            </div>
          </div>
        </div>

        {/* Station Sales Volume */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800">
          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-400" />
            <span>Station Sales Volume</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <Utensils className="h-5 w-5 mx-auto mb-2 text-amber-400" />
              <span className="text-xs text-slate-400 font-medium block">Cold Mezza</span>
              <span className="text-lg font-bold text-slate-100">{stationVolume.cold_mezza} items</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-orange-400" />
              <span className="text-xs text-slate-400 font-medium block">Hot Mezza</span>
              <span className="text-lg font-bold text-slate-100">{stationVolume.hot_mezza} items</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-red-400" />
              <span className="text-xs text-slate-400 font-medium block">Grill</span>
              <span className="text-lg font-bold text-slate-100">{stationVolume.grill} items</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <Wine className="h-5 w-5 mx-auto mb-2 text-blue-400" />
              <span className="text-xs text-slate-400 font-medium block">Bar</span>
              <span className="text-lg font-bold text-slate-100">{stationVolume.bar} items</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-purple-400" />
              <span className="text-xs text-slate-400 font-medium block">Shisha</span>
              <span className="text-lg font-bold text-slate-100">{stationVolume.shisha} items</span>
            </div>
          </div>
        </div>

        {/* STAFF AUDIT ACTIVITY TRAIL */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800">
          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <span>Realtime Staff Activity Audit Trail</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {activityLogs.length} Logged Events
            </span>
          </h3>

          {activityLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-semibold">
              No staff activity recorded yet today.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-100">
                          {log.staff_name}
                        </span>
                        <span className="text-[10px] bg-slate-900 text-amber-400 px-2 py-0.5 rounded-md font-bold uppercase border border-slate-800">
                          {log.staff_role}
                        </span>
                        {log.table_number && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-black">
                            Table #{log.table_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{log.details}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono self-end sm:self-auto">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
