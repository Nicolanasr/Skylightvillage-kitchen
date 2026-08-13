'use client';

import React, { useState, useEffect } from 'react';
import { ServiceCall } from '@/lib/types';
import { resolveServiceCall } from '@/app/actions/payment-actions';
import {
    getActiveCashierShift,
    openCashierShiftAction,
    recordCashDropAction,
    performBlindZReportCloseAction,
} from '@/app/actions/report-actions';
import { Bell, Monitor, ChefHat, Shield, ArrowLeft, Flame, DollarSign, FileText, TrendingUp, Printer, CheckCircle2 } from 'lucide-react';

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

    // Shift Z-Report State
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [loadingShift, setLoadingShift] = useState(false);
    const [activeShift, setActiveShift] = useState<any>(null);
    const [shiftViewMode, setShiftViewMode] = useState<'menu' | 'drop' | 'close'>('menu');

    // Open Shift State
    const [cashierName, setCashierName] = useState('');
    const [floatUsd, setFloatUsd] = useState('100.00');
    const [floatLbp, setFloatLbp] = useState('0');

    // Drop Cash State
    const [dropUsd, setDropUsd] = useState('');
    const [dropLbp, setDropLbp] = useState('');
    const [dropNotes, setDropNotes] = useState('');

    // Z-Report Close State
    const [closeActualUsd, setCloseActualUsd] = useState('');
    const [closeActualLbp, setCloseActualLbp] = useState('');
    const [closeNotes, setCloseNotes] = useState('');
    const [zReportResult, setZReportResult] = useState<any>(null);

    const loadShiftData = async () => {
        setLoadingShift(true);
        const res = await getActiveCashierShift();
        setActiveShift(res.activeShift);
        setLoadingShift(false);
    };

    useEffect(() => {
        loadShiftData();
    }, []);

    // Calculate overdue kitchen items (pending or preparing for > 12 minutes)
    const now = Date.now();
    const overdueItems = orderItems.filter((i) => {
        if (i.status !== 'pending' && i.status !== 'preparing') return false;
        const elapsedMins = Math.floor((now - new Date(i.created_at).getTime()) / 60000);
        return elapsedMins >= 12;
    });

    const overdueTableNums = Array.from(new Set(overdueItems.map((i) => i.table_number || 1))).sort((a, b) => a - b);

    const [showToolsMenu, setShowToolsMenu] = useState(false);

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
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#1c3a1e]/15 gap-4">
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

                {/* Streamlined Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Primary Floor Mode Switcher Pill */}
                    <div className="flex items-center gap-1 bg-[#eaf2eb] p-1 rounded-2xl border border-[#1c3a1e]/15 shadow-xs">
                        <button
                            onClick={() => {
                                setPosViewMode?.('tables');
                                setShowAllFloorTables(true);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${posViewMode === 'tables' && showAllFloorTables
                                    ? 'bg-[#1c3a1e] text-white shadow-sm'
                                    : 'text-[#1c3a1e] hover:bg-white/60'
                                }`}
                        >
                            📋 Floor Plan
                        </button>
                        <button
                            onClick={() => {
                                setPosViewMode?.('takeout');
                                setShowAllFloorTables(true);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${posViewMode === 'takeout' && showAllFloorTables
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-[#1c3a1e] hover:bg-white/60'
                                }`}
                        >
                            🛍️ Takeout & Camping
                        </button>
                    </div>

                    {/* Shift Z-Report Control Button */}
                    <button
                        onClick={async () => {
                            setShowShiftModal(true);
                            loadShiftData();
                        }}
                        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                        <DollarSign className="h-4 w-4" />
                        <span>{activeShift ? '🟢 Shift Z-Report' : '💵 Open Shift Float'}</span>
                    </button>

                    {/* Compact Tools Dropdown Popover */}
                    <div className="relative">
                        <button
                            onClick={() => setShowToolsMenu(!showToolsMenu)}
                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                            <span>⚡ Quick Apps</span>
                            <span className="text-[10px] text-gray-500">▼</span>
                        </button>

                        {showToolsMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowToolsMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#1c3a1e]/15 rounded-2xl shadow-xl z-50 p-2 space-y-1 text-xs">
                                    <a
                                        href="/kds"
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[#1c3a1e] hover:bg-[#eaf2eb] transition-colors"
                                        onClick={() => setShowToolsMenu(false)}
                                    >
                                        <ChefHat className="h-4 w-4 text-[#1c3a1e]" />
                                        <span>Kitchen KDS Display</span>
                                    </a>
                                    <a
                                        href="/events"
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[#1c3a1e] hover:bg-[#eaf2eb] transition-colors"
                                        onClick={() => setShowToolsMenu(false)}
                                    >
                                        <span>🎟️ Event Vouchers Desk</span>
                                    </a>
                                    <a
                                        href="/pos/reports"
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[#1c3a1e] hover:bg-[#eaf2eb] transition-colors"
                                        onClick={() => setShowToolsMenu(false)}
                                    >
                                        <TrendingUp className="h-4 w-4 text-[#1c3a1e]" />
                                        <span>Shift & Odoo Reports</span>
                                    </a>
                                    <div className="border-t border-gray-100 my-1" />
                                    <a
                                        href="/admin"
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-[#1c3a1e] hover:bg-[#eaf2eb] transition-colors"
                                        onClick={() => setShowToolsMenu(false)}
                                    >
                                        <Shield className="h-4 w-4 text-[#1c3a1e]" />
                                        <span>Admin Control Center</span>
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Shift Z-Report & Cash Control Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 text-[#1c3a1e]">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2.5">
                                <div className="h-10 w-10 bg-[#eaf2eb] rounded-2xl flex items-center justify-center text-[#1c3a1e]">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black">Cashier Shift Float & Z-Report</h3>
                                    <p className="text-xs text-gray-500 font-medium">Cash drawer tracking, drops & blind reconciliation</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowShiftModal(false);
                                    setZReportResult(null);
                                }}
                                className="text-gray-400 hover:text-black font-bold text-lg cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {loadingShift ? (
                            <div className="py-12 text-center space-y-3">
                                <div className="h-8 w-8 border-4 border-[#1c3a1e] border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-xs font-bold text-[#1c3a1e]">Loading shift data...</p>
                            </div>
                        ) : zReportResult ? (
                            /* Z-REPORT SUMMARY RESULT */
                            <div className="space-y-4">
                                <div className="bg-emerald-50 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-1">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                                    <h4 className="font-black text-base text-emerald-950">Shift Closed & Z-Report Generated!</h4>
                                    <p className="text-xs text-emerald-800 font-medium">
                                        Shift #{zReportResult.shiftId.slice(-6)} • Cashier: <strong>{zReportResult.cashierName}</strong>
                                    </p>
                                </div>

                                <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 space-y-2 text-xs">
                                    <div className="flex justify-between border-b pb-1.5 font-bold">
                                        <span>Opening Cash Float:</span>
                                        <span>${zReportResult.openingFloatUsd.toFixed(2)} USD • {zReportResult.openingFloatLbp.toLocaleString()} LBP</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1.5 font-bold text-emerald-800">
                                        <span>Collected Sales Cash:</span>
                                        <span>+${zReportResult.collectedCashUsd.toFixed(2)} USD • +{zReportResult.collectedCashLbp.toLocaleString()} LBP</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1.5 font-bold text-indigo-900">
                                        <span>Collected Credit Card:</span>
                                        <span>${zReportResult.collectedCardUsd.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1.5 font-bold text-rose-800">
                                        <span>Mid-Shift Safe Drops:</span>
                                        <span>-${zReportResult.cashDropsUsd.toFixed(2)} USD • -{zReportResult.cashDropsLbp.toLocaleString()} LBP</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1.5 font-black text-[#1c3a1e]">
                                        <span>Expected Cash in Drawer:</span>
                                        <span>${zReportResult.expectedCashUsd.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1.5 font-black text-blue-900">
                                        <span>Actual Cash Counted:</span>
                                        <span>${zReportResult.actualCashUsd.toFixed(2)} USD</span>
                                    </div>
                                    <div className={`flex justify-between font-black text-sm pt-1 ${zReportResult.varianceUsd >= 0 ? 'text-emerald-800' : 'text-rose-700'
                                        }`}>
                                        <span>Variance (Over / Short):</span>
                                        <span>
                                            {zReportResult.varianceUsd === 0
                                                ? '✅ PERFECT MATCH ($0.00)'
                                                : zReportResult.varianceUsd > 0
                                                    ? `+$${zReportResult.varianceUsd.toFixed(2)} OVERAGE`
                                                    : `-$${Math.abs(zReportResult.varianceUsd).toFixed(2)} SHORTAGE`}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        window.print();
                                    }}
                                    className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                                >
                                    <Printer className="h-4 w-4" />
                                    <span>Print Thermal Z-Report Slip</span>
                                </button>
                            </div>
                        ) : !activeShift ? (
                            /* OPEN NEW SHIFT FORM */
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    const res = await openCashierShiftAction({
                                        cashierName,
                                        openingFloatUsd: Number(floatUsd || 0),
                                        openingFloatLbp: Number(floatLbp || 0),
                                    });
                                    if (res.success) {
                                        loadShiftData();
                                    } else {
                                        alert(res.error || 'Failed to open shift');
                                    }
                                }}
                                className="space-y-4"
                            >
                                <div className="bg-emerald-50 border border-emerald-500/30 rounded-2xl p-4 text-xs font-medium text-emerald-950">
                                    💡 <strong>Start New Cashier Shift:</strong> Log starting drawer cash floats before taking customer payments.
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Cashier Name / Shift Leader</label>
                                    <input
                                        type="text"
                                        value={cashierName}
                                        onChange={(e) => setCashierName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Opening Float ($ USD)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            value={floatUsd}
                                            onChange={(e) => setFloatUsd(e.target.value)}
                                            placeholder="100.00"
                                            className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-black text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Opening Float (LBP)</label>
                                        <input
                                            type="number"
                                            step="50000"
                                            value={floatLbp}
                                            onChange={(e) => setFloatLbp(e.target.value)}
                                            placeholder="500000"
                                            className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-black text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs transition-all shadow-xs cursor-pointer"
                                >
                                    🟢 Open Cashier Shift
                                </button>
                            </form>
                        ) : (
                            /* ACTIVE SHIFT CONTROLS & RECONCILIATION */
                            <div className="space-y-4">
                                <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">🟢 Active Shift Leader</span>
                                        <strong className="text-sm font-black text-[#1c3a1e]">{activeShift.cashier_name}</strong>
                                        <span className="text-[11px] text-gray-500 block">Opened: {new Date(activeShift.opened_at).toLocaleTimeString('en-GB')}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black block">Opening Float: ${activeShift.opening_float_usd.toFixed(2)} USD</span>
                                        <span className="text-[11px] font-bold text-rose-800 block">Safe Drops: -${activeShift.cash_drops_usd.toFixed(2)} USD</span>
                                    </div>
                                </div>

                                {shiftViewMode === 'menu' && (
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button
                                            onClick={() => setShiftViewMode('drop')}
                                            className="bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-black p-4 rounded-2xl text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                        >
                                            <TrendingUp className="h-5 w-5 text-amber-600" />
                                            <span>Record Mid-Shift Safe Drop</span>
                                        </button>

                                        <button
                                            onClick={() => setShiftViewMode('close')}
                                            className="bg-[#1c3a1e] hover:bg-rose-700 text-white font-black p-4 rounded-2xl text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                        >
                                            <FileText className="h-5 w-5 text-white" />
                                            <span>Blind Z-Report Close</span>
                                        </button>
                                    </div>
                                )}

                                {shiftViewMode === 'drop' && (
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const res = await recordCashDropAction({
                                                shiftId: activeShift.id,
                                                amountUsd: Number(dropUsd || 0),
                                                amountLbp: Number(dropLbp || 0),
                                                droppedBy: activeShift.cashier_name,
                                                notes: dropNotes,
                                            });
                                            if (res.success) {
                                                setDropUsd('');
                                                setDropLbp('');
                                                setShiftViewMode('menu');
                                                loadShiftData();
                                            } else {
                                                alert(res.error || 'Failed to record drop');
                                            }
                                        }}
                                        className="bg-amber-50/60 border border-amber-500/20 rounded-2xl p-4 space-y-3"
                                    >
                                        <h4 className="font-extrabold text-xs text-amber-950 uppercase tracking-wider">Record Mid-Shift Safe Cash Drop</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Drop Amount ($ USD)</label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={dropUsd}
                                                    onChange={(e) => setDropUsd(e.target.value)}
                                                    placeholder="200.00"
                                                    className="w-full bg-white border border-amber-500/30 rounded-xl p-2.5 text-xs font-black text-[#1c3a1e]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Drop Amount (LBP)</label>
                                                <input
                                                    type="number"
                                                    step="50000"
                                                    value={dropLbp}
                                                    onChange={(e) => setDropLbp(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full bg-white border border-amber-500/30 rounded-xl p-2.5 text-xs font-black text-[#1c3a1e]"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShiftViewMode('menu')}
                                                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl text-xs shadow-xs"
                                            >
                                                Confirm Drop to Safe
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {shiftViewMode === 'close' && (
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const res = await performBlindZReportCloseAction({
                                                shiftId: activeShift.id,
                                                actualCashUsd: Number(closeActualUsd || 0),
                                                actualCashLbp: Number(closeActualLbp || 0),
                                                notes: closeNotes,
                                            });
                                            if (res.success && res.zReport) {
                                                setZReportResult(res.zReport);
                                            } else {
                                                alert(res.error || 'Failed to close shift');
                                            }
                                        }}
                                        className="bg-rose-50/60 border border-rose-500/20 rounded-2xl p-4 space-y-3"
                                    >
                                        <h4 className="font-extrabold text-xs text-rose-950 uppercase tracking-wider">Blind Z-Report Reconciliation</h4>
                                        <p className="text-[11px] text-gray-600">Count physical bills in drawer and enter total count below:</p>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Actual Cash in Drawer ($ USD)</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={closeActualUsd}
                                                    onChange={(e) => setCloseActualUsd(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full bg-white border border-rose-500/30 rounded-xl p-2.5 text-xs font-black text-[#1c3a1e]"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">Actual Cash in Drawer (LBP)</label>
                                                <input
                                                    type="number"
                                                    step="1000"
                                                    value={closeActualLbp}
                                                    onChange={(e) => setCloseActualLbp(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full bg-white border border-rose-500/30 rounded-xl p-2.5 text-xs font-black text-[#1c3a1e]"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <input
                                                type="text"
                                                value={closeNotes}
                                                onChange={(e) => setCloseNotes(e.target.value)}
                                                placeholder="Closing notes or manager sign-off (Optional)"
                                                className="w-full bg-white border border-rose-500/30 rounded-xl p-2 text-xs font-medium"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShiftViewMode('menu')}
                                                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                className="w-2/3 bg-rose-700 hover:bg-rose-800 text-white font-black py-2.5 rounded-xl text-xs shadow-xs"
                                            >
                                                Close Shift & Generate Z-Report
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
