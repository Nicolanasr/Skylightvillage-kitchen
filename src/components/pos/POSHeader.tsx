'use client';

import React from 'react';
import { ServiceCall } from '@/lib/types';
import { resolveServiceCall } from '@/app/actions/payment-actions';
import { Bell, Monitor, ChefHat, Shield, ArrowLeft, Flame } from 'lucide-react';

interface POSHeaderProps {
    serviceCalls: ServiceCall[];
    refreshPOSData: () => void;
    showAllFloorTables: boolean;
    setShowAllFloorTables: (val: boolean) => void;
    posViewMode?: 'tables' | 'takeout';
    setPosViewMode?: (mode: 'tables' | 'takeout') => void;
    orderItems?: any[];
}

export const POSHeader: React.FC<POSHeaderProps> = ({
    serviceCalls,
    refreshPOSData,
    showAllFloorTables,
    setShowAllFloorTables,
    posViewMode = 'tables',
    setPosViewMode,
    orderItems = [],
}) => {
    const pendingCalls = serviceCalls.filter((c) => c.status === 'pending');

    // Calculate overdue kitchen items (pending or preparing for > 12 minutes)
    const now = Date.now();
    const overdueItems = orderItems.filter((i) => {
        if (i.status !== 'pending' && i.status !== 'preparing') return false;
        const elapsedMins = Math.floor((now - new Date(i.created_at).getTime()) / 60000);
        return elapsedMins >= 12;
    });

    const overdueTableNums = Array.from(new Set(overdueItems.map((i) => i.table_number || 1))).sort((a, b) => a - b);

    return (
        <div className="space-y-4">
            {/* Kitchen Overdue Prep Alert Banner */}
            {overdueItems.length > 0 && (
                <div className="bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-lg font-black flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <Flame className="h-5 w-5 text-amber-300" />
                        <span className="text-sm">
                            🔥 KITCHEN PREP DELAY ALERT ({overdueItems.length} items overdue): Table #{overdueTableNums.join(', #')}{' '}
                            waiting &gt; 12 mins in kitchen!
                        </span>
                    </div>

                    <a
                        href="/kds"
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white text-rose-900 text-xs font-black px-4 py-2 rounded-xl hover:bg-amber-100 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                        <ChefHat className="h-4 w-4" />
                        <span>Open KDS Screen</span>
                    </a>
                </div>
            )}

            {/* Pending Waiter Service Calls Banner */}
            {pendingCalls.length > 0 && (
                <div className="bg-amber-500 text-slate-950 px-6 py-3 rounded-2xl shadow-lg font-black flex items-center justify-between animate-bounce">
                    <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 animate-spin" />
                        <span className="text-sm">
                            🔔 WAITER CALL ALERT ({pendingCalls.length}): Table #{pendingCalls.map((c) => c.table_number).join(', #')}{' '}
                            {pendingCalls.some((c) => c.type === 'bill') ? 'requested the BILL 💵' : 'needs assistance!'}
                        </span>
                    </div>

                    <button
                        onClick={async () => {
                            for (const c of pendingCalls) {
                                await resolveServiceCall(c.id);
                            }
                            refreshPOSData();
                        }}
                        className="bg-slate-950 text-amber-400 text-xs font-black px-4 py-2 rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
                    >
                        Acknowledge All ({pendingCalls.length})
                    </button>
                </div>
            )}

            {/* Main Navigation Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-[#1c3a1e]/15 gap-4">
                <div className="flex items-center gap-3">
                    {!showAllFloorTables && (
                        <button
                            onClick={() => setShowAllFloorTables(true)}
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back to {posViewMode === 'takeout' ? 'Workbench' : 'Tables'}</span>
                        </button>
                    )}

                    <div>
                        <h1 className="text-2xl font-black text-[#1c3a1e] tracking-tight flex items-center gap-2">
                            <Monitor className="h-6 w-6 text-[#d4af37]" />
                            <span>Skylight POS Terminal</span>
                        </h1>
                        <p className="text-xs text-gray-600 font-medium">
                            Real-time floor plan, fast order taking, table merging & invoice receipts
                        </p>
                    </div>
                </div>

                {/* Quick Action Navigation Links & Mode Selector */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#eaf2eb] p-1 rounded-xl border border-[#1c3a1e]/15">
                        <button
                            onClick={() => {
                                setPosViewMode?.('tables');
                                setShowAllFloorTables(true);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                posViewMode === 'tables' && showAllFloorTables
                                    ? 'bg-[#1c3a1e] text-white shadow-xs'
                                    : 'text-[#1c3a1e] hover:bg-white/50'
                            }`}
                        >
                            🍽️ Tables
                        </button>
                        <button
                            onClick={() => {
                                setPosViewMode?.('takeout');
                                setShowAllFloorTables(true);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                posViewMode === 'takeout' && showAllFloorTables
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-[#1c3a1e] hover:bg-white/50'
                            }`}
                        >
                            🛍️ Takeout & Camping
                        </button>
                    </div>

                    <a
                        href="/events"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
                    >
                        <span>🎟️ Event Vouchers</span>
                    </a>

                    <a
                        href="/kds"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
                    >
                        <ChefHat className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Kitchen KDS</span>
                    </a>

                    <a
                        href="/admin"
                        className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
                    >
                        <Shield className="h-4 w-4 text-[#1c3a1e]" />
                        <span>Admin Manager</span>
                    </a>
                </div>
            </header>
        </div>
    );
};
