'use client';

import { useState, useEffect } from 'react';
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
import { getPOSData } from '@/app/actions/payment-actions';

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
  const [posData, setPosData] = useState<any>({ payments: [], orderItems: [], discounts: [] });

  useEffect(() => {
    const fetchData = async () => {
      const logs = await getStaffActivityLogs();
      setActivityLogs(logs);
      const data = await getPOSData();
      setPosData(data);
    };
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const allPayments = posData.payments || [];
  const allOrderItems = (posData.orderItems || []).filter((i: any) => i.status !== 'cancelled');
  const allDiscounts = posData.discounts || [];

  const totalGrossSalesUsd = allOrderItems.reduce((acc: number, item: any) => {
    if (item.is_comped) return acc;
    const modifierExtra = (item.selected_modifiers || []).reduce(
      (mAcc: number, mod: any) => mAcc + (mod.price_extra || 0),
      0
    );
    return acc + (Number(item.unit_price_usd) + modifierExtra) * item.quantity;
  }, 0);

  const totalDiscountsUsd = allDiscounts.reduce((acc: number, d: any) => {
    if (d.type === 'fixed') return acc + Number(d.value);
    if (d.type === 'percentage') return acc + totalGrossSalesUsd * (Number(d.value) / 100);
    return acc;
  }, 0);

  const totalNetSalesUsd = Math.max(0, totalGrossSalesUsd - totalDiscountsUsd);

  // Payments breakdown
  const usdCashCollected = allPayments
    .filter((p: any) => p.payment_method === 'cash' && p.currency === 'USD')
    .reduce((acc: number, p: any) => acc + Number(p.amount_usd), 0);

  const lbpCashCollectedUsd = allPayments
    .filter((p: any) => p.payment_method === 'cash' && p.currency === 'LBP')
    .reduce((acc: number, p: any) => acc + Number(p.amount_usd), 0);

  const cardCollectedUsd = allPayments
    .filter((p: any) => p.payment_method === 'card')
    .reduce((acc: number, p: any) => acc + Number(p.amount_usd), 0);

  // Station Volume Breakdown
  const stationVolume = {
    mezza: allOrderItems
      .filter((i: any) => i.station === 'mezza')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
    sajj: allOrderItems
      .filter((i: any) => i.station === 'sajj')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
    grill: allOrderItems
      .filter((i: any) => i.station === 'grill')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
    subs_sandwiches: allOrderItems
      .filter((i: any) => i.station === 'subs_sandwiches')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
    bar: allOrderItems
      .filter((i: any) => i.station === 'bar')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
    shisha: allOrderItems
      .filter((i: any) => i.station === 'shisha')
      .reduce((acc: number, i: any) => acc + Number(i.quantity), 0),
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#fafbfa] text-[#1c271c] p-4 md:p-8">
      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center pb-6 mb-8 border-b border-[#1c3a1e]/15">
        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="bg-white border border-[#1c3a1e]/15 p-2.5 rounded-xl text-[#1c3a1e] hover:bg-[#eaf2eb] transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-12 w-12 rounded-2xl bg-[#eaf2eb] border border-[#1c3a1e]/20 flex items-center justify-center text-[#1c3a1e]">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1c3a1e] tracking-tight">End-of-Day Z-Report</h1>
            <p className="text-xs text-gray-600 font-medium">Daily Shift Revenue & Staff Audit Activity Logs &bull; {reportDate}</p>
          </div>
        </div>

        <button
          onClick={handlePrintReport}
          className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all print:hidden cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Print Shift Report</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto w-full space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Gross Sales
            </span>
            <div className="text-3xl font-black text-[#1c3a1e] mb-1">{formatUsd(totalGrossSalesUsd)}</div>
            <div className="text-xs text-[#d4af37] font-bold">
              {formatLbp(totalGrossSalesUsd, 89500)}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Total Discounts & Comps
            </span>
            <div className="text-3xl font-black text-emerald-700 mb-1">-{formatUsd(totalDiscountsUsd)}</div>
            <div className="text-xs text-gray-500 font-medium">
              {allDiscounts.length} discount(s) applied
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Net Revenue
            </span>
            <div className="text-3xl font-black text-[#1c3a1e] mb-1">{formatUsd(totalNetSalesUsd)}</div>
            <div className="text-xs text-gray-600 font-semibold">
              {formatLbp(totalNetSalesUsd, 89500)}
            </div>
          </div>
        </div>

        {/* Payments Tender Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
          <h3 className="text-lg font-bold text-[#1c3a1e] mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <span>Tender & Cash Drawer Breakdown</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10">
              <span className="text-xs text-gray-500 font-semibold block mb-1">USD Cash Collected</span>
              <div className="text-xl font-bold text-[#1c3a1e]">{formatUsd(usdCashCollected)}</div>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10">
              <span className="text-xs text-gray-500 font-semibold block mb-1">Credit Card Payments</span>
              <div className="text-xl font-bold text-blue-700">{formatUsd(cardCollectedUsd)}</div>
            </div>
          </div>
        </div>



        {/* KITCHEN STATIONS VOLUME BREAKDOWN */}
        <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
          <h3 className="text-lg font-bold text-[#1c3a1e] mb-4 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-[#d4af37]" />
            <span>Station Sales Volume</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Utensils className="h-5 w-5 mx-auto mb-2 text-[#1c3a1e]" />
              <span className="text-xs text-gray-500 font-medium block">Mezza</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.mezza} items</span>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-amber-600" />
              <span className="text-xs text-gray-500 font-medium block">Sajj</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.sajj} items</span>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-red-600" />
              <span className="text-xs text-gray-500 font-medium block">BBQ</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.grill} items</span>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Utensils className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
              <span className="text-xs text-gray-500 font-medium block">Subs & Sandwiches</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.subs_sandwiches} items</span>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Wine className="h-5 w-5 mx-auto mb-2 text-blue-600" />
              <span className="text-xs text-gray-500 font-medium block">Bar & Drinks</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.bar} items</span>
            </div>

            <div className="bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/10 text-center">
              <Flame className="h-5 w-5 mx-auto mb-2 text-purple-600" />
              <span className="text-xs text-gray-500 font-medium block">Shisha</span>
              <span className="text-base font-bold text-[#1c3a1e]">{stationVolume.shisha} items</span>
            </div>
          </div>
        </div>

        {/* STAFF AUDIT ACTIVITY TRAIL */}
        <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 shadow-sm">
          <h3 className="text-lg font-bold text-[#1c3a1e] mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1c3a1e]" />
              <span>Realtime Staff Activity Audit Trail</span>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {activityLogs.length} Logged Events
            </span>
          </h3>

          {activityLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs font-semibold">
              No staff activity recorded yet today.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#fafbfa] border border-[#1c3a1e]/10 rounded-2xl p-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-[#eaf2eb] border border-[#1c3a1e]/20 text-[#1c3a1e] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#1c3a1e]">
                          {log.staff_name}
                        </span>
                        <span className="text-[10px] bg-white text-[#1c3a1e] px-2 py-0.5 rounded-md font-bold uppercase border border-[#1c3a1e]/15">
                          {log.staff_role}
                        </span>
                        {log.table_number && (
                          <span className="text-[10px] bg-[#eaf2eb] text-[#1c3a1e] px-2 py-0.5 rounded-md font-black">
                            Table #{log.table_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-medium mt-0.5">{log.details}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono self-end sm:self-auto">
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
