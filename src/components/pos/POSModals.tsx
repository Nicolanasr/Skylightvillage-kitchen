'use client';

import React, { useState } from 'react';
import { Table, TableSession, MenuItem, OrderItem } from '@/lib/types';
import { calculateBillTotals, formatUsd, formatLbp } from '@/lib/currency';
import { applyDiscount, mergeTables, unmergeSingleTable, unmergeAllTables, processSplitPayment, closeTableSessionAction, assignGuestNameToOrderItems } from '@/app/actions/payment-actions';
import { CreditCard, DollarSign, Users, Utensils, Check, Percent, Printer, Edit2, CheckSquare, Square, Search } from 'lucide-react';

interface POSModalsProps {
  // Merge Tables Props
  isMergeModalOpen: boolean;
  onCloseMergeModal: () => void;
  selectedTable: Table | null;
  tables: Table[];
  sessions: TableSession[];
  refreshPOSData: () => void;

  // Discount Modal Props
  isDiscountModalOpen: boolean;
  onCloseDiscountModal: () => void;
  activeSession: TableSession | null;

  // Modifier Selection Modal Props
  selectedMenuItemForWaiter: MenuItem | null;
  onCloseModifierModal: () => void;
  orderItems: OrderItem[];

  // Payment Modal Props
  isPaymentModalOpen: boolean;
  onClosePaymentModal: () => void;
  discounts: any[];
  payments: any[];
  onPrintSplitInvoice?: (details: {
    items: OrderItem[];
    amountUsd: number;
    guestName?: string;
    splitTypeLabel: string;
    paymentMethod: string;
  }) => void;
}

