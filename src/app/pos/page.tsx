'use client';

import { useState } from 'react';
import { useRealtimePOS } from '@/hooks/useRealtimePOS';
import { calculateBillTotals, formatLbp, formatUsd } from '@/lib/currency';
import { dbStore } from '@/lib/db';
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
} from '../actions/payment-actions';
import { updateOrderItemStatus, addWaiterManualOrderItem } from '../actions/order-actions';
import { ThermalReceipt } from '@/components/pos/invoice-receipt';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import {
    Bell,
    ChefHat,
    CheckCircle2,
    ChevronRight,
    CreditCard,
    DollarSign,
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

    const [selectedTable, setSelectedTable] = useState<Table | null>(null);

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
    const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'LBP'>('USD');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

    // Button Loading & Double-Click Prevention States
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isClosingSession, setIsClosingSession] = useState(false);

    // Print Trigger State
    const [receiptToPrint, setReceiptToPrint] = useState<{
        tableNumber: number;
        items: OrderItem[];
        totals: any;
        isFinal: boolean;
        guestName?: string;
    } | null>(null);

    // Active Session Resolution
    const activeSession = selectedTable
        ? sessions.find(
            (s) =>
                (s.primary_table_id === selectedTable.id ||
                    s.merged_table_ids?.includes(selectedTable.id)) &&
                s.status === 'active'
        )
        : null;

    const sessionItems = activeSession
        ? orderItems.filter((i) => i.session_id === activeSession.id)
        : [];
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
        dbStore.exchangeRate
    );

    const pendingServiceCalls = serviceCalls.filter((c) => c.status === 'pending');
    const readyForDeliveryItems = orderItems.filter((i) => i.status === 'ready');

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

        const guestBillTotals = calculateBillTotals(guestItems, [], [], dbStore.exchangeRate);

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

    // ACTION 2: PAY & CLOSE GUEST ITEMS (Marks items as PAID and prints paid receipt)
    const handleOpenPayGuestModal = (guestName: string) => {
        setTargetPaymentGuestName(guestName);
        setIsPaymentModalOpen(true);
    };

    const handleCompleteGuestPayment = async () => {
        if (!activeSession || !targetPaymentGuestName) return;

        const targetItems = sessionItems.filter(
            (i) => i.guest_name === targetPaymentGuestName && i.status !== 'cancelled' && !i.is_paid
        );

        if (targetItems.length === 0) {
            alert(`All items for ${targetPaymentGuestName} are already paid!`);
            setIsPaymentModalOpen(false);
            return;
        }

        const payAmountUsd = targetItems.reduce((acc, item) => {
            return acc + (item.is_comped ? 0 : Number(item.unit_price_usd) * item.quantity);
        }, 0);

        const res = await processSplitPayment({
            sessionId: activeSession.id,
            amountUsd: payAmountUsd,
            currency: paymentCurrency,
            paymentMethod,
            paymentType: 'item_split',
            itemIdsPaid: targetItems.map((i) => i.id),
        });

        if (res.success) {
            const guestBillTotals = calculateBillTotals(targetItems, [], [], dbStore.exchangeRate);

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
            refreshPOSData();
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
        await updateOrderItemStatus(itemId, 'delivered');
        refreshPOSData();
    };

    const filteredMenuItemsForWaiter = menuItems.filter((item) => {
        const matchesCategory =
            selectedCategoryFilter === 'all' || item.category_id === selectedCategoryFilter;
        const matchesSearch =
            item.name.toLowerCase().includes(waiterSearchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(waiterSearchTerm.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // SIMPLIFIED FLOOR MATRIX: Show only 1 unified card per merged table group (hides all secondary merged tables)
    const visibleTablesOnMatrix = tables.filter((t) => {
        const isSecondaryMerged = sessions.some(
            (s) => s.status === 'active' && Array.isArray(s.merged_table_ids) && s.merged_table_ids.includes(t.id)
        );
        return !isSecondaryMerged;
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
            {/* 80mm ESC/POS Thermal Receipt Printer Container */}
            {receiptToPrint && (
                <ThermalReceipt
                    tableNumber={receiptToPrint.tableNumber}
                    items={receiptToPrint.items}
                    totals={receiptToPrint.totals}
                    isFinal={receiptToPrint.isFinal}
                    guestName={receiptToPrint.guestName}
                />
            )}

            {/* POS Top Header Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-slate-800 gap-4">
                <div className="flex items-center gap-4">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-10 w-auto object-contain"
                    />
                    <div>
                        <h1 className="text-xl font-black text-slate-100 tracking-tight">Waiter & Cashier POS Terminal</h1>
                        <p className="text-xs text-slate-400 font-medium">Dynamic Multi-Guest Billing & Individual Thermal Receipts</p>
                    </div>
                </div>

                {/* System Info Badges & Quick Action Links */}
                <div className="flex items-center gap-3">
                    <a
                        href="/admin"
                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                        <Shield className="h-4 w-4 text-amber-400" />
                        <span>Admin Manager Portal</span>
                    </a>
                    <a
                        href="/kds"
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                        <ChefHat className="h-4 w-4 text-amber-400" />
                        <span>Kitchen KDS Terminal</span>
                    </a>
                    <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-2">
                        <span>Rate: 89,500 LBP / $1</span>
                    </div>
                </div>
            </header>

            {/* READY FOR TABLE DELIVERY EXPEDITER TRAY */}
            {readyForDeliveryItems.length > 0 && (
                <div className="mb-6 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 animate-in fade-in shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                            <Truck className="h-5 w-5 animate-bounce" />
                            <span>READY FOR TABLE DELIVERY ({readyForDeliveryItems.length} ITEMS READY)</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
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
                                className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between shadow-xl"
                            >
                                <div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                                        <span className="font-black text-amber-400 text-base">
                                            TABLE #{tblNum} TRAY
                                        </span>
                                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-500/30">
                                            {tableItems.length} ITEM(S) READY
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {tableItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center"
                                            >
                                                <div>
                                                    <span className="font-extrabold text-xs text-slate-100 block">
                                                        1x {item.item_name}
                                                    </span>
                                                    <span className="text-[9px] text-amber-400 font-bold uppercase block mt-0.5">
                                                        Station: {item.station.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleMarkItemDelivered(item.id)}
                                                    className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors border border-emerald-500/30"
                                                >
                                                    Deliver Dish
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        for (const item of tableItems) {
                                            await handleMarkItemDelivered(item.id);
                                        }
                                    }}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                >
                                    <span>Deliver Entire Table #{tblNum} Tray</span>
                                    <CheckCircle2 className="h-4 w-4" />
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
                        <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
                            <Bell className="h-5 w-5 animate-bounce" />
                            <span>Active Service Alerts ({pendingServiceCalls.length})</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {pendingServiceCalls.map((call) => (
                            <div
                                key={call.id}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                            >
                                <div>
                                    <span className="font-extrabold text-amber-400 text-sm">
                                        Table #{call.table_number}
                                    </span>
                                    <div className="text-xs text-slate-300 font-bold capitalize flex items-center gap-1.5 mt-0.5">
                                        {call.type === 'waiter' && <Bell className="h-3.5 w-3.5 text-amber-400" />}
                                        {call.type === 'charcoal' && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                                        {call.type === 'bill' && <Receipt className="h-3.5 w-3.5 text-emerald-400" />}
                                        <span>{call.type.toUpperCase()} REQUESTED</span>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        await resolveServiceCall(call.id);
                                        refreshPOSData();
                                    }}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
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
                            <h2 className="text-base font-extrabold text-slate-100">Floor Layout & Table Matrix</h2>
                            <button
                                onClick={() => {
                                    if (!selectedTable) {
                                        alert('Please click a primary table on the floor layout first to merge other tables into it!');
                                        return;
                                    }
                                    setIsMergeModalOpen(true);
                                }}
                                className="bg-purple-500 hover:bg-purple-600 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all"
                            >
                                <Layers className="h-4 w-4" />
                                <span>Merge Tables</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Available
                            </span>
                            <span className="flex items-center gap-1.5 text-blue-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span> Occupied
                            </span>
                            <span className="flex items-center gap-1.5 text-purple-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Merged (1 Card)
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Bill Requested
                            </span>
                        </div>
                    </div>

                    {/* SIMPLIFIED GRID VIEW: Merged tables shown as 1 unified table card */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {visibleTablesOnMatrix.map((tbl) => {
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
                                ? 'border-purple-500/50 bg-purple-500/10 hover:border-purple-400'
                                : {
                                    available: 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500',
                                    occupied: 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500',
                                    merged: 'border-purple-500/50 bg-purple-500/10 hover:border-purple-400',
                                    bill_requested: 'border-amber-500/40 bg-amber-500/10 hover:border-amber-500 animate-pulse',
                                }[tbl.status];

                            const badgeColors = isMergedMaster
                                ? 'bg-purple-500 text-slate-950 font-black'
                                : {
                                    available: 'bg-emerald-500/20 text-emerald-300',
                                    occupied: 'bg-blue-500/20 text-blue-300',
                                    merged: 'bg-purple-500 text-slate-950 font-black',
                                    bill_requested: 'bg-amber-500/20 text-amber-300',
                                }[tbl.status];

                            const tblItems = sess ? orderItems.filter((i) => i.session_id === sess.id) : [];
                            const tblBill = calculateBillTotals(tblItems, [], [], dbStore.exchangeRate);
                            const hasReadyFood = tblItems.some((i) => i.status === 'ready');

                            // Table Number Label (e.g. Table #1 + #2 + #3)
                            const tableLabel = isMergedMaster
                                ? `Table #${tbl.table_number} + #${mergedTableNumbers.join(' + #')}`
                                : `Table #${tbl.table_number}`;

                            return (
                                <div
                                    key={tbl.id}
                                    onClick={() => setSelectedTable(tbl)}
                                    className={`glass-card rounded-2xl p-4 flex flex-col justify-between cursor-pointer border-2 transition-all min-h-[140px] relative ${statusColorClasses} ${isSelected ? 'ring-2 ring-amber-400 scale-[1.02]' : ''
                                        }`}
                                >
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-base font-black text-slate-100 leading-tight">
                                                {tableLabel}
                                            </span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-1 ${badgeColors}`}>
                                                {isMergedMaster ? 'MERGED' : tbl.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>

                                        {isMergedMaster && (
                                            <div className="mt-2 bg-purple-500/20 border border-purple-500/40 rounded-lg p-1.5 text-[10px] font-bold text-purple-300 flex items-center gap-1">
                                                <Layers className="h-3 w-3 text-purple-400" />
                                                <span>COMBINED SESSION</span>
                                            </div>
                                        )}

                                        {hasReadyFood && (
                                            <span className="mt-2 text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md flex items-center gap-1 w-max shadow-md animate-bounce">
                                                <Truck className="h-3 w-3" /> FOOD READY
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-2 border-t border-slate-800/80 flex justify-between items-end">
                                        <span className="text-[11px] text-slate-400 font-medium">Running Total:</span>
                                        <span className="text-xs font-bold text-amber-400">
                                            {sess ? formatUsd(tblBill.finalTotalUsd) : '$0.00'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Selected Table Detail Panel (5 Cols) */}
                <div className="lg:col-span-5">
                    {!selectedTable ? (
                        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-800">
                            <Utensils className="h-12 w-12 mx-auto mb-4 text-slate-600 opacity-40" />
                            <h3 className="text-lg font-bold text-slate-300">Select a Table to Manage</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Click any table on the floor layout to inspect orders, assign items to dynamic guests, print individual guest bills, or process payments.
                            </p>
                        </div>
                    ) : (
                        <div className="glass-card rounded-3xl p-6 border border-slate-800 flex flex-col justify-between h-full">
                            <div>
                                {/* Table Header & Action Buttons */}
                                <div className="pb-4 border-b border-slate-800 mb-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-100">
                                                {activeSession && activeSession.primary_table_id === selectedTable.id && activeSession.merged_table_ids?.length > 0
                                                    ? `Table #${selectedTable.table_number} + #${activeSession.merged_table_ids
                                                        .map((id) => tables.find((t) => t.id === id)?.table_number)
                                                        .filter(Boolean)
                                                        .join(' + #')}`
                                                    : `Table #${selectedTable.table_number}`}
                                            </h2>
                                            <p className="text-xs text-amber-400 font-semibold mt-0.5">
                                                Status: {selectedTable.status.toUpperCase()}
                                            </p>
                                            {activeSession && activeSession.merged_table_ids?.length > 0 && (
                                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-purple-300 font-bold uppercase">Merged Tables:</span>
                                                    {activeSession.merged_table_ids.map((mId) => {
                                                        const mTable = tables.find((t) => t.id === mId);
                                                        if (!mTable) return null;
                                                        return (
                                                            <button
                                                                key={mId}
                                                                onClick={() => handleUnmergeTable(mId)}
                                                                className="bg-purple-500/20 hover:bg-red-500/20 border border-purple-500/40 hover:border-red-500/40 text-purple-300 hover:text-red-400 text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
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
                                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                                            >
                                                <PlusCircle className="h-4 w-4" />
                                                <span>Add Items</span>
                                            </button>

                                            <button
                                                onClick={() => setIsMergeModalOpen(true)}
                                                className="bg-purple-500 hover:bg-purple-600 text-slate-950 p-2 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-purple-500/20"
                                                title="Merge other tables into this table session"
                                            >
                                                <Layers className="h-4 w-4" />
                                                <span>Merge Table</span>
                                            </button>

                                            <button
                                                onClick={() => setIsAssignGuestModalOpen(true)}
                                                className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 p-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
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
                                        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
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
                                                            : 'bg-slate-950 border-purple-500/40'
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xs text-purple-300 flex items-center gap-1">
                                                                    <User className="h-3.5 w-3.5 text-purple-400" /> {gName}
                                                                </span>
                                                                {isAllPaid ? (
                                                                    <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full">
                                                                        ALL PAID
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                        {gUnpaid.length} UNPAID ITEM(S)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                                                                Subtotal: <strong className="text-amber-400">${gTotalUsd.toFixed(2)}</strong>
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* SEPARATE ACTION 1: PRINT GUEST BILL (PRE-BILL WITHOUT CLOSING) */}
                                                            <button
                                                                onClick={() => handlePrintGuestBill(gName)}
                                                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                                                title="Print Pre-Bill for Guest"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                                <span>Print Bill</span>
                                                            </button>

                                                            {/* SEPARATE ACTION 2: PAY & CLOSE GUEST ITEMS */}
                                                            {!isAllPaid && (
                                                                <button
                                                                    onClick={() => handleOpenPayGuestModal(gName)}
                                                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black p-2 px-3 rounded-xl text-xs transition-all flex items-center gap-1 shadow-md"
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

                                {/* Session Order Items List with Guest Tags & Paid Badges */}
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {sessionItems.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-slate-500 text-xs mb-3">No order items submitted yet for Table #{selectedTable.table_number}.</p>
                                            <button
                                                onClick={() => setIsAddItemModalOpen(true)}
                                                className="bg-slate-900 border border-slate-800 hover:border-amber-500 text-amber-400 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                                            >
                                                + Add First Order Item as Waiter
                                            </button>
                                        </div>
                                    ) : (
                                        sessionItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`bg-slate-950 border rounded-xl p-3 ${item.is_paid
                                                    ? 'border-emerald-500/40 bg-emerald-500/10'
                                                    : item.status === 'cancelled'
                                                        ? 'border-red-500/20 opacity-50'
                                                        : item.status === 'ready'
                                                            ? 'border-emerald-500/50 bg-emerald-500/5'
                                                            : 'border-slate-800'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {/* Dynamic Guest Tag */}
                                                            {item.guest_name && (
                                                                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                    <User className="h-3 w-3" /> {item.guest_name}
                                                                </span>
                                                            )}

                                                            {/* Quantity Editor Controls (+ / -) */}
                                                            {!item.is_paid && item.status !== 'cancelled' ? (
                                                                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg">
                                                                    <button
                                                                        onClick={() => handleQuantityEdit(item.id, -1)}
                                                                        className="h-6 w-6 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="px-2 text-xs font-black text-amber-400">{item.quantity}</span>
                                                                    <button
                                                                        onClick={() => handleQuantityEdit(item.id, 1)}
                                                                        className="h-6 w-6 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className={`font-bold text-xs ${item.status === 'cancelled' ? 'line-through text-red-400' : 'text-emerald-400'}`}>
                                                                    {item.quantity}x
                                                                </span>
                                                            )}

                                                            <span className={`font-bold text-xs ${item.is_paid ? 'text-emerald-300' : item.status === 'cancelled' ? 'line-through text-red-400' : 'text-slate-100'}`}>
                                                                {item.item_name}
                                                            </span>

                                                            {item.is_paid && (
                                                                <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                                                    <UserCheck className="h-3 w-3" /> PAID
                                                                </span>
                                                            )}
                                                        </div>

                                                        {item.is_comped && (
                                                            <span className="mt-1 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold inline-block">
                                                                COMPED (FREE)
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className={`text-xs font-bold ${item.is_paid ? 'text-emerald-400' : item.status === 'cancelled' ? 'line-through text-red-400' : 'text-amber-400'}`}>
                                                        {item.is_comped || item.status === 'cancelled' ? '$0.00' : formatUsd(Number(item.unit_price_usd) * item.quantity)}
                                                    </span>
                                                </div>

                                                {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                    <div className="text-[10px] text-slate-400 mt-1">
                                                        {item.selected_modifiers.map((m) => `${m.group}: ${m.option}`).join(', ')}
                                                    </div>
                                                )}

                                                {/* Card Action Footer */}
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900">
                                                    <span
                                                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${item.is_paid
                                                            ? 'bg-emerald-500/20 text-emerald-300'
                                                            : item.status === 'cancelled'
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : item.status === 'ready'
                                                                    ? 'bg-emerald-500 text-slate-950 font-black'
                                                                    : 'bg-slate-800 text-slate-300'
                                                            }`}
                                                    >
                                                        STATUS: {item.is_paid ? 'PAID / CHECKOUT' : item.status.toUpperCase()}
                                                    </span>

                                                    {!item.is_paid && item.status === 'ready' && (
                                                        <button
                                                            onClick={() => handleMarkItemDelivered(item.id)}
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[10px] px-2.5 py-1 rounded"
                                                        >
                                                            Deliver to Table
                                                        </button>
                                                    )}

                                                    {!item.is_paid && (
                                                        item.status === 'cancelled' ? (
                                                            <button
                                                                onClick={() => handleRestoreCancelledItem(item.id)}
                                                                className="text-[10px] text-amber-400 hover:underline font-bold flex items-center gap-1"
                                                            >
                                                                <RotateCcw className="h-3 w-3" />
                                                                <span>Undo Cancel</span>
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => compOrderItem(item.id)}
                                                                    className="text-[10px] text-purple-400 hover:underline font-bold"
                                                                >
                                                                    {item.is_comped ? 'Undo Comp' : 'Comp Item'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCancelItem(item)}
                                                                    className="text-[10px] text-red-400 hover:underline font-bold"
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
                            <div className="pt-4 border-t border-slate-800 mt-6 space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Subtotal:</span>
                                        <span>{formatUsd(billTotals.subtotalUsd)}</span>
                                    </div>

                                    {sessionDiscounts.map((disc) => (
                                        <div key={disc.id} className="flex justify-between items-center text-xs text-emerald-400 font-semibold">
                                            <div className="flex items-center gap-1.5">
                                                <span>Discount ({disc.type === 'percentage' ? `${disc.value}%` : `$${disc.value}`}):</span>
                                                <button
                                                    onClick={() => handleRemoveDiscount(disc.id)}
                                                    className="text-red-400 hover:text-red-300 font-extrabold ml-1 text-[10px]"
                                                >
                                                    ✕ Remove
                                                </button>
                                            </div>
                                            <span>-{formatUsd(billTotals.discountUsd)}</span>
                                        </div>
                                    ))}

                                    <div className="flex justify-between text-base font-black text-slate-100 pt-1 border-t border-slate-800">
                                        <span>REMAINING UNPAID TOTAL USD:</span>
                                        <span className="text-emerald-400">{formatUsd(billTotals.remainingUsd)}</span>
                                    </div>

                                    <div className="flex justify-between text-xs font-bold text-amber-400">
                                        <span>REMAINING UNPAID LBP:</span>
                                        <span>{billTotals.remainingLbp}</span>
                                    </div>
                                </div>

                                {/* Button Action Bar */}
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button
                                        onClick={() => setIsDiscountModalOpen(true)}
                                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Percent className="h-4 w-4 text-emerald-400" />
                                        <span>Apply Discount</span>
                                    </button>

                                    <button
                                        onClick={handlePrintPreBill}
                                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Printer className="h-4 w-4 text-amber-400" />
                                        <span>Print Table Bill</span>
                                    </button>
                                </div>

                                {/* PAY ENTIRE TABLE BILL AS 1 CHECK BUTTON */}
                                <button
                                    onClick={async () => {
                                        if (!activeSession || billTotals.remainingUsd <= 0) return;
                                        const unpaidItems = sessionItems.filter((i) => i.status !== 'cancelled' && !i.is_paid);
                                        const res = await processSplitPayment({
                                            sessionId: activeSession.id,
                                            amountUsd: billTotals.remainingUsd,
                                            currency: paymentCurrency,
                                            paymentMethod,
                                            paymentType: 'full',
                                            itemIdsPaid: unpaidItems.map((i) => i.id),
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
                                            refreshPOSData();
                                        }
                                    }}
                                    disabled={billTotals.remainingUsd <= 0}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20 transition-all mt-2"
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2 text-purple-400 font-extrabold text-base">
                                <UserPlus className="h-5 w-5" />
                                <span>Assign Items to Dynamic Guest</span>
                            </div>
                            <button onClick={() => setIsAssignGuestModalOpen(false)} className="text-slate-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Guest Name Input / Selector */}
                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-bold text-slate-300">
                                Guest Name / Person Label:
                            </label>
                            <input
                                type="text"
                                value={newGuestInputName}
                                onChange={(e) => setNewGuestInputName(e.target.value)}
                                placeholder="Type name (e.g. John, Sarah, Seat 1, Mike)..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                            />

                            {dynamicGuestNames.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-500 font-bold self-center">Existing:</span>
                                    {dynamicGuestNames.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setNewGuestInputName(g)}
                                            className="bg-slate-950 border border-purple-500/40 text-purple-300 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-purple-500/10 transition-all"
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Select Unpaid Items and Quantities to Assign */}
                        <div className="mb-6 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 max-h-60 overflow-y-auto">
                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-900">
                                <span className="text-xs font-bold text-slate-300">
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
                                    className="text-[10px] text-amber-400 font-bold hover:underline"
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
                                                ? 'bg-purple-500/10 border-purple-500 text-purple-300'
                                                : 'bg-slate-900 border-slate-800 text-slate-300'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-xs text-slate-100">{item.item_name}</span>
                                                    {item.guest_name && (
                                                        <span className="text-[9px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                                                            Current: {item.guest_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                                    Available: {item.quantity}x @ ${Number(item.unit_price_usd).toFixed(2)}/ea
                                                </span>
                                            </div>

                                            {/* Quantity Picker for Assignment */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg">
                                                    <button
                                                        onClick={() => {
                                                            setItemAssignQuantities({
                                                                ...itemAssignQuantities,
                                                                [item.id]: Math.max(0, currentAssignQty - 1),
                                                            });
                                                        }}
                                                        className="h-7 w-7 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="px-2.5 text-xs font-black text-amber-400">{currentAssignQty}</span>
                                                    <button
                                                        onClick={() => {
                                                            setItemAssignQuantities({
                                                                ...itemAssignQuantities,
                                                                [item.id]: Math.min(item.quantity, currentAssignQty + 1),
                                                            });
                                                        }}
                                                        className="h-7 w-7 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
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
                            className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-slate-950 font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
                        >
                            <UserCheck className="h-4 w-4" />
                            <span>Assign Selected Quantities to {newGuestInputName || 'Guest'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* PAY & CLOSE GUEST ITEMS PAYMENT MODAL */}
            {isPaymentModalOpen && activeSession && targetPaymentGuestName && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">
                                    Pay & Close Items for {targetPaymentGuestName}
                                </h3>
                                <p className="text-xs text-amber-400 font-semibold mt-0.5">
                                    Guest Total:{' '}
                                    {formatUsd(
                                        sessionItems
                                            .filter((i) => i.guest_name === targetPaymentGuestName && i.status !== 'cancelled' && !i.is_paid)
                                            .reduce((acc, i) => acc + (i.is_comped ? 0 : Number(i.unit_price_usd) * i.quantity), 0)
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Currency & Payment Method Selection */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5">Tender Currency</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPaymentCurrency('USD')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${paymentCurrency === 'USD'
                                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                    >
                                        USD ($)
                                    </button>
                                    <button
                                        onClick={() => setPaymentCurrency('LBP')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${paymentCurrency === 'LBP'
                                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                    >
                                        LBP (LL)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5">Method</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === 'cash'
                                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                    >
                                        Cash
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('card')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === 'card'
                                            ? 'bg-blue-500 text-slate-950 border-blue-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                    >
                                        Card
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCompleteGuestPayment}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                        >
                            <CreditCard className="h-4 w-4" />
                            <span>Mark Paid & Print Receipt for {targetPaymentGuestName}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* WAITER MANUAL ITEM & STAFF FEE ADDITION MODAL */}
            {isAddItemModalOpen && selectedTable && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between overflow-hidden">
                        <div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-100">
                                        Add Item / Staff Fee to Table #{selectedTable.table_number}
                                    </h3>
                                    <p className="text-xs text-amber-400 font-medium">
                                        Waiter Manual Order Addition Entry
                                    </p>
                                </div>
                                <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Search & Category Filter */}
                            <div className="space-y-3 mb-4">
                                <div className="relative">
                                    <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={waiterSearchTerm}
                                        onChange={(e) => setWaiterSearchTerm(e.target.value)}
                                        placeholder="Search menu items or staff fees (e.g. Event fee, Tawook, Shisha)..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                    />
                                </div>

                                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <button
                                        onClick={() => setSelectedCategoryFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedCategoryFilter === 'all'
                                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                    >
                                        All Items
                                    </button>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryFilter(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedCategoryFilter === cat.id
                                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                                : 'bg-slate-950 text-slate-400 border-slate-800'
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
                                                ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-400'
                                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-slate-100">{item.name}</span>
                                                    {item.is_staff_only && (
                                                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                                                            STAFF FEE
                                                        </span>
                                                    )}
                                                </div>
                                                {item.description && (
                                                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-amber-400 whitespace-nowrap ml-2">
                                                {formatUsd(Number(item.price_usd))}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected Item Quantity & Special Notes */}
                            {selectedMenuItemForWaiter && (
                                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-200">
                                            Selected: {selectedMenuItemForWaiter.name}
                                        </span>
                                        <span className="text-xs font-black text-amber-400">
                                            {formatUsd(Number(selectedMenuItemForWaiter.price_usd) * waiterQuantity)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 font-semibold">Quantity:</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setWaiterQuantity(Math.max(1, waiterQuantity - 1))}
                                                className="h-8 w-8 bg-slate-900 text-slate-300 border border-slate-800 rounded-lg flex items-center justify-center text-sm font-bold"
                                            >
                                                -
                                            </button>
                                            <span className="text-sm font-black text-slate-100">{waiterQuantity}</span>
                                            <button
                                                onClick={() => setWaiterQuantity(waiterQuantity + 1)}
                                                className="h-8 w-8 bg-slate-900 text-slate-300 border border-slate-800 rounded-lg flex items-center justify-center text-sm font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                            Note / Custom Instructions
                                        </label>
                                        <input
                                            type="text"
                                            value={waiterNotes}
                                            onChange={(e) => setWaiterNotes(e.target.value)}
                                            placeholder="e.g. Requested by guest, extra sauce, well done..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                        />
                                    </div>

                                    {/* TOUCHSCREEN VARIANT & MODIFIER SELECTOR */}
                                    {selectedMenuItemForWaiter.modifier_groups && selectedMenuItemForWaiter.modifier_groups.length > 0 && (
                                        <div className="space-y-2 border-t border-slate-800 pt-3">
                                            <label className="block text-xs font-black text-amber-400 uppercase tracking-wider">
                                                Select Touch Variants & Modifiers:
                                            </label>
                                            {selectedMenuItemForWaiter.modifier_groups.map((group, gIdx) => (
                                                <div key={gIdx} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                                                    <span className="text-[11px] font-bold text-slate-300 block mb-1.5">{group.group_name}:</span>
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
                                                                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                                                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 active:scale-95'
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
                            disabled={!selectedMenuItemForWaiter}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Add Item to Table #{selectedTable.table_number} Check</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Table Merge Modal */}
            {isMergeModalOpen && selectedTable && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-100">
                                Merge Tables into Table #{selectedTable.table_number}
                            </h3>
                            <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 mb-4">
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
                                                ? 'bg-purple-500/10 border-purple-500 text-purple-300'
                                                : 'bg-slate-950 border-slate-800 text-slate-300'
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
                            className="w-full bg-purple-500 hover:bg-purple-600 text-slate-950 font-bold py-3 rounded-xl text-xs transition-all"
                        >
                            Confirm Merge Tables
                        </button>
                    </div>
                </div>
            )}

            {/* Apply Discount Modal */}
            {isDiscountModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-100">Apply Discount</h3>
                            <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setDiscountType('percentage')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${discountType === 'percentage'
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                            >
                                Percentage (%)
                            </button>
                            <button
                                onClick={() => setDiscountType('fixed')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${discountType === 'fixed'
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                            >
                                Fixed Cash ($ USD)
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-1">
                                    Discount Value {discountType === 'percentage' ? '(%)' : '($ USD)'}
                                </label>
                                <input
                                    type="number"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-1">Reason / Note</label>
                                <input
                                    type="text"
                                    value={discountReason}
                                    onChange={(e) => setDiscountReason(e.target.value)}
                                    placeholder="e.g. VIP guest, Manager courtesy..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleApplyDiscountSubmit}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl text-xs transition-all"
                        >
                            Apply Discount to Session
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
