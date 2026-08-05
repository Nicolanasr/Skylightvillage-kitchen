'use client';

import { useState, useEffect } from 'react';
import { useRealtimePOS } from '@/hooks/useRealtimePOS';
import { calculateBillTotals, formatLbp, formatUsd } from '@/lib/currency';
import { Table, TableSession, OrderItem, MenuItem } from '@/lib/types';
import {
    applyDiscount,
    removeDiscount,
    cancelOrderItem,
    restoreCancelledOrderItem,
    updateOrderItemQuantity,
    compOrderItem,
    mergeTables,
    unmergeSingleTable,
    processSplitPayment,
    requestPreBill,
    resolveServiceCall,
    assignItemsToGuest,
    closeTableSessionAction,
    updateTableStatusAction,
} from '../actions/payment-actions';
import { updateOrderItemStatus, updateMultipleOrderItemsStatus, addWaiterManualOrderItem } from '../actions/order-actions';
import { ThermalReceipt } from '@/components/pos/invoice-receipt';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import {
    Bell,
    ChefHat,
    CheckCircle2,
    Loader2,
    ChevronRight,
    CreditCard,
    DollarSign,
    Eye,
    Flame,
    Layers,
    Lock,
    MinusCircle,
    Monitor,
    Percent,
    Plus,
    Printer,
    Receipt,
    RotateCcw,
    Users,
    Utensils,
    X,
    Truck,
    Sparkles,
    Search,
    PlusCircle,
    Shield,
    ShieldAlert,
    Link as LinkIcon,
    Unlink,
    Trash2,
    UserCheck,
    UserPlus,
    User,
    QrCode,
    ChevronDown,
} from 'lucide-react';

export default function POSPage() {
    return (
        <StaffAuthGuard pageTitle="Waiter & Cashier POS Terminal">
            <POSContent />
        </StaffAuthGuard>
    );
}

