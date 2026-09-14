'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useRealtimeKDS } from '@/hooks/useRealtimeKDS';
import { ItemStatus, OrderItem } from '@/lib/types';
import { updateOrderItemStatus, updateMultipleOrderItemsStatus, revertOrderItemStatus, markKDSItemsPrinted } from '../actions/order-actions';
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
    Search,
    X,
    Shield,
    User,
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
    const [selectedTables, setSelectedTables] = useState<number[]>([]); // Empty = ALL tables
    const [selectedStatuses, setSelectedStatuses] = useState<ItemStatus[]>([]); // Empty = ALL statuses
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [groupByMode, setGroupByMode] = useState<'single' | 'table' | 'customer'>('single');
    const groupByTable = groupByMode === 'table';
    const [activePrintOverride, setActivePrintOverride] = useState<string[] | null>(null);
    const [activeTab, setActiveTab] = useState<'tickets' | 'expediter'>('tickets');
    const [sortBy, setSortBy] = useState<'received' | 'status' | 'time' | 'alphabet'>('received');
    const [showPrintedItems, setShowPrintedItems] = useState<boolean>(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
    const [showOverview, setShowOverview] = useState<boolean>(false);
    const [printedItemIds, setPrintedItemIds] = useState<string[]>([]);
    const [bumpingItemIds, setBumpingItemIds] = useState<Record<string, boolean>>({});
    const isAnyBumping = Object.values(bumpingItemIds).some(Boolean);
    const [bumpingTrayTableNum, setBumpingTrayTableNum] = useState<number | null>(null);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [printMode, setPrintMode] = useState<'station' | 'customer_grouped'>('station');
    const [currentTime, setCurrentTime] = useState<number>(Date.now());
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

    const activeKitchenItems = localItems.filter(
        (i) => i.status !== 'cancelled' && i.status !== 'delivered' && i.order_type !== 'event' && i.order_type !== 'event_voucher'
    );

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

    // Dynamic List of active table numbers
    const availableTableNumbers = Array.from(
        new Set(activeKitchenItems.map((i) => i.table_number || 1))
    ).sort((a, b) => a - b);

    // Filter Items by Station, Multi-Table, Multi-Status & Search Query
    const displayedItems = sortedItems.filter((item) => {
        // Station Filter
        if (stationFilter !== 'all' && item.station !== stationFilter) return false;

        // Multi-Table Selection Filter (If any selected)
        if (selectedTables.length > 0 && !selectedTables.includes(item.table_number || 1)) {
            return false;
        }

        // Multi-Status Selection Filter (If any selected)
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) {
            return false;
        }

        // Search Query Filter
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim();
            const tblStr = `table #${item.table_number || 1} tbl #${item.table_number || 1} #${item.table_number || 1} ${item.table_number || 1}`;
            const nameStr = item.item_name.toLowerCase();
            const noteStr = (item.special_notes || '').toLowerCase();
            const modStr = (item.selected_modifiers || []).map((m: any) => `${m.group} ${m.option}`).join(' ').toLowerCase();

            const matches =
                tblStr.includes(q) ||
                nameStr.includes(q) ||
                noteStr.includes(q) ||
                modStr.includes(q);

            if (!matches) return false;
        }

        return true;
    });

    // Helper for customer identification & mobile number grouping
    const getCustomerGroupInfo = (item: OrderItem) => {
        const rawPhone = (item.customer_phone || item.loyalty_phone || '').trim();
        const rawName = (item.guest_name && item.guest_name.trim())
            || (item.customer_name && item.customer_name.trim() !== 'Valued Guest' ? item.customer_name.trim() : '');

        let groupKey = '';
        if (rawPhone) {
            groupKey = `PHONE:${rawPhone.replace(/[\s\-\(\)]/g, '')}`;
        } else if (rawName) {
            groupKey = `NAME:${rawName.toLowerCase()}`;
        } else if (item.order_type === 'camping') {
            groupKey = `CAMPING:Guest`;
        } else {
            groupKey = `TABLE:${item.table_number || 1}`;
        }

        let displayTitle = '';
        if (rawPhone && rawName) {
            displayTitle = `${rawName} (${rawPhone})`;
        } else if (rawPhone) {
            displayTitle = `📱 ${rawPhone}`;
        } else if (rawName) {
            displayTitle = rawName;
        } else if (item.order_type === 'camping') {
            displayTitle = 'Camping Guest';
        } else {
            displayTitle = `Table #${item.table_number || 1}`;
        }

        return {
            groupKey,
            displayTitle,
            phone: rawPhone,
            name: rawName,
        };
    };

    // Grouping by Session / Table for Grouped View
    const itemsGroupedByCard = displayedItems.reduce<Record<string, OrderItem[]>>((acc, item) => {
        const isCamping = item.order_type === 'camping';
        const isTakeout = item.order_type === 'takeout';
        const isTable = !isCamping && !isTakeout && item.table_number && item.table_number > 0;

        let key = '';
        if (isTable) {
            key = `table-${item.table_number}`;
        } else {
            const info = getCustomerGroupInfo(item);
            key = `cust-${info.groupKey}`;
        }

        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    // Grouping by Customer (primarily mobile number) for Customer View Mode
    const itemsGroupedByCustomer = displayedItems.reduce<Record<string, {
        groupKey: string;
        customerName: string;
        phone: string;
        orderType: string;
        tableNumber: number;
        items: OrderItem[];
    }>>((acc, item) => {
        const info = getCustomerGroupInfo(item);

        if (!acc[info.groupKey]) {
            acc[info.groupKey] = {
                groupKey: info.groupKey,
                customerName: info.displayTitle,
                phone: info.phone,
                orderType: item.order_type || 'dine_in',
                tableNumber: item.table_number || 0,
                items: [],
            };
        }
        acc[info.groupKey].items.push(item);
        return acc;
    }, {});

    // Aggregate Active Items Quantity Overview (Item Name -> Total Qty, Pending Qty, Preparing Qty, Ready Qty)
    const itemQuantitySummary = displayedItems.reduce<Array<{
        itemName: string;
        station: string;
        totalQty: number;
        pendingQty: number;
        preparingQty: number;
        readyQty: number;
    }>>((acc, item) => {
        if (item.status === 'cancelled' || item.status === 'delivered') return acc;

        let existing = acc.find((i) => i.itemName.toLowerCase() === item.item_name.toLowerCase());
        const qty = item.quantity || 1;

        if (!existing) {
            existing = {
                itemName: item.item_name,
                station: item.station || 'mezza',
                totalQty: 0,
                pendingQty: 0,
                preparingQty: 0,
                readyQty: 0,
            };
            acc.push(existing);
        }

        existing.totalQty += qty;
        if (item.status === 'pending') existing.pendingQty += qty;
        else if (item.status === 'preparing') existing.preparingQty += qty;
        else if (item.status === 'ready') existing.readyQty += qty;

        return acc;
    }, []).sort((a, b) => b.totalQty - a.totalQty);

    const toggleTableSelection = (tbl: number) => {
        setSelectedTables((prev) =>
            prev.includes(tbl) ? prev.filter((t) => t !== tbl) : [...prev, tbl]
        );
    };

    const toggleStatusSelection = (st: ItemStatus) => {
        setSelectedStatuses((prev) =>
            prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
        );
    };

    const resetAllFilters = () => {
        setSelectedTables([]);
        setSelectedStatuses([]);
        setSearchQuery('');
        setStationFilter('all');
    };

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
        if (activePrintOverride) {
            return activePrintOverride.includes(item.id);
        }
        if (item.status === 'cancelled' || item.status === 'delivered') return false;
        if (!showPrintedItems && (item.is_printed || printedItemIds.includes(item.id))) return false;
        if (stationFilter !== 'all' && item.station !== stationFilter) return false;
        return true;
    });

    // Standard Station Chit Grouping:
    // If Table: Group by Table Number then Station
    // If Camping / Mobile: Group by Mobile Number then Station
    const groupedKDSPrintTickets = itemsToPrint.reduce<Array<{
        groupKey: string;
        tableNumber: number;
        customerName: string;
        orderType: string;
        station: string;
        stationName: string;
        ticketItems: OrderItem[];
    }>>((acc, item) => {
        let st: string = item.station || 'mezza';
        if (st === 'cold_mezza' || st === 'hot_mezza') st = 'mezza';
        const stName = stationDisplayNames[st] || st.replace('_', ' ').toUpperCase();

        const isCamping = item.order_type === 'camping';
        const isTakeout = item.order_type === 'takeout';
        const isTableOrder = !isCamping && !isTakeout && (item.table_number && item.table_number > 0);

        let groupKey = '';
        let customerDisplay = '';

        if (isTableOrder) {
            const tblNum = item.table_number || 1;
            groupKey = `TBL-${tblNum}-${st}`;
            customerDisplay = `TBL #${tblNum}`;
        } else {
            // Camping or Mobile/Takeout order -> group by Mobile Number / Customer Info, then station
            const info = getCustomerGroupInfo(item);
            groupKey = `MOBILE-${info.groupKey}-${st}`;
            if (isCamping) {
                customerDisplay = `CAMPING — ${info.displayTitle}`;
            } else if (isTakeout) {
                customerDisplay = `TAKEOUT — ${info.displayTitle}`;
            } else {
                customerDisplay = info.displayTitle;
            }
        }

        let existing = acc.find((g) => g.groupKey === groupKey);
        if (!existing) {
            existing = {
                groupKey,
                tableNumber: item.table_number || 0,
                customerName: customerDisplay,
                orderType: item.order_type || 'dine_in',
                station: st,
                stationName: stName,
                ticketItems: [],
            };
            acc.push(existing);
        }
        existing.ticketItems.push(item);
        return acc;
    }, []);

    // Grouping for "Print By Customer" option: Customer -> Category (Station) -> Item Name
    const groupedByCustomerTickets = itemsToPrint.reduce<Array<{
        groupKey: string;
        customerName: string;
        phone: string;
        orderType: string;
        tableNumber: number;
        stations: Array<{
            stationKey: string;
            stationName: string;
            items: OrderItem[];
        }>;
        totalItemsCount: number;
    }>>((acc, item) => {
        const info = getCustomerGroupInfo(item);

        let existingCust = acc.find((c) => c.groupKey === info.groupKey);
        if (!existingCust) {
            existingCust = {
                groupKey: info.groupKey,
                customerName: info.displayTitle,
                phone: info.phone,
                orderType: item.order_type || 'dine_in',
                tableNumber: item.table_number || 0,
                stations: [],
                totalItemsCount: 0,
            };
            acc.push(existingCust);
        }

        let st: string = item.station || 'mezza';
        if (st === 'cold_mezza' || st === 'hot_mezza') st = 'mezza';
        const stName = stationDisplayNames[st] || st.replace('_', ' ').toUpperCase();

        let existingStation = existingCust.stations.find((s) => s.stationKey === st);
        if (!existingStation) {
            existingStation = {
                stationKey: st,
                stationName: stName,
                items: [],
            };
            existingCust.stations.push(existingStation);
        }

        existingStation.items.push(item);
        existingCust.totalItemsCount += item.quantity || 1;
        return acc;
    }, []);

    const handlePrintSingleChit = async (targetItems: OrderItem[]) => {
        if (!targetItems || targetItems.length === 0) return;
        setIsPrinting(true);
        const targetPrintMode = groupByMode === 'customer' ? 'customer_grouped' : 'station';
        setPrintMode(targetPrintMode);
        const targetIds = targetItems.map((i) => i.id);

        setActivePrintOverride(targetIds);

        setLocalItems((prev) =>
            prev.map((item) => {
                if (targetIds.includes(item.id)) {
                    return {
                        ...item,
                        is_printed: true,
                        status: item.status === 'pending' ? 'preparing' : item.status,
                    };
                }
                return item;
            })
        );
        setPrintedItemIds((prev) => [...new Set([...prev, ...targetIds])]);

        setTimeout(async () => {
            window.print();
            setActivePrintOverride(null);
            try {
                await markKDSItemsPrinted(targetIds);
                await refreshKDSData();
            } finally {
                setIsPrinting(false);
            }
        }, 100);
    };

    const handlePrintKDSChits = async () => {
        if (itemsToPrint.length === 0) return;
        setIsPrinting(true);
        const targetPrintMode = groupByMode === 'customer' ? 'customer_grouped' : 'station';
        setPrintMode(targetPrintMode);

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

        setTimeout(async () => {
            window.print();
            try {
                await markKDSItemsPrinted(printedIds);
                await refreshKDSData();
            } finally {
                setIsPrinting(false);
            }
        }, 100);
    };

    // Print Option: Grouped by Customer -> Category / Station -> Item Name
    const handlePrintByCustomer = async () => {
        if (itemsToPrint.length === 0) return;
        setIsPrinting(true);
        setPrintMode('customer_grouped');

        const printedIds = itemsToPrint.map((i) => i.id);

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

        setTimeout(async () => {
            window.print();
            try {
                await markKDSItemsPrinted(printedIds);
                await refreshKDSData();
            } finally {
                setIsPrinting(false);
            }
        }, 100);
    };

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] p-4 md:p-6 print:p-0 print:bg-white">
            {/* ESC/POS THERMAL STATION CHIT PRINT CONTAINER PORTAL */}
            {isMounted && createPortal(
                <div className="print-kds-container hidden print:block print:w-full print:m-0 print:p-0 font-mono text-black text-xs">
                    {printMode === 'customer_grouped' ? (
                        groupedByCustomerTickets.map((custTicket, cIdx) => (
                            <div key={cIdx} className="kds-chit-ticket mb-3 pb-3 border-b-2 border-black print:p-2">
                                {/* Customer Header */}
                                <div className="border-b-2 border-black pb-1 mb-1.5 flex justify-between items-baseline bg-black text-white px-2 py-1">
                                    <span className="text-base font-black uppercase tracking-tight">👤 {custTicket.customerName}</span>
                                    <span className="text-xs font-black bg-white text-black px-2 py-0.5 rounded">
                                        {custTicket.orderType === 'camping'
                                            ? '🏕️ CAMPING'
                                            : custTicket.orderType === 'takeout'
                                            ? '🛍️ TAKEOUT'
                                            : `TBL #${custTicket.tableNumber}`}
                                    </span>
                                </div>

                                {/* Timestamp Sub-header */}
                                <div className="flex justify-between text-[10px] font-bold mb-2 border-b border-black/30 pb-0.5">
                                    <span>PRINTED: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>Chit #{cIdx + 1} ({custTicket.totalItemsCount} items)</span>
                                </div>

                                {/* Categories / Stations Grouping */}
                                <div className="space-y-2 py-1">
                                    {custTicket.stations.map((stGroup, sIdx) => (
                                        <div key={sIdx} className="border border-black p-1.5 rounded mb-2">
                                            <div className="font-black text-xs uppercase bg-black text-white px-1.5 py-0.5 mb-1 flex justify-between">
                                                <span>CATEGORY / STATION: {stGroup.stationName}</span>
                                                <span>({stGroup.items.length})</span>
                                            </div>

                                            <div className="space-y-1 pt-1">
                                                {stGroup.items.map((item, iIdx) => (
                                                    <div key={iIdx} className="text-xs leading-snug border-b border-gray-200 pb-1 last:border-b-0">
                                                        <div className="font-black text-sm text-black flex justify-between">
                                                            <span>• {item.quantity}x {item.item_name}</span>
                                                        </div>

                                                        {item.special_notes && item.special_notes.trim() !== '' && (
                                                            <div className="text-[11px] font-black pl-3 mt-0.5 text-black">
                                                                *** NOTE: {item.special_notes} ***
                                                            </div>
                                                        )}

                                                        {Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0 && (
                                                            <div className="text-[11px] font-bold pl-3 mt-0.5 text-black">
                                                                {item.selected_modifiers.map((m: any, mIdx: number) => (
                                                                    <div key={mIdx}>+ {m.group ? `${m.group}: ` : ''}{m.option || m.name}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        groupedKDSPrintTickets.map((ticket, tIdx) => (
                            <div key={tIdx} className="kds-chit-ticket mb-2 pb-2 border-b border-dashed border-black print:p-1">
                                {/* Compact Station & Table Header */}
                                <div className="border-b-2 border-black pb-1 mb-1 flex justify-between items-baseline">
                                    <span className="text-base font-black uppercase tracking-tight">{ticket.stationName}</span>
                                    <span className="text-lg font-black bg-black text-white px-2 py-0.5">
                                        {ticket.ticketItems[0]?.order_type === 'takeout' || ticket.tableNumber === 0
                                            ? `TAKEOUT ${ticket.ticketItems[0]?.customer_name ? `— ${ticket.ticketItems[0].customer_name}` : ''}`
                                            : ticket.ticketItems[0]?.order_type === 'camping'
                                            ? `CAMPING ${ticket.ticketItems[0]?.customer_name ? `— ${ticket.ticketItems[0].customer_name}` : ''}`
                                            : `TBL #${ticket.tableNumber}`}
                                    </span>
                                </div>

                                {/* Timestamp Sub-header */}
                                <div className="flex justify-between text-[10px] font-bold mb-1 border-b border-black/20 pb-0.5">
                                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>Chit #{tIdx + 1} ({ticket.ticketItems.length} items)</span>
                                </div>

                                {/* Compact Ticket Items List */}
                                <div className="space-y-1 py-1">
                                    {ticket.ticketItems.map((item, iIdx) => (
                                        <div key={iIdx} className="text-xs leading-snug border-b border-gray-200 pb-1">
                                            <div className="font-black text-sm text-black flex justify-between">
                                                <span>{item.quantity}x {item.item_name}</span>
                                            </div>

                                            {item.special_notes && item.special_notes.trim() !== '' && (
                                                <div className="text-[11px] font-black pl-2 mt-0.5 text-black">
                                                    *** NOTE: {item.special_notes} ***
                                                </div>
                                            )}

                                            {Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0 && (
                                                <div className="text-[11px] font-bold pl-2 mt-0.5 text-black">
                                                    {item.selected_modifiers.map((m: any, mIdx: number) => (
                                                        <div key={mIdx}>+ {m.group ? `${m.group}: ` : ''}{m.option || m.name}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>,
                document.body
            )}

            {/* Compact Space-Saving POS KDS Header Bar */}
            <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 mb-3 pb-3 border-b border-[#1c3a1e]/15 print:hidden">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                    <h1 className="text-xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                        <span>👨‍🍳 KDS Feed</span>
                        <span className="text-[10px] bg-[#eaf2eb] text-[#1c3a1e] font-extrabold px-2 py-0.5 rounded-full border border-[#1c3a1e]/15">
                            LIVE
                        </span>
                    </h1>

                    {/* Layout Mode Toggle Pill */}
                    <div className="flex items-center gap-1 bg-[#eaf2eb] border border-[#1c3a1e]/15 p-1 rounded-2xl">
                        <button
                            onClick={() => setGroupByMode('single')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${groupByMode === 'single' ? 'bg-[#1c3a1e] text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            📋 Single ({displayedItems.length})
                        </button>
                        <button
                            onClick={() => setGroupByMode('table')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${groupByMode === 'table' ? 'bg-[#1c3a1e] text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            🍽️ By Table ({Object.keys(itemsGroupedByCard).length})
                        </button>
                        <button
                            onClick={() => setGroupByMode('customer')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${groupByMode === 'customer' ? 'bg-purple-800 text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                }`}
                        >
                            👤 By Customer ({Object.keys(itemsGroupedByCustomer).length})
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto shrink-0">
                    <button
                        onClick={() => setShowPrintedItems(!showPrintedItems)}
                        className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 min-h-[42px] touch-manipulation active:scale-95 ${showPrintedItems
                            ? 'bg-purple-500/10 text-purple-800 border-purple-500/30 font-black'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 font-bold'
                            }`}
                        title="Toggle re-printing already printed chits"
                    >
                        <CheckSquare className="h-4 w-4" />
                        <span>{showPrintedItems ? 'All Printed' : 'Unprinted'}</span>
                    </button>

                    <button
                        onClick={handlePrintKDSChits}
                        disabled={isPrinting || itemsToPrint.length === 0}
                        className={`font-black px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-xs min-h-[42px] touch-manipulation active:scale-95 cursor-pointer ${isPrinting || itemsToPrint.length === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : groupByMode === 'customer'
                            ? 'bg-purple-800 hover:bg-purple-900 text-white shadow-md'
                            : 'bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white'
                            }`}
                        title={`Print chits (${groupByMode === 'customer' ? 'Grouped by Customer -> Category' : groupByMode === 'table' ? 'Grouped by Table' : 'Single Station'})`}
                    >
                        <Printer className="h-4 w-4" />
                        <span>{isPrinting ? 'Printing…' : `Print Chits (${itemsToPrint.length})`}</span>
                    </button>

                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`px-3.5 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer border min-h-[42px] touch-manipulation active:scale-95 ${
                            showAdvancedFilters || searchQuery || selectedTables.length > 0 || selectedStatuses.length > 0 || sortBy !== 'received'
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-sm'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        <span>Sort & Options</span>
                        {(searchQuery || selectedTables.length > 0 || selectedStatuses.length > 0 || sortBy !== 'received') && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                    </button>

                    <a
                        href="/pos"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black px-3.5 py-2 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-xs min-h-[42px] touch-manipulation active:scale-95 shrink-0"
                    >
                        <Monitor className="h-4 w-4 text-[#1c3a1e]" />
                        <span>POS</span>
                    </a>
                </div>
            </header>

            {/* Touch-Friendly Station Tab Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full pb-2 mb-3 print:hidden">
                <button
                    onClick={() => {
                        setActiveTab('tickets');
                        setStationFilter('all');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 border min-h-[46px] touch-manipulation cursor-pointer active:scale-95 shrink-0 ${activeTab === 'tickets' && stationFilter === 'all'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                        : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                        }`}
                >
                    <Filter className="h-4 w-4" />
                    <span>All Stations</span>
                    <span className="bg-[#1c3a1e]/10 text-[#1c3a1e] px-2 py-0.5 rounded-lg text-xs font-black border border-[#1c3a1e]/10">
                        {activeKitchenItems.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('expediter')}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 border min-h-[46px] touch-manipulation cursor-pointer active:scale-95 shrink-0 ${activeTab === 'expediter'
                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                        : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                        }`}
                >
                    <Truck className="h-4 w-4" />
                    <span>Table Expediter / Pass</span>
                    <span className="bg-[#1c3a1e]/10 text-[#1c3a1e] px-2 py-0.5 rounded-lg text-xs font-black border border-[#1c3a1e]/10">
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
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 border min-h-[46px] touch-manipulation cursor-pointer active:scale-95 shrink-0 ${activeTab === 'tickets' && stationFilter === st.id
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                                : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{st.name}</span>
                            {count > 0 && (
                                <span className="bg-amber-400 text-amber-950 px-2 py-0.5 rounded-lg text-xs font-black border border-amber-500/20">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* UNIFIED SORT & MULTI-FILTER CONTROL POPOVER SUITE */}
            {activeTab === 'tickets' && showAdvancedFilters && (
                <div className="bg-white p-5 rounded-3xl border border-[#1c3a1e]/20 shadow-lg mb-6 space-y-4 print:hidden animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-[#1c3a1e]" />
                            <h3 className="text-sm font-black text-[#1c3a1e]">KDS Display Options & Sort Menu</h3>
                        </div>
                        <button
                            onClick={() => setShowAdvancedFilters(false)}
                            className="p-1 rounded-lg text-gray-400 hover:text-[#1c3a1e] hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* 1. Sort Order Control */}
                        <div>
                            <label className="text-[11px] font-extrabold text-[#1c3a1e] uppercase tracking-wider block mb-2">
                                ↕️ Ticket Sort Order
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 bg-[#eaf2eb] p-1.5 rounded-2xl border border-[#1c3a1e]/15">
                                {[
                                    { id: 'received', label: 'As Received (FIFO)' },
                                    { id: 'status', label: 'By Cooking Status' },
                                    { id: 'time', label: 'By Prep Elapsed Time' },
                                    { id: 'alphabet', label: 'Alphabetical' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setSortBy(opt.id as any)}
                                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-center transition-all ${
                                            sortBy === opt.id
                                                ? 'bg-[#1c3a1e] text-white shadow-xs'
                                                : 'text-[#1c3a1e] hover:bg-white/60'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Search Bar */}
                        <div>
                            <label className="text-[11px] font-extrabold text-[#1c3a1e] uppercase tracking-wider block mb-2">
                                🔍 Search Item, Note, or Table #
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search dish or table #..."
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl pl-9 pr-8 py-2 text-xs font-bold text-[#1c3a1e] focus:outline-none"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 3. Printed Items Toggle */}
                        <div>
                            <label className="text-[11px] font-extrabold text-[#1c3a1e] uppercase tracking-wider block mb-2">
                                🖨️ Chit Print Visibility
                            </label>
                            <button
                                onClick={() => setShowPrintedItems(!showPrintedItems)}
                                className={`w-full py-2 px-3 rounded-2xl text-xs font-black transition-all border flex items-center justify-between cursor-pointer ${
                                    showPrintedItems
                                        ? 'bg-purple-50 text-purple-900 border-purple-300'
                                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <CheckSquare className="h-4 w-4 text-purple-700" />
                                    <span>{showPrintedItems ? 'Showing ALL Items' : 'Unprinted Items Only'}</span>
                                </div>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white border border-gray-200">
                                    {showPrintedItems ? 'ALL' : 'UNPRINTED'}
                                </span>
                            </button>
                        </div>

                        {/* 4. Quantity Overview Toggle */}
                        <div>
                            <label className="text-[11px] font-extrabold text-[#1c3a1e] uppercase tracking-wider block mb-2">
                                🔥 Prep Quantity Summary
                            </label>
                            <button
                                onClick={() => setShowOverview(!showOverview)}
                                className={`w-full py-2 px-3 rounded-2xl text-xs font-black transition-all border flex items-center justify-between cursor-pointer ${
                                    showOverview
                                        ? 'bg-amber-500/10 text-amber-950 border-amber-500/40 shadow-2xs'
                                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-600" />
                                    <span>{showOverview ? 'Prep Overview Active' : 'Show Prep Overview'}</span>
                                </div>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white border border-gray-200">
                                    {showOverview ? 'ON' : 'OFF'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* 4. Table Filter Pills & Reset Bar */}
                    {availableTableNumbers.length > 0 && (
                        <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold text-[#1c3a1e] uppercase">Filter Tables:</span>
                                {availableTableNumbers.map((tbl) => {
                                    const isSelected = selectedTables.includes(tbl);
                                    return (
                                        <button
                                            key={tbl}
                                            onClick={() => toggleTableSelection(tbl)}
                                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border ${
                                                isSelected
                                                    ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                                    : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                            }`}
                                        >
                                            Tbl #{tbl}
                                        </button>
                                    );
                                })}
                            </div>

                            {(searchQuery || selectedTables.length > 0 || selectedStatuses.length > 0 || sortBy !== 'received') && (
                                <button
                                    onClick={resetAllFilters}
                                    className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer shrink-0"
                                >
                                    Reset All Options
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* LIVE KITCHEN ITEM QUANTITY OVERVIEW BANNER */}
            {activeTab === 'tickets' && showOverview && itemQuantitySummary.length > 0 && (
                <div className="bg-white rounded-3xl p-4 border border-[#1c3a1e]/15 shadow-sm mb-4 print:hidden transition-all">
                    <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-[#1c3a1e]/10">
                        <div className="flex items-center gap-2">
                            <span className="bg-[#1c3a1e] text-white text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                                🔥 Active Kitchen Prep Summary
                            </span>
                            <span className="text-xs font-bold text-gray-600">
                                Total: <strong className="text-[#1c3a1e] font-black">{itemQuantitySummary.reduce((sum, i) => sum + i.totalQty, 0)} items</strong> across {itemQuantitySummary.length} dishes
                            </span>
                        </div>
                        <button
                            onClick={() => setShowOverview(false)}
                            className="text-xs text-gray-400 hover:text-gray-700 font-bold px-2 py-1 cursor-pointer"
                            title="Hide Summary Banner"
                        >
                            ✕ Close
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                        {itemQuantitySummary.map((summaryItem, idx) => (
                            <div
                                key={idx}
                                className="bg-[#fafbfa] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/40 rounded-2xl px-3.5 py-2 flex items-center gap-3 shadow-2xs transition-all"
                            >
                                <div className="bg-[#1c3a1e] text-white font-black text-sm px-2.5 py-1 rounded-xl flex items-center justify-center min-w-[34px] shadow-2xs">
                                    {summaryItem.totalQty}x
                                </div>
                                <div>
                                    <div className="font-black text-xs text-[#1c3a1e] leading-tight">
                                        {summaryItem.itemName}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold mt-1">
                                        {summaryItem.preparingQty > 0 && (
                                            <span className="bg-amber-500/15 text-amber-800 px-1.5 py-0.5 rounded-md font-black">
                                                {summaryItem.preparingQty} preparing
                                            </span>
                                        )}
                                        {summaryItem.pendingQty > 0 && (
                                            <span className="bg-blue-500/15 text-blue-800 px-1.5 py-0.5 rounded-md font-black">
                                                {summaryItem.pendingQty} pending
                                            </span>
                                        )}
                                        {summaryItem.readyQty > 0 && (
                                            <span className="bg-emerald-500/15 text-emerald-800 px-1.5 py-0.5 rounded-md font-black">
                                                {summaryItem.readyQty} ready
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'tickets' && (showAdvancedFilters || searchQuery !== '' || selectedTables.length > 0 || selectedStatuses.length > 0) && (
                <div className="bg-white p-4 rounded-3xl border border-[#1c3a1e]/15 shadow-sm mb-6 space-y-3.5 print:hidden">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Search Input Bar */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search table #, dish name, or special instructions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 text-[#1c3a1e] font-bold text-xs pl-10 pr-9 py-2.5 rounded-2xl outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-0.5 cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Layout Mode Toggle */}
                        <div className="flex items-center gap-1 bg-[#eaf2eb] border border-[#1c3a1e]/15 p-1 rounded-2xl shrink-0">
                            <span className="text-[10px] font-black text-[#1c3a1e] uppercase px-2">Layout:</span>
                            <button
                                onClick={() => setGroupByMode('single')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${groupByMode === 'single' ? 'bg-[#1c3a1e] text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                    }`}
                            >
                                📋 Single Cards ({displayedItems.length})
                            </button>
                            <button
                                onClick={() => setGroupByMode('table')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${groupByMode === 'table' ? 'bg-[#1c3a1e] text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                    }`}
                            >
                                🍽️ Group by Table ({Object.keys(itemsGroupedByCard).length})
                            </button>
                            <button
                                onClick={() => setGroupByMode('customer')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${groupByMode === 'customer' ? 'bg-purple-800 text-white shadow-xs' : 'text-[#1c3a1e] hover:bg-[#d8e6da]'
                                    }`}
                            >
                                👤 Group by Customer ({Object.keys(itemsGroupedByCustomer).length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            {activeTab === 'expediter' ? (
                /* EXPEDITER TABLE PASS VIEW */
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
                                                        className="p-1.5 rounded-lg bg-[#eaf2eb] text-[#1c3a1e] hover:bg-gray-200 transition-colors cursor-pointer"
                                                        title="Undo back to Preparing"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        disabled={isAnyBumping}
                                                        onClick={() => handleStatusClick(item.id, 'ready')}
                                                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
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
                                        const ids = tableReadyItems.map((i) => i.id);
                                        if (ids.length === 0) return;

                                        // Optimistic local update
                                        setLocalItems((prev) =>
                                            prev.map((item) => (ids.includes(item.id) ? { ...item, status: 'delivered' } : item))
                                        );

                                        await updateMultipleOrderItemsStatus(ids, 'delivered');
                                        await refreshKDSData();
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
            ) : groupByMode === 'customer' ? (
                /* GROUPED BY CUSTOMER VIEW FOR CHEFS */
                Object.keys(itemsGroupedByCustomer).length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-[#1c3a1e]/15 shadow-sm print:hidden">
                        <ChefHat className="h-16 w-16 mx-auto mb-4 text-[#1c3a1e] opacity-30" />
                        <h3 className="text-lg font-bold text-[#1c3a1e]">No Kitchen Orders Match Filters!</h3>
                        <p className="text-xs text-gray-500 mt-1">Try resetting table, status, or search filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
                        {Object.entries(itemsGroupedByCustomer).map(([custKey, custGroup]) => {
                            const tableItems = custGroup.items;
                            const isCamping = custGroup.orderType === 'camping';
                            const isTakeout = custGroup.orderType === 'takeout';
                            const custName = custGroup.customerName;

                            const earliestTime = Math.min(...tableItems.map((i) => new Date(i.created_at).getTime()));
                            const elapsedMins = Math.floor((currentTime - earliestTime) / 60000);

                            let timerColor = 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30';
                            if (elapsedMins >= 10 && elapsedMins < 15) {
                                timerColor = 'bg-amber-500/10 text-amber-800 border-amber-500/30';
                            } else if (elapsedMins >= 15) {
                                timerColor = 'bg-red-500/10 text-red-700 border-red-500/30 animate-pulse';
                            }

                            const hasPending = tableItems.some((i) => i.status === 'pending');
                            const hasPreparing = tableItems.some((i) => i.status === 'preparing');

                            return (
                                <div
                                    key={custKey}
                                    className="bg-white rounded-3xl p-5 border-2 border-purple-800/30 shadow-md flex flex-col justify-between space-y-4"
                                >
                                    <div>
                                        {/* Customer Card Header */}
                                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15 mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="bg-purple-800 text-white font-black text-sm px-3.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                                                    <User className="h-4 w-4 text-[#d4af37]" />
                                                    <span>{isCamping ? `🏕️ ${custName}` : isTakeout ? `🛍️ ${custName}` : custName}</span>
                                                </div>
                                                <span className="text-xs font-bold text-gray-600">
                                                    ({tableItems.length} {tableItems.length === 1 ? 'item' : 'items'})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={isPrinting}
                                                    onClick={() => handlePrintSingleChit(tableItems)}
                                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                                    title="Print Chit for this Customer only"
                                                >
                                                    <Printer className="h-3.5 w-3.5" />
                                                    <span>Print Chit</span>
                                                </button>

                                                <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1 ${timerColor}`}>
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{elapsedMins}m</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Customer Level Bulk Actions */}
                                        {(hasPending || hasPreparing) && (
                                            <div className="flex items-center gap-2 mb-3">
                                                {hasPending && (
                                                    <button
                                                        onClick={async () => {
                                                            const pendingIds = tableItems.filter((i) => i.status === 'pending').map((i) => i.id);
                                                            if (pendingIds.length === 0) return;

                                                            setLocalItems((prev) =>
                                                                prev.map((item) => (pendingIds.includes(item.id) ? { ...item, status: 'preparing' } : item))
                                                            );

                                                            await updateMultipleOrderItemsStatus(pendingIds, 'preparing');
                                                            await refreshKDSData();
                                                        }}
                                                        className="flex-1 bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-black py-2.5 px-3 rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] touch-manipulation active:scale-95"
                                                    >
                                                        <span>Start Cooking All</span>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {hasPreparing && (
                                                    <button
                                                        onClick={async () => {
                                                            const preparingIds = tableItems.filter((i) => i.status === 'preparing').map((i) => i.id);
                                                            if (preparingIds.length === 0) return;

                                                            setLocalItems((prev) =>
                                                                prev.map((item) => (preparingIds.includes(item.id) ? { ...item, status: 'ready' } : item))
                                                            );

                                                            await updateMultipleOrderItemsStatus(preparingIds, 'ready');
                                                            await refreshKDSData();
                                                        }}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-3 rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] touch-manipulation active:scale-95"
                                                    >
                                                        <span>Mark All Ready</span>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Customer Items Grouped by Category / Station */}
                                        <div className="space-y-3">
                                            {Object.entries(
                                                tableItems.reduce<Record<string, OrderItem[]>>((stAcc, stItem) => {
                                                    let st: string = stItem.station || 'mezza';
                                                    if (st === 'cold_mezza' || st === 'hot_mezza') st = 'mezza';
                                                    const stName = stationDisplayNames[st] || st.replace('_', ' ').toUpperCase();
                                                    if (!stAcc[stName]) stAcc[stName] = [];
                                                    stAcc[stName].push(stItem);
                                                    return stAcc;
                                                }, {})
                                            ).map(([stName, stItems]) => (
                                                <div key={stName} className="bg-[#f4f8f5] border border-[#1c3a1e]/20 p-3 rounded-2xl space-y-2">
                                                    <div className="text-xs font-black text-[#1c3a1e] uppercase pb-1 border-b border-[#1c3a1e]/15 flex justify-between">
                                                        <span>CATEGORY: {stName}</span>
                                                        <span className="text-[10px] text-gray-500 font-bold">({stItems.length})</span>
                                                    </div>

                                                    {stItems.map((item) => {
                                                        const mItem = menuItems.find((m) => m.id === item.menu_item_id);
                                                        const statusButtonStyles = {
                                                            pending: 'bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-extrabold',
                                                            preparing: 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold',
                                                            ready: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
                                                            delivered: 'bg-gray-200 text-gray-600',
                                                            cancelled: 'bg-red-500/10 text-red-700',
                                                        };

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="bg-white border border-[#1c3a1e]/15 p-3 rounded-xl space-y-2 shadow-2xs"
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex items-center gap-2.5">
                                                                        {mItem?.image_url && (
                                                                            <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-[#1c3a1e]/15 flex-shrink-0">
                                                                                <Image
                                                                                    src={mItem.image_url}
                                                                                    alt={item.item_name}
                                                                                    fill
                                                                                    unoptimized
                                                                                    className="object-cover"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <div className="font-black text-sm text-[#1c3a1e]">
                                                                                {item.quantity}x {item.item_name}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <span className={`uppercase px-2 py-0.5 rounded-md text-[9px] font-black border ${item.status === 'pending'
                                                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                            : item.status === 'preparing'
                                                                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                                        }`}>{item.status}</span>
                                                                </div>

                                                                {/* Modifiers List */}
                                                                {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                                    <div className="space-y-0.5 pl-1">
                                                                        {item.selected_modifiers.map((mod: any, idx: number) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="text-[11px] text-[#1c3a1e] font-medium"
                                                                            >
                                                                                + {mod.group}: <span className="font-black">{mod.option}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Special Notes */}
                                                                {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 text-[11px] text-red-800 font-semibold">
                                                                        *** NOTE: {item.special_notes} ***
                                                                    </div>
                                                                )}

                                                                {/* Action Buttons for this item */}
                                                                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#1c3a1e]/10">
                                                                    <button
                                                                        disabled={isPrinting}
                                                                        onClick={() => handlePrintSingleChit([item])}
                                                                        className="bg-gray-100 hover:bg-[#1c3a1e] hover:text-white border border-gray-300 text-gray-700 p-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                                        title="Print Chit for this 1 item"
                                                                    >
                                                                        <Printer className="h-3.5 w-3.5" />
                                                                    </button>

                                                                    {item.status !== 'pending' && (
                                                                        <button
                                                                            disabled={isAnyBumping}
                                                                            onClick={() => handleUndoStatus(item.id)}
                                                                            className="bg-[#eaf2eb] hover:bg-gray-200 border border-[#1c3a1e]/20 text-[#1c3a1e] p-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                                            title="Undo Status"
                                                                        >
                                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        disabled={isAnyBumping}
                                                                        onClick={() => handleStatusClick(item.id, item.status)}
                                                                        className={`px-4 py-2.5 min-h-[44px] rounded-2xl text-xs sm:text-sm font-black transition-all shadow-xs disabled:opacity-50 cursor-pointer touch-manipulation active:scale-95 flex items-center gap-1.5 ${statusButtonStyles[item.status]}`}
                                                                    >
                                                                        {item.status === 'pending'
                                                                            ? 'Start Cooking'
                                                                            : item.status === 'preparing'
                                                                                ? 'Mark Ready'
                                                                                : item.status === 'ready'
                                                                                    ? 'Deliver'
                                                                                    : 'Done'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : groupByTable ? (
                /* GROUPED BY TABLE VIEW FOR CHEFS */
                Object.keys(itemsGroupedByCard).length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-[#1c3a1e]/15 shadow-sm print:hidden">
                        <ChefHat className="h-16 w-16 mx-auto mb-4 text-[#1c3a1e] opacity-30" />
                        <h3 className="text-lg font-bold text-[#1c3a1e]">No Kitchen Orders Match Filters!</h3>
                        <p className="text-xs text-gray-500 mt-1">Try resetting table, status, or search filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
                        {Object.entries(itemsGroupedByCard).map(([cardKey, tableItems]) => {
                            const firstItem = tableItems[0];
                            const tblNum = firstItem?.table_number ?? 1;
                            const isTakeout = firstItem?.order_type === 'takeout' || tblNum === 0;
                            const isCamping = firstItem?.order_type === 'camping';
                            const custName = firstItem?.customer_name;

                            const earliestTime = Math.min(...tableItems.map((i) => new Date(i.created_at).getTime()));
                            const elapsedMins = Math.floor((currentTime - earliestTime) / 60000);

                            let timerColor = 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30';
                            if (elapsedMins >= 10 && elapsedMins < 15) {
                                timerColor = 'bg-amber-500/10 text-amber-800 border-amber-500/30';
                            } else if (elapsedMins >= 15) {
                                timerColor = 'bg-red-500/10 text-red-700 border-red-500/30 animate-pulse';
                            }

                            const hasPending = tableItems.some((i) => i.status === 'pending');
                            const hasPreparing = tableItems.some((i) => i.status === 'preparing');

                            return (
                                <div
                                    key={cardKey}
                                    className="bg-white rounded-3xl p-5 border-2 border-[#1c3a1e]/15 shadow-md flex flex-col justify-between space-y-4"
                                >
                                    <div>
                                        {/* Table Card Header */}
                                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15 mb-3">
                                            <div className="flex items-center gap-2.5">
                                                {isTakeout ? (
                                                    <div className="bg-amber-600 text-white font-black text-sm px-3.5 py-1 rounded-xl shadow-xs">
                                                        🛍️ TAKEOUT {custName ? `— ${custName}` : ''}
                                                    </div>
                                                ) : isCamping ? (
                                                    <div className="bg-purple-700 text-white font-black text-sm px-3.5 py-1 rounded-xl shadow-xs">
                                                        🏕️ CAMPING {custName ? `— ${custName}` : ''}
                                                    </div>
                                                ) : (
                                                    <div className="bg-[#1c3a1e] text-white font-black text-sm px-3.5 py-1 rounded-xl shadow-xs">
                                                        TABLE #{tblNum}
                                                    </div>
                                                )}
                                                <span className="text-xs font-bold text-gray-600">
                                                    ({tableItems.length} {tableItems.length === 1 ? 'item' : 'items'})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={isPrinting}
                                                    onClick={() => handlePrintSingleChit(tableItems)}
                                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                                    title="Print Chit for this Table only"
                                                >
                                                    <Printer className="h-3.5 w-3.5" />
                                                    <span>Print Chit</span>
                                                </button>

                                                <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1 ${timerColor}`}>
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{elapsedMins}m</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Table Level Quick Bulk Actions */}
                                        {(hasPending || hasPreparing) && (
                                            <div className="flex items-center gap-2 mb-3">
                                                {hasPending && (
                                                    <button
                                                        onClick={async () => {
                                                            const pendingIds = tableItems.filter((i) => i.status === 'pending').map((i) => i.id);
                                                            if (pendingIds.length === 0) return;

                                                            setLocalItems((prev) =>
                                                                prev.map((item) => (pendingIds.includes(item.id) ? { ...item, status: 'preparing' } : item))
                                                            );

                                                            await updateMultipleOrderItemsStatus(pendingIds, 'preparing');
                                                            await refreshKDSData();
                                                        }}
                                                        className="flex-1 bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-black py-2.5 px-3 rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] touch-manipulation active:scale-95"
                                                    >
                                                        <span>Start Cooking All</span>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {hasPreparing && (
                                                    <button
                                                        onClick={async () => {
                                                            const preparingIds = tableItems.filter((i) => i.status === 'preparing').map((i) => i.id);
                                                            if (preparingIds.length === 0) return;

                                                            setLocalItems((prev) =>
                                                                prev.map((item) => (preparingIds.includes(item.id) ? { ...item, status: 'ready' } : item))
                                                            );

                                                            await updateMultipleOrderItemsStatus(preparingIds, 'ready');
                                                            await refreshKDSData();
                                                        }}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-3 rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] touch-manipulation active:scale-95"
                                                    >
                                                        <span>Mark All Ready</span>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Table Items List */}
                                        <div className="space-y-3">
                                            {tableItems.map((item) => {
                                                const mItem = menuItems.find((m) => m.id === item.menu_item_id);
                                                const statusButtonStyles = {
                                                    pending: 'bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-extrabold',
                                                    preparing: 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold',
                                                    ready: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
                                                    delivered: 'bg-gray-200 text-gray-600',
                                                    cancelled: 'bg-red-500/10 text-red-700',
                                                };

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="bg-[#fafbfa] border border-[#1c3a1e]/15 p-3 rounded-2xl space-y-2 shadow-2xs"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2.5">
                                                                {mItem?.image_url && (
                                                                    <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-[#1c3a1e]/15 flex-shrink-0">
                                                                        <Image
                                                                            src={mItem.image_url}
                                                                            alt={item.item_name}
                                                                            fill
                                                                            unoptimized
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-black text-sm text-[#1c3a1e]">
                                                                        {item.quantity}x {item.item_name}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                                        STATION: {(stationDisplayNames[item.station] || item.station).replace(' Station', '').replace(' (Hot/Cold & Salads)', '')}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <span className={`uppercase px-2 py-0.5 rounded-md text-[9px] font-black border ${item.status === 'pending'
                                                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                    : item.status === 'preparing'
                                                                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                                }`}>{item.status}</span>
                                                        </div>

                                                        {/* Modifiers List */}
                                                        {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                                            <div className="space-y-0.5 pl-1">
                                                                {item.selected_modifiers.map((mod: any, idx: number) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="text-[11px] text-[#1c3a1e] font-medium"
                                                                    >
                                                                        + {mod.group}: <span className="font-black">{mod.option}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Special Notes */}
                                                        {item.special_notes && item.special_notes.trim() !== '' && item.special_notes !== 'Added by Waiter' && (
                                                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 text-[11px] text-red-800 font-semibold">
                                                                *** NOTE: {item.special_notes} ***
                                                            </div>
                                                        )}

                                                        {/* Action Buttons for this item */}
                                                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#1c3a1e]/10">
                                                            <button
                                                                disabled={isPrinting}
                                                                onClick={() => handlePrintSingleChit([item])}
                                                                className="bg-gray-100 hover:bg-[#1c3a1e] hover:text-white border border-gray-300 text-gray-700 p-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                                title="Print Chit for this 1 item"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </button>

                                                            {item.status !== 'pending' && (
                                                                <button
                                                                    disabled={isAnyBumping}
                                                                    onClick={() => handleUndoStatus(item.id)}
                                                                    className="bg-[#eaf2eb] hover:bg-gray-200 border border-[#1c3a1e]/20 text-[#1c3a1e] p-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                                    title="Undo Status"
                                                                >
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}

                                                            <button
                                                                disabled={isAnyBumping}
                                                                onClick={() => handleStatusClick(item.id, item.status)}
                                                                className={`px-4 py-2.5 min-h-[44px] rounded-2xl text-xs sm:text-sm font-black transition-all shadow-xs disabled:opacity-50 cursor-pointer touch-manipulation active:scale-95 flex items-center gap-1.5 ${statusButtonStyles[item.status]}`}
                                                            >
                                                                {item.status === 'pending'
                                                                    ? 'Start Cooking'
                                                                    : item.status === 'preparing'
                                                                        ? 'Mark Ready'
                                                                        : item.status === 'ready'
                                                                            ? 'Deliver'
                                                                            : 'Done'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                                                    <div className="relative h-11 w-11 rounded-xl overflow-hidden border border-[#1c3a1e]/15 flex-shrink-0 shadow-sm">
                                                        <Image
                                                            src={mItem.image_url}
                                                            alt={item.item_name}
                                                            fill
                                                            unoptimized
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="flex items-center gap-1.5 flex-wrap mb-1 text-sm font-extrabold text-[#1c3a1e]">
                                                        {item.order_type === 'takeout' || item.table_number === 0 ? (
                                                            <div className="bg-amber-600 text-white text-xs font-black px-2.5 py-0.5 rounded-lg shadow-xs">
                                                                🛍️ TAKEOUT {item.customer_name ? `— ${item.customer_name}` : ''}
                                                            </div>
                                                        ) : item.order_type === 'camping' ? (
                                                            <div className="bg-purple-700 text-white text-xs font-black px-2.5 py-0.5 rounded-lg shadow-xs">
                                                                🏕️ CAMPING {item.customer_name ? `— ${item.customer_name}` : ''}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-[#1c3a1e] text-white text-xs font-black px-2.5 py-0.5 rounded-lg shadow-xs">
                                                                TABLE #{item.table_number || 1}
                                                            </div>
                                                        )}
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
                                            Status: <strong className={`uppercase px-2 py-0.5 rounded-md text-[10px] font-black border ${item.status === 'pending'
                                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                    : item.status === 'preparing'
                                                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                }`}>{item.status}</strong>
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={isPrinting}
                                                onClick={() => handlePrintSingleChit([item])}
                                                className="bg-gray-100 hover:bg-[#1c3a1e] hover:text-white border border-gray-300 text-[#1c3a1e] p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                                title="Print Chit for this 1 item"
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">Print</span>
                                            </button>

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