export const POSModals: React.FC<POSModalsProps> = ({
  isMergeModalOpen,
  onCloseMergeModal,
  selectedTable,
  tables,
  sessions,
  refreshPOSData,
  isDiscountModalOpen,
  onCloseDiscountModal,
  activeSession,
  selectedMenuItemForWaiter,
  onCloseModifierModal,
  orderItems,
  isPaymentModalOpen,
  onClosePaymentModal,
  discounts,
  payments,
  onPrintSplitInvoice,
}) => {
  // Merge Tables Modal State
  const [selectedSecondaryTableIds, setSelectedSecondaryTableIds] = useState<string[]>([]);

  // Discount Modal State
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [discountReason, setDiscountReason] = useState<string>('Manager Discount');

  // Payment Modal State
  const [paymentType, setPaymentType] = useState<'full' | 'equal_split' | 'split_items' | 'partial'>('full');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [selectedSplitItemIds, setSelectedSplitItemIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [guestName, setGuestName] = useState<string>('');
  const [dishSearchTerm, setDishSearchTerm] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');

  // Handle Merge Submission
  const handleMergeSubmit = async () => {
    if (!selectedTable || selectedSecondaryTableIds.length === 0) return;
    const res = await mergeTables(selectedTable.id, selectedSecondaryTableIds);
    if (res.success) {
      setSelectedSecondaryTableIds([]);
      setModalError('');
      onCloseMergeModal();
      refreshPOSData();
    } else {
      setModalError(res.error || 'Failed to merge tables');
    }
  };

  // Handle Discount Submission
  const handleApplyDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return alert('No active session on this table');
    await applyDiscount(activeSession.id, discountType, discountValue, discountReason);
    onCloseDiscountModal();
    refreshPOSData();
  };

  // Calculate Draft Split Check Amounts
  const getDraftSplitDetails = () => {
    if (!selectedTable || !activeSession) return null;

    const tblItems = orderItems.filter(
      (i) => i.session_id === activeSession.id && i.status !== 'cancelled'
    );
    const tblDiscounts = discounts.filter((d) => d.session_id === activeSession.id);
    const tblPayments = payments.filter((p) => p.session_id === activeSession.id);
    const bill = calculateBillTotals(tblItems, tblDiscounts, tblPayments, 89500);

    let payAmt = bill.remainingUsd;
    let splitItems = tblItems.filter((i) => !i.is_paid);
    let label = 'FULL TABLE CHECK';

    if (paymentType === 'equal_split') {
      const count = Math.max(1, splitCount);
      payAmt = bill.remainingUsd / count;
      label = `EQUAL SPLIT (1/${count})`;
    } else if (paymentType === 'split_items') {
      splitItems = tblItems.filter((i) => selectedSplitItemIds.includes(i.id) && !i.is_paid);
      payAmt = splitItems.reduce(
        (sum, i) => sum + (i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity),
        0
      );
      label = `GUEST CHECK: ${guestName.trim() || 'ITEMIZED SPLIT'}`;
    } else if (paymentType === 'partial') {
      payAmt = parseFloat(partialAmount) || 0;
      label = `GUEST CHECK: ${guestName.trim() || 'PARTIAL PAYMENT'}`;
    }

    return { bill, payAmt, splitItems, label, tblItems };
  };

  // Handle Print Guest Invoice Alone
  const handlePrintGuestInvoiceAlone = async () => {
    const draft = getDraftSplitDetails();
    if (!draft) return;

    if (paymentType === 'split_items' && draft.splitItems.length === 0) {
      return setModalError('Select at least one dish item to print guest invoice');
    }

    setModalError('');

    // Permanently save guest name assignment to database order_items table
    const assignedTag = guestName.trim();
    if (assignedTag && draft.splitItems.length > 0) {
      await assignGuestNameToOrderItems(draft.splitItems.map((i) => i.id), assignedTag);
      refreshPOSData();
    }

    if (onPrintSplitInvoice) {
      onPrintSplitInvoice({
        items: draft.splitItems,
        amountUsd: Math.max(0, draft.payAmt),
        guestName: assignedTag || undefined,
        splitTypeLabel: draft.label,
        paymentMethod,
      });
    }
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // Handle Payment Submission (Complete Payment)
  const handlePaymentCheckoutSubmit = async (shouldPrintReceipt: boolean = false) => {
    if (!selectedTable || !activeSession || isProcessingPayment) return;
    const draft = getDraftSplitDetails();
    if (!draft) return;

    if (paymentType === 'split_items') {
      if (draft.splitItems.length === 0) return setModalError('Select at least one dish item to pay');
    } else if (paymentType === 'partial') {
      if (isNaN(draft.payAmt) || draft.payAmt <= 0) return setModalError('Enter a valid custom payment amount');
    }

    setModalError('');
    setIsProcessingPayment(true);
    const finalPayAmt = Math.max(0, draft.payAmt);

    const res = await processSplitPayment({
      sessionId: activeSession.id,
      paymentType: paymentType === 'split_items' ? 'item_split' : paymentType,
      amountUsd: finalPayAmt,
      currency: 'USD',
      paymentMethod,
      itemIdsPaid: paymentType === 'split_items' ? selectedSplitItemIds : undefined,
      guestName: guestName.trim() || undefined,
    });

    setIsProcessingPayment(false);

    if (res.success) {
      if (shouldPrintReceipt) {
        if (onPrintSplitInvoice) {
          onPrintSplitInvoice({
            items: draft.splitItems,
            amountUsd: finalPayAmt,
            guestName: guestName.trim() || undefined,
            splitTypeLabel: draft.label,
            paymentMethod,
          });
        }
        setTimeout(() => {
          window.print();
        }, 150);
      }
      setSelectedSplitItemIds([]);
      setGuestName('');
      setPartialAmount('');
      setModalError('');
      onClosePaymentModal();
      refreshPOSData();
    } else {
      setModalError((res as any).error || 'Payment failed');
    }
  };

  return (
    <>
      {/* 1. MERGE TABLES MODAL */}
      {isMergeModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-lg font-black text-[#1c3a1e]">
                Merge Tables into Table #{selectedTable.table_number}
              </h3>
              <button onClick={onCloseMergeModal} className="text-gray-500 hover:text-black font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {/* Unmerge Section if Table is currently merged */}
            {activeSession && activeSession.merged_table_ids && activeSession.merged_table_ids.length > 0 && (
              <div className="mb-4 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wide">
                    Currently Merged Tables ({activeSession.merged_table_ids.length})
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await unmergeAllTables(activeSession.id);
                      onCloseMergeModal();
                      refreshPOSData();
                    }}
                    className="text-[11px] font-black text-red-700 hover:text-red-900 bg-white px-2.5 py-1 rounded-xl border border-red-200 shadow-xs cursor-pointer"
                  >
                    🔓 Unmerge All Tables
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeSession.merged_table_ids.map((tid) => {
                    const mergedTbl = tables.find((t) => t.id === tid);
                    if (!mergedTbl) return null;
                    return (
                      <div
                        key={tid}
                        className="bg-white border border-purple-300 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-black text-purple-950 shadow-2xs"
                      >
                        <span>Table #{mergedTbl.table_number}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await unmergeSingleTable(activeSession.id, tid);
                            refreshPOSData();
                          }}
                          className="text-red-600 hover:text-red-800 font-bold ml-1 cursor-pointer"
                          title={`Unmerge Table #${mergedTbl.table_number}`}
                        >
                          ✕ Unmerge
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600 mb-4 font-semibold">
              Select secondary tables to link with Primary Table #{selectedTable.table_number}. All orders will aggregate into a single combined check.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto mb-6">
              {tables
                .filter((t) => t.id !== selectedTable.id)
                .map((t) => {
                  const isSelected = selectedSecondaryTableIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSecondaryTableIds(selectedSecondaryTableIds.filter((id) => id !== t.id));
                        } else {
                          setSelectedSecondaryTableIds([...selectedSecondaryTableIds, t.id]);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                          : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                      }`}
                    >
                      Table #{t.table_number}
                    </button>
                  );
                })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCloseMergeModal}
                className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3 rounded-2xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeSubmit}
                disabled={selectedSecondaryTableIds.length === 0}
                className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Confirm Merge ({selectedSecondaryTableIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. APPLY DISCOUNT MODAL */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-lg font-black text-[#1c3a1e]">Apply Session Discount</h3>
              <button onClick={onCloseDiscountModal} className="text-gray-500 hover:text-black font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyDiscountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Discount Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`py-2.5 rounded-xl text-xs font-black border cursor-pointer ${
                      discountType === 'percentage'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`py-2.5 rounded-xl text-xs font-black border cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                    }`}
                  >
                    Fixed USD ($)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Discount Value {discountType === 'percentage' ? '(%)' : '($ USD)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-black text-[#1c3a1e] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. VIP Customer or Manager Discount"
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-bold text-[#1c3a1e] focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseDiscountModal}
                  className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3 rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-xs transition-all cursor-pointer"
                >
                  Apply Discount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SPLIT CHECK WORKBENCH & PAYMENT MODAL */}
      {isPaymentModalOpen && selectedTable && activeSession && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl text-[#1c3a1e] max-h-[94vh] flex flex-col justify-between overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#1c3a1e]/15 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-black text-[#1c3a1e]">
                    Split Check Workbench — Table #{selectedTable.table_number}
                  </h3>
                  <span className="text-xs font-bold text-gray-500">
                    Assign dishes, search items, print guest invoice alone, or complete payment
                  </span>
                </div>
                <button onClick={onClosePaymentModal} className="text-gray-500 hover:text-black font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              {/* Total Unpaid Check Summary Box */}
              {(() => {
                const draft = getDraftSplitDetails();
                if (!draft) return null;

                const { bill, payAmt, tblItems } = draft;

                const unpaidItems = tblItems.filter((i) => !i.is_paid);
                const filteredUnpaidItems = unpaidItems.filter((i) => {
                  if (!dishSearchTerm.trim()) return true;
                  const term = dishSearchTerm.toLowerCase();
                  const matchName = i.item_name.toLowerCase().includes(term);
                  const matchMod = i.selected_modifiers?.some((m: any) =>
                    `${m.group} ${m.option}`.toLowerCase().includes(term)
                  );
                  return matchName || matchMod;
                });

                return (
                  <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                    <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3 flex justify-between items-center shadow-xs flex-shrink-0">
                      <div>
                        <span className="text-[11px] font-bold text-gray-500 block">TOTAL TABLE UNPAID BALANCE</span>
                        <span className="text-xl font-black text-emerald-800">{formatUsd(bill.remainingUsd)}</span>
                        <span className="text-[10px] font-bold text-[#d4af37] block">{bill.remainingLbp}</span>
                      </div>

                      <div className="text-right border-l border-[#1c3a1e]/15 pl-4">
                        <span className="text-[11px] font-bold text-gray-500 block">DRAFT GUEST CHECK DUE</span>
                        <span className="text-xl font-black text-[#1c3a1e]">{formatUsd(payAmt)}</span>
                        <span className="text-[10px] font-bold text-gray-600 block">{formatLbp(payAmt * 89500)}</span>
                      </div>
                    </div>

                    {/* Split Mode Selector Tabs */}
                    <div className="flex-shrink-0">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Payment Split Mode</label>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          onClick={() => setPaymentType('full')}
                          className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            paymentType === 'full'
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                          }`}
                        >
                          💳 Full Check
                        </button>

                        <button
                          onClick={() => setPaymentType('equal_split')}
                          className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            paymentType === 'equal_split'
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                          }`}
                        >
                          👥 Equal Split
                        </button>

                        <button
                          onClick={() => setPaymentType('split_items')}
                          className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            paymentType === 'split_items'
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                          }`}
                        >
                          🍽️ By Items
                        </button>

                        <button
                          onClick={() => setPaymentType('partial')}
                          className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            paymentType === 'partial'
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                          }`}
                        >
                          💵 Custom Part
                        </button>
                      </div>
                    </div>

                    {/* Mode Specific Controls */}
                    {paymentType === 'equal_split' && (
                      <div className="bg-[#eaf2eb] border border-[#1c3a1e]/15 p-3 rounded-2xl flex items-center justify-between flex-shrink-0">
                        <span className="text-xs font-bold text-[#1c3a1e]">Number of Equal Guest Splits:</span>
                        <div className="flex items-center gap-2">
                          {[2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              onClick={() => setSplitCount(num)}
                              className={`h-8 w-8 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                splitCount === num
                                  ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                  : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/20'
                              }`}
                            >
                              {num}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentType === 'split_items' && (
                      <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                        {/* Header & Quick Action Buttons */}
                        <div className="flex flex-col gap-1.5 bg-[#eaf2eb]/80 border border-[#1c3a1e]/15 px-3.5 py-2 rounded-2xl flex-shrink-0">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-[#1c3a1e]">
                              Tap dishes to assign ({selectedSplitItemIds.length}/{unpaidItems.length} selected):
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSplitItemIds(unpaidItems.map((i) => i.id))}
                                className="text-xs font-black text-[#1c3a1e] hover:underline cursor-pointer bg-white px-2.5 py-1 rounded-xl border border-[#1c3a1e]/15 shadow-xs"
                              >
                                Select All Unpaid
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSplitItemIds([])}
                                className="text-xs font-black text-red-700 hover:underline cursor-pointer bg-white px-2.5 py-1 rounded-xl border border-red-200 shadow-xs"
                              >
                                Clear Selection
                              </button>
                            </div>
                          </div>

                          {/* Quick Guest Selection Pills */}
                          {(() => {
                            const guestNames = Array.from(
                              new Set(
                                unpaidItems
                                  .map((i) => i.guest_name || (i.customer_name !== 'Valued Guest' ? i.customer_name : ''))
                                  .filter((n): n is string => !!n && n.trim() !== '')
                              )
                            );

                            if (guestNames.length === 0) return null;

                            return (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1c3a1e]/10">
                                <span className="text-[10px] font-bold text-gray-600">Quick Select Guest:</span>
                                {guestNames.map((gName) => (
                                  <button
                                    key={gName}
                                    type="button"
                                    onClick={() => {
                                      const matchedIds = unpaidItems
                                        .filter((i) => (i.guest_name || i.customer_name) === gName)
                                        .map((i) => i.id);
                                      setSelectedSplitItemIds(matchedIds);
                                      setGuestName(gName);
                                    }}
                                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 font-black text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                  >
                                    👤 Select {gName} ({unpaidItems.filter((i) => (i.guest_name || i.customer_name) === gName).length})
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Search Filter Input Bar */}
                        <div className="relative flex-shrink-0">
                          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={dishSearchTerm}
                            onChange={(e) => setDishSearchTerm(e.target.value)}
                            placeholder="Type to search dishes or modifiers..."
                            className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                          />
                        </div>

                        {/* TALL Scrollable Dish Selection List (Takes up ~55vh height!) */}
                        <div className="flex-1 max-h-[55vh] min-h-[220px] overflow-y-auto space-y-1.5 border border-[#1c3a1e]/20 rounded-2xl p-2 bg-[#fafbfa] shadow-inner">
                          {filteredUnpaidItems.length === 0 ? (
                            <div className="text-xs font-bold text-gray-500 p-8 text-center">
                              {unpaidItems.length === 0
                                ? 'All items on this check have been paid'
                                : 'No unpaid dishes match your search query'}
                            </div>
                          ) : (
                            filteredUnpaidItems.map((item) => {
                              const isSelected = selectedSplitItemIds.includes(item.id);
                              const assignedGuest = item.guest_name || (item.customer_name !== 'Valued Guest' ? item.customer_name : '');

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedSplitItemIds(selectedSplitItemIds.filter((id) => id !== item.id));
                                    } else {
                                      setSelectedSplitItemIds([...selectedSplitItemIds, item.id]);
                                    }
                                  }}
                                  className={`p-2.5 rounded-xl border text-xs font-bold flex justify-between items-center cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                                      : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {isSelected ? (
                                      <CheckSquare className="h-4.5 w-4.5 text-[#d4af37] flex-shrink-0" />
                                    ) : (
                                      <Square className="h-4.5 w-4.5 text-gray-400 flex-shrink-0" />
                                    )}
                                    <div>
                                      <div className="font-extrabold text-xs flex items-center gap-1.5 flex-wrap">
                                        <span>{item.quantity}x {item.item_name}</span>
                                        {assignedGuest && (
                                          <span
                                            className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                              isSelected
                                                ? 'bg-purple-900 text-purple-100 border-purple-400'
                                                : 'bg-purple-100 text-purple-900 border-purple-300'
                                            }`}
                                          >
                                            👤 {assignedGuest}
                                          </span>
                                        )}
                                      </div>
                                      {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                        <div className={`text-[10px] font-medium ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                                          {item.selected_modifiers.map((m: any) => `${m.group}: ${m.option}`).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-black text-xs">${(Number(item.unit_price_usd) * item.quantity).toFixed(2)}</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {paymentType === 'partial' && (
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Custom Amount to Pay ($ USD)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          placeholder="e.g. 25.00"
                          className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-black text-[#1c3a1e] focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Method & Optional Guest Name Tag */}
                    <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setPaymentMethod('cash')}
                            className={`py-2 rounded-xl text-xs font-black border cursor-pointer ${
                              paymentMethod === 'cash'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                            }`}
                          >
                            💵 Cash
                          </button>
                          <button
                            onClick={() => setPaymentMethod('card')}
                            className={`py-2 rounded-xl text-xs font-black border cursor-pointer ${
                              paymentMethod === 'card'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                            }`}
                          >
                            💳 Card
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Guest Check Tag / Name</label>
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Guest #1 or John"
                          className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-2 text-xs font-bold text-[#1c3a1e] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1c3a1e]/15 mt-3 flex-shrink-0">
              <button
                onClick={handlePrintGuestInvoiceAlone}
                className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                title="Print thermal guest check invoice alone without completing payment"
              >
                <Printer className="h-4 w-4 text-[#1c3a1e]" />
                <span>Print Invoice Alone</span>
              </button>

              <button
                onClick={() => handlePaymentCheckoutSubmit(false)}
                disabled={isProcessingPayment}
                className="bg-[#1c3a1e] hover:bg-[#2b542e] text-white font-black py-3.5 rounded-2xl text-xs cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Complete payment only in database"
              >
                {isProcessingPayment ? (
                  <>
                    <span className="animate-spin text-xs">⏳</span>
                    <span>Processing Payment…</span>
                  </>
                ) : (
                  <span>Complete Payment Only</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
