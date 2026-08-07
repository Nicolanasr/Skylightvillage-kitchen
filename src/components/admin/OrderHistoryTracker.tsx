'use client';

import React from 'react';
import { TableSession } from '@/lib/types';
import { getInvoiceReference } from '@/lib/currency';
import { Search, Receipt, Eye } from 'lucide-react';

interface OrderHistoryTrackerProps {
  filteredSessions: TableSession[];
  getSessionDetails: (sess: TableSession) => any;
  invoiceSearchTerm: string;
  setInvoiceSearchTerm: (term: string) => void;
  sessionStatusFilter: 'all' | 'active' | 'closed';
  setSessionStatusFilter: (filter: 'all' | 'active' | 'closed') => void;
  sessionDiscountFilter: 'all' | 'with_discount' | 'no_discount';
  setSessionDiscountFilter: (filter: 'all' | 'with_discount' | 'no_discount') => void;
  sessionDateFilter: 'all' | 'today' | 'yesterday' | 'month';
  setSessionDateFilter: (filter: 'all' | 'today' | 'yesterday' | 'month') => void;
  onViewOrderDetails: (sess: TableSession) => void;
}

export const OrderHistoryTracker: React.FC<OrderHistoryTrackerProps> = ({
  filteredSessions,
  getSessionDetails,
  invoiceSearchTerm,
  setInvoiceSearchTerm,
  sessionStatusFilter,
  setSessionStatusFilter,
  sessionDiscountFilter,
  setSessionDiscountFilter,
  sessionDateFilter,
  setSessionDateFilter,
  onViewOrderDetails,
}) => {
  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#1c3a1e]">Invoice & Session Reference Tracker</h2>
          <p className="text-xs text-gray-600 font-medium mt-0.5">
            Track invoice reference IDs, database session UUIDs, order items & payments
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={invoiceSearchTerm}
            onChange={(e) => setInvoiceSearchTerm(e.target.value)}
            placeholder="Search Invoice Ref, Dish Name, Guest or Table #..."
            className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e] shadow-xs"
          />
        </div>
      </div>

      {/* Multi-Filter Controls */}
      <div className="bg-white border border-[#1c3a1e]/15 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-black text-gray-700 uppercase tracking-wider mr-1">Status Filter:</span>
          <button
            onClick={() => setSessionStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              sessionStatusFilter === 'all'
                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
            }`}
          >
            All Statuses
          </button>
          <button
            onClick={() => setSessionStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              sessionStatusFilter === 'active'
                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
            }`}
          >
            Active Sessions
          </button>
          <button
            onClick={() => setSessionStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              sessionStatusFilter === 'closed'
                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
            }`}
          >
            Closed Paid Receipts
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-[#1c3a1e]/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Discounts Filter:</span>
            <select
              value={sessionDiscountFilter}
              onChange={(e: any) => setSessionDiscountFilter(e.target.value)}
              className="bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-2.5 py-1.5 font-extrabold text-[#1c3a1e]"
            >
              <option value="all">All Orders (With & Without Discount)</option>
              <option value="with_discount">With Discounts Only 🏷️</option>
              <option value="no_discount">Without Discounts</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Date Range:</span>
            <select
              value={sessionDateFilter}
              onChange={(e: any) => setSessionDateFilter(e.target.value)}
              className="bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-2.5 py-1.5 font-extrabold text-[#1c3a1e]"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="ml-auto text-xs font-bold text-[#1c3a1e]">
            Showing <strong className="font-black text-emerald-800">{filteredSessions.length}</strong> matching orders
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#1c3a1e]/15 rounded-3xl shadow-xs">
            <Receipt className="h-12 w-12 text-[#1c3a1e] opacity-30 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#1c3a1e]">No matching invoice session references found</h3>
          </div>
        ) : (
          filteredSessions.map((sess) => {
            const details = getSessionDetails(sess);
            const invoiceRef = getInvoiceReference(details.primaryNum, sess.id);

            return (
              <div key={sess.id} className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs text-[#1c3a1e]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[#1c3a1e] text-base">{invoiceRef}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                          sess.status === 'closed'
                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                        }`}
                      >
                        {sess.status === 'closed' ? 'SESSION CLOSED (PAID)' : 'ACTIVE TABLE SESSION'}
                      </span>
                      {details.isMerged && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-200">
                          MERGED TABLES
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 font-mono mt-1">
                      {details.tableLabel} • {new Date(sess.created_at).toLocaleString('en-GB')} •{' '}
                      <strong className="text-[#1c3a1e]">{details.sessItems.length} Items</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {details.bill.discountUsd > 0 && (
                        <div className="text-xs font-bold text-gray-400 line-through">
                          Subtotal: ${details.bill.subtotalUsd.toFixed(2)}
                        </div>
                      )}
                      <div className="text-sm font-black text-[#1c3a1e]">
                        ${details.bill.finalTotalUsd.toFixed(2)}
                        {details.bill.discountUsd > 0 && (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded ml-1 border border-amber-300">
                            -${details.bill.discountUsd.toFixed(2)} Off
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-800">
                        Paid: ${details.bill.paidUsd.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => onViewOrderDetails(sess)}
                      className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Order Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