function POSContent() {
    const { tables, sessions, serviceCalls, orderItems, discounts, payments, menuItems, categories, refreshPOSData } =
        useRealtimePOS();

    const [localOrderItems, setLocalOrderItems] = useState<OrderItem[]>([]);

    useEffect(() => {
        setLocalOrderItems(orderItems);
    }, [orderItems]);

    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showAllFloorTables, setShowAllFloorTables] = useState(false);
    const [cartSearchQuery, setCartSearchQuery] = useState<string>('');

    // Modals & Triggers
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [selectedSecondaryTableIds, setSelectedSecondaryTableIds] = useState<string[]>([]);

    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(10);
    const [discountReason, setDiscountReason] = useState<string>('Manager Discount');

    // Waiter Manual Item Addition Modal State
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [waiterSearchTerm, setWaiterSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [selectedMenuItemForWaiter, setSelectedMenuItemForWaiter] = useState<MenuItem | null>(null);
    const [selectedWaiterModifiers, setSelectedWaiterModifiers] = useState<any[]>([]);
    const [waiterQuantity, setWaiterQuantity] = useState(1);
    const [waiterNotes, setWaiterNotes] = useState('');

    // Dynamic Guest Assignment State
    const [isAssignGuestModalOpen, setIsAssignGuestModalOpen] = useState(false);
    const [newGuestInputName, setNewGuestInputName] = useState('');
    const [itemAssignQuantities, setItemAssignQuantities] = useState<Record<string, number>>({});

    // Payment Checkout Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [targetPaymentGuestName, setTargetPaymentGuestName] = useState<string | null>(null);
    const [isPayingEntireBill, setIsPayingEntireBill] = useState(false);
    const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'LBP'>('USD');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isPreviewReceiptModalOpen, setIsPreviewReceiptModalOpen] = useState(false);

    // Button Loading & Double-Click Prevention States
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isClosingSession, setIsClosingSession] = useState(false);
    const [deliveringItemIds, setDeliveringItemIds] = useState<Set<string>>(new Set());

    // Print Trigger State
    const [receiptToPrint, setReceiptToPrint] = useState<{
        tableNumber: number;
        items: OrderItem[];
        totals: any;
        isFinal: boolean;
        guestName?: string;
    } | null>(null);

    // Active Session Resolution & Merged Table Resolution
    const activeSession = selectedTable
        ? sessions.find(
            (s) =>
                (s.primary_table_id === selectedTable.id ||
                    s.merged_table_ids?.includes(selectedTable.id)) &&
                s.status === 'active'
        )
        : null;

    const activeSessionTableIds = activeSession
        ? Array.from(new Set([activeSession.primary_table_id, ...(activeSession.merged_table_ids || [])]))
        : [];

    const activeSessionTableNumbers = tables
        .filter((t) => activeSessionTableIds.includes(t.id))
        .map((t) => t.table_number);

    const sessionItems = activeSession
        ? localOrderItems.filter((i) =>
            i.session_id === activeSession.id ||
            (activeSessionTableNumbers.length > 0 &&
                i.table_number !== undefined &&
                activeSessionTableNumbers.includes(i.table_number) &&
                !i.is_paid &&
                i.status !== 'cancelled')
        )
        : [];

    const filteredCartItems = sessionItems.filter((item) => {
        if (!cartSearchQuery.trim()) return true;
        const q = cartSearchQuery.toLowerCase().trim();
        const nameMatch = item.item_name.toLowerCase().includes(q);
        const guestMatch = (item.guest_name || '').toLowerCase().includes(q);
        const noteMatch = (item.special_notes || '').toLowerCase().includes(q);
        const modMatch = (item.selected_modifiers || []).some((m: any) =>
            `${m.group || ''} ${m.option || m.name || ''}`.toLowerCase().includes(q)
        );
        return nameMatch || guestMatch || noteMatch || modMatch;
    });
    const sessionDiscounts = activeSession
        ? discounts.filter((d) => d.session_id === activeSession.id)
        : [];
    const sessionPayments = activeSession
        ? payments.filter((p) => p.session_id === activeSession.id)
        : [];

    const billTotals = calculateBillTotals(
        sessionItems,
        sessionDiscounts,
        sessionPayments,
        89500
    );

    const pendingServiceCalls = serviceCalls.filter((c) => c.status === 'pending');
    const readyForDeliveryItems = localOrderItems.filter((i) => i.status === 'ready');

    // Collect unique dynamic guest names for active session
    const dynamicGuestNames = Array.from(
        new Set(sessionItems.map((i) => i.guest_name).filter(Boolean) as string[])
    );

    // Handle Table Merging
    const handleMergeSubmit = async () => {
        if (!selectedTable || selectedSecondaryTableIds.length === 0) return;
        await mergeTables(selectedTable.id, selectedSecondaryTableIds);
        setIsMergeModalOpen(false);
        setSelectedSecondaryTableIds([]);
        refreshPOSData();
    };

    // Handle Table Unmerging
    const handleUnmergeTable = async (tableIdToUnmerge: string) => {
        if (!activeSession) return;
        await unmergeSingleTable(activeSession.id, tableIdToUnmerge);
        refreshPOSData();
    };

    // Handle Item Quantity Edit (+ / -)
    const handleQuantityEdit = async (orderItemId: string, delta: number) => {
        await updateOrderItemQuantity(orderItemId, delta);
        refreshPOSData();
    };

    // Handle Restore Cancelled Item Undo
    const handleRestoreCancelledItem = async (orderItemId: string) => {
        await restoreCancelledOrderItem(orderItemId);
        refreshPOSData();
    };

    // Handle Remove Discount Undo
    const handleRemoveDiscount = async (discountId: string) => {
        await removeDiscount(discountId);
        refreshPOSData();
    };

    // Handle Discount Application
    const handleApplyDiscountSubmit = async () => {
        if (!activeSession) return;
        await applyDiscount(activeSession.id, discountType, discountValue, discountReason);
        setIsDiscountModalOpen(false);
        refreshPOSData();
    };

    // Handle Assigning Items to Dynamic Guest with Quantity Selection
    const handleAssignItemsSubmit = async (targetGuest: string) => {
        const assignments = Object.entries(itemAssignQuantities)
            .filter(([_, qty]) => qty > 0)
            .map(([orderItemId, assignQty]) => ({ orderItemId, assignQty }));

        if (assignments.length === 0) {
            alert('Please select at least one item and quantity to assign to this guest!');
            return;
        }

        await assignItemsToGuest(assignments, targetGuest);
        setItemAssignQuantities({});
        setIsAssignGuestModalOpen(false);
        setNewGuestInputName('');
        refreshPOSData();
    };

    // ACTION 1: PRINT DYNAMIC GUEST BILL (Pre-bill preview for guest WITHOUT closing items)
    const handlePrintGuestBill = (guestName: string) => {
        if (!selectedTable) return;

        const guestItems = sessionItems.filter(
            (i) => i.guest_name === guestName && i.status !== 'cancelled'
        );

        if (guestItems.length === 0) {
            alert(`No active items found for ${guestName}`);
            return;
        }

        const guestBillTotals = calculateBillTotals(guestItems, [], [], 89500);

        setReceiptToPrint({
            tableNumber: selectedTable.table_number,
            items: guestItems,
            totals: guestBillTotals,
            isFinal: false,
            guestName: guestName,
        });

        setTimeout(() => {
            window.print();
        }, 300);
    };

    // ACTION 2: PAY & CLOSE GUEST ITEMS / ENTIRE TABLE BILL
    const handleOpenPayGuestModal = (guestName: string) => {
        setIsPayingEntireBill(false);
        setTargetPaymentGuestName(guestName);
        setIsPaymentModalOpen(true);
    };

    const handleOpenPayEntireBillModal = () => {
        setIsPayingEntireBill(true);
        setTargetPaymentGuestName(null);
        setIsPaymentModalOpen(true);
    };

    const handleCompleteGuestPayment = async () => {
        if (!activeSession || isProcessingPayment) return;
        setIsProcessingPayment(true);

        try {
            if (isPayingEntireBill) {
                const unpaidItems = sessionItems.filter(
                    (i) => i.status !== 'cancelled' && !i.is_paid
                );

                if (unpaidItems.length === 0) {
                    alert(`All items for Table #${selectedTable?.table_number} are already paid!`);
                    setIsPaymentModalOpen(false);
                    return;
                }

                const targetItemIds = unpaidItems.map((i) => i.id);
                const targetIdSet = new Set(targetItemIds);

                // OPTIMISTIC LOCAL UPDATE (0ms delay!)
                setLocalOrderItems((prev) =>
                    prev.map((i) => (targetIdSet.has(i.id) ? { ...i, is_paid: true } : i))
                );

                const res = await processSplitPayment({
                    sessionId: activeSession.id,
                    amountUsd: billTotals.remainingUsd,
                    currency: paymentCurrency,
                    paymentMethod,
                    paymentType: 'full',
                    itemIdsPaid: targetItemIds,
                });

                if (res.success) {
                    setReceiptToPrint({
                        tableNumber: selectedTable?.table_number || 1,
                        items: sessionItems,
                        totals: billTotals,
                        isFinal: true,
                    });

                    setTimeout(() => {
                        window.print();
                    }, 300);

                    setIsPaymentModalOpen(false);
                    setIsPayingEntireBill(false);
                    await refreshPOSData();
                }
            } else {
                if (!targetPaymentGuestName) return;

                const targetItems = sessionItems.filter(
                    (i) => i.guest_name === targetPaymentGuestName && i.status !== 'cancelled' && !i.is_paid
                );

                if (targetItems.length === 0) {
                    alert(`All items for ${targetPaymentGuestName} are already paid!`);
                    setIsPaymentModalOpen(false);
                    return;
                }

                const targetItemIds = targetItems.map((i) => i.id);
                const targetIdSet = new Set(targetItemIds);

                // OPTIMISTIC LOCAL UPDATE (0ms delay!)
                setLocalOrderItems((prev) =>
                    prev.map((i) => (targetIdSet.has(i.id) ? { ...i, is_paid: true } : i))
                );

                const payAmountUsd = targetItems.reduce((acc, item) => {
                    return acc + (item.is_comped ? 0 : Number(item.unit_price_usd) * item.quantity);
                }, 0);

                const res = await processSplitPayment({
                    sessionId: activeSession.id,
                    amountUsd: payAmountUsd,
                    currency: paymentCurrency,
                    paymentMethod,
                    paymentType: 'item_split',
                    itemIdsPaid: targetItemIds,
                });

                if (res.success) {
                    const guestBillTotals = calculateBillTotals(targetItems, [], [], 89500);

                    // Print Paid Thermal Receipt for Guest
                    setReceiptToPrint({
                        tableNumber: selectedTable?.table_number || 1,
                        items: targetItems,
                        totals: guestBillTotals,
                        isFinal: true,
                        guestName: targetPaymentGuestName,
                    });

                    setTimeout(() => {
                        window.print();
                    }, 300);

                    setIsPaymentModalOpen(false);
                    setTargetPaymentGuestName(null);
                    await refreshPOSData();
                }
            }
        } finally {
            setIsProcessingPayment(false);
        }
    };

    // Handle Waiter Adding Item to Table
    const handleAddWaiterItemSubmit = async () => {
        if (!selectedTable || !selectedMenuItemForWaiter || isAddingItem) return;
        setIsAddingItem(true);
        try {
            await addWaiterManualOrderItem({
                tableId: selectedTable.id,
                tableNumber: selectedTable.table_number,
                menuItemId: selectedMenuItemForWaiter.id,
                itemName: selectedMenuItemForWaiter.name,
                quantity: waiterQuantity,
                unitPriceUsd: Number(selectedMenuItemForWaiter.price_usd),
                station: selectedMenuItemForWaiter.station,
                selectedModifiers: selectedWaiterModifiers,
                specialNotes: waiterNotes || '',
            });

            setSelectedMenuItemForWaiter(null);
            setSelectedWaiterModifiers([]);
            setWaiterQuantity(1);
            setWaiterNotes('');
            setIsAddItemModalOpen(false);
            refreshPOSData();
        } finally {
            setIsAddingItem(false);
        }
    };

    // Handle Pre-Bill Printing for Whole Table
    const handlePrintPreBill = async () => {
        if (!selectedTable || !activeSession) return;
        await requestPreBill(activeSession.id);
        setReceiptToPrint({
            tableNumber: selectedTable.table_number,
            items: sessionItems.filter((i) => !i.is_paid),
            totals: billTotals,
            isFinal: false,
        });
        setTimeout(() => {
            window.print();
        }, 300);
        refreshPOSData();
    };

    // Handle Item Cancellation
    const handleCancelItem = async (item: OrderItem) => {
        if (item.status === 'preparing') {
            if (
                !confirm(
                    `Warning: Item "${item.item_name}" is already PREPARING in the kitchen! Confirm cancellation?`
                )
            ) {
                return;
            }
        }
        await cancelOrderItem(item.id);
        refreshPOSData();
    };

    // Handle Mark Delivered from POS Tray
    const handleMarkItemDelivered = async (itemId: string) => {
        if (deliveringItemIds.has(itemId)) return;
        setDeliveringItemIds((prev) => new Set([...Array.from(prev), itemId]));

        // OPTIMISTIC LOCAL UPDATE: Dish vanishes from ready tray in 0ms!
        setLocalOrderItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, status: 'delivered' } : i))
        );

        try {
            await updateOrderItemStatus(itemId, 'delivered');
            await refreshPOSData();
        } catch (e) {
            console.error('Error delivering item:', e);
        } finally {
            setDeliveringItemIds((prev) => {
                const next = new Set(Array.from(prev));
                next.delete(itemId);
                return next;
            });
        }
    };

    const filteredMenuItemsForWaiter = menuItems
        .filter((item) => {
            const matchesCategory =
                selectedCategoryFilter === 'all' || item.category_id === selectedCategoryFilter;
            const matchesSearch =
                item.name.toLowerCase().includes(waiterSearchTerm.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(waiterSearchTerm.toLowerCase()));
            return matchesCategory && matchesSearch;
        })
        .sort((a, b) => {
            const orderA = a.sort_order ?? 0;
            const orderB = b.sort_order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });

    // SIMPLIFIED FLOOR MATRIX: Show only 1 unified card per merged table group (hides all secondary merged tables)
    const visibleTablesOnMatrix = tables.filter((t) => {
        const isSecondaryMerged = sessions.some(
            (s) => s.status === 'active' && Array.isArray(s.merged_table_ids) && s.merged_table_ids.includes(t.id)
        );
        return !isSecondaryMerged;
    });

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c271c] p-4 md:p-6">
            {/* ESC/POS 80mm THERMAL RECEIPT PRINT CONTAINER */}
            {receiptToPrint && (
                <ThermalReceipt
                    tableNumber={receiptToPrint.tableNumber}
                    items={receiptToPrint.items}
                    totals={receiptToPrint.totals}
                    isFinal={receiptToPrint.isFinal}
                    guestName={targetPaymentGuestName || undefined}
                    sessionId={activeSession?.id}
                />
            )}

            {/* Top Header Bar with Skylight White Logo & Link to Admin */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-[#1c3a1e]/15 gap-4">
                <div className="flex items-center gap-4">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-10 w-auto object-contain filter invert"
                    />
                    <div>
                        <h1 className="text-xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-[#d4af37]" />
                            <span>Waiter & Cashier POS Terminal</span>
                        </h1>
                        <p className="text-xs text-gray-600 font-medium">Dynamic Multi-Guest Billing & Individual Thermal Receipts</p>
                    </div>
                </div>

                {/* System Info Badges & Quick Action Links */}
                <div className="flex items-center gap-3">
                    <a
                        href="/admin"
                        className="bg-[#faf5e6] hover:bg-[#f3eacb] border border-[#d4af37]/40 text-[#997a15] font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Shield className="h-4 w-4 text-[#d4af37]" />
                        <span>Admin Manager Portal</span>
                    </a>
                    <a
                        href="/kds"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <ChefHat className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Kitchen KDS Terminal</span>
                    </a>
                    <div className="bg-[#eaf2eb] border border-[#1c3a1e]/15 px-3.5 py-2 rounded-xl text-xs font-bold text-[#1c3a1e] flex items-center gap-2">
                        <span>Rate: 89,500 LBP / $1</span>
                    </div>
                </div>
            </header>

            {/* READY FOR TABLE DELIVERY EXPEDITER TRAY */}
            {readyForDeliveryItems.length > 0 && (
                <div className="mb-6 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 animate-in fade-in shadow-md">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                            <Truck className="h-5 w-5 animate-bounce text-emerald-600" />
                            <span>READY FOR TABLE DELIVERY ({readyForDeliveryItems.length} ITEMS READY)</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                            Deliver to Tables Now
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(
                            readyForDeliveryItems.reduce<Record<number, OrderItem[]>>((acc, item) => {
                                const tblNum = item.table_number || 1;
                                if (!acc[tblNum]) acc[tblNum] = [];
                                acc[tblNum].push(item);
                                return acc;
                            }, {})
                        ).map(([tblNum, tableItems]) => (
                            <div
                                key={tblNum}
                                className="bg-white border-2 border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between shadow-md"
                            >
                                <div>
                                    <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/10 mb-3">
                                        <span className="font-black text-[#1c3a1e] text-base">
                                            TABLE #{tblNum} TRAY
                                        </span>
                                        <span className="bg-emerald-500/20 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-500/30">
                                            {tableItems.length} ITEM(S) READY
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {tableItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="bg-[#fafbfa] border border-[#1c3a1e]/10 rounded-xl p-2.5 flex justify-between items-center"
                                            >
                                                <div>
                                                    <span className="font-extrabold text-xs text-[#1c3a1e] block">
                                                        {item.quantity > 1 ? `${item.quantity}x ` : '1x '}{item.item_name}
                                                    </span>
                                                    {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                        <div className="text-[10px] text-gray-600 font-semibold pl-1.5 mt-0.5 space-y-0.5">
                                                            {item.selected_modifiers.map((m: any, idx: number) => (
                                                                <div key={idx}>• {m.group}: {m.option}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                                        <div className="text-[10px] text-emerald-800 font-medium italic pl-1.5 mt-0.5">
                                                            Note: {item.special_notes}
                                                        </div>
                                                    )}
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase block mt-1">
                                                        Station: {item.station.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <button
                                                    disabled={deliveringItemIds.has(item.id)}
                                                    onClick={() => handleMarkItemDelivered(item.id)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-all shrink-0 ml-2 flex items-center gap-1.5 shadow-sm"
                                                >
                                                    {deliveringItemIds.has(item.id) ? (
                                                        <>
                                                            <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                            <span>Delivering...</span>
                                                        </>
                                                    ) : (
                                                        <span>Deliver Dish</span>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    disabled={tableItems.some((i) => deliveringItemIds.has(i.id))}
                                    onClick={async () => {
                                        const ids = tableItems.map((i) => i.id);
                                        setDeliveringItemIds((prev) => new Set([...Array.from(prev), ...ids]));

                                        // OPTIMISTIC LOCAL UPDATE: Entire table tray vanishes in 0ms!
                                        const idSet = new Set(ids);
                                        setLocalOrderItems((prev) =>
                                            prev.map((i) => (idSet.has(i.id) ? { ...i, status: 'delivered' } : i))
                                        );

                                        try {
                                            await updateMultipleOrderItemsStatus(ids, 'delivered');
                                            await refreshPOSData();
                                        } finally {
                                            setDeliveringItemIds((prev) => {
                                                const next = new Set(Array.from(prev));
                                                ids.forEach((id) => next.delete(id));
                                                return next;
                                            });
                                        }
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    {tableItems.some((i) => deliveringItemIds.has(i.id)) ? (
                                        <>
                                            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Delivering Tray...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Deliver Entire Table #{tblNum} Tray</span>
                                            <CheckCircle2 className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Service Alert Notification Drawer Tray */}
            {pendingServiceCalls.length > 0 && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 animate-in fade-in">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-amber-800 font-extrabold text-sm">
                            <Bell className="h-5 w-5 animate-bounce text-amber-600" />
                            <span>Active Service Alerts ({pendingServiceCalls.length})</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {pendingServiceCalls.map((call) => (
                            <div
                                key={call.id}
                                className="bg-white border border-[#1c3a1e]/15 rounded-xl p-3 flex items-center justify-between shadow-sm"
                            >
                                <div>
                                    <span className="font-extrabold text-[#1c3a1e] text-sm">
                                        Table #{call.table_number}
                                    </span>
                                    <div className="text-xs text-gray-700 font-bold capitalize flex items-center gap-1.5 mt-0.5">
                                        {call.type === 'waiter' && <Bell className="h-3.5 w-3.5 text-[#1c3a1e]" />}
                                        {call.type === 'charcoal' && <Flame className="h-3.5 w-3.5 text-orange-600" />}
                                        {call.type === 'bill' && <Receipt className="h-3.5 w-3.5 text-emerald-700" />}
                                        <span>{call.type.toUpperCase()} REQUESTED</span>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        await resolveServiceCall(call.id);
                                        refreshPOSData();
                                    }}
                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm"
                                >
                                    Resolve
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main POS Interface: Left Table Matrix, Right Session Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Visual Table Matrix (7 Cols) */}
                <div className="lg:col-span-7">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-base font-extrabold text-[#1c3a1e]">Floor Layout & Table Matrix</h2>
                            <button
                                onClick={() => {
                                    if (!selectedTable) {
                                        alert('Please click a primary table on the floor layout first to merge other tables into it!');
                                        return;
                                    }
                                    setIsMergeModalOpen(true);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                            >
                                <Layers className="h-4 w-4" />
                                <span>Merge Tables</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
                            <span className="flex items-center gap-1.5 text-emerald-700">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span> Available
                            </span>
                            <span className="flex items-center gap-1.5 text-blue-700">
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span> Occupied
                            </span>
                            <span className="flex items-center gap-1.5 text-purple-700">
                                <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span> Merged (1 Card)
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-700">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Bill Requested
                            </span>
                        </div>
                    </div>

                    {/* SIMPLIFIED GRID VIEW: Merged tables shown as 1 unified table card (First 4 Rows / 16 tables initially) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(showAllFloorTables ? visibleTablesOnMatrix : visibleTablesOnMatrix.slice(0, 16)).map((tbl) => {
                            const isSelected = selectedTable?.id === tbl.id;

                            const sess = sessions.find(
                                (s) =>
                                    (s.primary_table_id === tbl.id || s.merged_table_ids?.includes(tbl.id)) &&
                                    s.status === 'active'
                            );

                            // Check if this primary table is merged with secondary tables
                            const isMergedMaster = sess && sess.merged_table_ids?.length > 0;
                            const mergedTableNumbers = isMergedMaster
                                ? sess.merged_table_ids
                                    .map((id) => tables.find((t) => t.id === id)?.table_number)
                                    .filter(Boolean)
                                : [];

                            const statusColorClasses = isMergedMaster
                                ? 'border-purple-500/50 bg-purple-500/10 hover:border-purple-600'
                                : {
                                    available: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-600',
                                    occupied: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-600',
                                    merged: 'border-purple-500/50 bg-purple-500/10 hover:border-purple-600',
                                    bill_requested: 'border-amber-500/40 bg-amber-500/10 hover:border-amber-600 animate-pulse',
                                }[tbl.status];

                            const badgeColors = isMergedMaster
                                ? 'bg-purple-600 text-white font-black'
                                : {
                                    available: 'bg-emerald-500/20 text-emerald-800',
                                    occupied: 'bg-blue-500/20 text-blue-800',
                                    merged: 'bg-purple-600 text-white font-black',
                                    bill_requested: 'bg-amber-500/20 text-amber-800',
                                }[tbl.status];

                            const tblItems = sess ? orderItems.filter((i) => i.session_id === sess.id) : [];
                            const tblBill = calculateBillTotals(tblItems, [], [], 89500);
                            const hasReadyFood = tblItems.some((i) => i.status === 'ready');

                            // Table Number Label (e.g. Table #1 + #2 + #3)
                            const tableLabel = isMergedMaster
                                ? `Table #${tbl.table_number} + #${mergedTableNumbers.join(' + #')}`
                                : `Table #${tbl.table_number}`;

                            return (
                                <div
                                    key={tbl.id}
                                    onClick={() => setSelectedTable(tbl)}
                                    className={`bg-white rounded-2xl p-4 flex flex-col justify-between cursor-pointer border-2 transition-all min-h-[140px] relative shadow-sm hover:shadow-md ${statusColorClasses} ${isSelected ? 'ring-2 ring-[#1c3a1e] border-[#1c3a1e] scale-[1.02]' : ''
                                        }`}
                                >
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-base font-black text-[#1c3a1e] leading-tight">
                                                {tableLabel}
                                            </span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-1 ${badgeColors}`}>
                                                {isMergedMaster ? 'MERGED' : tbl.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>

                                        {isMergedMaster && (
                                            <div className="mt-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-1.5 text-[10px] font-bold text-purple-800 flex items-center gap-1">
                                                <Layers className="h-3 w-3 text-purple-600" />
                                                <span>COMBINED SESSION</span>
                                            </div>
                                        )}

                                        {hasReadyFood && (
                                            <span className="mt-2 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 w-max shadow-sm animate-bounce">
                                                <Truck className="h-3 w-3" /> FOOD READY
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 pt-2 border-t border-[#1c3a1e]/10 flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-bold">Running Total:</span>
                                        <span className="font-black text-[#1c3a1e]">{formatUsd(tblBill.remainingUsd)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* SHOW MORE / LOAD REMAINING TABLES BUTTON */}
                    {visibleTablesOnMatrix.length > 16 && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setShowAllFloorTables(!showAllFloorTables)}
                                className="w-full py-3 px-4 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAllFloorTables ? 'rotate-180' : ''}`} />
                                <span>
                                    {showAllFloorTables
                                        ? 'Show Less Tables (First 4 Rows)'
                                        : `Show More Tables (${visibleTablesOnMatrix.length - 16} More Tables Available)`}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Column: Selected Table Check & Dynamic Guest Items (5 Cols) */}
                <div className="lg:col-span-5">
                    {!selectedTable ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-[#1c3a1e]/15 shadow-sm">
                            <Utensils className="h-12 w-12 mx-auto mb-4 text-[#1c3a1e] opacity-30" />
                            <h3 className="text-lg font-bold text-[#1c3a1e]">Select a Table to Manage</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Click any table on the floor layout to inspect orders, assign items to dynamic guests, print individual guest bills, or process payments.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-6 border border-[#1c3a1e]/15 flex flex-col justify-between h-full shadow-sm text-[#1c3a1e]">
                            <div>
                                {/* Table Header & Action Buttons */}
                                <div className="pb-4 border-b border-[#1c3a1e]/15 mb-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-black text-[#1c3a1e]">
                                                {activeSession && activeSession.primary_table_id === selectedTable.id && activeSession.merged_table_ids?.length > 0
                                                    ? `Table #${selectedTable.table_number} + #${activeSession.merged_table_ids
                                                        .map((id) => tables.find((t) => t.id === id)?.table_number)
                                                        .filter(Boolean)
                                                        .join(' + #')}`
                                                    : `Table #${selectedTable.table_number}`}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[11px] font-bold text-gray-600">Status:</span>
                                                <select
                                                    value={selectedTable.status}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        await updateTableStatusAction(selectedTable.id, newStatus);
                                                        refreshPOSData();
                                                    }}
                                                    className="bg-[#fafbfa] border border-[#1c3a1e]/20 text-[#1c3a1e] text-xs font-extrabold px-2.5 py-1 rounded-xl focus:outline-none focus:border-[#1c3a1e] transition-all cursor-pointer"
                                                >
                                                    <option value="available">🟢 AVAILABLE</option>
                                                    <option value="occupied">🔴 OCCUPIED</option>
                                                    <option value="bill_requested">📄 BILL REQUESTED</option>
                                                    <option value="merged">🟣 MERGED</option>
                                                </select>
                                            </div>
                                            {activeSession && activeSession.merged_table_ids?.length > 0 && (
                                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-purple-800 font-bold uppercase">Merged Tables:</span>
                                                    {activeSession.merged_table_ids.map((mId) => {
                                                        const mTable = tables.find((t) => t.id === mId);
                                                        if (!mTable) return null;
                                                        return (
                                                            <button
                                                                key={mId}
                                                                onClick={() => handleUnmergeTable(mId)}
                                                                className="bg-purple-500/10 hover:bg-red-500/10 border border-purple-500/30 hover:border-red-500/30 text-purple-900 hover:text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                                                                title="Click to unmerge this table"
                                                            >
                                                                <Unlink className="h-3 w-3" />
                                                                <span>Unmerge Table #{mTable.table_number}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => setIsAddItemModalOpen(true)}
                                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white p-2 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                            >
                                                <PlusCircle className="h-4 w-4" />
                                                <span>Add Items</span>
                                            </button>

                                            <button
                                                onClick={() => setIsMergeModalOpen(true)}
                                                className="bg-purple-600 hover:bg-purple-700 text-white p-2 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                                title="Merge other tables into this table session"
                                            >
                                                <Layers className="h-4 w-4" />
                                                <span>Merge Table</span>
                                            </button>

                                            <button
                                                onClick={() => setIsAssignGuestModalOpen(true)}
                                                className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] p-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                <span>Assign Guest</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* DYNAMIC GUESTS CARDS SUMMARY SECTION */}
                                {dynamicGuestNames.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <h3 className="text-xs font-extrabold text-[#1c3a1e] uppercase tracking-wider">
                                            Dynamic Guests ({dynamicGuestNames.length}):
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            {dynamicGuestNames.map((gName) => {
                                                const gItems = sessionItems.filter(
                                                    (i) => i.guest_name === gName && i.status !== 'cancelled'
                                                );
                                                const gUnpaid = gItems.filter((i) => !i.is_paid && !i.is_comped);
                                                const gTotalUsd = gItems.reduce(
                                                    (acc, i) => acc + (i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity),
                                                    0
                                                );
                                                const isAllPaid = gItems.length > 0 && gUnpaid.length === 0;

                                                return (
                                                    <div
                                                        key={gName}
                                                        className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${isAllPaid
                                                            ? 'bg-emerald-500/10 border-emerald-500/40'
                                                            : 'bg-[#fafbfa] border-[#1c3a1e]/15'
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xs text-[#1c3a1e] flex items-center gap-1">
                                                                    <User className="h-3.5 w-3.5 text-[#1c3a1e]" /> {gName}
                                                                </span>
                                                                {isAllPaid ? (
                                                                    <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                                                                        ALL PAID
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-amber-500/20 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                        {gUnpaid.length} UNPAID ITEM(S)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-gray-600 font-semibold block mt-0.5">
                                                                Subtotal: <strong className="text-[#1c3a1e]">${gTotalUsd.toFixed(2)}</strong>
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* SEPARATE ACTION 1: PRINT GUEST BILL (PRE-BILL WITHOUT CLOSING) */}
                                                            <button
                                                                onClick={() => handlePrintGuestBill(gName)}
                                                                className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                                                title="Print Pre-Bill for Guest"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                                <span>Print Bill</span>
                                                            </button>

                                                            {/* SEPARATE ACTION 2: PAY & CLOSE GUEST ITEMS */}
                                                            {!isAllPaid && (
                                                                <button
                                                                    onClick={() => handleOpenPayGuestModal(gName)}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black p-2 px-3 rounded-xl text-xs transition-all flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <CreditCard className="h-3.5 w-3.5" />
                                                                    <span>Pay & Close</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CART SEARCH BAR */}
                                {sessionItems.length > 0 && (
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search items in cart, guests, or notes... 🔍"
                                            value={cartSearchQuery}
                                            onChange={(e) => setCartSearchQuery(e.target.value)}
                                            className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 text-[#1c3a1e] font-bold text-xs pl-9 pr-8 py-2 rounded-xl outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                                        />
                                        {cartSearchQuery && (
                                            <button
                                                onClick={() => setCartSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-0.5 cursor-pointer text-xs"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Session Order Items List with Guest Tags & Paid Badges */}
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {sessionItems.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500 text-xs mb-3">No order items submitted yet for Table #{selectedTable.table_number}.</p>
                                            <button
                                                onClick={() => setIsAddItemModalOpen(true)}
                                                className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                                            >
                                                + Add First Order Item as Waiter
                                            </button>
                                        </div>
                                    ) : filteredCartItems.length === 0 ? (
                                        <div className="text-center py-6 bg-[#fafbfa] rounded-xl border border-dashed border-gray-300">
                                            <p className="text-gray-500 text-xs font-bold mb-2">No cart items match "{cartSearchQuery}"</p>
                                            <button
                                                onClick={() => setCartSearchQuery('')}
                                                className="text-[11px] text-[#1c3a1e] font-black underline hover:text-[#d4af37] cursor-pointer"
                                            >
                                                Clear Search Filter
                                            </button>
                                        </div>
                                    ) : (
                                        filteredCartItems.map((item) => (
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
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {/* Dynamic Guest Tag */}
                                                            {item.guest_name && (
                                                                <span className="bg-purple-500/10 text-purple-900 border border-purple-500/30 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                    <User className="h-3 w-3" /> {item.guest_name}
                                                                </span>
                                                            )}

                                                            {/* Quantity Editor Controls (+ / -) */}
                                                            {!item.is_paid && item.status !== 'cancelled' ? (
                                                                <div className="flex items-center bg-white border border-[#1c3a1e]/20 rounded-lg shadow-sm">
                                                                    <button
                                                                        onClick={() => handleQuantityEdit(item.id, -1)}
                                                                        className="h-6 w-6 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="px-2 text-xs font-black text-[#1c3a1e]">{item.quantity}</span>
                                                                    <button
                                                                        onClick={() => handleQuantityEdit(item.id, 1)}
                                                                        className="h-6 w-6 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className={`font-black text-xs ${item.status === 'cancelled' ? 'line-through text-red-500' : 'text-emerald-700'}`}>
                                                                    {item.quantity}x
                                                                </span>
                                                            )}

                                                            <span className={`font-black text-xs ${item.is_paid ? 'text-emerald-800' : item.status === 'cancelled' ? 'line-through text-red-500' : 'text-[#1c3a1e]'}`}>
                                                                {item.item_name}
                                                            </span>

                                                            {item.is_paid && (
                                                                <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
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

                                                    <span className={`text-xs font-black ${item.is_paid ? 'text-emerald-800' : item.status === 'cancelled' ? 'line-through text-red-500' : 'text-[#1c3a1e]'}`}>
                                                        {item.is_comped || item.status === 'cancelled' ? '$0.00' : formatUsd(Number(item.unit_price_usd) * item.quantity)}
                                                    </span>
                                                </div>

                                                {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                    <div className="text-[10px] text-gray-700 font-extrabold mt-1">
                                                        {item.selected_modifiers.map((m) => `${m.group}: ${m.option}`).join(', ')}
                                                    </div>
                                                )}

                                                {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                                    <div className="text-[10px] text-emerald-800 font-bold italic mt-0.5">
                                                        Note: {item.special_notes}
                                                    </div>
                                                )}

                                                {/* Card Action Footer */}
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
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded shadow-sm"
                                                        >
                                                            Deliver to Table
                                                        </button>
                                                    )}

                                                    {!item.is_paid && (
                                                        item.status === 'cancelled' ? (
                                                            <button
                                                                onClick={() => handleRestoreCancelledItem(item.id)}
                                                                className="text-[10px] text-[#1c3a1e] hover:underline font-bold flex items-center gap-1"
                                                            >
                                                                <RotateCcw className="h-3 w-3" />
                                                                <span>Undo Cancel</span>
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => compOrderItem(item.id)}
                                                                    className="text-[10px] text-purple-800 hover:underline font-bold"
                                                                >
                                                                    {item.is_comped ? 'Undo Comp' : 'Comp Item'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCancelItem(item)}
                                                                    className="text-[10px] text-red-600 hover:underline font-bold"
                                                                >
                                                                    Cancel Item
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Bill Totals & Main Action Buttons */}
                            <div className="pt-4 border-t border-[#1c3a1e]/15 mt-6 space-y-3">
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
                                                    className="text-red-600 hover:text-red-700 font-extrabold ml-1 text-[10px]"
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

                                    {/* Button Action Bar */}
                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                        <button
                                            onClick={() => setIsDiscountModalOpen(true)}
                                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                                            title="Apply Session Discount"
                                        >
                                            <Percent className="h-4 w-4 text-emerald-700" />
                                            <span>Discount</span>
                                        </button>

                                        <button
                                            onClick={() => setIsPreviewReceiptModalOpen(true)}
                                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                                            title="Preview Thermal Receipt On-Screen"
                                        >
                                            <Eye className="h-4 w-4 text-blue-700" />
                                            <span>Preview</span>
                                        </button>

                                        <button
                                            onClick={handlePrintPreBill}
                                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                                            title="Print Table Bill"
                                        >
                                            <Printer className="h-4 w-4 text-[#1c3a1e]" />
                                            <span>Print</span>
                                        </button>
                                    </div>
                                </div>

                                {/* PAY ENTIRE TABLE BILL AS 1 CHECK BUTTON */}
                                <button
                                    onClick={handleOpenPayEntireBillModal}
                                    disabled={billTotals.remainingUsd <= 0}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20 transition-all mt-2 cursor-pointer"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    <span>Pay Entire Table Bill ({formatUsd(billTotals.remainingUsd)})</span>
                                </button>

                                {/* CLOSE TABLE SESSION & CLEAR PENDING ITEMS BUTTON */}
                                <button
                                    disabled={isClosingSession}
                                    onClick={async () => {
                                        if (!activeSession || isClosingSession) return;
                                        if (
                                            confirm(
                                                `Are you sure you want to CLOSE Table #${selectedTable?.table_number} session? This will cancel all unserved pending items and reset table to AVAILABLE.`
                                            )
                                        ) {
                                            setIsClosingSession(true);
                                            try {
                                                const activeStaffJSON = sessionStorage.getItem('skylight_staff_member');
                                                let sName = 'Waiter';
                                                let sRole = 'Staff';
                                                if (activeStaffJSON) {
                                                    try {
                                                        const parsed = JSON.parse(activeStaffJSON);
                                                        sName = parsed.name;
                                                        sRole = parsed.role;
                                                    } catch (e) { }
                                                }
                                                await closeTableSessionAction(activeSession.id, sName, sRole);
                                                setSelectedTable(null);
                                                refreshPOSData();
                                            } finally {
                                                setIsClosingSession(false);
                                            }
                                        }
                                    }}
                                    className={`w-full font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all mt-2 ${isClosingSession
                                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 active:scale-95'
                                        }`}
                                >
                                    <X className="h-4 w-4 text-red-400" />
                                    <span>{isClosingSession ? 'Closing Table Session...' : `Close Table #${selectedTable?.table_number} Session & Clear Pending`}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* DYNAMIC GUEST ASSIGNMENT MODAL */}
            {isAssignGuestModalOpen && selectedTable && activeSession && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2 text-purple-900 font-extrabold text-base">
                                <UserPlus className="h-5 w-5" />
                                <span>Assign Items to Dynamic Guest</span>
                            </div>
                            <button onClick={() => setIsAssignGuestModalOpen(false)} className="text-gray-500 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Guest Name Input / Selector */}
                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-extrabold text-[#1c3a1e]">
                                Guest Name / Person Label:
                            </label>
                            <input
                                type="text"
                                value={newGuestInputName}
                                onChange={(e) => setNewGuestInputName(e.target.value)}
                                placeholder="Type name (e.g. John, Sarah, Seat 1, Mike)..."
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                            />

                            {dynamicGuestNames.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="text-[10px] text-gray-600 font-bold self-center">Existing:</span>
                                    {dynamicGuestNames.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setNewGuestInputName(g)}
                                            className="bg-[#fafbfa] border border-purple-500/40 text-purple-900 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-purple-500/10 transition-all"
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Select Unpaid Items and Quantities to Assign */}
                        <div className="mb-6 bg-[#fafbfa] p-4 rounded-2xl border border-[#1c3a1e]/15 space-y-2.5 max-h-60 overflow-y-auto">
                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#1c3a1e]/10">
                                <span className="text-xs font-extrabold text-[#1c3a1e]">
                                    Select Quantities to Assign to {newGuestInputName || 'Guest'}:
                                </span>
                                <button
                                    onClick={() => {
                                        const unassigned = sessionItems.filter((i) => i.status !== 'cancelled' && !i.is_paid);
                                        const allMap: Record<string, number> = {};
                                        unassigned.forEach((i) => {
                                            allMap[i.id] = i.quantity;
                                        });
                                        setItemAssignQuantities(allMap);
                                    }}
                                    className="text-[10px] text-purple-800 font-extrabold hover:underline"
                                >
                                    Assign All Quantities
                                </button>
                            </div>

                            {sessionItems
                                .filter((i) => i.status !== 'cancelled' && !i.is_paid)
                                .map((item) => {
                                    const currentAssignQty = itemAssignQuantities[item.id] || 0;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3 rounded-xl border flex justify-between items-center transition-all ${currentAssignQty > 0
                                                ? 'bg-purple-500/10 border-purple-500 text-purple-900'
                                                : 'bg-white border-[#1c3a1e]/15 text-[#1c3a1e]'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-xs text-[#1c3a1e]">{item.item_name}</span>
                                                    {item.guest_name && (
                                                        <span className="text-[9px] text-purple-900 bg-purple-500/20 px-1.5 py-0.5 rounded font-bold">
                                                            Current: {item.guest_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-600 font-bold block mt-0.5">
                                                    Available: {item.quantity}x @ ${Number(item.unit_price_usd).toFixed(2)}/ea
                                                </span>
                                            </div>

                                            {/* Quantity Picker for Assignment */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-lg">
                                                    <button
                                                        onClick={() => {
                                                            setItemAssignQuantities({
                                                                ...itemAssignQuantities,
                                                                [item.id]: Math.max(0, currentAssignQty - 1),
                                                            });
                                                        }}
                                                        className="h-7 w-7 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="px-2.5 text-xs font-black text-[#1c3a1e]">{currentAssignQty}</span>
                                                    <button
                                                        onClick={() => {
                                                            setItemAssignQuantities({
                                                                ...itemAssignQuantities,
                                                                [item.id]: Math.min(item.quantity, currentAssignQty + 1),
                                                            });
                                                        }}
                                                        className="h-7 w-7 text-gray-700 hover:text-black flex items-center justify-center text-xs font-black"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        <button
                            onClick={() => handleAssignItemsSubmit(newGuestInputName || 'Guest')}
                            disabled={!newGuestInputName || Object.values(itemAssignQuantities).every((q) => q <= 0)}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                            <UserCheck className="h-4 w-4" />
                            <span>Assign Selected Quantities to {newGuestInputName || 'Guest'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* PAY & CLOSE GUEST ITEMS / ENTIRE BILL PAYMENT MODAL */}
            {isPaymentModalOpen && activeSession && (targetPaymentGuestName || isPayingEntireBill) && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
                            <div>
                                <h3 className="text-lg font-black text-[#1c3a1e]">
                                    {isPayingEntireBill
                                        ? `Pay Entire Table #${selectedTable?.table_number} Bill`
                                        : `Pay & Close Items for ${targetPaymentGuestName}`}
                                </h3>
                                <p className="text-xs text-emerald-700 font-black mt-0.5">
                                    Total Due:{' '}
                                    {formatUsd(
                                        isPayingEntireBill
                                            ? billTotals.remainingUsd
                                            : sessionItems
                                                .filter((i) => i.guest_name === targetPaymentGuestName && i.status !== 'cancelled' && !i.is_paid)
                                                .reduce((acc, i) => acc + (i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity), 0)
                                    )}
                                </p>
                            </div>
                            <button onClick={() => { setIsPaymentModalOpen(false); setIsPayingEntireBill(false); }} className="text-gray-500 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Currency & Payment Method Selection */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Tender Currency</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPaymentCurrency('USD')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${paymentCurrency === 'USD'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                            : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                            }`}
                                    >
                                        USD ($)
                                    </button>
                                    <button
                                        onClick={() => setPaymentCurrency('LBP')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${paymentCurrency === 'LBP'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                            : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                            }`}
                                    >
                                        LBP (LL)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Method</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${paymentMethod === 'cash'
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                            }`}
                                    >
                                        Cash
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('card')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${paymentMethod === 'card'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                            }`}
                                    >
                                        Card
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCompleteGuestPayment}
                            disabled={isProcessingPayment}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                            {isProcessingPayment ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    <span>Processing Payment & Printing...</span>
                                </>
                            ) : (
                                <>
                                    <CreditCard className="h-4 w-4" />
                                    <span>
                                        {isPayingEntireBill
                                            ? `Confirm & Mark Entire Table #${selectedTable?.table_number} Paid`
                                            : `Mark Paid & Print Receipt for ${targetPaymentGuestName}`}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* WAITER MANUAL ITEM & STAFF FEE ADDITION MODAL */}
            {isAddItemModalOpen && selectedTable && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between overflow-hidden text-[#1c3a1e]">
                        <div>
                            <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15 mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1c3a1e]">
                                        Add Item / Staff Fee to Table #{selectedTable.table_number}
                                    </h3>
                                    <p className="text-xs text-gray-600 font-semibold">
                                        Waiter Manual Order Addition Entry
                                    </p>
                                </div>
                                <button onClick={() => setIsAddItemModalOpen(false)} className="text-gray-500 hover:text-black">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Search & Category Filter */}
                            <div className="space-y-3 mb-4">
                                <div className="relative">
                                    <Search className="h-4 w-4 text-gray-500 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={waiterSearchTerm}
                                        onChange={(e) => setWaiterSearchTerm(e.target.value)}
                                        placeholder="Search menu items or staff fees (e.g. Event fee, Tawook, Shisha)..."
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                    />
                                </div>

                                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <button
                                        onClick={() => setSelectedCategoryFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedCategoryFilter === 'all'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                            : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15'
                                            }`}
                                    >
                                        All Items
                                    </button>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryFilter(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedCategoryFilter === cat.id
                                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15'
                                                }`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Menu Item Grid Selector */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto mb-4 p-1">
                                {filteredMenuItemsForWaiter.map((item) => {
                                    const isSelected = selectedMenuItemForWaiter?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedMenuItemForWaiter(item)}
                                            className={`p-3 rounded-xl border text-left transition-all flex justify-between items-start ${isSelected
                                                ? 'bg-[#eaf2eb] border-[#1c3a1e] ring-2 ring-[#1c3a1e]'
                                                : 'bg-[#fafbfa] border-[#1c3a1e]/15 hover:border-[#1c3a1e]'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-extrabold text-xs text-[#1c3a1e]">{item.name}</span>
                                                    {item.is_staff_only && (
                                                        <span className="bg-purple-500/10 text-purple-900 border border-purple-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                                                            STAFF FEE
                                                        </span>
                                                    )}
                                                </div>
                                                {item.description && (
                                                    <p className="text-[10px] text-gray-600 line-clamp-1 mt-0.5 font-medium">{item.description}</p>
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-[#1c3a1e] whitespace-nowrap ml-2">
                                                {formatUsd(Number(item.price_usd))}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected Item Quantity & Special Notes */}
                            {selectedMenuItemForWaiter && (
                                <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 p-4 rounded-2xl space-y-3 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black text-[#1c3a1e]">
                                            Selected: {selectedMenuItemForWaiter.name}
                                        </span>
                                        <span className="text-xs font-black text-emerald-800">
                                            {formatUsd(Number(selectedMenuItemForWaiter.price_usd) * waiterQuantity)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-700 font-bold">Quantity:</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setWaiterQuantity(Math.max(1, waiterQuantity - 1))}
                                                className="h-8 w-8 bg-white text-[#1c3a1e] border border-[#1c3a1e]/20 rounded-lg flex items-center justify-center text-sm font-black shadow-sm"
                                            >
                                                -
                                            </button>
                                            <span className="text-sm font-black text-[#1c3a1e]">{waiterQuantity}</span>
                                            <button
                                                onClick={() => setWaiterQuantity(waiterQuantity + 1)}
                                                className="h-8 w-8 bg-white text-[#1c3a1e] border border-[#1c3a1e]/20 rounded-lg flex items-center justify-center text-sm font-black shadow-sm"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                                            Note / Custom Instructions
                                        </label>
                                        <input
                                            type="text"
                                            value={waiterNotes}
                                            onChange={(e) => setWaiterNotes(e.target.value)}
                                            placeholder="e.g. Requested by guest, extra sauce, well done..."
                                            className="w-full bg-white border border-[#1c3a1e]/20 rounded-xl p-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                        />
                                    </div>

                                    {/* TOUCHSCREEN VARIANT & MODIFIER SELECTOR */}
                                    {selectedMenuItemForWaiter.modifier_groups && selectedMenuItemForWaiter.modifier_groups.length > 0 && (
                                        <div className="space-y-2 border-t border-[#1c3a1e]/15 pt-3">
                                            <label className="block text-xs font-black text-[#1c3a1e] uppercase tracking-wider">
                                                Select Touch Variants & Modifiers:
                                            </label>
                                            {selectedMenuItemForWaiter.modifier_groups.map((group, gIdx) => (
                                                <div key={gIdx} className="bg-white border border-[#1c3a1e]/15 rounded-xl p-2.5">
                                                    <span className="text-[11px] font-extrabold text-[#1c3a1e] block mb-1.5">{group.group_name}:</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {group.options.map((opt, oIdx) => {
                                                            const isSelected = selectedWaiterModifiers.some(
                                                                (m) => m.group === group.group_name && m.option === opt.name
                                                            );
                                                            return (
                                                                <button
                                                                    key={oIdx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            setSelectedWaiterModifiers(
                                                                                selectedWaiterModifiers.filter(
                                                                                    (m) => !(m.group === group.group_name && m.option === opt.name)
                                                                                )
                                                                            );
                                                                        } else {
                                                                            const filtered = selectedWaiterModifiers.filter((m) => m.group !== group.group_name);
                                                                            setSelectedWaiterModifiers([
                                                                                ...filtered,
                                                                                { group: group.group_name, option: opt.name, price_extra: opt.price_extra_usd || 0 },
                                                                            ]);
                                                                        }
                                                                    }}
                                                                    className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all border ${isSelected
                                                                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-sm'
                                                                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/15 hover:border-[#1c3a1e] active:scale-95'
                                                                        }`}
                                                                >
                                                                    {opt.name} {opt.price_extra_usd ? `(+$${opt.price_extra_usd})` : ''}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleAddWaiterItemSubmit}
                            disabled={!selectedMenuItemForWaiter || isAddingItem}
                            className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] disabled:opacity-40 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                            {isAddingItem ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    <span>Adding Item to Check...</span>
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4" />
                                    <span>Add Item to Table #{selectedTable.table_number} Check</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Table Merge Modal */}
            {isMergeModalOpen && selectedTable && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-[#1c3a1e]">
                                Merge Tables into Table #{selectedTable.table_number}
                            </h3>
                            <button onClick={() => setIsMergeModalOpen(false)} className="text-gray-500 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-600 font-medium mb-4">
                            Select available tables to merge into Table #{selectedTable.table_number}&apos;s active session.
                        </p>

                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {tables
                                .filter((t) => t.id !== selectedTable.id && t.status !== 'merged')
                                .map((t) => {
                                    const isChecked = selectedSecondaryTableIds.includes(t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedSecondaryTableIds(
                                                        selectedSecondaryTableIds.filter((id) => id !== t.id)
                                                    );
                                                } else {
                                                    setSelectedSecondaryTableIds([...selectedSecondaryTableIds, t.id]);
                                                }
                                            }}
                                            className={`w-full p-3 rounded-xl border text-xs font-bold flex justify-between items-center transition-all ${isChecked
                                                ? 'bg-purple-500/10 border-purple-500 text-purple-900 font-extrabold'
                                                : 'bg-[#fafbfa] border-[#1c3a1e]/15 text-[#1c3a1e]'
                                                }`}
                                        >
                                            <span>Table #{t.table_number}</span>
                                            <span>{t.status.toUpperCase()}</span>
                                        </button>
                                    );
                                })}
                        </div>

                        <button
                            onClick={handleMergeSubmit}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                        >
                            Confirm Merge Tables
                        </button>
                    </div>
                </div>
            )}

            {/* Apply Discount Modal */}
            {isDiscountModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-[#1c3a1e]">Apply Discount</h3>
                            <button onClick={() => setIsDiscountModalOpen(false)} className="text-gray-500 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setDiscountType('percentage')}
                                className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${discountType === 'percentage'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                    }`}
                            >
                                Percentage (%)
                            </button>
                            <button
                                onClick={() => setDiscountType('fixed')}
                                className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${discountType === 'fixed'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-[#fafbfa] text-gray-700 border-[#1c3a1e]/15'
                                    }`}
                            >
                                Fixed Cash ($ USD)
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs text-gray-700 font-extrabold mb-1">
                                    Discount Value {discountType === 'percentage' ? '(%)' : '($ USD)'}
                                </label>
                                <input
                                    type="number"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-sm font-extrabold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-700 font-extrabold mb-1">Reason / Note</label>
                                <input
                                    type="text"
                                    value={discountReason}
                                    onChange={(e) => setDiscountReason(e.target.value)}
                                    placeholder="e.g. VIP guest, Manager courtesy..."
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleApplyDiscountSubmit}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                        >
                            Apply Discount to Session
                        </button>
                    </div>
                </div>
            )}

            {/* ON-SCREEN THERMAL RECEIPT PREVIEW MODAL */}
            {isPreviewReceiptModalOpen && selectedTable && activeSession && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col items-center max-h-[90vh]">
                        <div className="flex justify-between items-center w-full mb-3 pb-2 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <Eye className="h-5 w-5 text-blue-700" />
                                <span className="font-black text-sm text-[#1c3a1e]">80mm Thermal Receipt Preview</span>
                            </div>
                            <button onClick={() => setIsPreviewReceiptModalOpen(false)} className="text-gray-500 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Simulated 80mm Thermal Paper Roll */}
                        <div className="w-full overflow-y-auto bg-white p-4 rounded-2xl shadow-2xl text-black border border-gray-200 max-h-[65vh]">
                            <ThermalReceipt
                                tableNumber={selectedTable.table_number}
                                items={sessionItems}
                                totals={billTotals}
                                isFinal={false}
                                sessionId={activeSession.id}
                                forceVisible={true}
                            />
                        </div>

                        <div className="flex gap-2 w-full mt-4">
                            <button
                                onClick={() => {
                                    setIsPreviewReceiptModalOpen(false);
                                    handlePrintPreBill();
                                }}
                                className="flex-1 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                            >
                                <Printer className="h-4 w-4" />
                                <span>Print Now</span>
                            </button>
                            <button
                                onClick={() => setIsPreviewReceiptModalOpen(false)}
                                className="px-4 bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] font-bold py-3 rounded-xl text-xs transition-all cursor-pointer border border-[#1c3a1e]/15"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
