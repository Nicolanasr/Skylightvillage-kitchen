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
    const [showPrintedItems, setShowPrintedItems] = useState<boolean>(false);
    const [printedItemIds, setPrintedItemIds] = useState<string[]>([]);
    const [bumpingItemIds, setBumpingItemIds] = useState<Record<string, boolean>>({});
    const [bumpingTrayTableNum, setBumpingTrayTableNum] = useState<number | null>(null);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(Date.now());

    const { items, menuItems, refreshKDSData } = useRealtimeKDS(stationFilter);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    const handleStatusClick = async (itemId: string, currentStatus: ItemStatus) => {
        if (bumpingItemIds[itemId]) return;
        setBumpingItemIds((prev) => ({ ...prev, [itemId]: true }));
        try {
            const nextStatusMap: Record<ItemStatus, ItemStatus> = {
                pending: 'preparing',
                preparing: 'ready',
                ready: 'delivered',
                delivered: 'delivered',
                cancelled: 'cancelled',
            };
            const nextStatus = nextStatusMap[currentStatus];

            await updateOrderItemStatus(itemId, nextStatus);
            refreshKDSData();
        } finally {
            setBumpingItemIds((prev) => ({ ...prev, [itemId]: false }));
        }
    };

    const handleUndoStatus = async (itemId: string) => {
        if (bumpingItemIds[itemId]) return;
        setBumpingItemIds((prev) => ({ ...prev, [itemId]: true }));
        try {
            await revertOrderItemStatus(itemId);
            refreshKDSData();
        } finally {
            setBumpingItemIds((prev) => ({ ...prev, [itemId]: false }));
        }
    };

    const readyItemsByTable = items.reduce<Record<number, OrderItem[]>>((acc, item) => {
        if (item.status === 'ready') {
            const tbl = item.table_number || 1;
            if (!acc[tbl]) acc[tbl] = [];
            acc[tbl].push(item);
        }
        return acc;
    }, {});

    const stationDisplayNames: Record<string, string> = {
        cold_mezza: 'Cold Mezza Station',
        hot_mezza: 'Hot Mezza Station',
        grill: 'Grill & Charcoal Station',
        bar: 'Bar & Refreshments',
        shisha: 'Shisha Lounge',
    };

    // Group items for KDS printing: EACH TABLE + EACH CATEGORY GETS ITS OWN SEPARATE PAGE TICKET
    // DEDUPLICATION: Exclude items where is_printed is true OR printedItemIds includes item.id!
    const itemsToPrint = items.filter((item) => {
        if (item.status === 'cancelled' || item.status === 'delivered') return false;
        if (!showPrintedItems && (item.is_printed || printedItemIds.includes(item.id))) return false;
        return true;
    });

    const groupedKDSPrintTickets = itemsToPrint.reduce<Array<{
        tableNumber: number;
        station: string;
        stationName: string;
        ticketItems: OrderItem[];
    }>>((acc, item) => {
        const tblNum = item.table_number || 1;
        const st = item.station || 'cold_mezza';
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
        if (isPrinting || itemsToPrint.length === 0) return;
        setIsPrinting(true);
        const unprintedIds = itemsToPrint.map((i) => i.id);

        // 1. Fire print dialog immediately while tickets are fully rendered in DOM
        window.print();

        // 2. Mark items as printed AFTER print dialog opens
        setPrintedItemIds((prev) => Array.from(new Set([...prev, ...unprintedIds])));

        if (unprintedIds.length > 0) {
            await markKDSItemsPrinted(unprintedIds);
            refreshKDSData();
        }
        setTimeout(() => setIsPrinting(false), 500);
    };

    const activeKitchenItems = items.filter(
        (item) => item.status !== 'delivered' && item.status !== 'cancelled'
    );

    const displayedItems = activeKitchenItems.filter((item) => {
        if (stationFilter === 'all') return true;
        return item.station === stationFilter;
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
            {/* 80mm ESC/POS THERMAL KITCHEN CHIT PRINT CONTAINER */}
            <div className="print-kds-container hidden print:block text-black bg-white font-sans text-xs w-[2.8in] p-2">
                {groupedKDSPrintTickets.length === 0 ? (
                    <div className="text-center font-bold py-4 text-black">NO UNPRINTED KITCHEN TICKETS</div>
                ) : (
                    groupedKDSPrintTickets.map((ticket, tIdx) => {
                        const now = new Date();
                        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <div key={tIdx} className="kds-chit-ticket pb-4 mb-4 border-b-2 border-black border-dashed">
                                <div className="text-center font-black text-sm uppercase tracking-wider mb-1">
                                    SKYLIGHT KITCHEN CHIT
                                </div>
                                <div className="flex justify-between items-center border-y-2 border-black py-1.5 my-1">
                                    <span className="font-black text-base">TABLE #{ticket.tableNumber}</span>
                                    <span className="font-bold text-xs uppercase bg-black text-white px-1.5 py-0.5 rounded">
                                        {ticket.stationName}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-700 text-right mb-2">Printed: {timeStr}</div>

                                <div className="space-y-2 my-2">
                                    {ticket.ticketItems.map((item, iIdx) => (
                                        <div key={iIdx} className="border-b border-gray-300 pb-1.5">
                                            <div className="font-black text-sm">
                                                1x {item.item_name}
                                            </div>

                                            {/* Variants / Modifiers */}
                                            {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                <div className="text-xs pl-2 font-bold text-gray-800">
                                                    {item.selected_modifiers.map((m: any, mIdx: number) => (
                                                        <div key={mIdx}>• {m.group}: {m.option}</div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Special Notes */}
                                            {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                                <div className="text-xs pl-2 font-extrabold italic text-red-900 mt-0.5">
                                                    NOTE: {item.special_notes}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="text-center text-[10px] font-bold mt-2 pt-1 border-t border-black uppercase">
                                    End of Ticket - Chit #{tIdx + 1}/{groupedKDSPrintTickets.length}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Top Header Bar with Skylight White Logo & Navigation Link to POS */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-slate-800 gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-10 w-auto object-contain"
                    />
                    <div>
                        <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                            <ChefHat className="h-5 w-5 text-amber-400" />
                            <span>Kitchen Display System & Waiter Pass</span>
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">Independent Dish Status Bumping & Realtime Kitchen Expediter</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href="/pos"
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
                    >
                        <Monitor className="h-4 w-4 text-amber-400" />
                        <span>POS Waiter Terminal</span>
                    </a>

                    <button
                        onClick={() => setShowPrintedItems(!showPrintedItems)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${showPrintedItems
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                        title="Toggle re-printing already printed chits"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>{showPrintedItems ? 'Including Printed' : 'Unprinted Only'}</span>
                    </button>

                    <button
                        onClick={handlePrintKDSChits}
                        disabled={isPrinting || itemsToPrint.length === 0}
                        className={`font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg ${isPrinting || itemsToPrint.length === 0
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20 active:scale-95'
                            }`}
                    >
                        <Printer className="h-4 w-4" />
                        <span>{isPrinting ? 'Printing Chits...' : `Print KDS Station Chits (${itemsToPrint.length})`}</span>
                    </button>
                </div>
            </header>

            {/* Station Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 print:hidden">
                <button
                    onClick={() => {
                        setActiveTab('tickets');
                        setStationFilter('all');
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${activeTab === 'tickets' && stationFilter === 'all'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <Filter className="h-4 w-4" />
                    <span>All Stations</span>
                    <span className="bg-slate-950 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black">
                        {activeKitchenItems.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('expediter')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${activeTab === 'expediter'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                >
                    <Truck className="h-4 w-4" />
                    <span>Table Expediter / Pass</span>
                    <span className="bg-slate-950 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black">
                        {Object.keys(readyItemsByTable).length}
                    </span>
                </button>

                {[
                    { id: 'cold_mezza', name: 'Cold Mezza', icon: Utensils },
                    { id: 'hot_mezza', name: 'Hot Mezza', icon: Flame },
                    { id: 'grill', name: 'Grill & Charcoal', icon: Flame },
                    { id: 'bar', name: 'Bar & Refreshments', icon: Wine },
                    { id: 'shisha', name: 'Shisha Lounge', icon: Sparkles },
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
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{st.name}</span>
                            {count > 0 && (
                                <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* EXPEDITER TABLE PASS VIEW */}
            {activeTab === 'expediter' ? (
                Object.keys(readyItemsByTable).length === 0 ? (
                    <div className="text-center py-20 glass-panel rounded-3xl border border-slate-800 print:hidden">
                        <Truck className="h-12 w-12 mx-auto mb-4 text-slate-600 opacity-40" />
                        <h3 className="text-lg font-bold text-slate-300">Expediter Tray Clear</h3>
                        <p className="text-xs text-slate-500 mt-1">No table dishes ready for pickup.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
                        {Object.entries(readyItemsByTable).map(([tblNum, tableReadyItems]) => (
                            <div
                                key={tblNum}
                                className="glass-card rounded-3xl p-5 border-2 border-emerald-500/50 bg-emerald-500/5 shadow-2xl flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-center pb-3 border-b border-emerald-500/30 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-emerald-500 text-slate-950 font-black text-xl px-3 py-1 rounded-xl shadow-lg">
                                                TABLE #{tblNum}
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                                            {tableReadyItems.length} ITEM(S) READY
                                        </span>
                                    </div>

                                    <div className="space-y-2.5 mb-4">
                                        {tableReadyItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center"
                                            >
                                                <div>
                                                    <span className="font-extrabold text-sm text-slate-100">
                                                        1x {item.item_name}
                                                    </span>
                                                    <span className="text-[10px] text-amber-400 font-bold block uppercase mt-0.5">
                                                        Station: {item.station.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleUndoStatus(item.id)}
                                                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-2 rounded-lg text-xs font-bold transition-all"
                                                        title="Undo Status"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusClick(item.id, 'ready')}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
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
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
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
                    <div className="text-center py-24 glass-panel rounded-3xl border border-slate-800/80 print:hidden">
                        <ChefHat className="h-16 w-16 mx-auto mb-4 text-slate-600 opacity-40" />
                        <h3 className="text-lg font-bold text-slate-300">All Kitchen Orders Clear!</h3>
                        <p className="text-xs text-slate-500 mt-1">No active tickets for station: {stationFilter}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
                        {displayedItems.map((item) => {
                            const elapsedMins = Math.floor(
                                (currentTime - new Date(item.created_at).getTime()) / 60000
                            );

                            let timerColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                            if (elapsedMins >= 10 && elapsedMins < 15) {
                                timerColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                            } else if (elapsedMins >= 15) {
                                timerColor = 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse';
                            }

                            const statusButtonStyles = {
                                pending: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold',
                                preparing: 'bg-blue-500 hover:bg-blue-600 text-slate-950 font-extrabold',
                                ready: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold',
                                delivered: 'bg-slate-800 text-slate-400',
                                cancelled: 'bg-red-500/20 text-red-400',
                            };

                            const mItem = menuItems.find((m) => m.id === item.menu_item_id);

                            return (
                                <div
                                    key={item.id}
                                    className="glass-card rounded-2xl p-4 flex flex-col justify-between border-l-4 border-l-amber-500 hover:border-amber-400 transition-all shadow-xl"
                                >
                                    <div>
                                        {/* Card Header with Table # & Item Title */}
                                        <div className="flex justify-between items-start pb-3 border-b border-slate-800/80 mb-3">
                                            <div className="flex items-start gap-3">
                                                {mItem?.image_url && (
                                                    <img
                                                        src={mItem.image_url}
                                                        alt={item.item_name}
                                                        className="h-11 w-11 rounded-xl object-cover border border-slate-700 flex-shrink-0 shadow-sm"
                                                    />
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                        <div className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-2.5 py-0.5 rounded-lg">
                                                            DELIVER TO TABLE #{item.table_number || 1}
                                                        </div>
                                                        {item.is_printed && (
                                                            <span className="bg-slate-900 text-slate-400 border border-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                                PRINTED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-lg font-black text-slate-100 leading-tight">
                                                        1x {item.item_name}
                                                    </h3>
                                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                                                        Station: {item.station.replace('_', ' ')}
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
                                                        className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-semibold"
                                                    >
                                                        {mod.group}: <span className="text-white font-bold">{mod.option}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Special Notes */}
                                        {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-300 font-semibold mb-3">
                                                <span className="font-extrabold uppercase block text-[10px] text-red-400">
                                                    Special Instructions:
                                                </span>
                                                {item.special_notes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Action Footer with Individual Dish Bump Control */}
                                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between mt-3">
                                        <span className="text-[11px] text-slate-500 font-medium">
                                            Status: <strong className="text-slate-200">{item.status.toUpperCase()}</strong>
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {item.status !== 'pending' && (
                                                <button
                                                    disabled={Boolean(bumpingItemIds[item.id])}
                                                    onClick={() => handleUndoStatus(item.id)}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Undo / Step Back Status"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Undo</span>
                                                </button>
                                            )}

                                            <button
                                                disabled={Boolean(bumpingItemIds[item.id])}
                                                onClick={() => handleStatusClick(item.id, item.status)}
                                                className={`px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${statusButtonStyles[item.status]
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
