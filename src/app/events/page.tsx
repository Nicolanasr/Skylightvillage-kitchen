'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getOrderPageData, submitEventVoucherOrder, getEventVouchersReport } from '@/app/actions/order-actions';
import { MenuItem, MenuCategory, SelectedModifier } from '@/lib/types';
import { formatUsd, formatLbp } from '@/lib/currency';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { createPortal } from 'react-dom';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import {
    Ticket,
    Printer,
    Plus,
    Minus,
    Trash2,
    CheckCircle,
    Search,
    Sparkles,
    CreditCard,
    Banknote,
    RefreshCw,
    Monitor,
    ChefHat,
    Shield,
    Clock,
    User,
    BarChart3,
} from 'lucide-react';

export default function EventVoucherTerminalPage() {
    return (
        <StaffAuthGuard pageTitle="Event Voucher Terminal">
            <EventTerminalContent />
        </StaffAuthGuard>
    );
}

function EventTerminalContent() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exchangeRate, setExchangeRate] = useState(89500);

    // Categories & Menu Items
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Ticket Counter & Guest Info
    const [ticketNumber, setTicketNumber] = useState(101);
    const [guestName, setGuestName] = useState('');

    // Cart State: menuItemId -> { item, quantity, selectedModifiers, specialNotes, addedAt }
    const [cart, setCart] = useState<{
        [key: string]: {
            item: MenuItem;
            quantity: number;
            selectedModifiers: SelectedModifier[];
            specialNotes: string;
            addedAt: number;
        };
    }>({});

    const [paymentMethod, setPaymentMethod] = useState<'cash_usd' | 'cash_lbp' | 'card'>('cash_usd');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastOrderResult, setLastOrderResult] = useState<any | null>(null);

    // Event Sales Report Modal State (Declared at top level)
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<any | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    const handleOpenReportModal = async () => {
        setShowReportModal(true);
        setLoadingReport(true);
        const res = await getEventVouchersReport();
        setReportData(res);
        setLoadingReport(false);
    };

    // Variant / Modifier Modal State (Must be declared before any early returns!)
    const [activeVariantItem, setActiveVariantItem] = useState<MenuItem | null>(null);
    const [variantModifiers, setVariantModifiers] = useState<SelectedModifier[]>([]);
    const [variantNotes, setVariantNotes] = useState('');

    // Portal mount check for thermal printing
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        async function loadData() {
            const res = await getOrderPageData('event-session');
            setData(res);
            if (res.categories) setCategories(res.categories);
            if (res.menuItems) setMenuItems(res.menuItems.filter((m: MenuItem) => m.available && !m.is_staff_only));
            if (res.exchangeRate) setExchangeRate(res.exchangeRate);

            // Persist & sync highest ticket number from DB + localStorage
            const savedLocal = typeof window !== 'undefined' ? localStorage.getItem('skylight_last_evt_ticket') : null;
            const localNum = savedLocal ? parseInt(savedLocal, 10) : 0;
            const dbNextNum = res.nextEventTicketNumber || 101;
            const finalTicket = Math.max(dbNextNum, localNum > 0 ? localNum : 101);

            setTicketNumber(finalTicket);
            if (typeof window !== 'undefined') {
                localStorage.setItem('skylight_last_evt_ticket', finalTicket.toString());
            }

            setLoading(false);
        }
        loadData();
    }, []);

    const handleOpenVariantModal = (item: MenuItem) => {
        setActiveVariantItem(item);
        setVariantModifiers([]);
        setVariantNotes('');
    };

    const handleAddVariantToCart = () => {
        if (!activeVariantItem) return;

        // Validate required modifier groups
        if (activeVariantItem.modifier_groups) {
            for (const group of activeVariantItem.modifier_groups) {
                if (group.required) {
                    const hasSelected = variantModifiers.some((m) => m.group === group.group_name);
                    if (!hasSelected) {
                        alert(`Please select an option for "${group.group_name}".`);
                        return;
                    }
                }
            }
        }

        const key = `${activeVariantItem.id}-${JSON.stringify(variantModifiers)}`;

        setCart((prev) => {
            const existing = prev[key];
            const currentQty = existing ? existing.quantity : 0;
            return {
                ...prev,
                [key]: {
                    item: activeVariantItem,
                    quantity: currentQty + 1,
                    selectedModifiers: variantModifiers,
                    specialNotes: variantNotes,
                    addedAt: Date.now(),
                },
            };
        });

        setActiveVariantItem(null);
    };

    const handleUpdateEntryQuantity = (key: string, delta: number) => {
        setCart((prev) => {
            const existing = prev[key];
            if (!existing) return prev;
            const newQty = existing.quantity + delta;

            if (newQty <= 0) {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            }

            return {
                ...prev,
                [key]: {
                    ...existing,
                    quantity: newQty,
                    addedAt: Date.now(),
                },
            };
        });
    };

    const handleClearCart = () => {
        setCart({});
        setGuestName('');
    };

    const cartEntries = Object.entries(cart)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const totalItemCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalUsd = cartEntries.reduce((sum, entry) => {
        const modExtra = entry.selectedModifiers.reduce((mSum, m) => mSum + Number(m.price_extra || 0), 0);
        return sum + (Number(entry.item.price_usd) + modExtra) * entry.quantity;
    }, 0);

    const handleCheckoutAndPrint = async () => {
        if (cartEntries.length === 0) return alert('Cart is empty. Please select food voucher items first.');

        setIsSubmitting(true);
        const tag = `EVT-${ticketNumber}`;

        const res = await submitEventVoucherOrder({
            items: cartEntries.map((e) => ({
                menuItem: e.item,
                quantity: e.quantity,
                selectedModifiers: e.selectedModifiers,
                specialNotes: e.specialNotes,
            })),
            paymentMethod,
            guestName: guestName.trim(),
            ticketTag: tag,
        });

        if (res.success) {
            setLastOrderResult(res);
            setTicketNumber((prev) => {
                const nextNum = prev + 1;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('skylight_last_evt_ticket', nextNum.toString());
                }
                return nextNum;
            });
            setCart({});
            setGuestName('');

            // Trigger thermal window print
            setTimeout(() => {
                window.print();
            }, 300);
        } else {
            alert(res.error || 'Failed to submit event voucher order.');
        }

        setIsSubmitting(false);
    };

    const filteredItems = menuItems.filter((item) => {
        const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
        const matchesSearch =
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1c3a1e] flex flex-col items-center justify-center text-white p-4">
                <div className="h-12 w-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-black text-sm tracking-wider uppercase">Loading Skylight Event Terminal...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] font-sans antialiased flex flex-col justify-between">
            <div>
                {/* Header Bar */}
                <header className="bg-[#1c3a1e] text-white p-4 shadow-md sticky top-0 z-30">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-[#d4af37] text-[#1c3a1e] flex items-center justify-center font-black shadow-md">
                                🎟️
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                    <span>Skylight Event Voucher Terminal</span>
                                    <span className="bg-[#d4af37]/20 text-[#d4af37] text-[10px] px-2 py-0.5 rounded-full border border-[#d4af37]/40 uppercase tracking-widest font-extrabold">
                                        Live Pop-up Mode
                                    </span>
                                </h1>
                                <p className="text-xs text-emerald-100/80 font-medium">
                                    High-speed voucher sales • Bypasses Kitchen KDS • Instant Voucher Printing
                                </p>
                            </div>
                        </div>

                        {/* Header Right Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold flex items-center gap-2">
                                <Ticket className="h-4 w-4 text-[#d4af37]" />
                                <span className="flex items-center gap-1">
                                    Next Ticket #:
                                    <strong className="text-[#d4af37] font-black text-sm flex items-center">
                                        #EVT-
                                        <input
                                            type="number"
                                            value={ticketNumber}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10) || 101;
                                                setTicketNumber(val);
                                                if (typeof window !== 'undefined') {
                                                    localStorage.setItem('skylight_last_evt_ticket', val.toString());
                                                }
                                            }}
                                            className="w-16 bg-white/20 text-[#d4af37] border border-[#d4af37]/40 rounded-lg px-1.5 py-0.5 text-xs font-black text-center focus:outline-none focus:bg-white/30"
                                        />
                                    </strong>
                                </span>
                            </div>

                            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-emerald-200">
                                Rate: $1 = {formatLbp(1, exchangeRate).replace('LBP', '')} LBP
                            </div>

                            <button
                                onClick={handleOpenReportModal}
                                className="bg-[#d4af37] hover:bg-amber-400 text-[#1c3a1e] font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                            >
                                <BarChart3 className="h-4 w-4 text-[#1c3a1e]" />
                                <span>Sales Report</span>
                            </button>

                            <a
                                href="/pos"
                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-white/20"
                            >
                                <Monitor className="h-3.5 w-3.5" />
                                <span>POS</span>
                            </a>

                            <a
                                href="/admin"
                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-white/20"
                            >
                                <Shield className="h-3.5 w-3.5" />
                                <span>Admin</span>
                            </a>
                        </div>
                    </div>
                </header>

                {/* Main Grid Content */}
                <div className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left 7 Columns: Fast Dish Touch Grid */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Search & Category Filter Navigation */}
                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Fast search dishes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-8 py-2.5 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 p-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${selectedCategory === 'all'
                                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                                        : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                        }`}
                                >
                                    <span>🍽️</span>
                                    <span>All Dishes ({filteredItems.length})</span>
                                </button>
                                {categories.map((cat) => {
                                    const icon =
                                        cat.name.toLowerCase().includes('cold') ? '🥗' :
                                            cat.name.toLowerCase().includes('hot') ? '🧆' :
                                                cat.name.toLowerCase().includes('salad') ? '🥬' :
                                                    cat.name.toLowerCase().includes('sajj') ? '🥙' :
                                                        cat.name.toLowerCase().includes('bbq') || cat.name.toLowerCase().includes('grill') ? '🥩' :
                                                            cat.name.toLowerCase().includes('sub') || cat.name.toLowerCase().includes('sandwich') ? '🍔' :
                                                                cat.name.toLowerCase().includes('bar') || cat.name.toLowerCase().includes('drink') || cat.name.toLowerCase().includes('beverage') ? '🍹' :
                                                                    cat.name.toLowerCase().includes('shisha') ? '💨' : '🍽️';

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${selectedCategory === cat.id
                                                ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                                                : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                                }`}
                                        >
                                            <span>{icon}</span>
                                            <span>{cat.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Fast Touch Dish Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {filteredItems.map((item) => {
                                const hasModifiers = item.modifier_groups && item.modifier_groups.length > 0;
                                const totalInCart = cartEntries
                                    .filter((e) => e.item.id === item.id)
                                    .reduce((sum, e) => sum + e.quantity, 0);
                                const rawImg = item.image_url || '';
                                const displayImage = transformGoogleDriveUrl(rawImg) || '/images/Skylight-logo-icon.png';

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (hasModifiers) {
                                                handleOpenVariantModal(item);
                                            } else {
                                                setCart((prev) => {
                                                    const existing = prev[item.id];
                                                    return {
                                                        ...prev,
                                                        [item.id]: {
                                                            item,
                                                            quantity: (existing?.quantity || 0) + 1,
                                                            selectedModifiers: [],
                                                            specialNotes: '',
                                                            addedAt: Date.now(),
                                                        },
                                                    };
                                                });
                                            }
                                        }}
                                        className={`bg-white rounded-3xl p-4 border-2 transition-all shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-[#1c3a1e] relative group ${totalInCart > 0 ? 'border-[#1c3a1e] ring-2 ring-[#1c3a1e]/15' : 'border-[#1c3a1e]/15 hover:border-[#d4af37]'
                                            }`}
                                    >
                                        {/* Cart Badge */}
                                        {totalInCart > 0 && (
                                            <div className="absolute -top-2 -right-2 bg-[#1c3a1e] text-[#d4af37] border-2 border-white px-2.5 py-0.5 rounded-full font-black text-[10px] shadow-md z-10">
                                                {totalInCart}x in ticket
                                            </div>
                                        )}

                                        <div className="flex gap-3 items-start">
                                            <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-[#1c3a1e]/15 shrink-0 bg-[#f4f7f4]">
                                                <Image
                                                    src={displayImage}
                                                    alt={item.name}
                                                    fill
                                                    unoptimized
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <h3 className="font-extrabold text-sm text-[#1c3a1e] leading-snug group-hover:text-[#d4af37] transition-colors">{item.name}</h3>
                                                    {hasModifiers && (
                                                        <span className="text-[9px] font-extrabold text-amber-900 bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                                                            Variants
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-black text-[#1c3a1e] block">
                                                    {formatUsd(Number(item.price_usd))}
                                                </span>
                                                <span className="text-[10px] text-gray-500 font-medium block">
                                                    {formatLbp(Number(item.price_usd), exchangeRate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right 5 Columns: Active Event Order Cart & Thermal Checkout */}
                    <div className="lg:col-span-5">
                        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-md space-y-5 sticky top-24">
                            <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                                <div>
                                    <h2 className="text-lg font-black text-[#1c3a1e] flex items-center gap-2">
                                        <Ticket className="h-5 w-5 text-[#d4af37]" />
                                        <span>Event Ticket Order</span>
                                    </h2>
                                    <span className="text-xs font-bold text-gray-500">Tag: #EVT-{ticketNumber}</span>
                                </div>

                                {cartEntries.length > 0 && (
                                    <button
                                        onClick={handleClearCart}
                                        className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Clear</span>
                                    </button>
                                )}
                            </div>

                            {/* Cart Items List */}
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                {cartEntries.length === 0 ? (
                                    <div className="text-center py-10 border border-dashed border-gray-300 rounded-2xl text-xs font-bold text-gray-400 space-y-2">
                                        <Ticket className="h-8 w-8 mx-auto text-gray-300" />
                                        <p>No event voucher items added yet.</p>
                                        <p className="text-gray-400 font-normal">Tap "+ Add Voucher" on any dish to begin.</p>
                                    </div>
                                ) : (
                                    cartEntries.map((entry) => {
                                        const modExtra = entry.selectedModifiers.reduce((s, m) => s + Number(m.price_extra || 0), 0);
                                        const unitPrice = Number(entry.item.price_usd) + modExtra;

                                        return (
                                            <div
                                                key={entry.key}
                                                className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3 flex justify-between items-center gap-3 text-xs"
                                            >
                                                <div className="flex-1">
                                                    <span className="font-black text-[#1c3a1e]">{entry.quantity}x {entry.item.name}</span>
                                                    {entry.selectedModifiers.length > 0 && (
                                                        <span className="text-[10px] font-semibold text-emerald-800 block">
                                                            + {entry.selectedModifiers.map((m) => m.option).join(', ')}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-500 font-medium block">
                                                        ${(unitPrice * entry.quantity).toFixed(2)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleUpdateEntryQuantity(entry.key, -1)}
                                                        className="bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded-lg font-black hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="font-extrabold text-[#1c3a1e] px-1.5">{entry.quantity}</span>
                                                    <button
                                                        onClick={() => handleUpdateEntryQuantity(entry.key, 1)}
                                                        className="bg-[#1c3a1e] text-white px-2 py-1 rounded-lg font-black hover:bg-[#d4af37] hover:text-[#1c3a1e] cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Optional Guest Name / Notes */}
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1 flex items-center gap-1">
                                    <User className="h-3.5 w-3.5 text-[#d4af37]" />
                                    <span>Guest Name / Tag (Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    placeholder="e.g. Marc H. / Table VIP"
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl p-2.5 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            {/* Subtotal & Totals */}
                            <div className="bg-[#eaf2eb] border border-[#1c3a1e]/20 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between items-center text-xs font-extrabold text-[#1c3a1e]">
                                    <span>Total Items:</span>
                                    <span>{totalItemCount} vouchers</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-1 border-t border-[#1c3a1e]/15">
                                    <span className="text-sm font-black text-[#1c3a1e]">Total USD:</span>
                                    <span className="text-2xl font-black text-[#1c3a1e]">{formatUsd(totalUsd)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-extrabold text-emerald-900">
                                    <span>Total LBP:</span>
                                    <span>{formatLbp(totalUsd, exchangeRate)}</span>
                                </div>
                            </div>

                            {/* Quick Payment Method Selector */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-extrabold text-gray-700">Payment Method:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash_usd')}
                                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${paymentMethod === 'cash_usd'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                                            : 'bg-white text-[#1c3a1e] border-gray-300 hover:bg-[#eaf2eb]'
                                            }`}
                                    >
                                        <Banknote className="h-4 w-4 text-[#d4af37]" />
                                        <span>Cash USD</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash_lbp')}
                                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${paymentMethod === 'cash_lbp'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                                            : 'bg-white text-[#1c3a1e] border-gray-300 hover:bg-[#eaf2eb]'
                                            }`}
                                    >
                                        <Banknote className="h-4 w-4 text-emerald-600" />
                                        <span>Cash LBP</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('card')}
                                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${paymentMethod === 'card'
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                                            : 'bg-white text-[#1c3a1e] border-gray-300 hover:bg-[#eaf2eb]'
                                            }`}
                                    >
                                        <CreditCard className="h-4 w-4 text-blue-600" />
                                        <span>Card</span>
                                    </button>
                                </div>
                            </div>

                            {/* Submit & Print Vouchers Button */}
                            <button
                                onClick={handleCheckoutAndPrint}
                                disabled={isSubmitting || cartEntries.length === 0}
                                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <span>Processing Vouchers...</span>
                                ) : (
                                    <>
                                        <Printer className="h-4 w-4" />
                                        <span>Issue & Print Food Vouchers</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Variant / Modifier Selection Modal */}
            {activeVariantItem && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
                            <div>
                                <h3 className="text-base font-black text-[#1c3a1e]">{activeVariantItem.name}</h3>
                                <span className="text-xs font-bold text-gray-500">${Number(activeVariantItem.price_usd).toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => setActiveVariantItem(null)}
                                className="text-gray-400 hover:text-black font-bold text-base cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            {activeVariantItem.modifier_groups?.map((group, gIdx) => (
                                <div key={gIdx} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black text-[#1c3a1e]">{group.group_name}</span>
                                        {group.required ? (
                                            <span className="text-[9px] font-black text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                                Required
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Optional</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {group.options.map((opt, oIdx) => {
                                            const isSelected = variantModifiers.some(
                                                (m) => m.group === group.group_name && m.option === opt.name
                                            );

                                            return (
                                                <button
                                                    key={oIdx}
                                                    type="button"
                                                    onClick={() => {
                                                        setVariantModifiers((prev) => {
                                                            const filtered = prev.filter((m) => m.group !== group.group_name);
                                                            if (isSelected) return filtered;
                                                            return [
                                                                ...filtered,
                                                                {
                                                                    group: group.group_name,
                                                                    option: opt.name,
                                                                    price_extra: opt.price_extra_usd || 0,
                                                                },
                                                            ];
                                                        });
                                                    }}
                                                    className={`p-3 rounded-2xl border text-left text-xs font-black transition-all cursor-pointer flex flex-col justify-between ${isSelected
                                                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs ring-2 ring-[#1c3a1e]/20'
                                                        : 'bg-[#fafbfa] text-[#1c3a1e] border-gray-300 hover:bg-[#eaf2eb]'
                                                        }`}
                                                >
                                                    <span>{opt.name}</span>
                                                    {opt.price_extra_usd > 0 && (
                                                        <span className={`text-[10px] block mt-1 ${isSelected ? 'text-[#d4af37]' : 'text-gray-500'}`}>
                                                            +${opt.price_extra_usd.toFixed(2)}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleAddVariantToCart}
                            className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                        >
                            + Add Variant Voucher
                        </button>
                    </div>
                </div>
            )}

            {/* Event Sales Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-2xl rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-5">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-6 w-6 text-[#d4af37]" />
                                <div>
                                    <h3 className="text-lg font-black text-[#1c3a1e]">Shift Event Sales Report</h3>
                                    <p className="text-xs text-gray-500 font-medium">Real-time breakdown of event voucher revenue</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="text-gray-400 hover:text-black font-bold text-base cursor-pointer p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {loadingReport ? (
                            <div className="py-12 text-center text-xs font-bold text-gray-400">Loading report data...</div>
                        ) : reportData ? (
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                                {/* Summary Metrics */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-[#eaf2eb] border border-[#1c3a1e]/15 rounded-2xl p-3.5 text-center">
                                        <span className="text-[10px] font-bold text-gray-600 block uppercase">Total Vouchers Sold</span>
                                        <strong className="text-xl font-black text-[#1c3a1e]">{reportData.totalOrders || 0}</strong>
                                    </div>

                                    <div className="bg-[#1c3a1e] text-white rounded-2xl p-3.5 text-center shadow-xs">
                                        <span className="text-[10px] font-bold text-emerald-200 block uppercase">Total Sales USD</span>
                                        <strong className="text-xl font-black text-[#d4af37]">{formatUsd(reportData.totalUsd || 0)}</strong>
                                    </div>

                                    <div className="bg-[#eaf2eb] border border-[#1c3a1e]/15 rounded-2xl p-3.5 text-center">
                                        <span className="text-[10px] font-bold text-gray-600 block uppercase">Total Sales LBP</span>
                                        <strong className="text-xs font-black text-emerald-900 block mt-1">
                                            {formatLbp(reportData.totalUsd || 0, exchangeRate)}
                                        </strong>
                                    </div>
                                </div>

                                {/* Items Sales Ranking */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider">Dishes & Voucher Sales Ranking</h4>
                                    <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3 space-y-2">
                                        {reportData.items?.length === 0 ? (
                                            <p className="text-xs text-gray-400 font-medium text-center py-4">No event vouchers sold yet.</p>
                                        ) : (
                                            reportData.items?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-200 last:border-0">
                                                    <div>
                                                        <span className="font-extrabold text-[#1c3a1e]">{item.item_name}</span>
                                                        <span className="text-[10px] text-gray-400 uppercase block">Station: {item.station}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-black text-[#1c3a1e] block">{item.total_qty}x</span>
                                                        <span className="text-[10px] text-gray-500 font-bold">${Number(item.total_usd || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-red-600 font-bold">Failed to load sales report.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ESC/POS Thermal Print Voucher Portal (Grouped strictly BY STATION like KDS) */}
            {isMounted && lastOrderResult && (() => {
                const stationGroups: Record<string, any[]> = {};
                (lastOrderResult.orderItems || []).forEach((item: any) => {
                    const st = (item.station || 'mezza').toLowerCase();
                    if (!stationGroups[st]) stationGroups[st] = [];
                    stationGroups[st].push(item);
                });

                return createPortal(
                    <div className="print-voucher-container hidden print:block print:w-full print:m-0 print:p-0 font-mono text-black text-xs">
                        {Object.entries(stationGroups).map(([stationKey, items]) => (
                            <div
                                key={stationKey}
                                className="voucher-ticket mb-4 pb-4 border-b-2 border-dashed border-black print:p-2 page-break-after"
                            >
                                {/* Station Ticket Header */}
                                <div className="text-center border-b-2 border-black pb-2 mb-2">
                                    <h1 className="text-base font-black uppercase tracking-tight">SKYLIGHT LIVE EVENT</h1>
                                    <div className="bg-black text-white font-black text-sm py-1 px-3 mt-1 inline-block">
                                        TICKET #{lastOrderResult.ticketTag}
                                    </div>
                                </div>

                                {/* Station Name */}
                                <div className="bg-black text-white px-2 py-1 text-center font-black text-sm uppercase mb-2">
                                    STATION: {stationKey.replace('_', ' ').toUpperCase()}
                                </div>

                                {/* Station Items List */}
                                <div className="space-y-2 mb-3 border-b-2 border-black/30 pb-2">
                                    {items.map((item: any, iIdx: number) => {
                                        const mods = typeof item.selected_modifiers === 'string'
                                            ? JSON.parse(item.selected_modifiers || '[]')
                                            : item.selected_modifiers || [];

                                        return (
                                            <div key={iIdx} className="border-b border-dashed border-black/20 pb-1.5 last:border-0">
                                                <div className="flex justify-between items-baseline text-sm font-black">
                                                    <span>{item.quantity}x {item.item_name}</span>
                                                </div>

                                                {mods.length > 0 && (
                                                    <div className="text-[11px] font-bold text-black pl-3">
                                                        + {mods.map((m: any) => m.option || m.name).join(', ')}
                                                    </div>
                                                )}

                                                {item.special_notes && item.special_notes !== 'Event Voucher Claim' && (
                                                    <div className="text-[10px] font-bold text-black border-l-2 border-black pl-2 py-0.5 mt-0.5">
                                                        NOTE: {item.special_notes}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Chit Footer */}
                                <div className="text-[10px] text-center pt-1 space-y-0.5">
                                    <span className="block font-bold">
                                        Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>,
                    document.body
                );
            })()}
        </div>
    );
}
