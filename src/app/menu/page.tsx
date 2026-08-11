'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MenuCategory, MenuItem, getMenuItemPrice } from '@/lib/types';
import { formatUsd, formatLbp } from '@/lib/currency';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { getPublicViewOnlyMenuData } from '../actions/order-actions';
import {
  Utensils,
  Search,
  Share2,
  PhoneCall,
  Sparkles,
  Info,
  ChevronRight,
  Flame,
  Wine,
  Coffee,
  X,
} from 'lucide-react';

function ViewOnlyMenuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get('mode') === 'camping' ? 'camping' : 'dine_in';

  const [menuMode, setMenuMode] = useState<'dine_in' | 'camping'>(initialMode);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(89500);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    getPublicViewOnlyMenuData().then((data) => {
      setCategories(data.categories || []);
      setMenuItems(data.menuItems || []);
      setExchangeRate(data.exchangeRate || 89500);
      setLoading(false);
    });
  }, []);

  // Sync mode parameter when tab changes
  const handleSwitchMode = (mode: 'dine_in' | 'camping') => {
    setMenuMode(mode);
    router.replace(`/menu?mode=${mode}`);
  };

  // Filtered Menu Items
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getPrice = (item: MenuItem) => {
    return getMenuItemPrice(item, menuMode);
  };

  const currentShareUrl = typeof window !== 'undefined' ? `${window.location.origin}/menu?mode=${menuMode}` : '';

  const handleShareWhatsApp = () => {
    const modeName = menuMode === 'camping' ? 'Camping & Picnic' : 'Restaurant Dine-In';
    const text = encodeURIComponent(`🌟 Skylight Village Digital Menu (${modeName} Pricing):\n${currentShareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] font-sans antialiased pb-16">
      {/* Top Brand & Title Bar */}
      <header className="bg-[#1c3a1e] text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#d4af37]/20 border border-[#d4af37]/40 rounded-2xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#d4af37]" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Skylight Village</span>
                <span className="text-[10px] bg-[#d4af37] text-[#1c3a1e] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Menu
                </span>
              </h1>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                {menuMode === 'camping' ? '🏕️ Camping & Picnic Pricing' : '🍽️ Restaurant Dine-In Pricing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="bg-[#25D366] hover:bg-[#1ebd59] text-white font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Share Menu on WhatsApp"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Dual Pricing Mode Tabs Switcher */}
        <div className="bg-[#152e17] border-t border-[#d4af37]/20 px-4 py-2">
          <div className="max-w-md mx-auto grid grid-cols-2 gap-2 p-1 bg-[#1c3a1e] rounded-2xl border border-white/10">
            <button
              onClick={() => handleSwitchMode('dine_in')}
              className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                menuMode === 'dine_in'
                  ? 'bg-[#d4af37] text-[#1c3a1e] shadow-md scale-[1.02]'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>🍽️ Restaurant Menu</span>
            </button>

            <button
              onClick={() => handleSwitchMode('camping')}
              className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                menuMode === 'camping'
                  ? 'bg-amber-600 text-white shadow-md scale-[1.02]'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>🏕️ Camping Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info Notice Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs font-bold text-amber-900">
        ℹ️ View-only digital menu for browsing prices. USD/LBP exchange rate fixed at <strong>{exchangeRate.toLocaleString()} LBP</strong>.
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search appetizers, grills, cold drinks..."
            className="w-full bg-white border border-[#1c3a1e]/15 rounded-2xl pl-10 pr-8 py-3 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] shadow-xs font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sticky Category Scroll Bar */}
        <div className="sticky top-[115px] z-20 bg-[#fafbfa]/95 backdrop-blur-md py-2 overflow-x-auto border-b border-[#1c3a1e]/10 scrollbar-none flex items-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#1c3a1e] text-white shadow-xs'
                : 'bg-white text-gray-700 border border-[#1c3a1e]/15 hover:bg-gray-50'
            }`}
          >
            All Categories ({menuItems.length})
          </button>
          {categories.map((cat) => {
            const count = menuItems.filter((m) => m.category_id === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1c3a1e] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-[#1c3a1e]/15 hover:bg-gray-50'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="h-10 w-10 border-4 border-[#1c3a1e] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-[#1c3a1e]">Loading Skylight Menu...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-2 bg-white rounded-3xl border border-[#1c3a1e]/15 p-6">
            <Utensils className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-600">No menu items found matching "{searchQuery}"</p>
          </div>
        ) : (
          /* Dish Items Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const priceUsd = getPrice(item);
              const priceLbp = formatLbp(priceUsd, exchangeRate);
              const imgUrl = item.image_url ? transformGoogleDriveUrl(item.image_url) : null;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemDetail(item)}
                  className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between gap-4 cursor-pointer"
                >
                  <div className="flex-1 space-y-2 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-black text-[#1c3a1e] tracking-tight">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1 font-medium leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black text-[#1c3a1e]">{formatUsd(priceUsd)}</span>
                        <span className="text-xs font-bold text-[#d4af37]">{priceLbp}</span>
                      </div>
                      {item.modifier_groups && item.modifier_groups.length > 0 && (
                        <span className="inline-block mt-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-500/20 px-2 py-0.5 rounded-md font-extrabold">
                          ✨ Custom Modifiers Available
                        </span>
                      )}
                    </div>
                  </div>

                  {imgUrl ? (
                    <div className="h-24 w-24 rounded-2xl overflow-hidden shrink-0 border border-gray-100 shadow-xs">
                      <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-2xl bg-[#eaf2eb] flex items-center justify-center shrink-0 border border-[#1c3a1e]/10">
                      <Utensils className="h-8 w-8 text-[#1c3a1e]/40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

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
                    <span className="text-xs font-black text-emerald-950 block">{group.title}</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {group.options.map((opt: any, oIdx: number) => (
                        <span key={oIdx} className="text-[11px] font-bold bg-white text-emerald-900 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                          {opt.name} {opt.price_extra ? `(+${formatUsd(opt.price_extra)})` : ''}
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
