'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    MenuItem,
    ModifierGroup,
    OrderItem,
    SelectedModifier,
    StationType,
    Table,
    TableSession,
    MenuCategory,
    getMenuItemPrice,
} from '@/lib/types';
import { calculateBillTotals, formatLbp, formatUsd } from '@/lib/currency';
import { getOrderPageData, submitCustomerOrder, triggerServiceCall } from '../actions/order-actions';
import { assignGuestNameToOrderItems } from '../actions/payment-actions';
import { lookupOrCreateCustomerLoyalty, redeemLoyaltyRewardAction, searchLoyaltyCustomers } from '../actions/loyalty-actions';
import { normalizePhone } from '@/lib/phone';
import { submitCustomerFeedbackAction } from '../actions/report-actions';
import { transformGoogleDriveUrl } from '@/lib/drive';
import {
    Bell,
    CheckCircle2,
    Clock,
    Flame,
    Minus,
    Plus,
    Receipt,
    ShoppingBag,
    Sparkles,
    Utensils,
    X,
    AlertCircle,
    Star,
    Lock,
    ChevronRight,
    ChevronLeft,
    HelpCircle,
    Image as ImageIcon,
    Search,
    DollarSign,
} from 'lucide-react';

export default function CustomerOrderPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 text-amber-400 flex items-center justify-center font-bold">
                    Loading Skylight Village Menu...
                </div>
            }
        >
            <CustomerOrderContent />
        </Suspense>
    );
}

function CustomerOrderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tableParam = searchParams.get('table');
    const tokenParam = searchParams.get('token');

    // Strict Access Guard: If visitor does not have a valid table QR param, redirect to /takeout
    useEffect(() => {
        if (!tableParam) {
            router.push('/takeout');
        }
    }, [tableParam, router]);

    const [table, setTable] = useState<Table | null>(null);
    const [session, setSession] = useState<TableSession | null>(null);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);

    // Modifier state for active modal
    const [selectedModifiers, setSelectedModifiers] = useState<Record<string, SelectedModifier>>({});
    const [specialNotes, setSpecialNotes] = useState<string>('');

    // Cart State (Continuous add-to-cart)
    const [cart, setCart] = useState<
        Array<{
            menuItem: MenuItem;
            quantity: number;
            selectedModifiers: SelectedModifier[];
            specialNotes: string;
            itemTotalUsd: number;
        }>
    >([]);

    // Drawers & Modals
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isBillOpen, setIsBillOpen] = useState(false);
    const [isServiceBellOpen, setIsServiceBellOpen] = useState(false);
    const [serviceMessage, setServiceMessage] = useState<string | null>(null);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);
    const [addedToastMsg, setAddedToastMsg] = useState<string | null>(null);

    // Optional Customer Phone & VIP Loyalty State
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
    const [rewardTiers, setRewardTiers] = useState<any[]>([]);
    const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
    const [tempPhoneInput, setTempPhoneInput] = useState('');
    const [tempNameInput, setTempNameInput] = useState('');
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [isSearchingCartPhone, setIsSearchingCartPhone] = useState(false);
    const [isNewGuestModalOpen, setIsNewGuestModalOpen] = useState(false);
    const [newGuestNameInput, setNewGuestNameInput] = useState('');

    const openLoyaltyModal = async () => {
        setIsLoyaltyModalOpen(true);
        const targetPhone = customerPhone || tempPhoneInput;
        if (targetPhone) {
            setLoyaltyLoading(true);
            try {
                const res = await lookupOrCreateCustomerLoyalty(targetPhone, customerName);
                if (res.success && res.customer) {
                    setCustomerPhone(res.customer.phone_number || '');
                    setCustomerName(res.customer.customer_name || '');
                    setLoyaltyProfile(res.customer);
                    setRewardTiers(res.rewardTiers || []);
                }
            } catch (e) {
                console.error('Error loading loyalty modal profile:', e);
            } finally {
                setLoyaltyLoading(false);
            }
        }
    };

    const handleSearchCartPhone = async () => {
        if (!tempPhoneInput.trim()) return;
        setIsSearchingCartPhone(true);
        try {
            const res = await searchLoyaltyCustomers(tempPhoneInput);
            if (res.success && res.customers && res.customers.length > 0) {
                const found = res.customers[0];
                setCustomerPhone(found.phone_number);
                setCustomerName(found.customer_name);
                setLoyaltyProfile(found);

                // Fetch eligible reward tiers directly
                const loyaltyRes = await lookupOrCreateCustomerLoyalty(found.phone_number, found.customer_name);
                if (loyaltyRes.success) {
                    setRewardTiers(loyaltyRes.rewardTiers || []);
                }

                setAddedToastMsg(`✅ Recognized Guest: ${found.customer_name}`);
                setTimeout(() => setAddedToastMsg(null), 3500);
            } else {
                // Profile not found -> open modal to enter name
                setCustomerPhone(normalizePhone(tempPhoneInput) || tempPhoneInput.trim());
                setIsNewGuestModalOpen(true);
            }
        } catch (e) {
            console.error('Cart phone search error:', e);
        } finally {
            setIsSearchingCartPhone(false);
        }
    };

    // Post-Meal 5-Star Rating & Feedback State
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [ratingValue, setRatingValue] = useState(5);
    const [ratingTags, setRatingTags] = useState<string[]>(['Fast Service', 'Delicious Food']);
    const [ratingComment, setRatingComment] = useState('');
    const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    // Pay My Share Mobile Drawer State
    const [isPayMyShareOpen, setIsPayMyShareOpen] = useState(false);
    const [selectedShareItemIds, setSelectedShareItemIds] = useState<string[]>([]);
    const [payShareSplitCount, setPayShareSplitCount] = useState<number>(1);
    const [isSubmittingSharePay, setIsSubmittingSharePay] = useState(false);
    const [shareCustomerName, setShareCustomerName] = useState<string>('');

    const handleSaveLoyaltyProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempPhoneInput.trim()) return;
        setLoyaltyLoading(true);
        const res = await lookupOrCreateCustomerLoyalty(tempPhoneInput, tempNameInput);
        if (res.success && res.customer) {
            setCustomerPhone(tempPhoneInput.trim());
            if (tempNameInput.trim()) setCustomerName(tempNameInput.trim());
            setLoyaltyProfile(res.customer);
            setRewardTiers(res.rewardTiers || []);
            setAddedToastMsg(`🌟 Welcome ${res.customer.customer_name}! VIP Points linked.`);
            setTimeout(() => setAddedToastMsg(null), 4000);
            setIsLoyaltyModalOpen(false); // Close after save
        }
        setLoyaltyLoading(false);
    };

    const [redeemingTierId, setRedeemingTierId] = useState<string | null>(null);

    const handleRedeemCustomerReward = async (tierId: string) => {
        if (!session || !customerPhone) return;
        setRedeemingTierId(tierId);
        const res = await redeemLoyaltyRewardAction(session.id, customerPhone, tierId, 'Customer App');
        setRedeemingTierId(null);
        if (res.success) {
            setOrderSuccessMsg(`🎁 Reward Redeemed! ${res.rewardName} applied to your bill.`);
            setIsLoyaltyModalOpen(false); // Auto-close window once redeemed!
            await refreshPageData(); // Auto-update UI!
            // Refresh customer balance
            const updated = await lookupOrCreateCustomerLoyalty(customerPhone, customerName);
            if (updated.success && updated.customer) {
                setLoyaltyProfile(updated.customer);
            }
            setTimeout(() => setOrderSuccessMsg(null), 5000);
        } else {
            alert(res.error || 'Failed to redeem reward');
        }
    };

    // Self-Ordering Welcome Notice & Visual Guide States
    const [isWelcomeNoticeOpen, setIsWelcomeNoticeOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [guideStep, setGuideStep] = useState(0);
    const [guideLang, setGuideLang] = useState<'en' | 'ar'>('en');

    // Auto-open clear self-ordering welcome notice for first-time QR scan customers
    useEffect(() => {
        try {
            const hasSeenNotice = localStorage.getItem('skylight_has_seen_welcome_notice');
            if (!hasSeenNotice) {
                setIsWelcomeNoticeOpen(true);
            }
        } catch (e) { }
    }, []);

    const handleCloseWelcomeNotice = () => {
        setIsWelcomeNoticeOpen(false);
        try {
            localStorage.setItem('skylight_has_seen_welcome_notice', 'true');
        } catch (e) { }
    };

    const handleOpenGuideFromNotice = () => {
        handleCloseWelcomeNotice();
        setGuideStep(0);
        setIsGuideOpen(true);
    };

    const handleCloseGuide = () => {
        setIsGuideOpen(false);
        try {
            localStorage.setItem('skylight_has_seen_guide', 'true');
        } catch (e) { }
    };

    // Live order items for active session
    const [liveOrderItems, setLiveOrderItems] = useState<OrderItem[]>([]);
    const [liveDiscounts, setLiveDiscounts] = useState<any[]>([]);
    const [livePayments, setLivePayments] = useState<any[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(89500);

    const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

    // Fetch Order Page Data via Server Action
    const refreshPageData = async () => {
        const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
        const token = tokenParam || `token-table-${tableNum}`;

        try {
            const data = await getOrderPageData(tableNum, token);
            setTable(data.table);
            setSession(data.session);
            setCategories(data.categories);
            setMenuItems(data.menuItems);
            setLiveOrderItems(data.orderItems);
            setLiveDiscounts(data.discounts);
            setLivePayments(data.payments);
            setExchangeRate(data.exchangeRate);
            setLoyaltyEnabled(data.loyaltyEnabled !== false);
        } catch (e) {
            console.error('Error fetching order page data:', e);
        }
    };

    useEffect(() => {
        refreshPageData();

        let eventSource: EventSource | null = null;
        try {
            eventSource = new EventSource('/api/events');
            eventSource.addEventListener('pos_update', () => refreshPageData());
            eventSource.addEventListener('kds_update', () => refreshPageData());
        } catch (e) { }

        return () => {
            if (eventSource) eventSource.close();
        };
    }, [tableParam, tokenParam]);

    // Restore customerPhone from localStorage (keyed per table)
    useEffect(() => {
        try {
            const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
            const savedPhone = localStorage.getItem(`skylight_loyalty_phone_t${tableNum}`);
            const savedName = localStorage.getItem(`skylight_loyalty_name_t${tableNum}`);
            if (savedPhone) {
                setCustomerPhone(savedPhone);
                if (savedName) setCustomerName(savedName);
            }
        } catch (e) { }
    }, [tableParam]);

    // Persist customerPhone to localStorage whenever it changes
    useEffect(() => {
        try {
            const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
            if (customerPhone) {
                localStorage.setItem(`skylight_loyalty_phone_t${tableNum}`, customerPhone);
                if (customerName) localStorage.setItem(`skylight_loyalty_name_t${tableNum}`, customerName);
            }
        } catch (e) { }
    }, [customerPhone, customerName, tableParam]);

    // Restoring cart from localStorage on initial load
    useEffect(() => {
        try {
            const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
            const storageKey = `skylight_cart_tbl_${tableNum}`;
            const savedCart = localStorage.getItem(storageKey);
            if (savedCart) {
                const parsed = JSON.parse(savedCart);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCart(parsed);
                }
            }
        } catch (e) {
            console.error('Error reading cart from localStorage:', e);
        }
    }, [tableParam]);

    // Saving cart to localStorage whenever cart changes
    useEffect(() => {
        try {
            const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
            const storageKey = `skylight_cart_tbl_${tableNum}`;
            if (cart.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify(cart));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (e) {
            console.error('Error saving cart to localStorage:', e);
        }
    }, [cart, tableParam]);

    const filteredMenuItems = menuItems.filter((item) => {
        const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory;
        const term = searchQuery.toLowerCase().trim();
        const matchesSearch = !term || item.name.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
        return matchesCategory && matchesSearch;
    });

    // Open Modifier Drawer for Item
    const handleItemClick = (item: MenuItem) => {
        if (!item.available) return;
        setSelectedItemForModifier(item);
        setSpecialNotes('');

        const initialMods: Record<string, SelectedModifier> = {};
        (item.modifier_groups || []).forEach((group) => {
            if (group.required && group.options.length > 0) {
                initialMods[group.group_name] = {
                    group: group.group_name,
                    option: group.options[0].name,
                    price_extra: group.options[0].price_extra_usd,
                };
            }
        });
        setSelectedModifiers(initialMods);
    };

    const handleModifierSelect = (groupName: string, optionName: string, priceExtraUsd: number) => {
        setSelectedModifiers((prev) => ({
            ...prev,
            [groupName]: {
                group: groupName,
                option: optionName,
                price_extra: priceExtraUsd,
            },
        }));
    };

    // Add Item to Cart
    const handleAddToCart = () => {
        if (!selectedItemForModifier) return;

        for (const group of selectedItemForModifier.modifier_groups || []) {
            if (group.required && !selectedModifiers[group.group_name]) {
                alert(`Please select an option for ${group.group_name}`);
                return;
            }
        }

        const modifierList = Object.values(selectedModifiers);
        const extraTotal = modifierList.reduce((acc, m) => acc + m.price_extra, 0);
        const basePrice = getMenuItemPrice(selectedItemForModifier, session?.order_type);
        const itemTotalUsd = basePrice + extraTotal;

        setCart((prev) => [
            ...prev,
            {
                menuItem: selectedItemForModifier,
                quantity: 1,
                selectedModifiers: modifierList,
                specialNotes,
                itemTotalUsd,
            },
        ]);

        const itemName = selectedItemForModifier.name;
        setSelectedItemForModifier(null);
        setAddedToastMsg(`Added "${itemName}" to cart!`);
        setTimeout(() => setAddedToastMsg(null), 3000);
    };

    const handleCategoryClick = (catId: string) => {
        setActiveCategory(catId);
        if (catId === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            const el = document.getElementById(`category-${catId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };

    // Submit Order (Continuous workflow)
    const handleOrderSubmit = async () => {
        if (!session || cart.length === 0) return;
        setOrderSubmitting(true);

        const itemsToSubmit = cart.map((c) => ({
            menuItemId: c.menuItem.id,
            itemName: c.menuItem.name,
            quantity: c.quantity,
            unitPriceUsd: getMenuItemPrice(c.menuItem, session?.order_type),
            station: c.menuItem.station,
            selectedModifiers: c.selectedModifiers,
            specialNotes: c.specialNotes,
        }));

        const res = await submitCustomerOrder({
            sessionId: session.id,
            items: itemsToSubmit,
            customerPhone: customerPhone.trim() || undefined,
            customerName: customerName.trim() || undefined,
        });

        setOrderSubmitting(false);

        if (res.success) {
            setCart([]);
            setIsCartOpen(false);
            setOrderSuccessMsg('Order submitted successfully! Sending to kitchen.');

            // 0ms Instant Broadcast to KDS and POS tabs
            try {
                const bc = new BroadcastChannel('skylight_events');
                bc.postMessage({ event: 'kds_update' });
                bc.postMessage({ event: 'pos_update' });
                bc.close();
            } catch (e) { }
            try {
                localStorage.setItem('skylight_event_kds', Date.now().toString());
                localStorage.setItem('skylight_event_pos', Date.now().toString());
            } catch (e) { }

            await refreshPageData();
            setTimeout(() => setOrderSuccessMsg(null), 4000);
        } else {
            alert(res.error || 'Failed to submit order');
        }
    };

    // Trigger Waiter Calls
    const handleCallWaiter = async (type: 'waiter' | 'charcoal' | 'bill') => {
        if (!session || !table) return;
        await triggerServiceCall(session.id, table.table_number, type);

        const labels = {
            waiter: 'Waiter notified! Someone will assist you shortly.',
            charcoal: 'Charcoal change requested! Shisha waiter is on the way.',
            bill: 'Bill requested! Waiter will bring your check.',
        };

        setServiceMessage(labels[type]);
        setIsServiceBellOpen(false);
        await refreshPageData();
        setTimeout(() => setServiceMessage(null), 4000);
    };

    // Calculate Cart Totals
    const cartSubtotal = cart.reduce((acc, c) => acc + c.itemTotalUsd * c.quantity, 0);

    // Calculate Running Session Bill
    const liveBill = calculateBillTotals(liveOrderItems, liveDiscounts, livePayments, exchangeRate);

    const isBillRequested = table?.status === 'bill_requested';

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c271c] pb-28">
            {/* Locked Screen Overlay if Pre-Bill Requested */}
            {isBillRequested && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-amber-800 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-600" />
                        <span>Pre-Bill requested. Cart submissions are temporarily locked.</span>
                    </div>
                    <button
                        onClick={() => setIsBillOpen(true)}
                        className="underline font-bold text-amber-700 hover:text-amber-900"
                    >
                        View Check
                    </button>
                </div>
            )}

            {/* Header with Official Skylight Logo */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1c3a1e]/10 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Image
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        width={40}
                        height={40}

                        unoptimized
                        className="h-10 w-auto object-contain filter invert"
                    />
                    <div>
                        <h1 className="text-base font-black text-[#1c3a1e] leading-tight tracking-tight">Skylight Village</h1>
                        <p className="text-xs text-[#d4af37] font-bold">Table #{table?.table_number || 1}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Interactive Ordering Guide Button */}
                    <button
                        onClick={() => {
                            setGuideStep(0);
                            setIsGuideOpen(true);
                        }}
                        className="flex items-center gap-1.5 bg-[#eaf2eb] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/30 text-[#1c3a1e] text-xs px-2.5 py-2 rounded-xl font-bold transition-all"
                        title="View Ordering Guide"
                    >
                        <HelpCircle className="h-4 w-4 text-[#1c3a1e]" />
                        <span className="hidden sm:inline">Guide</span>
                    </button>

                    {/* Google Review Button */}
                    <a
                        href="https://g.page/r/CVjTZaAHNiz0EAI/review"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center gap-1.5 bg-[#faf5e6] border border-[#d4af37]/40 hover:border-[#d4af37] text-[#997a15] text-xs px-3 py-2 rounded-xl font-bold transition-all"
                        title="Leave us a Google Review!"
                    >
                        <Star className="h-4 w-4 fill-[#d4af37] text-[#d4af37]" />
                        <span>Review Us</span>
                    </a>

                    {/* Running Bill Button */}
                    <button
                        onClick={() => setIsBillOpen(true)}
                        className="flex items-center gap-1.5 bg-[#eaf2eb] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/30 text-[#1c3a1e] text-xs px-3 py-2 rounded-xl font-bold transition-all"
                    >
                        <Receipt className="h-4 w-4 text-[#1c3a1e]" />
                        <span>{formatUsd(liveBill.finalTotalUsd)}</span>
                    </button>
                </div>
            </header>

            {/* Live Order Status Tracker Banner */}
            {(() => {
                const activeOrderItems = liveOrderItems.filter((i) => i.status !== 'cancelled');
                if (activeOrderItems.length === 0) return null;

                const hasPending = activeOrderItems.some((i) => i.status === 'pending');
                const hasPreparing = activeOrderItems.some((i) => i.status === 'preparing');
                const allReady = activeOrderItems.every((i) => i.status === 'ready' || i.status === 'delivered');

                let bgStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-900';
                let iconColor = 'text-amber-600 animate-pulse';
                let statusMsg = 'Order Received by Kitchen — Preparing ticket...';

                if (hasPreparing) {
                    bgStyle = 'bg-blue-500/10 border-blue-500/30 text-blue-900';
                    iconColor = 'text-blue-600 animate-spin';
                    statusMsg = 'Kitchen is Preparing Your Meal — Chef is cooking your dishes!';
                } else if (allReady) {
                    bgStyle = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900';
                    iconColor = 'text-emerald-600';
                    statusMsg = 'Order Ready! — Servings are being delivered to your table.';
                }

                return (
                    <div className={`${bgStyle} border-b px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-xs`}>
                        <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${hasPreparing ? 'bg-blue-600' : hasPending ? 'bg-amber-500' : 'bg-emerald-600'} ${iconColor}`} />
                            <span>{statusMsg}</span>
                        </div>
                        <button
                            onClick={() => setIsBillOpen(true)}
                            className="underline text-[11px] font-black uppercase tracking-wider hover:opacity-80"
                        >
                            View Items ({activeOrderItems.length})
                        </button>
                    </div>
                );
            })()}

            {/* Success / Notification Banner */}
            {orderSuccessMsg && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{orderSuccessMsg}</span>
                </div>
            )}

            {serviceMessage && (
                <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 text-blue-800 text-xs font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <span>{serviceMessage}</span>
                </div>
            )}
            {/* Category Navigation Bar */}
            <div className="sticky top-[60px] md:top-[61px] z-[21] bg-[#fafbfa]/95 backdrop-blur-md py-3 px-4 overflow-x-auto border-b border-[#1c3a1e]/10 scrollbar-none flex flex-col gap-2.5">
                {/* Search Input Bar */}
                {/* <div className="relative max-w-3xl w-full mx-auto">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search menu items, drinks, or shisha..."
                        className="w-full bg-white border border-[#1c3a1e]/15 rounded-2xl pl-10 pr-8 py-2 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] transition-all shadow-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 p-1"
                        >
                            ✕
                        </button>
                    )}
                </div> */}

                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    <button
                        onClick={() => handleCategoryClick('all')}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === 'all'
                            ? 'bg-[#1c3a1e] text-white shadow-md'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
                            }`}
                    >
                        All Items
                    </button>
                    {categories
                        .filter((cat) => cat.available !== false && filteredMenuItems.some((m) => m.category_id === cat.id))
                        .map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id
                                    ? 'bg-[#1c3a1e] text-white shadow-md'
                                    : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                </div>
            </div>

            {/* Menu Item Grid with Category Titles & Sticky Section Headers */}
            <main className="px-4 py-6 max-w-3xl mx-auto space-y-8">
                {categories.map((cat) => {
                    const catItems = filteredMenuItems
                        .filter((item) => item.category_id === cat.id)
                        .sort((a, b) => {
                            const orderA = a.sort_order ?? 0;
                            const orderB = b.sort_order ?? 0;
                            if (orderA !== orderB) return orderA - orderB;
                            return a.name.localeCompare(b.name);
                        });
                    if (catItems.length === 0) return null;

                    return (
                        <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-36">
                            {/* Sticky Category Title Header */}
                            <div className="sticky top-[130px] z-20 bg-[#fafbfa]/95 backdrop-blur-md px-4 py-1.5 mb-2 border-b border-[#1c3a1e]/15 flex items-center justify-between shadow-sm">
                                <h2 className="text-base font-black text-[#1c3a1e] flex items-center gap-2 tracking-wide">
                                    <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-pulse" />
                                    <span>{cat.name}</span>
                                </h2>
                                <span className="text-[11px] font-bold text-[#1c3a1e] bg-[#eaf2eb] px-2.5 py-1 rounded-full border border-[#1c3a1e]/10">
                                    {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>

                            {/* Category Items List (Horizontal Row Layout) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {catItems.map((item) => {
                                    const isOutOfStock = !item.available;
                                    const displayImage = transformGoogleDriveUrl(item.image_url || '') || '/images/Skylight-logo-icon.png';

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            className={`bg-white rounded-2xl overflow-hidden flex flex-row items-center p-3 gap-3.5 transition-all group border border-[#1c3a1e]/10 shadow-sm ${isOutOfStock
                                                ? 'opacity-50 grayscale cursor-not-allowed border-[#1c3a1e]/10'
                                                : 'hover:border-[#d4af37] hover:shadow-md cursor-pointer active:scale-[0.99]'
                                                }`}
                                        >
                                            {/* Left Square Thumbnail Image */}
                                            <div className="relative h-24 w-24 sm:h-28 sm:w-28 bg-[#f4f7f4] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#1c3a1e]/10">
                                                <Image
                                                    src={displayImage}
                                                    alt={item.name}
                                                    fill
                                                    unoptimized
                                                    className={`w-full h-full ${item.image_url ? 'object-cover' : 'object-contain p-4 opacity-50 filter invert'} group-hover:scale-105 transition-transform duration-300`}
                                                />
                                                {item.is_bestseller && (
                                                    <div className="absolute top-1 left-1 bg-[#d4af37] text-[#1c3a1e] font-black text-[9px] px-1.5 py-0.5 rounded-md shadow-sm z-10 flex items-center gap-0.5">
                                                        ⭐ Speciality
                                                    </div>
                                                )}
                                                {isOutOfStock && (
                                                    <div className="absolute inset-0 bg-[#fafbfa]/80 flex items-center justify-center text-[10px] font-black text-red-600">
                                                        OUT OF STOCK
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right Column: Name, Description, Price & Add Button */}
                                            <div className="flex-1 flex flex-col justify-between min-h-[96px] py-0.5">
                                                <div>
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h3 className="font-extrabold text-sm text-[#1c3a1e] leading-snug group-hover:text-[#d4af37] transition-colors flex items-center gap-1.5 flex-wrap">
                                                            <span>{item.name}</span>
                                                            {item.is_bestseller && (
                                                                <span className="bg-[#d4af37]/20 text-[#1c3a1e] font-black text-[9px] px-1.5 py-0.5 rounded-md border border-[#d4af37]/40">
                                                                    ⭐ Speciality
                                                                </span>
                                                            )}
                                                        </h3>
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-gray-600 text-xs line-clamp-2 leading-relaxed mb-2">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between pt-1.5 mt-auto border-t border-[#1c3a1e]/10">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-[#1c3a1e]">
                                                            {formatUsd(getMenuItemPrice(item, session?.order_type))}
                                                            {session?.order_type === 'camping' && (
                                                                <span className="ml-1 text-[9px] text-emerald-800 font-bold bg-emerald-100 px-1 py-0.5 rounded">Camping</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 font-medium">
                                                            {formatLbp(getMenuItemPrice(item, session?.order_type), exchangeRate)}
                                                        </span>
                                                    </div>

                                                    {!isOutOfStock && (
                                                        <div className="bg-[#eaf2eb] group-hover:bg-[#1c3a1e] group-hover:text-white text-[#1c3a1e] h-8 px-3 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shadow-sm">
                                                            <Plus className="h-3.5 w-3.5" />
                                                            <span>Add</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </main>

            {/* Item Modifier Drawer / Modal */}
            {selectedItemForModifier && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                        {/* Header Image if available */}
                        {selectedItemForModifier.image_url && (
                            <div className="relative h-48 w-full">
                                <Image
                                    src={selectedItemForModifier.image_url}
                                    alt={selectedItemForModifier.name}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
                            </div>
                        )}

                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-extrabold text-[#1c3a1e]">{selectedItemForModifier.name}</h3>
                                    <p className="text-sm text-[#d4af37] font-extrabold mt-0.5">
                                        {formatUsd(getMenuItemPrice(selectedItemForModifier, session?.order_type))} &bull;{' '}
                                        {formatLbp(getMenuItemPrice(selectedItemForModifier, session?.order_type), exchangeRate)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedItemForModifier(null)}
                                    className="bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] p-2 rounded-full transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {selectedItemForModifier.description && (
                                <p className="text-gray-600 text-xs mb-6 leading-relaxed">{selectedItemForModifier.description}</p>
                            )}

                            {/* Modifier Groups */}
                            {(selectedItemForModifier.modifier_groups || []).map((group: ModifierGroup) => (
                                <div key={group.group_name} className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-[#1c3a1e] uppercase tracking-wider">
                                            {group.group_name}
                                        </label>
                                        {group.required && (
                                            <span className="text-[10px] text-[#d4af37] font-bold bg-[#faf5e6] px-2 py-0.5 rounded border border-[#d4af37]/30">
                                                Required
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {group.options.map((opt) => {
                                            const isSelected = selectedModifiers[group.group_name]?.option === opt.name;
                                            return (
                                                <button
                                                    key={opt.name}
                                                    onClick={() =>
                                                        handleModifierSelect(group.group_name, opt.name, opt.price_extra_usd)
                                                    }
                                                    className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-medium flex justify-between items-center transition-all ${isSelected
                                                        ? 'bg-[#1c3a1e] border-[#1c3a1e] text-white font-bold'
                                                        : 'bg-[#fafbfa] border-[#1c3a1e]/15 text-[#1c3a1e] hover:bg-[#eaf2eb]'
                                                        }`}
                                                >
                                                    <span>{opt.name}</span>
                                                    {opt.price_extra_usd > 0 && (
                                                        <span className={isSelected ? 'text-[#d4af37]' : 'text-[#1c3a1e] font-bold'}>+{formatUsd(opt.price_extra_usd)}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Special Instructions Note */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-[#1c3a1e] uppercase tracking-wider mb-2">
                                    Special Requests / Notes
                                </label>
                                <textarea
                                    value={specialNotes}
                                    onChange={(e) => setSpecialNotes(e.target.value)}
                                    placeholder="e.g. Extra garlic, sauce on the side, well done..."
                                    rows={2}
                                    className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                />
                            </div>

                            <button
                                onClick={handleAddToCart}
                                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-all"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Add to Cart</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cart Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
                    <div className="bg-white border-l border-[#1c3a1e]/15 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
                        <div>
                            <div className="flex justify-between items-center pb-4 border-b border-[#1c3a1e]/15 mb-4">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="h-5 w-5 text-[#1c3a1e]" />
                                    <h3 className="text-base font-extrabold text-[#1c3a1e]">Your Current Cart</h3>
                                </div>
                                <button onClick={() => setIsCartOpen(false)} className="text-[#1c3a1e] hover:text-[#d4af37]">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Your cart is currently empty.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, index) => (
                                        <div key={index} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-xl p-3 shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="font-extrabold text-sm text-[#1c3a1e]">{item.menuItem.name}</div>
                                                <div className="text-xs font-black text-[#1c3a1e]">
                                                    {formatUsd(item.itemTotalUsd * item.quantity)}
                                                </div>
                                            </div>

                                            {item.selectedModifiers.length > 0 && (
                                                <div className="text-[11px] text-gray-600 mt-1">
                                                    {item.selectedModifiers.map((m) => `${m.group}: ${m.option}`).join(', ')}
                                                </div>
                                            )}

                                            {item.specialNotes && (
                                                <div className="text-[11px] text-[#d4af37] mt-0.5 italic font-bold">
                                                    Note: {item.specialNotes}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1c3a1e]/10">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (item.quantity > 1) {
                                                                const newCart = [...cart];
                                                                newCart[index].quantity -= 1;
                                                                setCart(newCart);
                                                            }
                                                        }}
                                                        className="h-6 w-6 bg-[#eaf2eb] text-[#1c3a1e] border border-[#1c3a1e]/15 rounded flex items-center justify-center text-xs font-bold"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="text-xs text-[#1c3a1e] font-extrabold">{item.quantity}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newCart = [...cart];
                                                            newCart[index].quantity += 1;
                                                            setCart(newCart);
                                                        }}
                                                        className="h-6 w-6 bg-[#eaf2eb] text-[#1c3a1e] border border-[#1c3a1e]/15 rounded flex items-center justify-center text-xs font-bold"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                                    className="text-red-600 hover:text-red-700 text-xs font-bold"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="pt-4 border-t border-[#1c3a1e]/15 mt-4 space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-600 font-medium">Subtotal USD:</span>
                                        <span className="font-black text-[#1c3a1e]">{formatUsd(cartSubtotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-600 font-medium">Subtotal LBP:</span>
                                        <span className="font-extrabold text-[#1c3a1e]">
                                            {formatLbp(cartSubtotal, exchangeRate)}
                                        </span>
                                    </div>
                                </div>

                                {/* 1-Line Inline Optional Phone Entry with Explicit Search */}
                                <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-2.5 space-y-1.5 shadow-2xs">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-black text-[#1c3a1e] whitespace-nowrap flex items-center gap-1 shrink-0">
                                            <span>📱</span>
                                            <span>Phone:</span>
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="03 724 473 (Optional)"
                                            value={tempPhoneInput || customerPhone}
                                            onChange={(e) => {
                                                setTempPhoneInput(e.target.value);
                                                if (!e.target.value) setCustomerPhone('');
                                            }}
                                            className="flex-1 bg-white border border-[#1c3a1e]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchCartPhone}
                                            disabled={isSearchingCartPhone || !tempPhoneInput.trim()}
                                            className="bg-[#1c3a1e] hover:bg-black text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-40"
                                        >
                                            {isSearchingCartPhone ? '⏳' : '🔍 Search'}
                                        </button>
                                    </div>

                                    {customerPhone && (
                                        <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-2xs">
                                            <span className="truncate">👤 {customerName || 'Guest'} ({customerPhone})</span>
                                            <button
                                                type="button"
                                                onClick={openLoyaltyModal}
                                                className="bg-[#d4af37] text-[#1c3a1e] hover:bg-[#c29f2f] px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer shrink-0 transition-all flex items-center gap-1 ml-2 shadow-2xs"
                                            >
                                                <Sparkles className="h-3 w-3 text-[#1c3a1e]" />
                                                <span>🎁 Redeem Points</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isBillRequested ? (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-700 text-xs p-3 rounded-xl text-center font-bold">
                                        Pre-Bill generated. Contact server to add items.
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleOrderSubmit}
                                        disabled={orderSubmitting}
                                        className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-lg disabled:opacity-50 transition-all uppercase tracking-wider"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>{orderSubmitting ? 'Sending Order...' : 'Submit Order to Kitchen 🚀'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Running Bill Drawer */}
            {isBillOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
                    <div className="bg-white border-l border-[#1c3a1e]/15 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
                        <div>
                            <div className="flex justify-between items-center pb-4 border-b border-[#1c3a1e]/15 mb-4">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-[#1c3a1e]" />
                                    <h3 className="text-base font-extrabold text-[#1c3a1e]">Live Table Session Bill</h3>
                                </div>
                                <button onClick={() => setIsBillOpen(false)} className="text-[#1c3a1e] hover:text-[#d4af37]">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {liveOrderItems.length === 0 ? (
                                <p className="text-center py-12 text-gray-500 text-sm">No items ordered yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {liveOrderItems.map((item) => {
                                        const statusColors = {
                                            pending: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
                                            preparing: 'bg-blue-500/10 text-blue-800 border-blue-500/30',
                                            ready: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30',
                                            delivered: 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/20',
                                            cancelled: 'bg-red-500/10 text-red-700 border-red-500/30 line-through',
                                        };

                                        return (
                                            <div key={item.id} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-xl p-3 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-extrabold text-[#1c3a1e] text-xs">
                                                            {item.quantity}x {item.item_name}
                                                        </span>
                                                        {item.is_comped && (
                                                            <span className="ml-2 text-[10px] bg-purple-500/10 text-purple-800 px-1.5 py-0.5 rounded font-extrabold">
                                                                COMPED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-black text-[#1c3a1e]">
                                                        {item.is_comped ? '$0.00' : formatUsd(Number(item.unit_price_usd) * item.quantity)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between items-center mt-2">
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColors[item.status]
                                                            }`}
                                                    >
                                                        {item.status.toUpperCase()}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {new Date(item.created_at).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-[#1c3a1e]/15 mt-6 space-y-2">
                            <div className="flex justify-between text-xs text-gray-600">
                                <span>Subtotal:</span>
                                <span>{formatUsd(liveBill.subtotalUsd)}</span>
                            </div>
                            {liveBill.discountUsd > 0 && (
                                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                                    <span>Discounts Applied:</span>
                                    <span>-{formatUsd(liveBill.discountUsd)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-black text-[#1c3a1e] pt-1 border-t border-[#1c3a1e]/15">
                                <span>TOTAL USD:</span>
                                <span>{formatUsd(liveBill.finalTotalUsd)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-extrabold text-[#d4af37]">
                                <span>TOTAL LBP ({exchangeRate}):</span>
                                <span>{liveBill.finalTotalLbp}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button
                                    onClick={() => {
                                        setIsBillOpen(false);
                                        setIsPayMyShareOpen(true);
                                    }}
                                    className="bg-[#d4af37] text-[#1c3a1e] font-black py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md transition-all hover:scale-102 cursor-pointer"
                                >
                                    <DollarSign className="h-4 w-4" />
                                    <span>Pay My Share</span>
                                </button>
                                <button
                                    onClick={() => handleCallWaiter('bill')}
                                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all shadow-md cursor-pointer"
                                >
                                    <Receipt className="h-4 w-4" />
                                    <span>Request Check</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAY MY SHARE MOBILE DRAWER */}
            {isPayMyShareOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-[#1c3a1e] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <div className="h-9 w-9 bg-[#eaf2eb] rounded-xl flex items-center justify-center text-[#1c3a1e]">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#1c3a1e]">Pay My Share</h3>
                                    <p className="text-xs text-gray-500 font-medium">Select dishes or split table total equally</p>
                                </div>
                            </div>
                            <button onClick={() => setIsPayMyShareOpen(false)} className="text-gray-400 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Customer Name Input for Share Identification */}
                        <div className="space-y-1.5 border-b border-gray-200 pb-3">
                            <label className="block text-xs font-bold text-[#1c3a1e] flex items-center justify-between">
                                <span>Your Name:</span>
                                <span className="text-[10px] text-amber-700 font-extrabold">* Used to tag your bill share on POS</span>
                            </label>
                            <input
                                type="text"
                                value={shareCustomerName}
                                onChange={(e) => setShareCustomerName(e.target.value)}
                                placeholder="Enter your name (e.g. Nicolas, Sarah)..."
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-2 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                            />
                        </div>

                        {/* Split Type Toggles */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-700">Quick Equal Split:</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map((count) => (
                                    <button
                                        key={count}
                                        onClick={() => setPayShareSplitCount(count)}
                                        className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${payShareSplitCount === count
                                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                            : 'bg-[#fafbfa] text-[#1c3a1e] border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        {count === 1 ? 'Full' : `1/${count} Split`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3 space-y-2">
                            <label className="block text-xs font-bold text-gray-700">Or Pick Specific Dishes You Ate:</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {liveOrderItems.filter((i) => i.status !== 'cancelled').map((item) => {
                                    const isChecked = selectedShareItemIds.includes(item.id);
                                    const itemPrice = Number(item.unit_price_usd) * item.quantity;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedShareItemIds((prev) => prev.filter((id) => id !== item.id));
                                                } else {
                                                    setSelectedShareItemIds((prev) => [...prev, item.id]);
                                                }
                                            }}
                                            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${isChecked
                                                ? 'bg-emerald-50 border-emerald-500/40 text-emerald-950 font-bold'
                                                : 'bg-[#fafbfa] border-gray-200 text-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => { }}
                                                    className="h-4 w-4 rounded accent-[#1c3a1e]"
                                                />
                                                <span className="text-xs">
                                                    {item.quantity}x {item.item_name}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black">{formatUsd(itemPrice)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Calculated Share Total */}
                        {(() => {
                            let shareUsd = 0;
                            if (selectedShareItemIds.length > 0) {
                                const selectedItems = liveOrderItems.filter((i) => selectedShareItemIds.includes(i.id));
                                shareUsd = selectedItems.reduce((acc, i) => acc + Number(i.unit_price_usd) * i.quantity, 0);
                            } else {
                                shareUsd = liveBill.finalTotalUsd / payShareSplitCount;
                            }
                            const shareLbp = formatLbp(shareUsd, exchangeRate);

                            return (
                                <div className="bg-[#1c3a1e] text-white p-4 rounded-2xl space-y-2 shadow-md">
                                    <div className="flex justify-between text-xs text-gray-300">
                                        <span>Your Individual Share Total:</span>
                                        <span className="font-extrabold text-[#d4af37]">
                                            {selectedShareItemIds.length > 0 ? `${selectedShareItemIds.length} items picked` : `1/${payShareSplitCount} of Table Bill`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xl font-black text-[#d4af37]">{formatUsd(shareUsd)}</span>
                                        <span className="text-xs font-bold">{shareLbp}</span>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            const nameToUse = shareCustomerName.trim() || customerName.trim() || 'Guest Share';
                                            if (!nameToUse) {
                                                alert('Please enter your name to request your share.');
                                                return;
                                            }

                                            setIsSubmittingSharePay(true);

                                            // 1. Permanently tag selected items in CockroachDB with guest name
                                            if (selectedShareItemIds.length > 0) {
                                                await assignGuestNameToOrderItems(selectedShareItemIds, nameToUse);
                                            }

                                            // 2. Call waiter with custom share note including guest name
                                            await triggerServiceCall(
                                                session?.id || '',
                                                table?.table_number || 1,
                                                'bill',
                                                `${nameToUse} requested individual check share: ${formatUsd(shareUsd)} (${shareLbp})`
                                            );

                                            setIsSubmittingSharePay(false);
                                            setIsPayMyShareOpen(false);
                                            setAddedToastMsg(`✅ Share of ${formatUsd(shareUsd)} for ${nameToUse} sent to waiter!`);
                                            setTimeout(() => setAddedToastMsg(null), 4000);
                                        }}
                                        disabled={isSubmittingSharePay}
                                        className="w-full mt-2 bg-[#d4af37] hover:bg-[#c29f2f] text-[#1c3a1e] font-black py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                    >
                                        <Receipt className="h-4 w-4" />
                                        <span>{isSubmittingSharePay ? 'Sending...' : 'Request Server for My Share ($' + shareUsd.toFixed(2) + ')'}</span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* FLOATING STICKY BOTTOM CART BAR */}
            {cart.length > 0 && !isCartOpen && (
                <div className="fixed bottom-4 left-4 right-20 z-40 animate-in slide-in-from-bottom-4">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full bg-[#1c3a1e] hover:bg-black text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-[#d4af37]/40 transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 bg-[#d4af37] text-[#1c3a1e] rounded-xl font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-white leading-tight">View Your Cart</p>
                                <p className="text-[10px] text-gray-300 font-medium truncate max-w-[130px] sm:max-w-none">Tap to submit order</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-[#d4af37]">{formatUsd(cartSubtotal)}</span>
                            <ChevronRight className="h-4 w-4 text-white" />
                        </div>
                    </button>
                </div>
            )}

            {/* Floating Action Button (FAB) - Service Bell */}
            <div className="fixed bottom-4 right-4 z-40">
                <button
                    onClick={() => setIsServiceBellOpen(!isServiceBellOpen)}
                    className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border border-[#d4af37]/30"
                >
                    <Bell className="h-5 w-5" />
                </button>

                {/* Service Options Popover */}
                {isServiceBellOpen && (
                    <div className="absolute bottom-16 right-0 w-64 bg-white border border-[#1c3a1e]/15 rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider px-2 py-1">
                            Call Service
                        </div>
                        <button
                            onClick={() => handleCallWaiter('waiter')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors"
                        >
                            <Bell className="h-4 w-4 text-[#1c3a1e]" />
                            <span>Call Waiter</span>
                        </button>
                        <button
                            onClick={() => handleCallWaiter('charcoal')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors"
                        >
                            <Flame className="h-4 w-4 text-orange-600" />
                            <span>Request Charcoal Change</span>
                        </button>
                        <button
                            onClick={() => handleCallWaiter('bill')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#fafbfa] hover:bg-[#eaf2eb] text-xs font-bold text-[#1c3a1e] flex items-center gap-2.5 transition-colors"
                        >
                            <Receipt className="h-4 w-4 text-emerald-700" />
                            <span>Request Bill</span>
                        </button>
                    </div>
                )}
                {/* Added Item Toast Confirmation Banner */}
                {addedToastMsg && (
                    <div className="fixed bottom-6 w-max left-1/2 -translate-x-1/2 z-50 bg-[#1c3a1e] text-white font-black text-xs px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-[#d4af37] animate-in fade-in slide-in-from-bottom-4">
                        <CheckCircle2 className="h-4 w-4 text-[#d4af37]" />
                        <span>{addedToastMsg}</span>
                    </div>
                )}
            </div>

            {/* FIRST-TIME CUSTOMER SELF-ORDERING WELCOME NOTICE MODAL */}
            {isWelcomeNoticeOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white border border-[#1c3a1e]/20 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl text-[#1c3a1e] relative overflow-hidden flex flex-col justify-between space-y-6">
                        {/* Decorative Gold Header Bar */}
                        <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-[#1c3a1e] via-[#d4af37] to-[#1c3a1e]" />

                        {/* Top Close Button */}
                        <div className="flex justify-between items-center pt-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-[#1c3a1e] bg-[#eaf2eb] px-3.5 py-1.5 rounded-full border border-[#1c3a1e]/20 flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#d4af37] animate-pulse" />
                                    Self-Ordering System | الطلب الذاتي
                                </span>
                            </div>
                            <button
                                onClick={handleCloseWelcomeNotice}
                                className="text-gray-400 hover:text-black font-bold p-1 rounded-full text-base transition-colors"
                                title="Close"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Hero Icon Badge */}
                        <div className="text-center py-1 space-y-4">
                            <div className="h-20 w-20 bg-[#eaf2eb] rounded-3xl flex items-center justify-center mx-auto border border-[#1c3a1e]/15 shadow-sm">
                                <Utensils className="h-10 w-10 text-[#1c3a1e]" />
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-[#1c3a1e] tracking-tight">
                                    Welcome to Skylight Village 🌲
                                </h3>
                                <p className="text-sm font-extrabold text-[#d4af37]">
                                    Table #{table?.table_number || 10} • الطاولة #{table?.table_number || 10}
                                </p>
                            </div>

                            {/* Dual Language Clear Explanation Box */}
                            <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 sm:p-5 space-y-4 text-left shadow-xs">
                                {/* English Version */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-sm font-black text-[#1c3a1e]">
                                        <span>🇬🇧 English: Self-Ordering System</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-700 font-semibold leading-relaxed">
                                        You are using our live digital self-ordering menu. Simply browse dishes, customize your options, and send orders directly to our kitchen!
                                    </p>
                                </div>

                                <div className="border-t border-[#1c3a1e]/15" />

                                {/* Arabic Version (RTL) */}
                                <div className="space-y-1.5 text-right" dir="rtl">
                                    <div className="flex items-center gap-1.5 text-sm font-black text-[#1c3a1e]">
                                        <span>🇱🇧 العربية: نظام الطلب الذاتي المباشر</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-700 font-bold leading-relaxed">
                                        أهلاً بكم! هذا نظام طلب إلكتروني ذاتي لطاولتك. تصفّح قائمة الطعام، خصّص أطباقك المفضلة، وأرسل طلبك مباشرة إلى المطبخ من هاتفك!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-1">
                            <button
                                onClick={handleCloseWelcomeNotice}
                                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-4 rounded-2xl text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Start Self-Ordering 🚀 | ابدأ الطلب الذاتي</span>
                            </button>

                            <button
                                onClick={handleOpenGuideFromNotice}
                                className="w-full bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] font-extrabold py-3 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#1c3a1e]/15"
                            >
                                <HelpCircle className="h-4 w-4 text-[#1c3a1e]" />
                                <span>How It Works Guide (5 Steps) | دليل الاستخدام</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FIRST-TIME CUSTOMER INTERACTIVE ONBOARDING GUIDE MODAL */}
            {isGuideOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div
                        dir={guideLang === 'ar' ? 'rtl' : 'ltr'}
                        className="bg-white border border-[#1c3a1e]/20 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] relative overflow-hidden flex flex-col justify-between min-h-[520px]"
                    >
                        {/* Top Decorative Gold Header Bar */}
                        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#1c3a1e] via-[#d4af37] to-[#1c3a1e]" />

                        <div>
                            {/* Modal Header Controls */}
                            <div className="flex justify-between items-center mb-3 pt-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1c3a1e] bg-[#eaf2eb] px-2.5 py-1 rounded-full border border-[#1c3a1e]/15">
                                        {guideLang === 'ar' ? `الخطوة ${guideStep + 1} من 5` : `Step ${guideStep + 1} of 5`}
                                    </span>

                                    {/* Language Switcher */}
                                    <div className="flex items-center bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-full p-0.5 shadow-xs">
                                        <button
                                            onClick={() => setGuideLang('en')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${guideLang === 'en'
                                                ? 'bg-[#1c3a1e] text-white shadow-xs'
                                                : 'text-gray-500 hover:text-[#1c3a1e]'
                                                }`}
                                        >
                                            EN
                                        </button>
                                        <button
                                            onClick={() => setGuideLang('ar')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${guideLang === 'ar'
                                                ? 'bg-[#1c3a1e] text-white shadow-xs'
                                                : 'text-gray-500 hover:text-[#1c3a1e]'
                                                }`}
                                        >
                                            عربي
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCloseGuide}
                                    className="text-gray-400 hover:text-black font-bold p-1 rounded-full text-base transition-colors"
                                    title={guideLang === 'ar' ? 'إغلاق' : 'Close Guide'}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* STEP 1: BROWSE MENU */}
                            {guideStep === 0 && (
                                <div className="space-y-3 text-center py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="relative w-full h-44 bg-[#f4f7f4] border border-[#1c3a1e]/15 rounded-2xl overflow-hidden shadow-sm">
                                        <Image
                                            src="/images/sc-guide-1.png"
                                            alt="Browse Menu Screenshot"
                                            fill
                                            unoptimized
                                            className="object-cover object-top"
                                        />
                                    </div>

                                    <h3 className="text-lg font-black text-[#1c3a1e] tracking-tight">
                                        {guideLang === 'ar' ? 'أهلاً بكم وتصفح قائمة الطعام 🌲' : 'Welcome & Browse Menu 🌲'}
                                    </h3>

                                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                                        {guideLang === 'ar' ? (
                                            <>
                                                تصفّح الأقسام (المقبلات، الصاج، المشاوي، المشروبات، الشيشة) واضغط على أي طبق لبدء الطلب لطاولتك رقم{' '}
                                                <strong className="text-[#1c3a1e]">#{table?.table_number || 10}</strong>!
                                            </>
                                        ) : (
                                            <>
                                                Browse categories (Mezza, Sajj, BBQ, Bar, Shisha) & tap any item card to start ordering for{' '}
                                                <strong className="text-[#1c3a1e]">Table #{table?.table_number || 10}</strong>!
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* STEP 2: CUSTOMIZE DISH & OPTIONS */}
                            {guideStep === 1 && (
                                <div className="space-y-3 text-center py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="relative w-full h-44 bg-[#f4f7f4] border border-[#1c3a1e]/15 rounded-2xl overflow-hidden shadow-sm">
                                        <Image
                                            src="/images/sc-guide-2.png"
                                            alt="Customize Dish Screenshot"
                                            fill
                                            unoptimized
                                            className="object-cover object-top"
                                        />
                                    </div>

                                    <h3 className="text-lg font-black text-[#1c3a1e] tracking-tight">
                                        {guideLang === 'ar' ? 'تحديد الإضافات والملاحظات 📝' : 'Customize Options & Special Notes 📝'}
                                    </h3>

                                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                                        {guideLang === 'ar' ? (
                                            <>
                                                اختر الإضافات المطلوبة (مثل بيبسي، سفن أب، الثوم الإضافي) وأضف ملاحظاتك الخاصة للطهي قبل الإضافة للسلة!
                                            </>
                                        ) : (
                                            <>
                                                Choose required options (e.g. Pepsi, 7up, Extra Garlic) and add your special requests before adding to cart!
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* STEP 3: REVIEW CART & SUBMIT */}
                            {guideStep === 2 && (
                                <div className="space-y-3 text-center py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="relative w-full h-44 bg-[#f4f7f4] border border-[#1c3a1e]/15 rounded-2xl overflow-hidden shadow-sm">
                                        <Image
                                            src="/images/sc-guide-3.png"
                                            alt="Cart Drawer Screenshot"
                                            fill
                                            unoptimized
                                            className="object-cover object-top"
                                        />
                                    </div>

                                    <h3 className="text-lg font-black text-[#1c3a1e] tracking-tight">
                                        {guideLang === 'ar' ? 'مراجعة السلة وإرسال الطلب 🛒' : 'Review Cart & Submit Order 🛒'}
                                    </h3>

                                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                                        {guideLang === 'ar' ? (
                                            <>
                                                راجع محتويات السلة والأسعار بالدولار والليرة اللبنانية، ثم اضغط على زر <strong className="text-[#1c3a1e]">إرسال الطلب للمطبخ</strong>!
                                            </>
                                        ) : (
                                            <>
                                                Inspect cart items & totals in USD ($) and LBP (L.L.), then tap <strong className="text-[#1c3a1e]">Submit Order to Kitchen</strong>!
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* STEP 4: CALL WAITER & SERVICE BELL */}
                            {guideStep === 3 && (
                                <div className="space-y-3 text-center py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="relative w-full h-44 bg-[#f4f7f4] border border-[#1c3a1e]/15 rounded-2xl overflow-hidden shadow-sm">
                                        <Image
                                            src="/images/sc-guide-4.png"
                                            alt="Service Bell Screenshot"
                                            fill
                                            unoptimized
                                            className="object-cover object-top"
                                        />
                                    </div>

                                    <h3 className="text-lg font-black text-[#1c3a1e] tracking-tight">
                                        {guideLang === 'ar' ? 'طلب الويتر والفحم والخدمة 🔔' : 'Call Waiter & Service Bell 🔔'}
                                    </h3>

                                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                                        {guideLang === 'ar' ? (
                                            <>
                                                هل تحتاج لمساعدة الويتر، تغيير فحم الشيشة، أوطلب الفاتورة؟ اضغط على زر الجرس السريع في الأسفل في أي وقت!
                                            </>
                                        ) : (
                                            <>
                                                Need extra napkins, charcoal for shisha, or your check? Tap the floating bell icon at the bottom right anytime!
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* STEP 5: LIVE ORDER TRACKER */}
                            {guideStep === 4 && (
                                <div className="space-y-3 text-center py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="relative w-full h-44 bg-[#f4f7f4] border border-[#1c3a1e]/15 rounded-2xl overflow-hidden shadow-sm">
                                        <Image
                                            src="/images/sc-guide-5.png"
                                            alt="Live Order Status Screenshot"
                                            fill
                                            unoptimized
                                            className="object-cover object-top"
                                        />
                                    </div>

                                    <h3 className="text-lg font-black text-[#1c3a1e] tracking-tight">
                                        {guideLang === 'ar' ? 'متابعة حالة الطلب في المطبخ 🟡' : 'Live Kitchen Order Status 🟡'}
                                    </h3>

                                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                                        {guideLang === 'ar' ? (
                                            <>
                                                تابع حالة طلبك مباشرة من المطبخ: <strong className="text-amber-700">🟡 تم الاستلام</strong> ➔ <strong className="text-blue-700">🔵 قيد التحضير</strong> ➔ <strong className="text-emerald-700">🟢 جاهز للتقديم!</strong>
                                            </>
                                        ) : (
                                            <>
                                                Track your order live from the kitchen: <strong className="text-amber-700">🟡 Received</strong> ➔ <strong className="text-blue-700">🔵 Cooking</strong> ➔ <strong className="text-emerald-700">🟢 Ready on its way!</strong>
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer Controls & Progress Indicators */}
                        <div className="pt-3 border-t border-[#1c3a1e]/15 mt-3">
                            {/* Step Dots */}
                            <div className="flex justify-center items-center gap-1.5 mb-3">
                                {[0, 1, 2, 3, 4].map((stepIdx) => (
                                    <button
                                        key={stepIdx}
                                        onClick={() => setGuideStep(stepIdx)}
                                        className={`h-2 rounded-full transition-all ${guideStep === stepIdx
                                            ? 'w-6 bg-[#d4af37]'
                                            : 'w-2 bg-gray-300 hover:bg-gray-400'
                                            }`}
                                    />
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                {guideStep > 0 ? (
                                    <button
                                        onClick={() => setGuideStep((prev) => prev - 1)}
                                        className="w-1/3 bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] font-bold py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        {guideLang === 'ar' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                                        <span>{guideLang === 'ar' ? 'السابق' : 'Back'}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCloseGuide}
                                        className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
                                    >
                                        {guideLang === 'ar' ? 'تخطي' : 'Skip'}
                                    </button>
                                )}

                                {guideStep < 4 ? (
                                    <button
                                        onClick={() => setGuideStep((prev) => prev + 1)}
                                        className="w-2/3 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <span>{guideLang === 'ar' ? 'الخطوة التالية' : 'Next Step'}</span>
                                        {guideLang === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCloseGuide}
                                        className="w-2/3 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <span>{guideLang === 'ar' ? 'ابدأ الطلب الآن! 🚀' : 'Start Ordering! 🚀'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW GUEST NAME REGISTRATION MODAL */}
            {isNewGuestModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
                            <h3 className="text-sm font-black text-[#1c3a1e] flex items-center gap-2">
                                <span>👤</span> New Guest Profile
                            </h3>
                            <button onClick={() => setIsNewGuestModalOpen(false)} className="text-gray-400 font-bold p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-600 font-medium">
                            No existing profile found for <strong className="text-[#1c3a1e] font-mono">{customerPhone}</strong>. Enter your name below to register and save your order history!
                        </p>

                        <div className="space-y-2">
                            <label className="block text-xs font-black text-[#1c3a1e]">Your Name (Optional)</label>
                            <input
                                type="text"
                                autoFocus
                                placeholder="e.g. Nicola Nasr"
                                value={newGuestNameInput}
                                onChange={(e) => setNewGuestNameInput(e.target.value)}
                                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                const resolvedName = newGuestNameInput.trim() || 'Valued Guest';
                                setCustomerName(resolvedName);
                                setIsNewGuestModalOpen(false);

                                const res = await lookupOrCreateCustomerLoyalty(customerPhone, resolvedName);
                                if (res.success && res.customer) {
                                    setLoyaltyProfile(res.customer);
                                    setRewardTiers(res.rewardTiers || []);
                                }

                                setAddedToastMsg(`✅ Registered: ${resolvedName} (${customerPhone})`);
                                setTimeout(() => setAddedToastMsg(null), 3500);
                            }}
                            className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
                        >
                            Save &amp; Link Profile 🚀
                        </button>
                    </div>
                </div>
            )}

            {/* CUSTOM MOBILE-FRIENDLY VIP LOYALTY MODAL */}
            {isLoyaltyModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-[#d4af37]" />
                                <h3 className="text-base font-black text-[#1c3a1e]">VIP Loyalty Rewards</h3>
                            </div>
                            <button onClick={() => setIsLoyaltyModalOpen(false)} className="text-gray-400 font-bold p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {loyaltyProfile ? (
                            <div className="space-y-4">
                                <div className="bg-[#eaf2eb] border border-[#1c3a1e]/20 rounded-2xl p-4 text-center space-y-2 shadow-xs">
                                    <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block">Recognized VIP Profile</span>
                                    <h4 className="text-lg font-black text-[#1c3a1e]">{loyaltyProfile.customer_name}</h4>
                                    <p className="text-xs font-bold text-gray-600">{loyaltyProfile.phone_number}</p>

                                    <div className="bg-white border border-amber-300 rounded-xl p-3 inline-block shadow-xs">
                                        <span className="text-xs text-gray-500 font-bold block">Current Points Balance</span>
                                        <strong className="text-2xl font-black text-amber-800">🌟 {loyaltyProfile.points_balance} PTS</strong>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider">Eligible Rewards</h4>
                                    {rewardTiers.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No reward tiers available.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {rewardTiers.map((tier) => {
                                                const canAfford = loyaltyProfile.points_balance >= tier.points_required;
                                                return (
                                                    <div key={tier.id} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3 flex justify-between items-center">
                                                        <div>
                                                            <strong className="text-xs font-extrabold text-[#1c3a1e] block">{tier.name}</strong>
                                                            <span className="text-[10px] text-gray-500 font-bold">{tier.points_required} pts required (${tier.discount_value.toFixed(2)} Off)</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRedeemCustomerReward(tier.id)}
                                                            disabled={!canAfford || redeemingTierId === tier.id}
                                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${canAfford
                                                                ? 'bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white shadow-xs'
                                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            {redeemingTierId === tier.id ? (
                                                                <>
                                                                    <span className="animate-spin text-xs">⏳</span>
                                                                    <span>Redeeming…</span>
                                                                </>
                                                            ) : canAfford ? (
                                                                'Redeem'
                                                            ) : (
                                                                'Need Pts'
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        try {
                                            const tableNum = tableParam ? parseInt(tableParam, 10) : 1;
                                            localStorage.removeItem(`skylight_loyalty_phone_t${tableNum}`);
                                            localStorage.removeItem(`skylight_loyalty_name_t${tableNum}`);
                                        } catch (e) { }
                                        setCustomerPhone('');
                                        setCustomerName('');
                                        setLoyaltyProfile(null);
                                        setTempPhoneInput('');
                                        setTempNameInput('');
                                        setIsLoyaltyModalOpen(false);
                                    }}
                                    className="w-full bg-gray-100 hover:bg-red-50 hover:border-red-200 hover:text-red-700 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <span>🚪</span> Log Out / Switch Number
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveLoyaltyProfile} className="space-y-3">
                                <p className="text-xs text-gray-600 font-medium">
                                    {loyaltyEnabled
                                        ? 'Enter your mobile number to earn points for every $1 spent and redeem rewards for free Shisha or Tawook!'
                                        : 'Enter your mobile number (optional) to save your visit history, reorder quickly, and receive exclusive member offers & updates!'}
                                </p>

                                <div>
                                    <label className="block text-xs font-bold text-[#1c3a1e] mb-1">Mobile Phone Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="e.g. 70 123 456"
                                        value={tempPhoneInput}
                                        onChange={(e) => setTempPhoneInput(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs font-black text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#1c3a1e] mb-1">Your Name (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Nicola Nasr"
                                        value={tempNameInput}
                                        onChange={(e) => setTempNameInput(e.target.value)}
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loyaltyLoading}
                                    className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer mt-2"
                                >
                                    {loyaltyLoading ? 'Saving Profile...' : 'Save & Link Guest Profile 🚀'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* SLEEK 5-STAR RATING & REVIEW MODAL */}
            {isRatingModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-[#1c3a1e]">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <div className="h-9 w-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                    <Star className="h-5 w-5 fill-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Rate Your Dining Experience</h3>
                                    <p className="text-xs text-gray-500 font-medium">Skylight Village Guest Review</p>
                                </div>
                            </div>
                            <button onClick={() => setIsRatingModalOpen(false)} className="text-gray-400 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {hasSubmittedFeedback ? (
                            <div className="py-8 text-center space-y-3">
                                <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <h4 className="text-base font-black">Thank you for your rating!</h4>
                                <p className="text-xs text-gray-600">Your feedback helps us continuously elevate our service.</p>
                                <a
                                    href="https://g.page/r/CVjTZaAHNiz0EAI/review"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-[#d4af37] text-[#1c3a1e] font-black px-4 py-2.5 rounded-xl text-xs shadow-xs hover:scale-105 transition-all mt-2"
                                >
                                    <span>Also Leave a Google Review ⭐</span>
                                </a>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-center items-center gap-2 py-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setRatingValue(star)}
                                            className="p-1 transition-transform hover:scale-125 cursor-pointer"
                                        >
                                            <Star
                                                className={`h-7 w-7 ${star <= ratingValue ? 'text-amber-500 fill-amber-400' : 'text-gray-300'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">What did you love most?</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['Fast Service', 'Delicious Food', 'Friendly Staff', 'Great Vibes', 'Clean Tables'].map((tag) => {
                                            const isSelected = ratingTags.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setRatingTags((prev) => prev.filter((t) => t !== tag));
                                                        } else {
                                                            setRatingTags((prev) => [...prev, tag]);
                                                        }
                                                    }}
                                                    className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${isSelected
                                                        ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                                                        : 'bg-[#fafbfa] text-gray-700 border-gray-300 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {isSelected ? '✓ ' : '+ '}{tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Comments or suggestions (Optional):</label>
                                    <textarea
                                        rows={2}
                                        value={ratingComment}
                                        onChange={(e) => setRatingComment(e.target.value)}
                                        placeholder="Tell us what you liked..."
                                        className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-2.5 text-xs text-[#1c3a1e] font-medium"
                                    />
                                </div>

                                <button
                                    disabled={isSubmittingFeedback}
                                    onClick={async () => {
                                        setIsSubmittingFeedback(true);
                                        const res = await submitCustomerFeedbackAction({
                                            sessionId: session?.id,
                                            tableNumber: table?.table_number || 1,
                                            rating: ratingValue,
                                            tags: ratingTags,
                                            comment: ratingComment,
                                            customerPhone: customerPhone,
                                        });
                                        setIsSubmittingFeedback(false);
                                        if (res.success) {
                                            setHasSubmittedFeedback(true);
                                        }
                                    }}
                                    className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-md transition-all cursor-pointer"
                                >
                                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback ⭐'}
                                </button>

                                <div className="text-center pt-1 border-t border-gray-100">
                                    <a
                                        href="https://g.page/r/CVjTZaAHNiz0EAI/review"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] font-bold text-[#997a15] hover:underline"
                                    >
                                        Or click here to review us on Google Maps ↗
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
