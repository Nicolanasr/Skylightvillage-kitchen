'use client';

import React, { useState, useEffect } from 'react';
import {
    getLoyaltyData,
    saveRewardTierAction,
    adjustCustomerPointsAction,
    getLoyaltyEnabledSetting,
    setLoyaltyEnabledSetting,
    CustomerLoyalty,
    LoyaltyRewardTier,
    LoyaltyClaimToken,
    LoyaltyAuditLog,
} from '@/app/actions/loyalty-actions';
import { formatUsd } from '@/lib/currency';
import {
    Sparkles,
    Gift,
    Award,
    Users,
    Search,
    Plus,
    Edit,
    TrendingUp,
    History,
    QrCode,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Clock,
    Power,
} from 'lucide-react';

export function AdminLoyaltyManager() {
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'customers' | 'tiers' | 'audits' | 'tokens'>('customers');
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
    const [togglingSetting, setTogglingSetting] = useState(false);

    const [customers, setCustomers] = useState<CustomerLoyalty[]>([]);
    const [rewardTiers, setRewardTiers] = useState<LoyaltyRewardTier[]>([]);
    const [claimTokens, setClaimTokens] = useState<LoyaltyClaimToken[]>([]);
    const [auditLogs, setAuditLogs] = useState<LoyaltyAuditLog[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Manual Adjust Modal
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedCust, setSelectedCust] = useState<CustomerLoyalty | null>(null);
    const [adjustPoints, setAdjustPoints] = useState(50);
    const [adjustNotes, setAdjustNotes] = useState('Birthday VIP Bonus');

    // Tier Edit Modal
    const [showTierModal, setShowTierModal] = useState(false);
    const [editTier, setEditTier] = useState<Partial<LoyaltyRewardTier>>({
        name: '',
        points_required: 100,
        reward_type: 'discount_usd',
        discount_value: 5.0,
        active: true,
    });

    const loadData = async () => {
        setLoading(true);
        const [res, isEnabled] = await Promise.all([
            getLoyaltyData(),
            getLoyaltyEnabledSetting(),
        ]);
        if (res.success) {
            setCustomers(res.customers || []);
            setRewardTiers(res.rewardTiers || []);
            setClaimTokens(res.claimTokens || []);
            setAuditLogs(res.auditLogs || []);
            setMenuItems(res.menuItems || []);
        }
        setLoyaltyEnabled(isEnabled);
        setLoading(false);
    };

    const handleToggleLoyaltyProgram = async () => {
        const nextState = !loyaltyEnabled;
        const confirmMsg = nextState
            ? 'Enable the VIP Loyalty Rewards Program across POS, QR & Customer portal?'
            : 'Disable the VIP Loyalty Rewards Program? (POS & Customer apps will temporarily pause points accrual and redemptions).';
        if (!confirm(confirmMsg)) return;

        setTogglingSetting(true);
        const res = await setLoyaltyEnabledSetting(nextState);
        if (res.success) {
            setLoyaltyEnabled(nextState);
        } else {
            alert(res.error || 'Failed to update setting');
        }
        setTogglingSetting(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveTier = async () => {
        if (!editTier.name || !editTier.points_required) return alert('Enter tier name and points required.');
        setIsSaving(true);
        const res = await saveRewardTierAction(editTier);
        if (res.success) {
            setShowTierModal(false);
            loadData();
        } else {
            alert(res.error || 'Failed to save tier');
        }
        setIsSaving(false);
    };

    const handleAdjustPoints = async () => {
        if (!selectedCust) return;
        setIsSaving(true);
        const res = await adjustCustomerPointsAction(selectedCust.id, adjustPoints, adjustNotes, 'Admin');
        if (res.success) {
            setShowAdjustModal(false);
            loadData();
        } else {
            alert(res.error || 'Failed to adjust points');
        }
        setIsSaving(false);
    };

    const filteredCustomers = customers.filter(
        (c) =>
            c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.phone_number && c.phone_number.includes(searchQuery)) ||
            (c.vip_code && c.vip_code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalPointsIssued = customers.reduce((sum, c) => sum + c.points_balance, 0);
    const totalLoyaltySpentUsd = customers.reduce((sum, c) => sum + c.total_spent_usd, 0);

    if (loading) {
        return (
            <div className="py-20 text-center space-y-3">
                <div className="h-10 w-10 border-4 border-[#1c3a1e] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider">Loading VIP Loyalty Rewards Engine...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-[#1c3a1e]">
            {/* Master Loyalty Enable/Disable Control Banner */}
            <div className={`border rounded-3xl p-5 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                loyaltyEnabled
                    ? 'bg-emerald-50/80 border-emerald-500/30'
                    : 'bg-rose-50/80 border-rose-500/30'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${
                        loyaltyEnabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                        <Power className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-[#1c3a1e]">
                                Master Loyalty Program Control
                            </h3>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                loyaltyEnabled ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
                            }`}>
                                {loyaltyEnabled ? '🟢 ACTIVE (ENABLED)' : '🔴 PAUSED (DISABLED)'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium mt-0.5">
                            {loyaltyEnabled
                                ? 'VIP Points accrual, reward redemptions, and customer claim portals are LIVE across POS & QR apps.'
                                : 'Loyalty points and reward redemptions are currently suspended across all POS terminals and customer apps.'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleToggleLoyaltyProgram}
                    disabled={togglingSetting}
                    className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                        loyaltyEnabled
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                >
                    <Power className="h-4 w-4" />
                    <span>{loyaltyEnabled ? 'Disable Loyalty Program' : 'Enable Loyalty Program'}</span>
                </button>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase block">Registered VIP Guests</span>
                        <strong className="text-2xl font-black text-[#1c3a1e]">{customers.length} Guests</strong>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-[#eaf2eb] text-[#1c3a1e] flex items-center justify-center font-black">
                        <Users className="h-6 w-6" />
                    </div>
                </div>

                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-amber-900 uppercase block">Active Loyalty Points</span>
                        <strong className="text-2xl font-black text-amber-800">{totalPointsIssued} PTS</strong>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                        <Sparkles className="h-6 w-6" />
                    </div>
                </div>

                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">VIP Total Spend</span>
                        <strong className="text-2xl font-black text-emerald-800">{formatUsd(totalLoyaltySpentUsd)}</strong>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                </div>

                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-purple-900 uppercase block">Active Reward Tiers</span>
                        <strong className="text-2xl font-black text-purple-900">{rewardTiers.length} Tiers</strong>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-900 flex items-center justify-center font-black">
                        <Gift className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-[#1c3a1e]/15 pb-3">
                <button
                    onClick={() => setActiveSubTab('customers')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${activeSubTab === 'customers'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                            : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                        }`}
                >
                    <Users className="h-4 w-4 text-[#d4af37]" />
                    <span>VIP Customers ({customers.length})</span>
                </button>

                <button
                    onClick={() => setActiveSubTab('tiers')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${activeSubTab === 'tiers'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                            : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                        }`}
                >
                    <Gift className="h-4 w-4 text-emerald-400" />
                    <span>Reward Tiers ({rewardTiers.length})</span>
                </button>

                <button
                    onClick={() => setActiveSubTab('audits')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${activeSubTab === 'audits'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
                            : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                        }`}
                >
                    <History className="h-4 w-4 text-blue-400" />
                    <span>Redemption & Audit Feed ({auditLogs.length})</span>
                </button>
            </div>

            {/* TAB 1: VIP CUSTOMERS TABLE */}
            {activeSubTab === 'customers' && (
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search phone, name, or VIP code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                                <tr>
                                    <th className="p-3">Customer Name</th>
                                    <th className="p-3">Phone Number</th>
                                    <th className="p-3">VIP Code</th>
                                    <th className="p-3">Total Spent USD</th>
                                    <th className="p-3">Visits</th>
                                    <th className="p-3">Points Balance</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 font-medium">
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">
                                            No VIP customers found matching search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map((c) => (
                                        <tr key={c.id} className="hover:bg-[#fafbfa]">
                                            <td className="p-3 font-extrabold text-[#1c3a1e]">{c.customer_name}</td>
                                            <td className="p-3 font-bold text-gray-700">{c.phone_number || 'N/A (Receipt Only)'}</td>
                                            <td className="p-3 font-bold text-purple-900">{c.vip_code || '-'}</td>
                                            <td className="p-3 font-black text-emerald-800">${c.total_spent_usd.toFixed(2)}</td>
                                            <td className="p-3 font-bold text-gray-600">{c.total_visits} visits</td>
                                            <td className="p-3 font-black text-amber-800 text-sm">{c.points_balance} PTS</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCust(c);
                                                        setAdjustPoints(50);
                                                        setAdjustNotes('Admin points bonus');
                                                        setShowAdjustModal(true);
                                                    }}
                                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-[11px] font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                                                >
                                                    ± Adjust Points
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: REWARD TIERS MANAGER */}
            {activeSubTab === 'tiers' && (
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                        <div>
                            <h3 className="text-base font-black text-[#1c3a1e]">Configurable Reward Tiers</h3>
                            <p className="text-xs text-gray-500 font-medium">Define rewards available for customer point redemptions</p>
                        </div>

                        <button
                            onClick={() => {
                                setEditTier({ name: '', points_required: 100, reward_type: 'discount_usd', discount_value: 5.0, active: true });
                                setShowTierModal(true);
                            }}
                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-black px-4 py-2 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                            <Plus className="h-4 w-4" />
                            <span>+ Create Reward Tier</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rewardTiers.map((tier) => (
                            <div key={tier.id} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 space-y-3 shadow-xs">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-extrabold text-sm text-[#1c3a1e]">{tier.name}</h4>
                                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md inline-block mt-1">
                                            {tier.points_required} Points Required
                                        </span>
                                    </div>

                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${tier.active ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {tier.active ? 'Active' : 'Disabled'}
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-gray-700 border-t border-b border-gray-200 py-2">
                                    <span>Value: </span>
                                    <strong className="text-[#1c3a1e] font-black">${tier.discount_value.toFixed(2)} Off Bill</strong>
                                </div>

                                <button
                                    onClick={() => {
                                        setEditTier(tier);
                                        setShowTierModal(true);
                                    }}
                                    className="w-full bg-[#1c3a1e] text-white hover:bg-[#d4af37] hover:text-[#1c3a1e] text-xs font-black py-2 rounded-xl transition-all cursor-pointer"
                                >
                                    Edit Reward Configuration
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: REDEMPTION & AUDIT FEED */}
            {activeSubTab === 'audits' && (
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="pb-3 border-b border-[#1c3a1e]/15">
                        <h3 className="text-base font-black text-[#1c3a1e]">Real-Time Loyalty Audit & Redemption Log</h3>
                        <p className="text-xs text-gray-500 font-medium">Complete trail of points earned, claimed from receipts, or redeemed by staff</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                                <tr>
                                    <th className="p-3">Timestamp</th>
                                    <th className="p-3">Customer Phone / Identifier</th>
                                    <th className="p-3">Action Type</th>
                                    <th className="p-3">Points Delta</th>
                                    <th className="p-3">Logged By</th>
                                    <th className="p-3">Details / Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 font-medium">
                                {auditLogs.map((log) => {
                                    const isPositive = log.points_amount > 0;
                                    return (
                                        <tr key={log.id} className="hover:bg-[#fafbfa]">
                                            <td className="p-3 text-gray-500 font-bold">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="p-3 font-extrabold text-[#1c3a1e]">{log.customer_phone || 'Anonymous Guest'}</td>
                                            <td className="p-3 uppercase text-[10px] font-black">
                                                <span className={`px-2 py-0.5 rounded-md ${log.action_type === 'redeemed'
                                                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                                        : log.action_type === 'claimed_receipt'
                                                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                    }`}>
                                                    {log.action_type}
                                                </span>
                                            </td>
                                            <td className={`p-3 font-black text-sm ${isPositive ? 'text-emerald-700' : 'text-purple-700'}`}>
                                                {isPositive ? `+${log.points_amount}` : log.points_amount} PTS
                                            </td>
                                            <td className="p-3 text-gray-700 font-bold">{log.logged_by || 'System'}</td>
                                            <td className="p-3 text-gray-500 italic">{log.notes || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: RECEIPT CLAIM TOKENS */}
            {activeSubTab === 'tokens' && (
                <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="pb-3 border-b border-[#1c3a1e]/15">
                        <h3 className="text-base font-black text-[#1c3a1e]">Thermal Receipt Claim Tokens</h3>
                        <p className="text-xs text-gray-500 font-medium">Anonymous receipt QR tokens generated for guests to claim at home</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                                <tr>
                                    <th className="p-3">Claim Token Code</th>
                                    <th className="p-3">Points Value</th>
                                    <th className="p-3">Claim Status</th>
                                    <th className="p-3">Claimed By Phone</th>
                                    <th className="p-3">Date Generated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 font-medium">
                                {claimTokens.map((tok) => (
                                    <tr key={tok.token} className="hover:bg-[#fafbfa]">
                                        <td className="p-3 font-black text-[#1c3a1e] font-mono">{tok.token}</td>
                                        <td className="p-3 font-black text-amber-800">{tok.points_value} PTS</td>
                                        <td className="p-3">
                                            {tok.claimed ? (
                                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                                                    CLAIMED
                                                </span>
                                            ) : (
                                                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                                                    UNCLAIMED (ACTIVE)
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-gray-700 font-bold">{tok.claimed_by_phone || '-'}</td>
                                        <td className="p-3 text-gray-500 font-bold">{new Date(tok.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ADJUST POINTS MODAL */}
            {showAdjustModal && selectedCust && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
                            <h3 className="text-base font-black text-[#1c3a1e]">Adjust Points for {selectedCust.customer_name}</h3>
                            <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 font-bold p-1">✕</button>
                        </div>

                        <div className="space-y-3 text-xs font-bold">
                            <div className="bg-[#fafbfa] p-3 rounded-2xl border border-gray-200">
                                <span className="text-gray-500 block">Current Balance:</span>
                                <strong className="text-lg font-black text-amber-800">{selectedCust.points_balance} PTS</strong>
                            </div>

                            <div>
                                <label className="block text-gray-700 mb-1">Points Delta (+ Add / - Deduct)</label>
                                <input
                                    type="number"
                                    value={adjustPoints}
                                    onChange={(e) => setAdjustPoints(parseInt(e.target.value, 10) || 0)}
                                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e] font-black"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 mb-1">Audit Reason / Note</label>
                                <input
                                    type="text"
                                    value={adjustNotes}
                                    onChange={(e) => setAdjustNotes(e.target.value)}
                                    placeholder="e.g. Complimentary birthday bonus"
                                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleAdjustPoints}
                            disabled={isSaving}
                            className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
                        >
                            {isSaving ? 'Saving...' : 'Apply Points Adjustment'}
                        </button>
                    </div>
                </div>
            )}

            {/* REWARD TIER EDIT MODAL */}
            {showTierModal && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
                            <h3 className="text-base font-black text-[#1c3a1e]">
                                {editTier.id ? 'Edit Reward Tier' : 'Create New Reward Tier'}
                            </h3>
                            <button onClick={() => setShowTierModal(false)} className="text-gray-400 font-bold p-1">✕</button>
                        </div>

                        <div className="space-y-3 text-xs font-bold">
                            <div>
                                <label className="block text-gray-700 mb-1">Reward Name</label>
                                <input
                                    type="text"
                                    value={editTier.name || ''}
                                    onChange={(e) => setEditTier((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Free Shisha Refill"
                                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-700 mb-1">Points Required</label>
                                    <input
                                        type="number"
                                        value={editTier.points_required || 100}
                                        onChange={(e) => setEditTier((prev) => ({ ...prev, points_required: parseInt(e.target.value, 10) || 0 }))}
                                        className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e] font-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-700 mb-1">Discount Value ($)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editTier.discount_value || 5.0}
                                        onChange={(e) => setEditTier((prev) => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e] font-black"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveTier}
                            disabled={isSaving}
                            className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
                        >
                            {isSaving ? 'Saving Tier...' : 'Save Reward Tier'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
