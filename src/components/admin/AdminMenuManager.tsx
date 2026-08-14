'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MenuItem, MenuCategory } from '@/lib/types';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { updateMenuItem, deleteMenuItem } from '@/app/actions/admin-actions';
import { Search, PlusCircle, ImageIcon, Edit3, Trash2 } from 'lucide-react';

interface AdminMenuManagerProps {
    categories: MenuCategory[];
    menuItems: MenuItem[];
    refreshPOSData: () => void;
    onOpenAddItemModal: () => void;
    onOpenEditModal: (item: MenuItem) => void;
}

export const AdminMenuManager: React.FC<AdminMenuManagerProps> = ({
    categories,
    menuItems,
    refreshPOSData,
    onOpenAddItemModal,
    onOpenEditModal,
}) => {
    const [menuSearchTerm, setMenuSearchTerm] = useState('');

    return (
        <div className="space-y-6">
            {/* Search Bar & Action Buttons Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-[#1c3a1e]">
                        Skylight Village Menu Items ({menuItems.length})
                    </h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Edit dish details, prices, Google Drive images, or add new items
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search items by name, category..."
                            value={menuSearchTerm}
                            onChange={(e) => setMenuSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] transition-all shadow-xs"
                        />
                    </div>

                    <button
                        onClick={onOpenAddItemModal}
                        className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                    >
                        <PlusCircle className="h-4 w-4" />
                        <span>Add New Menu Item</span>
                    </button>
                </div>
            </div>

            {/* Category Sections & Items Grid */}
            <div className="space-y-6">
                {categories.map((cat) => {
                    const catItems = menuItems.filter((item) => {
                        if (item.category_id !== cat.id) return false;
                        const term = menuSearchTerm.toLowerCase().trim();
                        if (!term) return true;
                        return (
                            item.name.toLowerCase().includes(term) ||
                            (item.description && item.description.toLowerCase().includes(term)) ||
                            cat.name.toLowerCase().includes(term)
                        );
                    });

                    if (catItems.length === 0 && menuSearchTerm) return null;

                    return (
                        <div key={cat.id} className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs">
                            {/* Category Header */}
                            <div className="flex items-center justify-between border-b border-[#1c3a1e]/15 pb-3 mb-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-3 w-3 rounded-full bg-[#d4af37] animate-pulse" />
                                    <h2 className="text-base font-black text-[#1c3a1e] tracking-tight">{cat.name}</h2>
                                </div>
                                <span className="text-xs font-extrabold text-[#1c3a1e] bg-[#eaf2eb] px-3 py-1 rounded-full border border-[#1c3a1e]/10">
                                    {catItems.length} {catItems.length === 1 ? 'dish' : 'dishes'}
                                </span>
                            </div>

                            {/* Items Grid */}
                            {catItems.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {catItems.map((item) => {
                                        const displayImage = transformGoogleDriveUrl(item.image_url || '');

                                        return (
                                            <div
                                                key={item.id}
                                                className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all text-[#1c3a1e]"
                                            >
                                                <div>
                                                    <div className="flex gap-3 mb-3">
                                                         {displayImage ? (
                                                             <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-[#1c3a1e]/15 flex-shrink-0">
                                                                 <Image
                                                                     src={displayImage}
                                                                     alt={item.name}
                                                                     fill
                                                                     unoptimized
                                                                     className="object-cover"
                                                                 />
                                                             </div>
                                                         ) : (
                                                            <div className="h-14 w-14 rounded-2xl bg-white border border-[#1c3a1e]/15 flex items-center justify-center flex-shrink-0">
                                                                <ImageIcon className="h-6 w-6 text-[#1c3a1e]/40" />
                                                            </div>
                                                        )}

                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-[10px] font-black text-[#1c3a1e] uppercase tracking-widest bg-[#eaf2eb] px-2 py-0.5 rounded-lg border border-[#1c3a1e]/15">
                                                                        {cat.name}
                                                                    </span>
                                                                    {item.is_bestseller && (
                                                                        <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider bg-amber-400/20 px-1.5 py-0.5 rounded-lg border border-amber-400/40">
                                                                            ⭐ Speciality
                                                                        </span>
                                                                    )}
                                                                    {item.is_staff_only && (
                                                                        <span className="text-[9px] font-black text-purple-800 uppercase tracking-wider bg-purple-500/10 px-1.5 py-0.5 rounded-lg border border-purple-500/30">
                                                                            🔒 Staff-Only
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    onClick={async () => {
                                                                        await updateMenuItem(item.id, { available: !item.available });
                                                                        refreshPOSData();
                                                                    }}
                                                                    title="Click to toggle Available vs Sold Out"
                                                                    className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 border shadow-xs transition-all cursor-pointer ${item.available
                                                                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:scale-105'
                                                                            : 'bg-red-600 text-white border-red-700 hover:bg-red-700 hover:scale-105'
                                                                        }`}
                                                                >
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                                    <span>{item.available ? 'AVAILABLE' : 'SOLD OUT'}</span>
                                                                </button>
                                                            </div>

                                                            <h3 className="text-base font-black text-[#1c3a1e] mt-1 leading-tight">{item.name}</h3>
                                                        </div>
                                                    </div>

                                                    {item.description && (
                                                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                                                    )}

                                                    <div className="text-[11px] text-gray-500 font-semibold mb-2 flex items-center gap-3">
                                                        <span>
                                                            Station: <strong className="text-[#1c3a1e] uppercase">{item.station.replace('_', ' ')}</strong>
                                                        </span>
                                                        <span>
                                                            Sort #: <strong className="text-[#1c3a1e]">{item.sort_order ?? 0}</strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Actions Footer */}
                                                <div className="pt-3 border-t border-[#1c3a1e]/10 flex items-center justify-between mt-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[#1c3a1e] font-black text-sm">
                                                            ${Number(item.price_usd).toFixed(2)} <span className="text-[10px] font-bold text-gray-500 uppercase">Dine-In</span>
                                                        </span>
                                                        <span className="text-emerald-800 font-extrabold text-xs">
                                                            ${Number(item.price_camping_usd ?? item.price_usd).toFixed(2)} <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">🏕️ Camping</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => onOpenEditModal(item)}
                                                            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                            <span>Edit Dish</span>
                                                        </button>

                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Delete "${item.name}" from menu?`)) {
                                                                    await deleteMenuItem(item.id);
                                                                    refreshPOSData();
                                                                }
                                                            }}
                                                            className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors cursor-pointer"
                                                            title="Delete Item"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-xs text-gray-500 italic">
                                    No dishes found in this category.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
