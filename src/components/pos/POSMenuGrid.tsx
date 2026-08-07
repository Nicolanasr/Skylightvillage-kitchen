'use client';

import React, { useState } from 'react';
import { MenuCategory, MenuItem } from '@/lib/types';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { Search, ImageIcon, Plus, Loader2 } from 'lucide-react';

interface POSMenuGridProps {
    categories: MenuCategory[];
    menuItems: MenuItem[];
    onSelectItemForCart: (item: MenuItem) => void;
    addingItemId?: string | null;
}

export const POSMenuGrid: React.FC<POSMenuGridProps> = ({
    categories,
    menuItems,
    onSelectItemForCart,
    addingItemId = null,
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
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedCatFilter('all')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${selectedCatFilter === 'all'
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                            : 'bg-white text-gray-800 border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                            }`}
                    >
                        <span>🍽️</span>
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
                                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${selectedCatFilter === c.id
                                    ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md ring-2 ring-[#1c3a1e]/20'
                                    : 'bg-white text-gray-800 border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
                                    }`}
                            >
                                <span>{icon}</span>
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
                            className={`bg-white border border-[#1c3a1e]/15 hover:border-[#1c3a1e] rounded-2xl p-3 flex flex-col justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden ${isAddingThis ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
                                }`}
                        >
                            <div>
                                <div className="w-full h-24 rounded-xl bg-[#fafbfa] border border-[#1c3a1e]/10 overflow-hidden mb-2 relative flex items-center justify-center">
                                    {displayImage ? (
                                        <img
                                            src={displayImage}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon className="h-6 w-6 opacity-40 mb-1" />
                                            <span className="text-[10px] font-black uppercase text-[#1c3a1e]/60">
                                                {item.name.charAt(0)}
                                            </span>
                                        </div>
                                    )}

                                    {item.is_bestseller && (
                                        <span className="absolute top-1.5 left-1.5 text-[9px] font-black text-amber-900 bg-amber-400 px-1.5 py-0.5 rounded-md shadow-xs">
                                            ⭐ Chef's Special
                                        </span>
                                    )}
                                </div>

                                <h3 className=" font-black text-sm text-[#1c3a1e] line-clamp-1 group-hover:text-[#d4af37] transition-colors">
                                    {item.name}
                                </h3>
                                <span className="text-[10px] font-bold text-gray-500 uppercase block">
                                    Station: {item.station}
                                </span>
                            </div>

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#1c3a1e]/10">
                                <span className="font-black text-[#1c3a1e]">
                                    ${Number(item.price_usd).toFixed(2)}
                                </span>
                                <button className="bg-[#1c3a1e] group-hover:bg-[#d4af37] group-hover:text-[#1c3a1e] text-white p-1.5 rounded-lg transition-colors flex items-center justify-center">
                                    {isAddingThis ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                                    ) : (
                                        <Plus className="h-3.5 w-3.5" />
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
