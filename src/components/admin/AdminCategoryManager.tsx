'use client';

import React, { useState } from 'react';
import { MenuCategory, MenuItem } from '@/lib/types';
import { createCategory, deleteCategory, updateCategory, toggleCategoryAvailabilityAction } from '@/app/actions/admin-actions';
import { PlusCircle, Trash2, Edit3, Check, X, Eye, EyeOff } from 'lucide-react';

interface AdminCategoryManagerProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  refreshPOSData: () => void;
}

export const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({
  categories,
  menuItems,
  refreshPOSData,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState<number>(0);

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await createCategory(newCatName.trim());
    setNewCatName('');
    refreshPOSData();
  };

  const handleStartEdit = (cat: MenuCategory) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sort_order || 0);
  };

  const handleSaveEdit = async (catId: string) => {
    if (!editName.trim()) return;
    await updateCategory(catId, editName.trim(), editSortOrder);
    setEditingCatId(null);
    refreshPOSData();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#1c3a1e] mb-1">Menu Categories Manager</h2>
        <p className="text-xs text-gray-600 font-medium">
          Create new menu categories, toggle availability/hide entire category, adjust order, or delete categories
        </p>
      </div>

      <form onSubmit={handleCreateCategorySubmit} className="flex gap-3">
        <input
          type="text"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Enter New Category Name..."
          className="flex-1 bg-white border border-[#1c3a1e]/20 focus:border-[#1c3a1e] rounded-2xl px-4 py-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none transition-colors shadow-xs"
        />
        <button
          type="submit"
          className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Category</span>
        </button>
      </form>

      <div className="space-y-3">
        {categories.map((cat) => {
          const itemCount = menuItems.filter((m) => m.category_id === cat.id).length;
          const isEditing = editingCatId === cat.id;
          const isAvailable = cat.available !== false;

          return (
            <div
              key={cat.id}
              className={`bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs text-[#1c3a1e] transition-all ${
                isAvailable ? 'border-[#1c3a1e]/15' : 'border-red-300 bg-red-50/40 opacity-75'
              }`}
            >
              {isEditing ? (
                <div className="flex-1 flex items-center gap-3 pr-4">
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
              ) : (
                <>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#1c3a1e]">{cat.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">Sort #{cat.sort_order || 0}</span>
                      {!isAvailable && (
                        <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                          🔴 Category Hidden / Out of Stock
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 font-semibold block mt-0.5">
                      {itemCount} Menu Items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Category Availability Toggle */}
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
                      title={isAvailable ? 'Click to Hide Entire Category from Menu' : 'Click to Make Category Visible'}
                    >
                      {isAvailable ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Visible</span>
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
                      title="Edit Category Name & Order"
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
