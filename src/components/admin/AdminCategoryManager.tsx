'use client';

import React, { useState } from 'react';
import { MenuCategory, MenuItem } from '@/lib/types';
import { createCategory, deleteCategory, updateCategory } from '@/app/actions/admin-actions';
import { PlusCircle, Trash2, Edit3, Check, X } from 'lucide-react';

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
          Create new menu categories, edit names, adjust sort order, or delete categories
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

          return (
            <div
              key={cat.id}
              className="bg-white border border-[#1c3a1e]/15 rounded-2xl p-4 flex items-center justify-between shadow-xs text-[#1c3a1e]"
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
                    </div>
                    <span className="text-xs text-gray-600 font-semibold block mt-0.5">
                      {itemCount} Menu Items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
