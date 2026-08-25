'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MenuCategory, MenuItem, getMenuItemPrice } from '@/lib/types';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { Search, ImageIcon, Plus, Loader2 } from 'lucide-react';

interface POSMenuGridProps {
    categories: MenuCategory[];
    menuItems: MenuItem[];
    onSelectItemForCart: (item: MenuItem) => void;
    addingItemId?: string | null;
    activeOrderType?: string;
}

export const POSMenuGrid: React.FC<POSMenuGridProps> = ({
    categories,
    menuItems,
    onSelectItemForCart,
    addingItemId = null,
    activeOrderType,
}) => {
    const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredItems = menuItems.filter((item) => {
        if (selectedCatFilter !== 'all' && item.category_id !== selectedCatFilter) return false;
        const term = searchQuery.toLowerCase().trim();
        if (!term) return true;
        return (
            item.name.toLowerCase().includes(term) ||
            (item.description && item.description.toLowerCase().includes(term))
        );
    });

    return (
        <div className="space-y-4">
            {/* Category Pills Bar & Search Input */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full pb-1 whitespace-nowrap">
                    <button
                        onClick={() => setSelectedCatFilter('all')}
                        className={`px-5 py-3.5 min-h-[52px] rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer border flex items-center gap-2 touch-manipulation active:scale-95 ${selectedCatFilter === 'all'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/30'
                            : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                            }`}
                    >
                        <span className="text-base">🍽️</span>
                        <span>All Dishes ({menuItems.length})</span>
                    </button>

                    {categories.map((c) => {
                        const icon =
                            c.name.toLowerCase().includes('cold') ? '🥗' :
                                c.name.toLowerCase().includes('hot') ? '🧆' :
                                    c.name.toLowerCase().includes('salad') ? '🥬' :
                                        c.name.toLowerCase().includes('sajj') ? '🥙' :
                                            c.name.toLowerCase().includes('bbq') || c.name.toLowerCase().includes('grill') ? '🥩' :
                                                c.name.toLowerCase().includes('sub') || c.name.toLowerCase().includes('sandwich') ? '🍔' :
                                                    c.name.toLowerCase().includes('bar') || c.name.toLowerCase().includes('drink') || c.name.toLowerCase().includes('beverage') ? '🍹' :
                                                        c.name.toLowerCase().includes('shisha') ? '💨' : '🍽️';

                        return (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCatFilter(c.id)}
                                className={`px-5 py-3.5 min-h-[52px] rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer border flex items-center gap-2 touch-manipulation active:scale-95 ${selectedCatFilter === c.id
                                    ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/30'
                                    : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                                    }`}
                            >
                                <span className="text-base">{icon}</span>
                                <span>{c.name}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search food & drinks..."
                        className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] shadow-xs"
                    />
                </div>
            </div>

            {/* Dish Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[62vh] overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                    const displayImage = transformGoogleDriveUrl(item.image_url || '');
                    const isAddingThis = addingItemId === item.id;

                    return (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (!isAddingThis) onSelectItemForCart(item);
                            }}
                            className={`bg-white border-2 border-[#1c3a1e]/15 hover:border-[#1c3a1e] rounded-3xl p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden touch-manipulation active:scale-[0.98] min-h-[155px] ${isAddingThis ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50' : ''
                                }`}
                        >
                            <div>
                                <div className="w-full h-28 rounded-2xl bg-[#fafbfa] border border-[#1c3a1e]/10 overflow-hidden mb-2 relative flex items-center justify-center">
                                    {displayImage ? (
                                        <Image
                                            src={displayImage}
                                            alt={item.name}
                                            fill
                                            unoptimized
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon className="h-7 w-7 opacity-40 mb-1" />
                                            <span className="text-xs font-black uppercase text-[#1c3a1e]/60">
                                                {item.name.charAt(0)}
                                            </span>
                                        </div>
                                    )}

                                    {item.is_bestseller && (
                                        <span className="absolute top-1.5 left-1.5 text-[9px] font-black text-amber-900 bg-amber-400 px-2 py-0.5 rounded-md shadow-xs">
                                            ⭐ Chef's Special
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-black text-sm sm:text-base text-[#1c3a1e] line-clamp-1 group-hover:text-[#d4af37] transition-colors leading-tight">
                                    {item.name}
                                </h3>
                                <span className="text-[10px] font-extrabold text-gray-500 uppercase block mt-0.5">
                                    Station: {item.station}
                                </span>
                            </div>

                             <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-[#1c3a1e]/10">
                                <span className="font-black text-sm sm:text-base text-[#1c3a1e]">
                                    ${getMenuItemPrice(item, activeOrderType).toFixed(2)}
                                    {activeOrderType === 'camping' && (
                                        <span className="ml-1 text-[9px] text-emerald-800 font-bold bg-emerald-100 px-1 py-0.5 rounded">Camping</span>
                                    )}
                                </span>
                                <button className="bg-[#1c3a1e] group-hover:bg-[#d4af37] group-hover:text-[#1c3a1e] text-white h-9 w-9 rounded-xl transition-all flex items-center justify-center shadow-xs active:scale-95">
                                    {isAddingThis ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                                    ) : (
                                        <Plus className="h-4.5 w-4.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
