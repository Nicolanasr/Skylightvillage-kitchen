'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    MenuItem,
    ModifierGroup,
    OrderItem,
    SelectedModifier,
    StationType,
    Table,
    TableSession,
    MenuCategory,
} from '@/lib/types';
import { calculateBillTotals, formatLbp, formatUsd } from '@/lib/currency';
import { getOrderPageData, submitCustomerOrder, triggerServiceCall } from '../actions/order-actions';
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
    Lock,
    ChevronRight,
    Image as ImageIcon,
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
    const tableParam = searchParams.get('table');
    const tokenParam = searchParams.get('token');

    const [table, setTable] = useState<Table | null>(null);
    const [session, setSession] = useState<TableSession | null>(null);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    const [activeCategory, setActiveCategory] = useState<string>('all');
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

    // Live order items for active session
    const [liveOrderItems, setLiveOrderItems] = useState<OrderItem[]>([]);
    const [liveDiscounts, setLiveDiscounts] = useState<any[]>([]);
    const [livePayments, setLivePayments] = useState<any[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(89500);

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
        } catch (e) {
            console.error('Error fetching order page data:', e);
        }
    };

    useEffect(() => {
        refreshPageData();
        const interval = setInterval(refreshPageData, 2000);
        return () => clearInterval(interval);
    }, [tableParam, tokenParam]);

    const filteredMenuItems =
        activeCategory === 'all'
            ? menuItems
            : menuItems.filter((item) => item.category_id === activeCategory);

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
        const itemTotalUsd = Number(selectedItemForModifier.price_usd) + extraTotal;

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
            unitPriceUsd: Number(c.menuItem.price_usd),
            station: c.menuItem.station,
            selectedModifiers: c.selectedModifiers,
            specialNotes: c.specialNotes,
        }));

        const res = await submitCustomerOrder({
            sessionId: session.id,
            items: itemsToSubmit,
        });

        setOrderSubmitting(false);

        if (res.success) {
            setCart([]);
            setIsCartOpen(false);
            setOrderSuccessMsg('Order submitted successfully! Sending to kitchen.');
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
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
            {/* Locked Screen Overlay if Pre-Bill Requested */}
            {isBillRequested && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-amber-300 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-400" />
                        <span>Pre-Bill requested. Cart submissions are temporarily locked.</span>
                    </div>
                    <button
                        onClick={() => setIsBillOpen(true)}
                        className="underline font-bold text-amber-400 hover:text-amber-200"
                    >
                        View Check
                    </button>
                </div>
            )}

            {/* Header with Official Skylight Logo */}
            <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-10 w-auto object-contain"
                    />
                    <div>
                        <h1 className="text-base font-black text-slate-100 leading-tight tracking-tight">Skylight Village</h1>
                        <p className="text-xs text-amber-400 font-bold">Table #{table?.table_number || 1}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Running Bill Button */}
                    <button
                        onClick={() => setIsBillOpen(true)}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl font-medium transition-all"
                    >
                        <Receipt className="h-4 w-4 text-amber-400" />
                        <span>{formatUsd(liveBill.finalTotalUsd)}</span>
                    </button>

                    {/* Cart Drawer Trigger */}
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold p-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                    >
                        <ShoppingBag className="h-5 w-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                                {cart.reduce((acc, c) => acc + c.quantity, 0)}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Success / Notification Banner */}
            {orderSuccessMsg && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{orderSuccessMsg}</span>
                </div>
            )}

            {serviceMessage && (
                <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 text-blue-400 text-xs font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span>{serviceMessage}</span>
                </div>
            )}
            {/* Category Navigation Bar */}
            <div className="sticky top-[60px] md:top-[61px] z-20 bg-slate-950/80 backdrop-blur-md py-3 px-4 overflow-x-auto border-b border-slate-800/80 scrollbar-none flex gap-2">
                <button
                    onClick={() => handleCategoryClick('all')}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === 'all'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                        }`}
                >
                    All Items
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu Item Grid with Category Titles & Sticky Section Headers */}
            <main className="px-4 py-6 max-w-3xl mx-auto space-y-8">
                {categories.map((cat) => {
                    const catItems = filteredMenuItems.filter((item) => item.category_id === cat.id);
                    if (catItems.length === 0) return null;

                    return (
                        <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-36">
                            {/* Sticky Category Title Header */}
                            <div className="sticky top-[115px] z-20 bg-slate-950/90 backdrop-blur-md px-4 mb-2 border-b border-amber-500/30 flex items-center justify-between shadow-md">
                                <h2 className="text-base font-black text-amber-400 flex items-center gap-2 tracking-wide">
                                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span>{cat.name}</span>
                                </h2>
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
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
                                            className={`glass-card rounded-2xl overflow-hidden flex flex-row items-center p-3 gap-3.5 transition-all group border border-slate-800/80 ${isOutOfStock
                                                ? 'opacity-50 grayscale cursor-not-allowed border-slate-800'
                                                : 'hover:border-amber-500/50 cursor-pointer active:scale-[0.99]'
                                                }`}
                                        >
                                            {/* Left Square Thumbnail Image */}
                                            <div className="relative h-24 w-24 sm:h-28 sm:w-28 bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-800">
                                                <img
                                                    src={displayImage}
                                                    alt={item.name}
                                                    className={`w-full h-full ${item.image_url ? 'object-cover' : 'object-contain p-4 opacity-40'} group-hover:scale-105 transition-transform duration-300`}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/images/Skylight-logo-icon.png';
                                                        (e.target as HTMLImageElement).className = 'w-full h-full object-contain p-4 opacity-40';
                                                    }}
                                                />
                                                {isOutOfStock && (
                                                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-[10px] font-black text-red-400">
                                                        OUT OF STOCK
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right Column: Name, Description, Price & Add Button */}
                                            <div className="flex-1 flex flex-col justify-between min-h-[96px] py-0.5">
                                                <div>
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h3 className="font-extrabold text-sm text-slate-100 leading-snug group-hover:text-amber-300 transition-colors">
                                                            {item.name}
                                                        </h3>
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-2">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between pt-1.5 mt-auto border-t border-slate-800/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-amber-400">
                                                            {formatUsd(Number(item.price_usd))}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {formatLbp(Number(item.price_usd), exchangeRate)}
                                                        </span>
                                                    </div>

                                                    {!isOutOfStock && (
                                                        <div className="bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-400 h-8 px-3 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shadow-md">
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                        {/* Header Image if available */}
                        {selectedItemForModifier.image_url && (
                            <div className="relative h-48 w-full">
                                <img
                                    src={selectedItemForModifier.image_url}
                                    alt={selectedItemForModifier.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                            </div>
                        )}

                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-100">{selectedItemForModifier.name}</h3>
                                    <p className="text-sm text-amber-400 font-bold mt-0.5">
                                        {formatUsd(Number(selectedItemForModifier.price_usd))} &bull;{' '}
                                        {formatLbp(Number(selectedItemForModifier.price_usd), exchangeRate)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedItemForModifier(null)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-2 rounded-full transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {selectedItemForModifier.description && (
                                <p className="text-slate-400 text-xs mb-6 leading-relaxed">{selectedItemForModifier.description}</p>
                            )}

                            {/* Modifier Groups */}
                            {(selectedItemForModifier.modifier_groups || []).map((group: ModifierGroup) => (
                                <div key={group.group_name} className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                            {group.group_name}
                                        </label>
                                        {group.required && (
                                            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
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
                                                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                                                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <span>{opt.name}</span>
                                                    {opt.price_extra_usd > 0 && (
                                                        <span className="text-amber-400">+{formatUsd(opt.price_extra_usd)}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Special Instructions Note */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                                    Special Requests / Notes
                                </label>
                                <textarea
                                    value={specialNotes}
                                    onChange={(e) => setSpecialNotes(e.target.value)}
                                    placeholder="e.g. Extra garlic, sauce on the side, well done..."
                                    rows={2}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <button
                                onClick={handleAddToCart}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20"
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
                    <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
                        <div>
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="h-5 w-5 text-amber-400" />
                                    <h3 className="text-base font-extrabold text-slate-100">Your Current Cart</h3>
                                </div>
                                <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Your cart is currently empty.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, index) => (
                                        <div key={index} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                            <div className="flex justify-between items-start">
                                                <div className="font-bold text-sm text-slate-100">{item.menuItem.name}</div>
                                                <div className="text-xs font-bold text-amber-400">
                                                    {formatUsd(item.itemTotalUsd * item.quantity)}
                                                </div>
                                            </div>

                                            {item.selectedModifiers.length > 0 && (
                                                <div className="text-[11px] text-slate-400 mt-1">
                                                    {item.selectedModifiers.map((m) => `${m.group}: ${m.option}`).join(', ')}
                                                </div>
                                            )}

                                            {item.specialNotes && (
                                                <div className="text-[11px] text-amber-400/80 mt-0.5 italic">
                                                    Note: {item.specialNotes}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (item.quantity > 1) {
                                                                const newCart = [...cart];
                                                                newCart[index].quantity -= 1;
                                                                setCart(newCart);
                                                            }
                                                        }}
                                                        className="h-6 w-6 bg-slate-900 text-slate-300 border border-slate-800 rounded flex items-center justify-center text-xs"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="text-xs text-slate-200 font-bold">{item.quantity}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newCart = [...cart];
                                                            newCart[index].quantity += 1;
                                                            setCart(newCart);
                                                        }}
                                                        className="h-6 w-6 bg-slate-900 text-slate-300 border border-slate-800 rounded flex items-center justify-center text-xs"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
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
                            <div className="pt-4 border-t border-slate-800 mt-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-400">Subtotal USD:</span>
                                    <span className="text-sm font-bold text-slate-100">{formatUsd(cartSubtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs text-slate-400">Subtotal LBP:</span>
                                    <span className="text-xs font-bold text-amber-400">
                                        {formatLbp(cartSubtotal, exchangeRate)}
                                    </span>
                                </div>

                                {isBillRequested ? (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl text-center font-semibold mb-2">
                                        Pre-Bill generated. Contact server to add items.
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleOrderSubmit}
                                        disabled={orderSubmitting}
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>{orderSubmitting ? 'Sending...' : 'Submit Order to Kitchen'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Running Bill Drawer */}
            {isBillOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
                    <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
                        <div>
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-amber-400" />
                                    <h3 className="text-base font-extrabold text-slate-100">Live Table Session Bill</h3>
                                </div>
                                <button onClick={() => setIsBillOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {liveOrderItems.length === 0 ? (
                                <p className="text-center py-12 text-slate-500 text-sm">No items ordered yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {liveOrderItems.map((item) => {
                                        const statusColors = {
                                            pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                                            preparing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                            ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                                            delivered: 'bg-slate-800 text-slate-400 border-slate-700',
                                            cancelled: 'bg-red-500/20 text-red-400 border-red-500/30 line-through',
                                        };

                                        return (
                                            <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-slate-100 text-xs">
                                                            {item.quantity}x {item.item_name}
                                                        </span>
                                                        {item.is_comped && (
                                                            <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                                                COMPED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-400">
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
                                                    <span className="text-[10px] text-slate-500">
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

                        <div className="pt-4 border-t border-slate-800 mt-6 space-y-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Subtotal:</span>
                                <span>{formatUsd(liveBill.subtotalUsd)}</span>
                            </div>
                            {liveBill.discountUsd > 0 && (
                                <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                                    <span>Discounts Applied:</span>
                                    <span>-{formatUsd(liveBill.discountUsd)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-extrabold text-slate-100 pt-1 border-t border-slate-800">
                                <span>TOTAL USD:</span>
                                <span>{formatUsd(liveBill.finalTotalUsd)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-amber-400">
                                <span>TOTAL LBP ({exchangeRate}):</span>
                                <span>{liveBill.finalTotalLbp}</span>
                            </div>

                            <button
                                onClick={() => handleCallWaiter('bill')}
                                className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs border border-slate-700 transition-all"
                            >
                                <Receipt className="h-4 w-4" />
                                <span>Request Final Check from Waiter</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Action Button (FAB) - Service Bell */}
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => setIsServiceBellOpen(!isServiceBellOpen)}
                    className="bg-gradient-to-tr from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-slate-950 p-4 rounded-2xl shadow-2xl shadow-amber-500/30 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                    <Bell className="h-6 w-6" />
                </button>

                {/* Service Options Popover */}
                {isServiceBellOpen && (
                    <div className="absolute bottom-16 right-0 w-64 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1">
                            Call Service
                        </div>
                        <button
                            onClick={() => handleCallWaiter('waiter')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center gap-2.5 transition-colors"
                        >
                            <Bell className="h-4 w-4 text-amber-400" />
                            <span>Call Waiter</span>
                        </button>
                        <button
                            onClick={() => handleCallWaiter('charcoal')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center gap-2.5 transition-colors"
                        >
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span>Request Charcoal Change</span>
                        </button>
                        <button
                            onClick={() => handleCallWaiter('bill')}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center gap-2.5 transition-colors"
                        >
                            <Receipt className="h-4 w-4 text-emerald-400" />
                            <span>Request Bill</span>
                        </button>
                    </div>
                )}
                {/* Added Item Toast Confirmation Banner */}
                {addedToastMsg && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black text-xs px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-amber-300 animate-in fade-in slide-in-from-bottom-4">
                        <CheckCircle2 className="h-4 w-4 text-slate-950" />
                        <span>{addedToastMsg}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
