'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MenuCategory, MenuItem, getMenuItemPrice } from '@/lib/types';
import { formatUsd, formatLbp } from '@/lib/currency';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { getPublicViewOnlyMenuData } from '../actions/order-actions';
import { submitCustomerFeedbackAction } from '../actions/report-actions';
import {
    HelpCircle,
    Star,
    CheckCircle2,
    X,
    Utensils,
    Search,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react';

function ViewOnlyMenuContent() {
    const searchParams = useSearchParams();
    const menuMode = searchParams.get('mode') === 'camping' ? 'camping' : 'dine_in';

    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(89500);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);

    // Guide & Rating Modal States
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [guideStep, setGuideStep] = useState(0);
    const [guideLang, setGuideLang] = useState<'en' | 'ar'>('en');

    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [ratingValue, setRatingValue] = useState(5);
    const [ratingTags, setRatingTags] = useState<string[]>(['Fast Service', 'Delicious Food']);
    const [ratingComment, setRatingComment] = useState('');
    const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    useEffect(() => {
        getPublicViewOnlyMenuData().then((data) => {
            setCategories(data.categories || []);
            setMenuItems(data.menuItems || []);
            setExchangeRate(data.exchangeRate || 89500);
            setLoading(false);
        });
    }, []);

    const handleCategoryClick = (catId: string) => {
        setActiveCategory(catId);
        if (catId === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            const el = document.getElementById(`category-${catId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    const getPrice = (item: MenuItem) => {
        return getMenuItemPrice(item, menuMode);
    };

    return (
        <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] font-sans antialiased">
            {/* Header with Official Skylight Logo - Identical to /order page */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1c3a1e]/10 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <img
                        src="/images/Skylight-logo-icon.png"
                        alt="Skylight Village Logo"
                        className="h-10 w-auto object-contain filter invert"
                    />
                    <div>
                        <h1 className="text-base font-black text-[#1c3a1e] leading-tight tracking-tight">Skylight Village</h1>
                        <p className="text-xs text-[#d4af37] font-bold">
                            {menuMode === 'camping' ? ' Camping & Picnic Menu' : 'Restaurant Menu'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Ordering Guide Button */}
                    <button
                        onClick={() => {
                            setGuideStep(0);
                            setIsGuideOpen(true);
                        }}
                        className="flex items-center gap-1.5 bg-[#eaf2eb] border border-[#1c3a1e]/15 hover:border-[#1c3a1e]/30 text-[#1c3a1e] text-xs px-2.5 py-2 rounded-xl font-bold transition-all cursor-pointer"
                        title="View Menu Guide"
                    >
                        <HelpCircle className="h-4 w-4 text-[#1c3a1e]" />
                        <span className="hidden sm:inline">Guide</span>
                    </button>

                    {/* Google Review Button */}
                    <a
                        href="https://g.page/r/CVjTZaAHNiz0EAI/review"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-[#faf5e6] border border-[#d4af37]/40 hover:border-[#d4af37] text-[#997a15] text-xs px-3 py-2 rounded-xl font-bold transition-all"
                        title="Leave us a Google Review!"
                    >
                        <Star className="h-4 w-4 fill-[#d4af37] text-[#d4af37]" />
                        <span className="hidden sm:inline">Review Us</span>
                    </a>
                </div>
            </header>

            {/* Category Navigation Bar - Identical to /order page */}
            <div className="sticky top-[61px] z-[21] bg-[#fafbfa]/95 backdrop-blur-md py-3 px-4 overflow-x-auto border-b border-[#1c3a1e]/10 scrollbar-none flex gap-2">
                <button
                    onClick={() => handleCategoryClick('all')}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${activeCategory === 'all'
                            ? 'bg-[#1c3a1e] text-white shadow-md'
                            : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
                        }`}
                >
                    All Items
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${activeCategory === cat.id
                                ? 'bg-[#1c3a1e] text-white shadow-md'
                                : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Loading Spinner */}
            {loading ? (
                <div className="py-20 text-center space-y-3">
                    <div className="h-10 w-10 border-4 border-[#1c3a1e] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-extrabold text-[#1c3a1e]">Loading Skylight Menu...</p>
                </div>
            ) : (
                /* Menu Item Grid with Category Titles & Sticky Section Headers - Identical to /order page */
                <main className="px-4 py-6 max-w-3xl mx-auto space-y-8">
                    {categories.map((cat) => {
                        const catItems = menuItems
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
                                <div className="sticky top-[115px] z-20 bg-[#fafbfa]/95 backdrop-blur-md px-4 py-1.5 mb-2 border-b border-[#1c3a1e]/15 flex items-center justify-between shadow-sm">
                                    <h2 className="text-base font-black text-[#1c3a1e] flex items-center gap-2 tracking-wide">
                                        <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-pulse" />
                                        <span>{cat.name}</span>
                                    </h2>
                                    <span className="text-[11px] font-bold text-[#1c3a1e] bg-[#eaf2eb] px-2.5 py-1 rounded-full border border-[#1c3a1e]/10">
                                        {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>

                                {/* Category Items List (Horizontal Row Layout) - Identical to /order page */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {catItems.map((item) => {
                                        const isOutOfStock = !item.available;
                                        const priceUsd = getPrice(item);
                                        const priceLbp = formatLbp(priceUsd, exchangeRate);
                                        const displayImage = transformGoogleDriveUrl(item.image_url || '') || '/images/Skylight-logo-icon.png';

                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setSelectedItemDetail(item)}
                                                className={`bg-white rounded-2xl overflow-hidden flex flex-row items-center p-3 gap-3.5 transition-all group border border-[#1c3a1e]/10 shadow-sm ${isOutOfStock
                                                        ? 'opacity-50 grayscale cursor-not-allowed border-[#1c3a1e]/10'
                                                        : 'hover:border-[#d4af37] hover:shadow-md cursor-pointer active:scale-[0.99]'
                                                    }`}
                                            >
                                                {/* Left Square Thumbnail Image */}
                                                <div className="relative h-24 w-24 sm:h-28 sm:w-28 bg-[#f4f7f4] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#1c3a1e]/10">
                                                    <img
                                                        src={displayImage}
                                                        alt={item.name}
                                                        className={`w-full h-full ${item.image_url ? 'object-cover' : 'object-contain p-4 opacity-50 filter invert'
                                                            } group-hover:scale-105 transition-transform duration-300`}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '/images/Skylight-logo-icon.png';
                                                            (e.target as HTMLImageElement).className = 'w-full h-full object-contain p-4 opacity-50';
                                                        }}
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

                                                {/* Right Column: Name, Description, Price */}
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

                                                    <div className="flex items-baseline justify-between pt-1 border-t border-[#1c3a1e]/10 mt-1">
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="font-black text-sm text-[#1c3a1e]">{formatUsd(priceUsd)}</span>
                                                            <span className="text-xs font-bold text-[#d4af37]">{priceLbp}</span>
                                                        </div>
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
            )}

            {/* Item Detail Modal */}
            {selectedItemDetail && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-[#1c3a1e] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black">{selectedItemDetail.name}</h3>
                                <span className="text-xs font-bold text-[#d4af37]">
                                    {formatUsd(getPrice(selectedItemDetail))} • {formatLbp(getPrice(selectedItemDetail), exchangeRate)}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedItemDetail(null)}
                                className="text-gray-400 hover:text-black font-bold p-1 cursor-pointer"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {selectedItemDetail.image_url && (
                            <div className="h-56 w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                                <img
                                    src={transformGoogleDriveUrl(selectedItemDetail.image_url)}
                                    alt={selectedItemDetail.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        )}

                        {selectedItemDetail.description && (
                            <div className="bg-[#fafbfa] p-3 rounded-2xl border border-gray-200">
                                <span className="text-[10px] font-extrabold uppercase text-gray-500 block mb-1">Description</span>
                                <p className="text-xs text-gray-700 font-medium leading-relaxed">{selectedItemDetail.description}</p>
                            </div>
                        )}

                        {selectedItemDetail.modifier_groups && selectedItemDetail.modifier_groups.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <span className="text-xs font-extrabold uppercase text-[#1c3a1e] block">Available Options & Add-ons:</span>
                                {selectedItemDetail.modifier_groups.map((group: any, idx: number) => (
                                    <div key={idx} className="bg-emerald-50/60 border border-emerald-500/20 p-3 rounded-2xl space-y-1">
                                        <span className="text-xs font-black text-emerald-950 block">{group.group_name || group.title}</span>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {group.options.map((opt: any, oIdx: number) => (
                                                <span key={oIdx} className="text-[11px] font-bold bg-white text-emerald-900 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                                                    {opt.name || opt.option} {opt.price_extra_usd || opt.price_extra ? `(+${formatUsd(opt.price_extra_usd || opt.price_extra)})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setSelectedItemDetail(null)}
                            className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer mt-2"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            )}

            {/* Guide Modal */}
            {isGuideOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/20 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] relative">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-black text-[#1c3a1e]">Digital Menu Guide</h3>
                            <button onClick={() => setIsGuideOpen(false)} className="text-gray-400 hover:text-black">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                            Browse dishes, appetizers, drinks, and shisha prices in real time. Use the category pills at the top to jump directly to any category. Tap any dish card to view ingredients and available customization options!
                        </p>
                        <button
                            onClick={() => setIsGuideOpen(false)}
                            className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs mt-4"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {isRatingModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-[#1c3a1e]">
                        <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                            <div className="flex items-center gap-2">
                                <div className="h-9 w-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                    <Star className="h-5 w-5 fill-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Rate Your Experience</h3>
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

                                <button
                                    disabled={isSubmittingFeedback}
                                    onClick={async () => {
                                        setIsSubmittingFeedback(true);
                                        const res = await submitCustomerFeedbackAction({
                                            tableNumber: 1,
                                            rating: ratingValue,
                                            tags: ratingTags,
                                            comment: ratingComment,
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
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ViewOnlyMenuPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] flex items-center justify-center font-bold">
                    Loading Skylight Village Digital Menu...
                </div>
            }
        >
            <ViewOnlyMenuContent />
        </Suspense>
    );
}
