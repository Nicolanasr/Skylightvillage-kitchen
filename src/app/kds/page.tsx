'use client';

import { useState, useEffect } from 'react';
import { useRealtimeKDS } from '@/hooks/useRealtimeKDS';
import { ItemStatus, OrderItem } from '@/lib/types';
import { updateOrderItemStatus, revertOrderItemStatus, markKDSItemsPrinted } from '../actions/order-actions';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import {
    ChefHat,
    Clock,
    CheckCircle2,
    Flame,
    RotateCcw,
    Utensils,
    Truck,
    Filter,
    Wine,
    Sparkles,
    Printer,
    ChevronRight,
    Monitor,
    CheckSquare,
    Loader2,
} from 'lucide-react';

export default function KDSPage() {
    return (
        <StaffAuthGuard pageTitle="Kitchen Display System (KDS)">
            <KDSContent />
        </StaffAuthGuard>
    );
}

function KDSContent() {
    const [stationFilter, setStationFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'tickets' | 'expediter'>('tickets');
    const [sortBy, setSortBy] = useState<'received' | 'status' | 'time' | 'alphabet'>('received');
    const [showPrintedItems, setShowPrintedItems] = useState<boolean>(false);
    const [printedItemIds, setPrintedItemIds] = useState<string[]>([]);
    const [bumpingItemIds, setBumpingItemIds] = useState<Record<string, boolean>>({});
    const isAnyBumping = Object.values(bumpingItemIds).some(Boolean);
    const [bumpingTrayTableNum, setBumpingTrayTableNum] = useState<number | null>(null);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(Date.now());

    const { items, menuItems, refreshKDSData } = useRealtimeKDS(stationFilter);
    const [localItems, setLocalItems] = useState<OrderItem[]>([]);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    const handleStatusClick = async (itemId: string, currentStatus: ItemStatus) => {
        if (bumpingItemIds[itemId]) return;
        setBumpingItemIds((prev) => ({ ...prev, [itemId]: true }));
        const nextStatusMap: Record<ItemStatus, ItemStatus> = {
            pending: 'preparing',
            preparing: 'ready',
            ready: 'delivered',
            delivered: 'delivered',
            cancelled: 'cancelled',
        };
        const nextStatus = nextStatusMap[currentStatus];

        // Optimistic local status bump
        setLocalItems((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, status: nextStatus } : item))
        );

        try {
            await updateOrderItemStatus(itemId, nextStatus);
            await refreshKDSData();
        } finally {
            setBumpingItemIds((prev) => ({ ...prev, [itemId]: false }));
        }
    }

    const handleUndoStatus = async (itemId: string) => {
        if (bumpingItemIds[itemId]) return;
        setBumpingItemIds((prev) => ({ ...prev, [itemId]: true }));

        const prevStatusMap: Record<ItemStatus, ItemStatus> = {
            pending: 'pending',
            preparing: 'pending',
            ready: 'preparing',
            delivered: 'ready',
            cancelled: 'pending',
        };

        // Optimistic local undo bump
        setLocalItems((prev) =>
            prev.map((item) => {
                if (item.id === itemId) {
                    const prevStatus = prevStatusMap[item.status] || 'pending';
                    return { ...item, status: prevStatus };
                }
                return item;
            })
        );

        try {
            await revertOrderItemStatus(itemId);
            await refreshKDSData();
        } finally {
            setBumpingItemIds((prev) => ({ ...prev, [itemId]: false }));
        }
    };

    const activeKitchenItems = localItems.filter((i) => i.status !== 'cancelled' && i.status !== 'delivered');

    const readyItemsByTable = activeKitchenItems
        .filter((i) => i.status === 'ready')
        .reduce<Record<number, OrderItem[]>>((acc, item) => {
            const tblNum = item.table_number || 1;
            if (!acc[tblNum]) acc[tblNum] = [];
            acc[tblNum].push(item);
            return acc;
        }, {});

    const sortedItems = [...activeKitchenItems].sort((a, b) => {
        if (sortBy === 'received' || sortBy === 'time') {
            // Default: Oldest received orders first (FIFO). Strict deterministic tie-breaker so card position NEVER changes when status is updated!
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            if (timeA !== timeB) {
                return timeA - timeB;
            }
            return a.id.localeCompare(b.id);
        }

        if (sortBy === 'status') {
            const statusPriority: Record<string, number> = {
                pending: 1,
                preparing: 2,
                ready: 3,
            };
            const prioA = statusPriority[a.status] || 99;
            const prioB = statusPriority[b.status] || 99;
            if (prioA !== prioB) {
                return prioA - prioB;
            }
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            if (timeA !== timeB) {
                return timeA - timeB;
            }
            return a.id.localeCompare(b.id);
        }

        if (sortBy === 'alphabet') {
            const nameComp = a.item_name.localeCompare(b.item_name);
            if (nameComp !== 0) return nameComp;
            return a.id.localeCompare(b.id);
        }

        return a.id.localeCompare(b.id);
    });

    const displayedItems =
        stationFilter === 'all'
            ? sortedItems
            : sortedItems.filter((item) => item.station === stationFilter);

    const stationDisplayNames: Record<string, string> = {
        mezza: 'Mezza Station (Hot/Cold & Salads)',
        cold_mezza: 'Mezza Station (Hot/Cold & Salads)',
        hot_mezza: 'Mezza Station (Hot/Cold & Salads)',
        sajj: 'Sajj Station',
        grill: 'BBQ Station',
        subs_sandwiches: 'Subs, Sandwiches & Kids Meals',
        bar: 'Bar & Refreshments',
        shisha: 'Shisha Lounge',
    };

    const itemsToPrint = items.filter((item) => {
        if (item.status === 'cancelled' || item.status === 'delivered') return false;
        if (!showPrintedItems && (item.is_printed || printedItemIds.includes(item.id))) return false;
        if (stationFilter !== 'all' && item.station !== stationFilter) return false;
        return true;
    });

    const groupedKDSPrintTickets = itemsToPrint.reduce<Array<{
        tableNumber: number;
        station: string;
        stationName: string;
        ticketItems: OrderItem[];
    }>>((acc, item) => {
        const tblNum = item.table_number || 1;
        let st: string = item.station || 'mezza';
        if (st === 'cold_mezza' || st === 'hot_mezza') st = 'mezza';
        const stName = stationDisplayNames[st] || st.replace('_', ' ').toUpperCase();

        let existing = acc.find((g) => g.tableNumber === tblNum && g.station === st);
        if (!existing) {
            existing = {
                tableNumber: tblNum,
                station: st,
                stationName: stName,
                ticketItems: [],
            };
            acc.push(existing);
        }
        existing.ticketItems.push(item);
        return acc;
    }, []);

    const handlePrintKDSChits = async () => {
        if (itemsToPrint.length === 0) return;
        setIsPrinting(true);

        const printedIds = itemsToPrint.map((i) => i.id);

        // Optimistically update local state: mark items printed & switch pending -> preparing ("Start Cooking")
        setLocalItems((prev) =>
            prev.map((item) => {
                if (printedIds.includes(item.id)) {
                    return {
                        ...item,
                        is_printed: true,
                        status: item.status === 'pending' ? 'preparing' : item.status,
                    };
                }
                return item;
            })
        );
        setPrintedItemIds((prev) => [...new Set([...prev, ...printedIds])]);

        window.print();

        try {
            await markKDSItemsPrinted(printedIds);
            await refreshKDSData();
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] p-4 md:p-6 print:p-0 print:bg-white">
            {/* ESC/POS THERMAL STATION CHIT PRINT CONTAINER */}
            <div className="print-kds-container hidden print:block print:w-full print:m-0 print:p-0 font-mono text-black text-xs">
                {groupedKDSPrintTickets.map((ticket, tIdx) => (
                    <div key={tIdx} className="kds-chit-ticket mb-6 pb-6 border-b-2 border-dashed border-black print:p-2">
                        <div className="text-center mb-3">
                            <h1 className="text-xl font-black uppercase tracking-wider">{ticket.stationName}</h1>
                            <div className="text-2xl font-black my-1 border-2 border-black py-1">
                                TABLE #{ticket.tableNumber}
                            </div>
                            <div className="text-[10px]">
                                {new Date().toLocaleTimeString()} - CHIT #{tIdx + 1}
                            </div>
                        </div>

                        <div className="border-t border-b border-black py-2 my-2 space-y-3">
                            {ticket.ticketItems.map((item, iIdx) => (
                                <div key={iIdx} className="text-sm">
                                    <div className="flex justify-between font-black text-base">
                                        <span>{item.quantity}x {item.item_name}</span>
                                    </div>

                                    {item.special_notes && (
                                        <div className="text-xs font-bold pl-3 mt-0.5 uppercase">
                                            *** NOTE: {item.special_notes} ***
                                        </div>
                                    )}

                                    {Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0 && (
                                        <div className="text-xs pl-3 mt-0.5">
                                            {item.selected_modifiers.map((m: any, mIdx: number) => (
                                                <div key={mIdx}>+ {m.option || m.name}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="text-center text-[10px] font-bold mt-4">
                            --- END OF STATION CHIT ---
                        </div>
                    </div>
                ))}
            </div>

            {/* Header Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-[#1c3a1e]/15 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="bg-[#1c3a1e] p-2.5 rounded-2xl shadow-sm">
                        <img
                            src="/images/Skylight-logo-white.png"
                            alt="Skylight Village Logo"
                            className="h-8 w-auto object-contain filter invert"
                        />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                            <span>Skylight Kitchen KDS</span>
                            <span className="text-xs bg-[#eaf2eb] text-[#1c3a1e] font-extrabold px-2.5 py-0.5 rounded-full border border-[#1c3a1e]/15">
                                Realtime Feed
                            </span>
                        </h1>
                        <p className="text-xs text-gray-600 font-semibold mt-0.5">
                            Kitchen Display System & Station Pass Management
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href="/pos"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Monitor className="h-4 w-4 text-[#1c3a1e]" />
                        <span>POS Waiter Terminal</span>
                    </a>

                    <button
                        onClick={() => setShowPrintedItems(!showPrintedItems)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${showPrintedItems
                            ? 'bg-purple-500/10 text-purple-800 border-purple-500/30'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15'
                            }`}
                        title="Toggle re-printing already printed chits"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>{showPrintedItems ? 'Including Printed' : 'Unprinted Only'}</span>
                    </button>

                    <button
                        onClick={handlePrintKDSChits}
                        disabled={isPrinting || itemsToPrint.length === 0}
                        className={`font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm ${isPrinting || itemsToPrint.length === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white active:scale-95'
                            }`}
                    >
                        <Printer className="h-4 w-4" />
                        <span>{isPrinting ? 'Printing Chits...' : `Print KDS Station Chits (${itemsToPrint.length})`}</span>
                    </button>
                </div>
            </header>

            {/* Station Filter & Sorting Control Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 print:hidden">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setActiveTab('tickets');
                            setStationFilter('all');
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${activeTab === 'tickets' && stationFilter === 'all'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                            }`}
                    >
                        <Filter className="h-4 w-4" />
                        <span>All Stations</span>
                        <span className="bg-white text-[#1c3a1e] px-2 py-0.5 rounded-lg text-[10px] font-black border border-[#1c3a1e]/10">
                            {activeKitchenItems.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('expediter')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${activeTab === 'expediter'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                            }`}
                    >
                        <Truck className="h-4 w-4" />
                        <span>Table Expediter / Pass</span>
                        <span className="bg-white text-[#1c3a1e] px-2 py-0.5 rounded-lg text-[10px] font-black border border-[#1c3a1e]/10">
                            {Object.keys(readyItemsByTable).length}
                        </span>
                    </button>

                    {[
                        { id: 'mezza', name: 'Mezza', icon: Utensils },
                        { id: 'sajj', name: 'Sajj', icon: Flame },
                        { id: 'grill', name: 'BBQ', icon: Flame },
                        { id: 'subs_sandwiches', name: 'Subs & Sandwiches', icon: Utensils },
                        { id: 'bar', name: 'Bar & Drinks', icon: Wine },
                        { id: 'shisha', name: 'Shisha', icon: Sparkles },
                    ].map((st) => {
                        const Icon = st.icon;
                        const count = activeKitchenItems.filter((i) => i.station === st.id).length;
                        return (
                            <button
                                key={st.id}
                                onClick={() => {
                                    setActiveTab('tickets');
                                    setStationFilter(st.id);
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${activeTab === 'tickets' && stationFilter === st.id
                                    ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                                    : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{st.name}</span>
                                {count > 0 && (
                                    <span className="bg-white text-[#1c3a1e] px-2 py-0.5 rounded-lg text-[10px] font-black border border-[#1c3a1e]/10">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Sort Mode Controls */}
                {activeTab === 'tickets' && (
                    <div className="flex items-center gap-1 bg-[#eaf2eb] border border-[#1c3a1e]/15 p-1 rounded-2xl shrink-0">
                        <span className="text-[10px] font-extrabold text-[#1c3a1e] uppercase px-2">Sort By:</span>
                        <button
                            onClick={() => setSortBy('received')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${sortBy === 'received'
                                ? 'bg-[#1c3a1e] text-white shadow-sm'
                                : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                            title="Cards stay fixed in received order (Changing status does NOT move card position)"
                        >
                            As Received
                        </button>
                        <button
                            onClick={() => setSortBy('status')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${sortBy === 'status'
                                ? 'bg-[#1c3a1e] text-white shadow-sm'
                                : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            By Status
                        </button>
                        <button
                            onClick={() => setSortBy('time')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${sortBy === 'time'
                                ? 'bg-[#1c3a1e] text-white shadow-sm'
                                : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            By Time
                        </button>
                        <button
                            onClick={() => setSortBy('alphabet')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${sortBy === 'alphabet'
                                ? 'bg-[#1c3a1e] text-white shadow-sm'
                                : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            Alphabetical
                        </button>
                    </div>
                )}
            </div>

            {/* EXPEDITER TABLE PASS VIEW */}
            {activeTab === 'expediter' ? (
                Object.keys(readyItemsByTable).length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-[#1c3a1e]/15 shadow-sm print:hidden">
                        <Truck className="h-16 w-16 mx-auto mb-4 text-[#1c3a1e] opacity-30" />
                        <h3 className="text-lg font-bold text-[#1c3a1e]">No Tables Waiting for Delivery!</h3>
                        <p className="text-xs text-gray-500 mt-1">Ready dishes will group here by table for waiter delivery.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
                        {Object.entries(readyItemsByTable).map(([tblNum, tableReadyItems]) => (
                            <div
                                key={tblNum}
                                className="bg-white rounded-3xl p-5 border border-[#1c3a1e]/15 shadow-md flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-[#1c3a1e] text-white font-black text-sm px-3 py-1 rounded-xl">
                                                TABLE #{tblNum}
                                            </div>
                                            <span className="text-xs font-bold text-gray-600">
                                                ({tableReadyItems.length} ready {tableReadyItems.length === 1 ? 'dish' : 'dishes'})
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {tableReadyItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="bg-[#fafbfa] border border-[#1c3a1e]/10 p-3 rounded-2xl flex justify-between items-center"
                                            >
                                                <div>
                                                    <div className="font-extrabold text-sm text-[#1c3a1e]">
                                                        {item.quantity}x {item.item_name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-semibold">
                                                        Guest: {item.guest_name || 'Guest 1'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        disabled={isAnyBumping}
                                                        onClick={() => handleUndoStatus(item.id)}
                                                        className="p-1.5 rounded-lg bg-[#eaf2eb] text-[#1c3a1e] hover:bg-gray-200 transition-colors"
                                                        title="Undo back to Preparing"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        disabled={isAnyBumping}
                                                        onClick={() => handleStatusClick(item.id, 'ready')}
                                                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                                    >
                                                        <span>Deliver</span>
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        for (const item of tableReadyItems) {
                                            await updateOrderItemStatus(item.id, 'delivered');
                                        }
                                        refreshKDSData();
                                    }}
                                    className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                                >
                                    <Truck className="h-4 w-4" />
                                    <span>Mark Entire Table #{tblNum} Tray Delivered</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* INDIVIDUAL DISH TICKET GRID FOR CHEFS */
                displayedItems.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-[#1c3a1e]/15 shadow-sm print:hidden">
                        <ChefHat className="h-16 w-16 mx-auto mb-4 text-[#1c3a1e] opacity-30" />
                        <h3 className="text-lg font-bold text-[#1c3a1e]">All Kitchen Orders Clear!</h3>
                        <p className="text-xs text-gray-500 mt-1">No active tickets for station: {stationFilter}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
                        {displayedItems.map((item) => {
                            const elapsedMins = Math.floor(
                                (currentTime - new Date(item.created_at).getTime()) / 60000
                            );

                            let timerColor = 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30';
                            if (elapsedMins >= 10 && elapsedMins < 15) {
                                timerColor = 'bg-amber-500/10 text-amber-800 border-amber-500/30';
                            } else if (elapsedMins >= 15) {
                                timerColor = 'bg-red-500/10 text-red-700 border-red-500/30 animate-pulse';
                            }

                            const statusButtonStyles = {
                                pending: 'bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-extrabold',
                                preparing: 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold',
                                ready: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
                                delivered: 'bg-gray-200 text-gray-600',
                                cancelled: 'bg-red-500/10 text-red-700',
                            };

                            const mItem = menuItems.find((m) => m.id === item.menu_item_id);

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl p-4 flex flex-col justify-between border-l-4 border-l-[#1c3a1e] border border-[#1c3a1e]/15 shadow-sm text-[#1c3a1e] hover:shadow-md transition-all"
                                >
                                    <div>
                                        {/* Card Header with Table # & Item Title */}
                                        <div className="flex justify-between items-start pb-3 border-b border-[#1c3a1e]/15 mb-3">
                                            <div className="flex items-start gap-3">
                                                {mItem?.image_url && (
                                                    <img
                                                        src={mItem.image_url}
                                                        alt={item.item_name}
                                                        className="h-11 w-11 rounded-xl object-cover border border-[#1c3a1e]/15 flex-shrink-0 shadow-sm"
                                                    />
                                                )}
                                                <div>
                                                    <h3 className="flex items-center gap-1.5 flex-wrap mb-1 text-sm font-extrabold text-[#1c3a1e]">
                                                        <div className="bg-[#1c3a1e] text-white text-xs font-black px-2.5 py-0.5 rounded-lg">
                                                            TABLE #{item.table_number || 1}
                                                        </div>
                                                        <span>{item.quantity}x {item.item_name}</span>
                                                    </h3>
                                                    <span className="text-[10px] text-gray-600 font-bold block uppercase tracking-wider">
                                                        STATION: {(stationDisplayNames[item.station] || item.station).replace(' Station', '').replace(' (Hot/Cold & Salads)', '')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1 ${timerColor}`}>
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>{elapsedMins}m</span>
                                            </div>
                                        </div>

                                        {/* Modifiers List */}
                                        {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                            <div className="mb-3 space-y-1">
                                                {item.selected_modifiers.map((mod, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="bg-[#eaf2eb] border border-[#1c3a1e]/20 rounded-lg px-2.5 py-1 text-xs text-[#1c3a1e] font-semibold"
                                                    >
                                                        {mod.group}: <span className="font-black text-[#1c3a1e]">{mod.option}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Special Notes */}
                                        {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-800 font-semibold mb-3">
                                                <span className="font-extrabold uppercase block text-[10px] text-red-700">
                                                    Special Instructions:
                                                </span>
                                                {item.special_notes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Action Footer with Individual Dish Bump Control */}
                                    <div className="pt-3 border-t border-[#1c3a1e]/15 flex items-center justify-between mt-3">
                                        <span className="text-xs font-bold text-gray-500">
                                            Status: <strong className={`uppercase px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                                item.status === 'pending'
                                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                    : item.status === 'preparing'
                                                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                            }`}>{item.status}</strong>
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {item.status !== 'pending' && (
                                                <button
                                                    disabled={isAnyBumping}
                                                    onClick={() => handleUndoStatus(item.id)}
                                                    className="bg-[#eaf2eb] hover:bg-gray-200 border border-[#1c3a1e]/20 text-[#1c3a1e] p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Undo / Step Back Status"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Undo</span>
                                                </button>
                                            )}

                                            <button
                                                disabled={isAnyBumping}
                                                onClick={() => handleStatusClick(item.id, item.status)}
                                                className={`w-32 h-9 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${statusButtonStyles[item.status]
                                                    }`}
                                            >
                                                {bumpingItemIds[item.id] ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                                                        <span>Updating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>
                                                            {item.status === 'pending'
                                                                ? 'Start Cooking'
                                                                : item.status === 'preparing'
                                                                    ? 'Mark Ready'
                                                                    : item.status === 'ready'
                                                                        ? 'Deliver'
                                                                        : 'Done'}
                                                        </span>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
