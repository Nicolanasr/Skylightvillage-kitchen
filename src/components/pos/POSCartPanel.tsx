'use client';

import React from 'react';
import { Table, TableSession, OrderItem, MenuItem } from '@/lib/types';
import { calculateBillTotals, formatUsd } from '@/lib/currency';
import { updateOrderItemQuantity, cancelOrderItem, restoreCancelledOrderItem, compOrderItem, removeDiscount, unmergeAllTables, updateTableStatusAction } from '@/app/actions/payment-actions';
import { updateOrderItemStatus } from '@/app/actions/order-actions';
import { User, UserCheck, RotateCcw, Percent, Eye, Printer, CreditCard } from 'lucide-react';

interface POSCartPanelProps {
    selectedTable: Table | null;
    activeSession: TableSession | null;
    tableItems: OrderItem[];
    discounts: any[];
    payments: any[];
    menuItems: MenuItem[];
    refreshPOSData: () => void;
    onOpenAddItemModal: () => void;
    onOpenDiscountModal: () => void;
    onOpenPreviewReceipt: () => void;
    onOpenPrintReceipt: () => void;
    onOpenPaymentModal: () => void;
    onOpenMergeModal: () => void;
}

export const POSCartPanel: React.FC<POSCartPanelProps> = ({
    selectedTable,
    activeSession,
    tableItems,
    discounts,
    payments,
    menuItems,
    refreshPOSData,
    onOpenAddItemModal,
    onOpenDiscountModal,
    onOpenPreviewReceipt,
    onOpenPrintReceipt,
    onOpenPaymentModal,
    onOpenMergeModal,
}) => {
    if (!selectedTable) {
        return (
            <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-8 text-center shadow-xs flex flex-col items-center justify-center min-h-[400px]">
                <div className="h-16 w-16 rounded-full bg-[#eaf2eb] flex items-center justify-center text-[#1c3a1e] mb-4">
                    🛒
                </div>
                <h3 className="text-lg font-black text-[#1c3a1e]">No Table Selected</h3>
                <p className="text-xs text-gray-500 max-w-xs mt-1">
                    Select a table card from the floor plan to view its active orders, add items, or process payment checkout.
                </p>
            </div>
        );
    }

    const activeItems = tableItems.filter((i) => i.status !== 'cancelled');
    const sessionDiscounts = activeSession ? discounts.filter((d) => d.session_id === activeSession.id) : [];
    const sessionPayments = activeSession ? payments.filter((p) => p.session_id === activeSession.id) : [];

    const billTotals = calculateBillTotals(tableItems, sessionDiscounts, sessionPayments, 89500);

    const handleQuantityEdit = async (itemId: string, delta: number) => {
        const item = tableItems.find((i) => i.id === itemId);
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            await cancelOrderItem(itemId);
        } else {
            await updateOrderItemQuantity(itemId, newQty);
        }
        refreshPOSData();
    };

    const handleMarkItemDelivered = async (itemId: string) => {
        await updateOrderItemStatus(itemId, 'delivered');
        refreshPOSData();
    };

    const handleCancelItem = async (item: OrderItem) => {
        if (confirm(`Cancel "${item.item_name}" from table?`)) {
            await cancelOrderItem(item.id);
            refreshPOSData();
        }
    };

    const handleRestoreCancelledItem = async (itemId: string) => {
        await restoreCancelledOrderItem(itemId);
        refreshPOSData();
    };

    const handleRemoveDiscount = async (discId: string) => {
        await removeDiscount(discId);
        refreshPOSData();
    };

    return (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs text-[#1c3a1e] space-y-4 flex flex-col justify-between min-h-[500px]">
            <div>
                {/* Table Header */}
                <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                    <div>
                        <h2 className="text-xl font-black text-[#1c3a1e]">Table #{selectedTable.table_number} Cart</h2>
                        <span className="text-xs font-bold text-gray-500">
                            {activeItems.length} active order items
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedTable.status === 'bill_requested' && (
                            <button
                                onClick={async () => {
                                    await updateTableStatusAction(selectedTable.id, 'occupied');
                                    refreshPOSData();
                                }}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs animate-pulse"
                                title="Clear bill requested status"
                            >
                                🔔 Clear Request
                            </button>
                        )}

                        {activeSession?.merged_table_ids && activeSession.merged_table_ids.length > 0 && (
                            <button
                                onClick={async () => {
                                    await unmergeAllTables(activeSession.id);
                                    refreshPOSData();
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                                title="Unmerge all secondary tables linked to this session"
                            >
                                🔓 Unmerge
                            </button>
                        )}

                        <button
                            onClick={onOpenMergeModal}
                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] border border-[#1c3a1e]/15 text-xs font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                            {activeSession?.merged_table_ids && activeSession.merged_table_ids.length > 0
                                ? `🔗 Merged (${activeSession.merged_table_ids.length + 1})`
                                : '🔗 Merge'}
                        </button>

                        <button
                            onClick={async () => {
                                const confirm1 = confirm(`Are you sure you want to close and reset Table #${selectedTable.table_number}?`);
                                if (!confirm1) return;
                                const confirm2 = confirm(`⚠️ SECOND CONFIRMATION: Resetting Table #${selectedTable.table_number} will clear all items and set status to Available. Click OK to proceed.`);
                                if (!confirm2) return;

                                await updateTableStatusAction(selectedTable.id, 'available');
                                refreshPOSData();
                            }}
                            className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 text-xs font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                            title="Close and reset table session to available"
                        >
                            Reset Table
                        </button>

                        <button
                            onClick={onOpenAddItemModal}
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                            + Add Item
                        </button>
                    </div>
                </div>

                {/* Order Items List */}
                <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1 my-3">
                    {tableItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-semibold text-xs bg-[#fafbfa] border border-dashed border-[#1c3a1e]/15 rounded-2xl">
                            No items in this cart. Tap dishes from the menu to add.
                        </div>
                    ) : (
                        tableItems.map((item) => {
                            const menuItemObj =
                                menuItems.find((m) => m.id === item.menu_item_id) ||
                                menuItems.find((m) => m.name.toLowerCase() === item.item_name.toLowerCase());
                            const rawImg = menuItemObj?.image_url || '';
                            const imgUrl = rawImg.includes('drive.google.com')
                                ? `/api/image-proxy?url=${encodeURIComponent(rawImg)}`
                                : rawImg;

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-[#fafbfa] border rounded-xl p-3 ${item.is_paid
                                            ? 'border-emerald-500/40 bg-emerald-500/10'
                                            : item.status === 'cancelled'
                                                ? 'border-red-500/20 opacity-50'
                                                : item.status === 'ready'
                                                    ? 'border-emerald-500/50 bg-emerald-500/10'
                                                    : 'border-[#1c3a1e]/15'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-8 h-8 rounded-lg border border-[#1c3a1e]/15 bg-amber-50 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                                                {imgUrl ? (
                                                    <img
                                                        src={imgUrl}
                                                        alt={item.item_name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e: any) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                ) : null}
                                                <span className="text-xs font-black text-[#1c3a1e]">
                                                    {item.item_name.charAt(0)}
                                                </span>
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {item.guest_name && (
                                                        <span className="bg-purple-500/10 text-purple-900 border border-purple-500/30 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                            <User className="h-3 w-3" /> {item.guest_name}
                                                        </span>
                                                    )}

                                                    {!item.is_paid && item.status !== 'cancelled' ? (
                                                        <div className="flex items-center bg-white border border-[#1c3a1e]/20 rounded-lg shadow-xs">
                                                            <button
                                                                onClick={() => handleQuantityEdit(item.id, -1)}
                                                                className="h-6 w-6 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black cursor-pointer"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="px-2 text-xs font-black text-[#1c3a1e]">{item.quantity}</span>
                                                            <button
                                                                onClick={() => handleQuantityEdit(item.id, 1)}
                                                                className="h-6 w-6 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black cursor-pointer"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className={`font-black text-xs ${item.status === 'cancelled' ? 'line-through text-red-500' : 'text-emerald-700'
                                                                }`}
                                                        >
                                                            {item.quantity}x
                                                        </span>
                                                    )}

                                                    <span
                                                        className={`font-black text-xs ${item.is_paid
                                                                ? 'text-emerald-800'
                                                                : item.status === 'cancelled'
                                                                    ? 'line-through text-red-500'
                                                                    : 'text-[#1c3a1e]'
                                                            }`}
                                                    >
                                                        {item.item_name}
                                                    </span>

                                                    {item.is_paid && (
                                                        <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                                            <UserCheck className="h-3 w-3" /> PAID
                                                        </span>
                                                    )}
                                                </div>

                                                {item.is_comped && (
                                                    <span className="mt-1 text-[10px] bg-purple-500/20 text-purple-900 px-1.5 py-0.5 rounded font-bold inline-block">
                                                        COMPED (FREE)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <span
                                            className={`text-xs font-black ${item.is_paid
                                                    ? 'text-emerald-800'
                                                    : item.status === 'cancelled'
                                                        ? 'line-through text-red-500'
                                                        : 'text-[#1c3a1e]'
                                                }`}
                                        >
                                            {item.is_comped || item.status === 'cancelled'
                                                ? '$0.00'
                                                : formatUsd(Number(item.unit_price_usd) * item.quantity)}
                                        </span>
                                    </div>

                                    {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                        <div className="text-[10px] text-gray-700 font-extrabold mt-1">
                                            {item.selected_modifiers.map((m: any) => `${m.group}: ${m.option}`).join(', ')}
                                        </div>
                                    )}

                                    {item.special_notes &&
                                        item.special_notes.trim() !== '' &&
                                        item.special_notes !== 'Added by Waiter' && (
                                            <div className="text-[10px] text-emerald-800 font-bold italic mt-0.5">
                                                Note: {item.special_notes}
                                            </div>
                                        )}

                                    {/* Actions Footer */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1c3a1e]/10">
                                        <span
                                            className={`text-[10px] font-black px-2 py-0.5 rounded ${item.is_paid
                                                    ? 'bg-emerald-500/20 text-emerald-900'
                                                    : item.status === 'cancelled'
                                                        ? 'bg-red-500/20 text-red-700'
                                                        : item.status === 'ready'
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-[#eaf2eb] text-[#1c3a1e] border border-[#1c3a1e]/15'
                                                }`}
                                        >
                                            STATUS: {item.is_paid ? 'PAID / CHECKOUT' : item.status.toUpperCase()}
                                        </span>

                                        {!item.is_paid && item.status === 'ready' && (
                                            <button
                                                onClick={() => handleMarkItemDelivered(item.id)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded shadow-xs cursor-pointer"
                                            >
                                                Deliver to Table
                                            </button>
                                        )}

                                        {!item.is_paid &&
                                            (item.status === 'cancelled' ? (
                                                <button
                                                    onClick={() => handleRestoreCancelledItem(item.id)}
                                                    className="text-[10px] text-[#1c3a1e] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    <span>Undo Cancel</span>
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            await compOrderItem(item.id, !item.is_comped);
                                                            refreshPOSData();
                                                        }}
                                                        className={`text-[10px] font-black px-2 py-0.5 rounded cursor-pointer transition-all ${item.is_comped
                                                                ? 'bg-purple-700 text-white hover:bg-purple-800'
                                                                : 'bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200'
                                                            }`}
                                                    >
                                                        {item.is_comped ? '↩ Undo Comp' : '🎁 Comp Item'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelItem(item)}
                                                        className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                                                    >
                                                        Cancel Item
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bill Totals Summary */}
            <div className="pt-4 border-t border-[#1c3a1e]/15 space-y-3">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600 font-bold">
                        <span>Subtotal:</span>
                        <span>{formatUsd(billTotals.subtotalUsd)}</span>
                    </div>

                    {sessionDiscounts.map((disc) => (
                        <div key={disc.id} className="flex justify-between items-center text-xs text-emerald-800 font-bold">
                            <div className="flex items-center gap-1.5">
                                <span>Discount ({disc.type === 'percentage' ? `${disc.value}%` : `$${disc.value}`}):</span>
                                <button
                                    onClick={() => handleRemoveDiscount(disc.id)}
                                    className="text-red-600 hover:text-red-700 font-extrabold ml-1 text-[10px] cursor-pointer"
                                >
                                    ✕ Remove
                                </button>
                            </div>
                            <span>-{formatUsd(billTotals.discountUsd)}</span>
                        </div>
                    ))}

                    <div className="flex justify-between text-base font-black text-[#1c3a1e] pt-1 border-t border-[#1c3a1e]/15">
                        <span>REMAINING UNPAID TOTAL USD:</span>
                        <span className="text-emerald-700 font-black">{formatUsd(billTotals.remainingUsd)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-[#d4af37]">
                        <span>REMAINING UNPAID LBP:</span>
                        <span>{billTotals.remainingLbp}</span>
                    </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                    <button
                        onClick={onOpenDiscountModal}
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                        <Percent className="h-4 w-4 text-emerald-700" />
                        <span>Discount</span>
                    </button>

                    <button
                        onClick={onOpenPreviewReceipt}
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                        <Eye className="h-4 w-4 text-blue-700" />
                        <span>Preview</span>
                    </button>

                    <button
                        onClick={onOpenPrintReceipt}
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                        <Printer className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Print Bill</span>
                    </button>

                    <button
                        onClick={onOpenPaymentModal}
                        disabled={billTotals.remainingUsd <= 0}
                        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CreditCard className="h-4 w-4 text-[#d4af37]" />
                        <span>Pay Checkout</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
