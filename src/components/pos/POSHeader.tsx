'use client';

import React from 'react';
import { ServiceCall } from '@/lib/types';
import { resolveServiceCall } from '@/app/actions/payment-actions';
import { Bell, Monitor, ChefHat, Shield } from 'lucide-react';

interface POSHeaderProps {
    serviceCalls: ServiceCall[];
    refreshPOSData: () => void;
    showAllFloorTables: boolean;
    setShowAllFloorTables: (val: boolean) => void;
}

export const POSHeader: React.FC<POSHeaderProps> = ({
    serviceCalls,
    refreshPOSData,
    showAllFloorTables,
    setShowAllFloorTables,
}) => {
    const pendingCalls = serviceCalls.filter((c) => c.status === 'pending');

    return (
        <div className="space-y-4">
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
                <div className="flex items-center gap-4">
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

                {/* Quick Action Navigation Links */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowAllFloorTables(!showAllFloorTables)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${showAllFloorTables
                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#d8e6da]'
                            }`}
                    >
                        {showAllFloorTables ? 'View Selected Table Cart' : 'View Floor Plan Overview'}
                    </button>

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
