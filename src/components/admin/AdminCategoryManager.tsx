'use client';

import React, { useState } from 'react';
import { MenuCategory, MenuItem, ChannelType } from '@/lib/types';
import { createCategory, deleteCategory, updateCategory, toggleCategoryAvailabilityAction, updateCategoryVisibilityChannelsAction } from '@/app/actions/admin-actions';
import { PlusCircle, Trash2, Edit3, Check, X, Eye, EyeOff } from 'lucide-react';

interface AdminCategoryManagerProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  refreshPOSData: () => void;
}

const CHANNELS: { id: ChannelType; label: string; icon: string }[] = [
  { id: 'dine_in', label: 'Dine-In (QR)', icon: '🍽️' },
  { id: 'takeout', label: 'Takeout', icon: '🛍️' },
  { id: 'camping', label: 'Camping', icon: '⛺' },
  { id: 'pos', label: 'Waiter POS', icon: '🖥️' },
];

export const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({
  categories,
  menuItems,
  refreshPOSData,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatChannels, setNewCatChannels] = useState<ChannelType[]>(['dine_in', 'takeout', 'camping', 'pos']);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState<number>(0);
  const [editChannels, setEditChannels] = useState<ChannelType[]>([]);

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await createCategory(newCatName.trim(), newCatChannels);
    setNewCatName('');
    setNewCatChannels(['dine_in', 'takeout', 'camping', 'pos']);
    refreshPOSData();
  };

  const handleStartEdit = (cat: MenuCategory) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sort_order || 0);
    setEditChannels(cat.visible_channels && cat.visible_channels.length > 0 ? cat.visible_channels : ['dine_in', 'takeout', 'camping', 'pos']);
  };

  const handleSaveEdit = async (catId: string) => {
    if (!editName.trim()) return;
    await updateCategory(catId, editName.trim(), editSortOrder, editChannels);
    setEditingCatId(null);
    refreshPOSData();
  };

  const handleToggleChannelDirectly = async (cat: MenuCategory, channelId: ChannelType) => {
    const currentChannels: ChannelType[] = cat.visible_channels && cat.visible_channels.length > 0
      ? (cat.visible_channels as ChannelType[])
      : ['dine_in', 'takeout', 'camping', 'pos'];

    const newChannels = currentChannels.includes(channelId)
      ? currentChannels.filter((c) => c !== channelId)
      : [...currentChannels, channelId];

    await updateCategoryVisibilityChannelsAction(cat.id, newChannels);
    refreshPOSData();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#1c3a1e] mb-1">Menu Categories & Channel Access Manager</h2>
        <p className="text-xs text-gray-600 font-medium">
          Create categories and specify exactly which access channels (Dine-In QR, Takeout, Camping, or Waiter POS) can see each category.
        </p>
      </div>

      <form onSubmit={handleCreateCategorySubmit} className="bg-white border border-[#1c3a1e]/15 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex gap-3">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Enter New Category Name (e.g. Extras, Shisha, Camping Gear)..."
            className="flex-1 bg-[#fafbfa] border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none transition-colors shadow-xs"
          />
          <button
            type="submit"
            className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Category</span>
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-[#1c3a1e] mb-1.5 uppercase tracking-wider">
            Initial Channel Access:
          </label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => {
              const isSelected = newCatChannels.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setNewCatChannels((prev) =>
                      prev.includes(ch.id) ? prev.filter((c) => c !== ch.id) : [...prev, ch.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                      : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </form>

      <div className="space-y-3">
        {categories.map((cat) => {
          const itemCount = menuItems.filter((m) => m.category_id === cat.id).length;
          const isEditing = editingCatId === cat.id;
          const isAvailable = cat.available !== false;
          const activeChannels: ChannelType[] = cat.visible_channels && cat.visible_channels.length > 0
            ? (cat.visible_channels as ChannelType[])
            : ['dine_in', 'takeout', 'camping', 'pos'];

          return (
            <div
              key={cat.id}
              className={`bg-white border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs text-[#1c3a1e] transition-all gap-3 ${
                isAvailable ? 'border-[#1c3a1e]/15' : 'border-red-300 bg-red-50/40 opacity-75'
              }`}
            >
              {isEditing ? (
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-3 py-1.5 text-xs font-extrabold text-[#1c3a1e] focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-500">Sort #:</span>
                      <input
                        type="number"
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(parseInt(e.target.value, 10) || 0)}
                        className="w-16 bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl px-2 py-1.5 text-xs font-bold text-[#1c3a1e] focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveEdit(cat.id)}
                      className="bg-[#1c3a1e] text-white p-1.5 rounded-xl hover:bg-[#d4af37] hover:text-[#1c3a1e] transition-colors cursor-pointer"
                      title="Save Changes"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="bg-gray-100 text-gray-600 p-1.5 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                      title="Cancel Edit"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Channels:</span>
                    {CHANNELS.map((ch) => {
                      const isSel = editChannels.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setEditChannels((prev) =>
                              prev.includes(ch.id) ? prev.filter((c) => c !== ch.id) : [...prev, ch.id]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                            isSel
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                              : 'bg-gray-100 text-gray-400 border-gray-200'
                          }`}
                        >
                          <span>{ch.icon}</span>
                          <span>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-[#1c3a1e]">{cat.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">Sort #{cat.sort_order || 0}</span>
                      {!isAvailable && (
                        <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                          🔴 Hidden / Off-Menu
                        </span>
                      )}
                    </div>

                    {/* Interactive Channel Access Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400">Visible To:</span>
                      {CHANNELS.map((ch) => {
                        const isVisible = activeChannels.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => handleToggleChannelDirectly(cat, ch.id)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer border ${
                              isVisible
                                ? 'bg-[#eaf2eb] text-[#1c3a1e] border-[#1c3a1e]/30 hover:bg-[#d8e6da]'
                                : 'bg-gray-100 text-gray-300 border-gray-200 line-through opacity-60 hover:opacity-100'
                            }`}
                            title={`Click to ${isVisible ? 'HIDE from' : 'SHOW in'} ${ch.label}`}
                          >
                            <span>{ch.icon}</span>
                            <span>{ch.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <span className="text-xs text-gray-500 font-semibold block">
                      {itemCount} Menu Items
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Category Global Availability Toggle */}
                    <button
                      onClick={async () => {
                        await toggleCategoryAvailabilityAction(cat.id, !isAvailable);
                        refreshPOSData();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isAvailable
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                      }`}
                      title={isAvailable ? 'Click to Hide Entire Category' : 'Click to Make Category Available'}
                    >
                      {isAvailable ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-white" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleStartEdit(cat)}
                      className="text-[#1c3a1e] hover:bg-[#eaf2eb] p-2 rounded-xl text-xs transition-colors cursor-pointer"
                      title="Edit Category Name & Channels"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete category "${cat.name}"?`)) {
                          await deleteCategory(cat.id);
                          refreshPOSData();
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-xl text-xs transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
