'use client';

import React from 'react';
import Image from 'next/image';
import { Table, TableSession, OrderItem, MenuItem } from '@/lib/types';
import { calculateBillTotals, formatUsd } from '@/lib/currency';
import { updateOrderItemQuantity, cancelOrderItem, restoreCancelledOrderItem, compOrderItem, removeDiscount, unmergeAllTables, updateTableStatusAction } from '@/app/actions/payment-actions';
import { updateOrderItemStatus } from '@/app/actions/order-actions';
import { assignLoyaltyPhoneToSession, assignLoyaltyPhoneToOrderItem, removeLoyaltyPhoneFromOrderItem, redeemLoyaltyRewardAction, searchLoyaltyCustomers, lookupOrCreateCustomerLoyalty } from '@/app/actions/loyalty-actions';
import { User, UserCheck, RotateCcw, Percent, Eye, CreditCard, Sparkles, X, Phone } from 'lucide-react';

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

    // ── Per-item VIP assignment state ──
    const [itemVipTarget, setItemVipTarget] = React.useState<{ id: string; name: string } | null>(null);
    const [itemVipPhone, setItemVipPhone] = React.useState('');
    const [itemVipCustName, setItemVipCustName] = React.useState('');
    const [itemVipLoading, setItemVipLoading] = React.useState(false);
    const [itemVipToast, setItemVipToast] = React.useState('');
    const [itemVipResults, setItemVipResults] = React.useState<any[]>([]);
    const [itemVipSearching, setItemVipSearching] = React.useState(false);
    const [vipProfile, setVipProfile] = React.useState<any>(null);
    const [vipTiers, setVipTiers] = React.useState<any[]>([]);
    const itemVipDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-lookup VIP profile and eligible gifts when phone is selected/typed
    React.useEffect(() => {
        if (itemVipPhone.trim().length >= 6) {
            lookupOrCreateCustomerLoyalty(itemVipPhone, itemVipCustName).then((res) => {
                if (res.success && res.customer) {
                    setVipProfile(res.customer);
                    setVipTiers(res.rewardTiers || []);
                } else {
                    setVipProfile(null);
                    setVipTiers([]);
                }
            });
        } else {
            setVipProfile(null);
            setVipTiers([]);
        }
    }, [itemVipPhone]);

    const [redeemingBannerKey, setRedeemingBannerKey] = React.useState<string | null>(null);
    const [redeemingTierId, setRedeemingTierId] = React.useState<string | null>(null);

    const handleRedeemGift = async (tierId: string) => {
        if (!activeSession || !itemVipPhone) return;
        setItemVipLoading(true);
        setRedeemingTierId(tierId);
        const res = await redeemLoyaltyRewardAction(activeSession.id, itemVipPhone, tierId, 'POS Waiter');
        setRedeemingTierId(null);
        if (res.success) {
            setItemVipToast(`🎁 Reward Applied: ${res.rewardName}! (-${res.pointsDeducted} pts)`);
            refreshPOSData();
            const updated = await lookupOrCreateCustomerLoyalty(itemVipPhone, itemVipCustName);
            if (updated.success && updated.customer) {
                setVipProfile(updated.customer);
            }
        } else {
            setItemVipToast(res.error || 'Failed to redeem reward');
        }
        setItemVipLoading(false);
    };

    const handleItemVipPhoneChange = (val: string) => {
        setItemVipPhone(val);
        setItemVipResults([]);
        if (itemVipDebounce.current) clearTimeout(itemVipDebounce.current);
        if (val.trim().length >= 2) {
            setItemVipSearching(true);
            itemVipDebounce.current = setTimeout(async () => {
                const res = await searchLoyaltyCustomers(val);
                if (res.success) setItemVipResults(res.customers || []);
                setItemVipSearching(false);
            }, 320);
        } else {
            setItemVipSearching(false);
        }
    };

    const selectExistingCustomer = (cust: any) => {
        setItemVipPhone(cust.phone_number);
        setItemVipCustName(cust.customer_name);
        setItemVipResults([]);
    };

    const activeItems = tableItems.filter((i) => i.status !== 'cancelled');
    const sessionDiscounts = activeSession ? discounts.filter((d) => d.session_id === activeSession.id) : [];
    const sessionPayments = activeSession ? payments.filter((p) => p.session_id === activeSession.id) : [];

    const billTotals = calculateBillTotals(tableItems, sessionDiscounts, sessionPayments, 89500);

    // Extract guests already present in this table's order for quick one-tap assignment
    const existingGuestsInOrder = React.useMemo(() => {
        const map = new Map<string, { phone: string; name: string }>();
        tableItems.forEach((item) => {
            const phone = item.loyalty_phone || item.customer_phone;
            if (phone && phone.trim()) {
                const cleanP = phone.trim();
                if (!map.has(cleanP)) {
                    const name = item.customer_name && item.customer_name !== 'Valued Guest'
                        ? item.customer_name
                        : (item.guest_name || 'VIP Guest');
                    map.set(cleanP, { phone: cleanP, name });
                }
            }
        });
        if (activeSession?.customer_phone && activeSession.customer_phone.trim() && !map.has(activeSession.customer_phone.trim())) {
            map.set(activeSession.customer_phone.trim(), {
                phone: activeSession.customer_phone.trim(),
                name: activeSession.customer_name && activeSession.customer_name !== 'Valued Guest' ? activeSession.customer_name : 'Table Customer',
            });
        }
        return Array.from(map.values());
    }, [tableItems, activeSession]);

    // Detect VIP gift eligibility for any guest at this table
    const [eligibleVipGuests, setEligibleVipGuests] = React.useState<Array<{ phone: string; name: string; points: number; claimableTiers: any[] }>>([]);
    const [giftDrawerOpen, setGiftDrawerOpen] = React.useState(false);

    React.useEffect(() => {
        if (existingGuestsInOrder.length === 0) {
            setEligibleVipGuests([]);
            return;
        }

        let isMounted = true;
        Promise.all(
            existingGuestsInOrder.map(async (g) => {
                const res = await lookupOrCreateCustomerLoyalty(g.phone, g.name);
                if (res.success && res.customer) {
                    const pts = Number(res.customer.points_balance || 0);
                    const claimable = (res.rewardTiers || []).filter((t: any) => pts >= Number(t.points_required));
                    if (claimable.length > 0) {
                        return {
                            phone: g.phone,
                            name: res.customer.customer_name || g.name,
                            points: pts,
                            claimableTiers: claimable,
                        };
                    }
                }
                return null;
            })
        ).then((results) => {
            if (isMounted) {
                setEligibleVipGuests(results.filter(Boolean) as any[]);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [existingGuestsInOrder, tableItems.length]);

    const handleAssignItemVip = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemVipTarget || !itemVipPhone.trim()) return;
        setItemVipLoading(true);
        setItemVipToast('');

        if (itemVipTarget.id === '__all__') {
            // Assign phone to ALL unassigned active items
            const unassigned = activeItems.filter((i) => !i.loyalty_phone && !i.is_paid);
            let successCount = 0;
            for (const item of unassigned) {
                const res = await assignLoyaltyPhoneToOrderItem(item.id, itemVipPhone, itemVipCustName);
                if (res.success) successCount++;
            }
            setItemVipToast(`✅ Linked ${itemVipPhone} to ${successCount} item${successCount !== 1 ? 's' : ''}!`);
            refreshPOSData();
            setTimeout(() => {
                setItemVipTarget(null);
                setItemVipPhone('');
                setItemVipCustName('');
                setItemVipToast('');
                setItemVipResults([]);
            }, 1800);
        } else {
            const res = await assignLoyaltyPhoneToOrderItem(itemVipTarget.id, itemVipPhone, itemVipCustName);
            if (res.success && res.customer) {
                setItemVipToast(`✅ ${res.customer.customer_name} linked! (${res.customer.points_balance} pts)`);
                refreshPOSData();
                setTimeout(() => {
                    setItemVipTarget(null);
                    setItemVipPhone('');
                    setItemVipCustName('');
                    setItemVipToast('');
                    setItemVipResults([]);
                }, 1800);
            } else {
                setItemVipToast(res.error || 'Failed to assign VIP.');
            }
        }
        setItemVipLoading(false);
    };

    const handleRemoveItemVip = async (itemId: string) => {
        await removeLoyaltyPhoneFromOrderItem(itemId);
        refreshPOSData();
    };

    const handleQuantityEdit = async (itemId: string, delta: number) => {
        const item = tableItems.find((i) => i.id === itemId);
        if (!item) return;
        const currentQty = Math.round(Number(item.quantity || 1));
        const stepDelta = Math.round(Number(delta || 1));
        const newQty = currentQty + stepDelta;
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
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-gray-500">{activeItems.length} active order items</span>
                        </div>
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

                {/* 🎁 VIP Gift Eligibility Notification Banner */}
                {eligibleVipGuests.length > 0 && (
                    <div className="bg-[#eaf2eb] border border-amber-400/80 rounded-2xl p-2.5 shadow-xs space-y-1.5 mt-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm">🎁</span>
                                <div className="min-w-0">
                                    <span className="text-xs font-black text-[#1c3a1e] truncate block">
                                        VIP Gift Eligible: {eligibleVipGuests.map(g => `${g.name} (${g.points} PTS)`).join(', ')}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setGiftDrawerOpen(!giftDrawerOpen)}
                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-[11px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                            >
                                <Sparkles className="h-3 w-3 text-[#d4af37]" />
                                <span>Claim Gift {giftDrawerOpen ? '▲' : '▼'}</span>
                            </button>
                        </div>

                        {/* Direct One-Click Gift Claim Buttons */}
                        {giftDrawerOpen && (
                            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-amber-300/40">
                                {eligibleVipGuests.flatMap(g => 
                                    g.claimableTiers.map(tier => {
                                        const key = `${g.phone}-${tier.id}`;
                                        const isRedeemingThis = redeemingBannerKey === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                disabled={isRedeemingThis}
                                                onClick={async () => {
                                                    if (!activeSession) return;
                                                    setRedeemingBannerKey(key);
                                                    const res = await redeemLoyaltyRewardAction(activeSession.id, g.phone, tier.id, 'POS Cart Banner');
                                                    setRedeemingBannerKey(null);
                                                    if (res.success) {
                                                        refreshPOSData();
                                                        setItemVipToast(`🎁 SUCCESS: "${res.rewardName}" claimed for ${g.name}!`);
                                                    } else {
                                                        setItemVipToast(res.error || 'Failed to redeem reward');
                                                    }
                                                }}
                                                className="bg-white hover:bg-emerald-50 border border-emerald-500/40 text-emerald-950 px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                            >
                                                {isRedeemingThis ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="animate-spin text-xs">⏳</span>
                                                        <span>Claiming…</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span>🎁 {g.name}: {tier.name}</span>
                                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded-md">-{tier.points_required} pts</span>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Order Items List */}
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 my-3">
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
                                                    <Image
                                                        src={imgUrl}
                                                        alt={item.item_name}
                                                        fill
                                                        unoptimized
                                                        className="object-cover"
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

                                                    {item.is_comped && (
                                                        <span className="text-[9px] font-black text-purple-800 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded-md">
                                                            🎁 COMPED
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Modifiers List */}
                                                {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                    <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                                        {item.selected_modifiers.map((m: any) => `${m.group}: ${m.option}`).join(', ')}
                                                    </div>
                                                )}

                                                {item.special_notes && (
                                                    <div className="text-[10px] text-emerald-800 font-bold italic mt-0.5">
                                                        Note: {item.special_notes}
                                                    </div>
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

                                    {/* Per-item VIP Loyalty Badge */}
                                    {!item.is_paid && item.status !== 'cancelled' && (
                                        <div className="mt-2">
                                            {item.loyalty_phone ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setItemVipTarget({ id: item.id, name: item.item_name });
                                                            setItemVipPhone(item.loyalty_phone || item.customer_phone || '');
                                                            setItemVipCustName(item.customer_name || '');
                                                            setItemVipToast('');
                                                            setItemVipResults([]);
                                                        }}
                                                        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-black text-[10px] px-2 py-0.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                                                        title="Click to view VIP points & customer details"
                                                    >
                                                        <Sparkles className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                                                        <span>
                                                            {item.customer_name && item.customer_name !== 'Valued Guest'
                                                                ? `${item.customer_name} (${item.loyalty_phone})`
                                                                : item.loyalty_phone}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveItemVip(item.id)}
                                                        className="text-[10px] text-gray-400 hover:text-red-500 font-bold cursor-pointer"
                                                        title="Remove VIP assignment"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setItemVipTarget({ id: item.id, name: item.item_name });
                                                        setItemVipPhone('');
                                                        setItemVipCustName('');
                                                        setItemVipToast('');
                                                    }}
                                                    className="flex items-center gap-1 text-[10px] font-black text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <Sparkles className="h-2.5 w-2.5" />
                                                    Assign VIP
                                                </button>
                                            )}
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

            {/* Per-item VIP Assignment Modal with Typeahead */}
            {itemVipTarget && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
                        {/* Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
                            <div>
                                <h3 className="text-sm font-black text-[#1c3a1e] flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-[#d4af37]" />
                                    Assign VIP Loyalty
                                </h3>
                                <p className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 mt-1 inline-block truncate max-w-[230px]">
                                    🍽 {itemVipTarget.name}
                                </p>
                            </div>
                            <button onClick={() => { setItemVipTarget(null); setItemVipResults([]); setItemVipToast(''); }} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Toast */}
                        {itemVipToast && (
                            <div className={`text-xs font-bold p-2.5 rounded-xl border ${
                                itemVipToast.startsWith('✅')
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-red-50 border-red-300 text-red-800'
                            }`}>
                                {itemVipToast}
                            </div>
                        )}

                        {/* Quick Select from current table guests */}
                        {existingGuestsInOrder.length > 0 && (
                            <div className="bg-[#eaf2eb]/70 border border-[#1c3a1e]/15 rounded-2xl p-2.5 space-y-1.5">
                                <label className="block text-[10px] font-black text-[#1c3a1e] uppercase tracking-wider">
                                    ⚡ Table Guests (One-Tap Assign)
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {existingGuestsInOrder.map((guest) => (
                                        <button
                                            key={guest.phone}
                                            type="button"
                                            onClick={() => {
                                                setItemVipPhone(guest.phone);
                                                setItemVipCustName(guest.name);
                                                setItemVipResults([]);
                                            }}
                                            className="flex items-center gap-1.5 bg-white hover:bg-amber-50 border border-[#1c3a1e]/20 hover:border-amber-400 text-[#1c3a1e] px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <User className="h-3 w-3 text-amber-600 shrink-0" />
                                            <span>{guest.name}</span>
                                            <span className="text-[10px] text-gray-500 font-bold">({guest.phone})</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleAssignItemVip} className="space-y-3">
                            {/* Phone input with live search */}
                            <div className="relative">
                                <label className="block text-xs font-black text-[#1c3a1e] mb-1">
                                    Mobile Phone or Name *
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        placeholder="Search or type phone…"
                                        value={itemVipPhone}
                                        onChange={(e) => handleItemVipPhoneChange(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-sm font-black text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e] pr-8"
                                    />
                                    {itemVipSearching && (
                                        <span className="absolute right-3 top-3.5 text-gray-400 text-xs">⏳</span>
                                    )}
                                </div>

                                {/* Dropdown results */}
                                {itemVipResults.length > 0 && (
                                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-[#1c3a1e]/20 rounded-2xl shadow-xl overflow-hidden">
                                        {itemVipResults.map((cust) => (
                                            <button
                                                key={cust.id}
                                                type="button"
                                                onClick={() => selectExistingCustomer(cust)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-[#eaf2eb] transition-colors border-b border-[#1c3a1e]/10 last:border-0 cursor-pointer"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-xs font-black text-[#1c3a1e] block">{cust.customer_name}</span>
                                                        <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                                                            <Phone className="h-2.5 w-2.5" />
                                                            {cust.phone_number}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                                        🌟 {cust.points_balance} pts
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Name field - auto-filled when customer is selected */}
                            <div>
                                <label className="block text-xs font-black text-[#1c3a1e] mb-1">Customer Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Auto-filled or enter new name"
                                    value={itemVipCustName}
                                    onChange={(e) => setItemVipCustName(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-2.5 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            {/* Customer Loyalty Profile & Gift Redemption Card */}
                            {vipProfile && (
                                <div className="bg-[#eaf2eb] border border-[#1c3a1e]/20 rounded-2xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block">VIP Profile</span>
                                            <strong className="text-xs font-black text-[#1c3a1e] block">{vipProfile.customer_name}</strong>
                                            <span className="text-[10px] text-gray-600 font-bold">{vipProfile.phone_number}</span>
                                        </div>
                                        <div className="bg-white border border-amber-300 rounded-xl px-2.5 py-1 text-center shadow-2xs">
                                            <span className="text-[9px] text-gray-500 font-bold block">Balance</span>
                                            <strong className="text-xs font-black text-amber-800">🌟 {vipProfile.points_balance} PTS</strong>
                                        </div>
                                    </div>

                                    {/* Reward Tiers List */}
                                    {vipTiers.length > 0 && (
                                        <div className="space-y-1.5 pt-2 border-t border-[#1c3a1e]/15">
                                            <label className="block text-[10px] font-black text-[#1c3a1e] uppercase tracking-wider">
                                                🎁 Redeem Gifts / Rewards for Table:
                                            </label>
                                            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                                                {vipTiers.map((tier) => {
                                                    const canAfford = vipProfile.points_balance >= tier.points_required;
                                                    const isRedeemingThis = redeemingTierId === tier.id;
                                                    return (
                                                        <div key={tier.id} className="bg-white border border-[#1c3a1e]/15 rounded-xl p-2 flex justify-between items-center">
                                                            <div className="truncate max-w-[170px]">
                                                                <strong className="text-[11px] font-bold text-[#1c3a1e] block truncate">{tier.name}</strong>
                                                                <span className="text-[9px] text-gray-500 font-medium">{tier.points_required} pts (${tier.discount_value.toFixed(2)} off)</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRedeemGift(tier.id)}
                                                                disabled={!canAfford || itemVipLoading || isRedeemingThis}
                                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                                    canAfford
                                                                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs'
                                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                {isRedeemingThis ? (
                                                                    <span className="flex items-center gap-1">
                                                                        <span className="animate-spin text-xs">⏳</span>
                                                                        <span>Redeeming…</span>
                                                                    </span>
                                                                ) : canAfford ? (
                                                                    '🎁 Redeem'
                                                                ) : (
                                                                    'Need Pts'
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={itemVipLoading}
                                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-60"
                            >
                                {itemVipLoading ? 'Linking…' : '🌟 Link VIP to This Item'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

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

                {/* Action Buttons Toolbar — 4 buttons */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                    <button
                        onClick={() => {
                            const unassigned = activeItems.filter((i) => !i.loyalty_phone && !i.is_paid);
                            setItemVipTarget({ id: '__all__', name: `Assign all ${unassigned.length} unassigned item${unassigned.length !== 1 ? 's' : ''}` });
                            setItemVipPhone('');
                            setItemVipCustName('');
                            setItemVipToast('');
                            setItemVipResults([]);
                        }}
                        disabled={activeItems.filter((i) => !i.loyalty_phone && !i.is_paid).length === 0}
                        className="bg-[#d4af37]/20 hover:bg-[#d4af37]/30 border border-[#d4af37]/40 text-[#1c3a1e] font-extrabold py-2.5 px-1 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Assign one customer's phone to all unassigned items at once"
                    >
                        <Sparkles className="h-4 w-4 text-[#d4af37] shrink-0" />
                        <span>Assign All</span>
                    </button>

                    <button
                        onClick={onOpenDiscountModal}
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-1 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                        <Percent className="h-4 w-4 text-emerald-700" />
                        <span>Discount</span>
                    </button>

                    <button
                        onClick={onOpenPreviewReceipt}
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-1 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                        <Eye className="h-4 w-4 text-blue-700" />
                        <span>Preview</span>
                    </button>

                    <button
                        onClick={onOpenPaymentModal}
                        disabled={activeItems.length === 0 || activeItems.every((i) => i.is_paid)}
                        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-2.5 px-1 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CreditCard className="h-4 w-4 text-[#d4af37]" />
                        <span>Checkout</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
