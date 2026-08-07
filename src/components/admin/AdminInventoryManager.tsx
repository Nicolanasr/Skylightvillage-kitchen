'use client';

import React, { useState, useEffect } from 'react';
import {
  getInventoryData,
  saveRawIngredient,
  deleteRawIngredient,
  saveMenuItemRecipe,
  recordStockReceiving,
  recordStockWaste,
  recordStockAudit,
  RawIngredient,
  MenuItemRecipe,
  StockReceivingLog,
  StockWasteLog,
  StockAuditLog,
  StockDeductionLog,
} from '@/app/actions/inventory-actions';
import { formatUsd } from '@/lib/currency';
import {
  Package,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  DollarSign,
  TrendingUp,
  Truck,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  FileSpreadsheet,
  Search,
  BookOpen,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';

interface AdminInventoryManagerProps {
  initialSubTab?: 'ingredients' | 'recipes' | 'receiving' | 'waste' | 'audit' | 'deductions';
}

export function AdminInventoryManager({ initialSubTab = 'ingredients' }: AdminInventoryManagerProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes' | 'receiving' | 'waste' | 'audit' | 'deductions'>(initialSubTab);

  const [rawIngredients, setRawIngredients] = useState<RawIngredient[]>([]);
  const [recipes, setRecipes] = useState<MenuItemRecipe[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [receivingLogs, setReceivingLogs] = useState<StockReceivingLog[]>([]);
  const [wasteLogs, setWasteLogs] = useState<StockWasteLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<StockAuditLog[]>([]);
  const [deductionLogs, setDeductionLogs] = useState<StockDeductionLog[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedLogGroup, setExpandedLogGroup] = useState<string | null>(null);

  // Raw Ingredient Modal State
  const [showIngModal, setShowIngModal] = useState(false);
  const [editIng, setEditIng] = useState<Partial<RawIngredient>>({
    unit: 'kg',
    category: 'General',
    current_stock: 10,
    reorder_level: 2,
    cost_per_unit_usd: 5.0,
  });

  // Recipe Builder State
  const [selectedRecipeDishId, setSelectedRecipeDishId] = useState<string>('');
  const [dishSearchFilter, setDishSearchFilter] = useState('');
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: string; quantity_required: number; unit: string }[]>([]);

  // Stock Receiving Modal State
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [receivingForm, setReceivingForm] = useState({
    ingredientId: '',
    quantityAdded: 10,
    unitCostUsd: 5.0,
    supplierName: '',
    notes: '',
  });

  // Waste Modal State
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    ingredientId: '',
    quantityWasted: 1,
    reason: 'Spoilage / Expired',
    loggedBy: 'Kitchen Chef',
  });

  // Audit Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditForm, setAuditForm] = useState({
    ingredientId: '',
    actualStock: 0,
    notes: 'End of week physical count',
  });

  // Sync subtab with URL query param for easy refreshing!
  const switchSubTab = (tab: 'ingredients' | 'recipes' | 'receiving' | 'waste' | 'audit' | 'deductions') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('sub', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const loadData = async () => {
    setLoading(true);
    const res = await getInventoryData();
    if (res.success) {
      setRawIngredients(res.rawIngredients || []);
      setRecipes(res.recipes || []);
      setMenuItems(res.menuItems || []);
      setReceivingLogs(res.receivingLogs || []);
      setWasteLogs(res.wasteLogs || []);
      setAuditLogs(res.auditLogs || []);
      setDeductionLogs(res.deductionLogs || []);

      if (res.menuItems && res.menuItems.length > 0 && !selectedRecipeDishId) {
        setSelectedRecipeDishId(res.menuItems[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update recipe form when selected dish changes
  useEffect(() => {
    if (selectedRecipeDishId) {
      const dishRecipes = recipes.filter((r) => r.menu_item_id === selectedRecipeDishId);
      setRecipeLines(
        dishRecipes.map((r) => ({
          ingredient_id: r.ingredient_id,
          quantity_required: r.quantity_required,
          unit: r.unit,
        }))
      );
    }
  }, [selectedRecipeDishId, recipes]);

  const handleSaveIngredient = async () => {
    if (!editIng.name) return alert('Please enter ingredient name.');
    setIsSaving(true);
    const res = await saveRawIngredient(editIng);
    if (res.success) {
      setShowIngModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to save ingredient');
    }
    setIsSaving(false);
  };

  const handleDeleteIngredient = async (id: string, name: string) => {
    if (confirm(`Delete ingredient "${name}"?`)) {
      await deleteRawIngredient(id);
      loadData();
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipeDishId) return;
    setIsSaving(true);
    const res = await saveMenuItemRecipe(selectedRecipeDishId, recipeLines);
    if (res.success) {
      alert('Recipe saved successfully!');
      loadData();
    } else {
      alert(res.error || 'Failed to save recipe');
    }
    setIsSaving(false);
  };

  const handleSaveReceiving = async () => {
    if (!receivingForm.ingredientId) return alert('Select an ingredient');
    setIsSaving(true);
    const res = await recordStockReceiving(receivingForm);
    if (res.success) {
      setShowReceivingModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to record stock delivery');
    }
    setIsSaving(false);
  };

  const handleSaveWaste = async () => {
    if (!wasteForm.ingredientId) return alert('Select an ingredient');
    setIsSaving(true);
    const res = await recordStockWaste(wasteForm);
    if (res.success) {
      setShowWasteModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to log waste');
    }
    setIsSaving(false);
  };

  const handleSaveAudit = async () => {
    if (!auditForm.ingredientId) return alert('Select an ingredient');
    setIsSaving(true);
    const res = await recordStockAudit(auditForm);
    if (res.success) {
      setShowAuditModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed to record audit');
    }
    setIsSaving(false);
  };

  const lowStockCount = rawIngredients.filter((i) => i.current_stock <= i.reorder_level).length;
  const totalWasteLossUsd = wasteLogs.reduce((sum, w) => sum + w.total_cost_usd, 0);

  const filteredMenuItemsForRecipe = menuItems.filter((m) =>
    m.name.toLowerCase().includes(dishSearchFilter.toLowerCase().trim())
  );

  // Group deduction logs by Order Reference (1 line per transaction)
  const groupedDeductionLogs = React.useMemo(() => {
    const map = new Map<string, { key: string; orderRef: string; dishes: Set<string>; items: StockDeductionLog[]; timestamp: string }>();
    for (const log of deductionLogs) {
      const key = `${log.order_reference}-${new Date(log.created_at).getTime() / 60000 | 0}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          orderRef: log.order_reference,
          dishes: new Set([log.dish_name]),
          items: [log],
          timestamp: log.created_at,
        });
      } else {
        const group = map.get(key)!;
        group.dishes.add(log.dish_name);
        group.items.push(log);
      }
    }
    return Array.from(map.values());
  }, [deductionLogs]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-10 w-10 border-4 border-[#1c3a1e] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider">Loading Inventory & Recipe BOM Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1c3a1e]">
      {/* Top Header Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-gray-500 uppercase block">Total Raw Ingredients</span>
            <strong className="text-2xl font-black text-[#1c3a1e]">{rawIngredients.length} Items</strong>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[#eaf2eb] text-[#1c3a1e] flex items-center justify-center font-black">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className={`bg-white border rounded-3xl p-4 shadow-xs flex items-center justify-between ${lowStockCount > 0 ? 'border-amber-400 bg-amber-50/50' : 'border-[#1c3a1e]/15'}`}>
          <div>
            <span className="text-[10px] font-extrabold text-amber-900 uppercase block">Low Stock Warnings</span>
            <strong className={`text-2xl font-black ${lowStockCount > 0 ? 'text-amber-800' : 'text-[#1c3a1e]'}`}>
              {lowStockCount} Items
            </strong>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-gray-500 uppercase block">Active Dish Recipes</span>
            <strong className="text-2xl font-black text-[#1c3a1e]">
              {new Set(recipes.map((r) => r.menu_item_id)).size} Dishes
            </strong>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[#eaf2eb] text-[#1c3a1e] flex items-center justify-center font-black">
            <BookOpen className="h-6 w-6 text-[#1c3a1e]" />
          </div>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-red-600 uppercase block">Total Waste Loss</span>
            <strong className="text-2xl font-black text-red-700">{formatUsd(totalWasteLossUsd)}</strong>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center font-black">
            <ArrowDownRight className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Multi-Tab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[#1c3a1e]/15 pb-3">
        <button
          onClick={() => switchSubTab('ingredients')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'ingredients'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <Package className="h-4 w-4 text-[#d4af37]" />
          <span>Raw Ingredients ({rawIngredients.length})</span>
        </button>

        <button
          onClick={() => switchSubTab('recipes')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'recipes'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <BookOpen className="h-4 w-4 text-emerald-400" />
          <span>Dish Recipes & COGS Costing</span>
        </button>

        <button
          onClick={() => switchSubTab('deductions')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'deductions'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-400" />
          <span>Real-Time Sales Deductions ({groupedDeductionLogs.length})</span>
        </button>

        <button
          onClick={() => switchSubTab('receiving')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'receiving'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <Truck className="h-4 w-4 text-blue-400" />
          <span>Supplier Receiving (Stock In)</span>
        </button>

        <button
          onClick={() => switchSubTab('waste')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'waste'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <Trash2 className="h-4 w-4 text-red-400" />
          <span>Waste & Spoilage Log</span>
        </button>

        <button
          onClick={() => switchSubTab('audit')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === 'audit'
              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-md'
              : 'bg-white text-[#1c3a1e] border-[#1c3a1e]/15 hover:bg-[#eaf2eb]'
          }`}
        >
          <Scale className="h-4 w-4 text-amber-400" />
          <span>Weekly Variance Audit</span>
        </button>
      </div>

      {/* TAB 1: RAW INGREDIENTS LIST */}
      {activeTab === 'ingredients' && (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search raw ingredients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
              />
            </div>

            <button
              onClick={() => {
                setEditIng({ unit: 'kg', category: 'General', current_stock: 10, reorder_level: 2, cost_per_unit_usd: 5.0 });
                setShowIngModal(true);
              }}
              className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white text-xs font-black px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Raw Ingredient</span>
            </button>
          </div>

          {/* Ingredients Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                <tr>
                  <th className="p-3">Ingredient Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Current Stock</th>
                  <th className="p-3">Reorder Alert Level</th>
                  <th className="p-3">Cost Per Unit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {rawIngredients
                  .filter((ing) => ing.name.toLowerCase().includes(searchTerm.toLowerCase()) || ing.category.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((ing) => {
                    const isLow = ing.current_stock <= ing.reorder_level;
                    return (
                      <tr key={ing.id} className="hover:bg-[#fafbfa]">
                        <td className="p-3 font-extrabold text-[#1c3a1e]">{ing.name}</td>
                        <td className="p-3 text-gray-500 font-bold uppercase text-[10px]">{ing.category}</td>
                        <td className="p-3 font-black text-sm">
                          {ing.current_stock} <span className="text-xs font-bold text-gray-500">{ing.unit}</span>
                        </td>
                        <td className="p-3 font-bold text-gray-600">
                          {ing.reorder_level} {ing.unit}
                        </td>
                        <td className="p-3 font-bold text-[#1c3a1e]">
                          ${ing.cost_per_unit_usd.toFixed(3)} / {ing.unit}
                        </td>
                        <td className="p-3">
                          {isLow ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-black text-[10px] flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3 text-amber-700" /> LOW STOCK
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md font-black text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3 text-emerald-700" /> OK
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditIng(ing);
                              setShowIngModal(true);
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-[#1c3a1e] p-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DISH RECIPES & COGS COSTING BUILDER */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Fast Interactive Dish Selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-[#1c3a1e] uppercase tracking-wider">Select Dish to Build Recipe</h3>
              
              {/* Fast Search Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type dish name to search..."
                  value={dishSearchFilter}
                  onChange={(e) => setDishSearchFilter(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                />
              </div>

              {/* Interactive Dish List Picker */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border border-[#1c3a1e]/15 rounded-2xl p-2 bg-[#fafbfa]">
                {filteredMenuItemsForRecipe.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 font-bold">No dishes found matching search</div>
                ) : (
                  filteredMenuItemsForRecipe.map((m) => {
                    const isSelected = m.id === selectedRecipeDishId;
                    const recipeCount = recipes.filter((r) => r.menu_item_id === m.id).length;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedRecipeDishId(m.id)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer border ${
                          isSelected
                            ? 'bg-[#1c3a1e] text-white border-[#1c3a1e] shadow-xs'
                            : 'bg-white text-[#1c3a1e] border-gray-200 hover:border-[#1c3a1e]/30 hover:bg-[#eaf2eb]'
                        }`}
                      >
                        <div className="font-bold">
                          <div>{m.name}</div>
                          <span className={`text-[10px] font-black ${isSelected ? 'text-[#d4af37]' : 'text-emerald-700'}`}>
                            ${m.price_usd.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : recipeCount > 0
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {recipeCount > 0 ? `${recipeCount} stock items` : 'No stock items'}
                          </span>
                          {isSelected && <Check className="h-4 w-4 text-[#d4af37]" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* COGS Profit Calculation Box */}
              {selectedRecipeDishId && (() => {
                const activeDish = menuItems.find((m) => m.id === selectedRecipeDishId);
                const sellingPrice = activeDish?.price_usd || 0;
                const recipeCost = recipeLines.reduce((sum, line) => {
                  const ing = rawIngredients.find((i) => i.id === line.ingredient_id);
                  return sum + (ing ? ing.cost_per_unit_usd * line.quantity_required : 0);
                }, 0);
                const profitUsd = sellingPrice - recipeCost;
                const marginPct = sellingPrice > 0 ? (profitUsd / sellingPrice) * 100 : 0;

                return (
                  <div className="bg-[#eaf2eb] border border-[#1c3a1e]/20 rounded-2xl p-4 space-y-2 mt-4">
                    <span className="text-[10px] font-black text-emerald-900 uppercase block">Recipe Financial Summary</span>
                    <div className="flex justify-between text-xs font-bold">
                      <span>Menu Selling Price:</span>
                      <span className="font-black">${sellingPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-700">
                      <span>Raw Stock Cost (COGS):</span>
                      <span className="font-black">${recipeCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-[#1c3a1e] pt-2 border-t border-[#1c3a1e]/15">
                      <span>Gross Profit:</span>
                      <span className="text-emerald-800">${profitUsd.toFixed(2)} ({marginPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Column: Recipe Portion Builder Form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
                <div>
                  <h3 className="text-base font-black text-[#1c3a1e]">
                    Recipe Ingredients for {menuItems.find((m) => m.id === selectedRecipeDishId)?.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">Define exact gram weights/portion quantities deducted per sale</p>
                </div>

                <button
                  onClick={() => {
                    if (rawIngredients.length === 0) return alert('Create raw ingredients first.');
                    setRecipeLines((prev) => [
                      ...prev,
                      { ingredient_id: rawIngredients[0].id, quantity_required: 0.1, unit: rawIngredients[0].unit },
                    ]);
                  }}
                  className="bg-[#1c3a1e] text-white text-xs font-black px-3.5 py-2 rounded-xl hover:bg-[#d4af37] hover:text-[#1c3a1e] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Ingredient Line</span>
                </button>
              </div>

              {recipeLines.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-300 rounded-2xl text-xs font-bold text-gray-500 space-y-1">
                  <p className="font-extrabold text-[#1c3a1e]">No stock items linked to this dish</p>
                  <p className="text-[11px] text-gray-400 font-medium">Ordering this menu item will not deduct inventory stock. Tap "+ Add Ingredient Line" if needed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recipeLines.map((line, idx) => {
                    const matchedIng = rawIngredients.find((i) => i.id === line.ingredient_id);
                    const lineCost = (matchedIng?.cost_per_unit_usd || 0) * line.quantity_required;

                    return (
                      <div key={idx} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-3">
                        <select
                          value={line.ingredient_id}
                          onChange={(e) => {
                            const newIngId = e.target.value;
                            const ingObj = rawIngredients.find((i) => i.id === newIngId);
                            setRecipeLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, ingredient_id: newIngId, unit: ingObj?.unit || 'kg' } : l))
                            );
                          }}
                          className="flex-1 bg-white border border-gray-300 rounded-xl p-2.5 text-xs font-extrabold text-[#1c3a1e] cursor-pointer"
                        >
                          {rawIngredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit}) - ${i.cost_per_unit_usd.toFixed(3)}/{i.unit}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.001"
                            value={line.quantity_required}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setRecipeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity_required: val } : l)));
                            }}
                            className="w-24 bg-white border border-gray-300 rounded-xl p-2 text-xs font-black text-center text-[#1c3a1e]"
                          />
                          <span className="text-xs font-bold text-gray-600">{line.unit}</span>
                        </div>

                        <span className="text-xs font-black text-emerald-800 w-24 text-right">Cost: ${lineCost.toFixed(3)}</span>

                        <button
                          onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleSaveRecipe}
                disabled={isSaving}
                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {isSaving ? 'Saving Recipe...' : 'Save Dish Recipe Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REAL-TIME SALES DEDUCTION LOGS (Grouped 1 Line Per Order with Collapsible Details) */}
      {activeTab === 'deductions' && (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
            <div>
              <h3 className="text-base font-black text-[#1c3a1e]">Real-Time Order Sales Deduction Logs</h3>
              <p className="text-xs text-gray-500 font-medium">Automatic transaction log feed. Click any row to expand raw ingredient deduction details.</p>
            </div>
          </div>

          <div className="space-y-2">
            {groupedDeductionLogs.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-gray-400 border border-dashed border-gray-300 rounded-2xl">
                No sales deductions logged yet. Place an order on POS, Takeout, or Event Vouchers to see deductions live!
              </div>
            ) : (
              groupedDeductionLogs.map((group) => {
                const isExpanded = expandedLogGroup === group.key;
                const isRestock = group.orderRef.includes('RESTOCK') || group.items.some((i) => i.quantity_deducted < 0);
                const dishListStr = Array.from(group.dishes).join(', ');

                return (
                  <div
                    key={group.key}
                    className={`border rounded-2xl transition-all ${
                      isExpanded
                        ? 'border-[#1c3a1e] bg-[#fafbfa] shadow-sm'
                        : 'border-[#1c3a1e]/15 bg-white hover:border-[#1c3a1e]/40'
                    }`}
                  >
                    {/* Main 1-Line Row Summary */}
                    <div
                      onClick={() => setExpandedLogGroup(isExpanded ? null : group.key)}
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black ${
                          isRestock ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {isRestock ? '↺' : '⚡'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-extrabold text-[#1c3a1e]">{group.orderRef}</strong>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                              isRestock ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {isRestock ? 'Restock' : 'Sales Deduction'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-gray-700 mt-0.5">{dishListStr}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="text-[11px] font-extrabold text-gray-500">
                          {group.items.length} raw item{group.items.length > 1 ? 's' : ''} {isRestock ? 'refunded' : 'deducted'}
                        </span>

                        <span className="text-xs font-bold text-gray-500">
                          {new Date(group.timestamp).toLocaleString()}
                        </span>

                        <button className="bg-[#eaf2eb] hover:bg-[#d8e6da] text-[#1c3a1e] p-1.5 rounded-lg transition-all text-xs font-black flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Details Breakdown */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#1c3a1e]/10 space-y-2 bg-white/60 rounded-b-2xl">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Raw Ingredient Breakdown</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {group.items.map((item) => (
                            <div key={item.id} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-xl p-2.5 text-xs flex justify-between items-center">
                              <div>
                                <span className="font-extrabold text-[#1c3a1e] block">{item.ingredient_name}</span>
                                <span className="text-[10px] text-gray-500 font-bold">{item.dish_name}</span>
                              </div>
                              <div className="text-right">
                                <span className={`font-black text-xs block ${item.quantity_deducted < 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {item.quantity_deducted < 0 ? `+${Math.abs(item.quantity_deducted)}` : `-${item.quantity_deducted}`} {item.unit}
                                </span>
                                <span className="text-[9px] font-bold text-gray-500">Stock left: {item.remaining_stock} {item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIER RECEIVING (STOCK IN) */}
      {activeTab === 'receiving' && (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
            <div>
              <h3 className="text-base font-black text-[#1c3a1e]">Supplier Deliveries & Stock Receiving (Stock In)</h3>
              <p className="text-xs text-gray-500 font-medium">Record incoming raw stock to increase inventory & update average costs</p>
            </div>

            <button
              onClick={() => {
                if (rawIngredients.length === 0) return alert('Create raw ingredients first.');
                setReceivingForm({
                  ingredientId: rawIngredients[0].id,
                  quantityAdded: 10,
                  unitCostUsd: rawIngredients[0].cost_per_unit_usd || 5.0,
                  supplierName: 'Main Supplier',
                  notes: 'Weekly fresh stock delivery',
                });
                setShowReceivingModal(true);
              }}
              className="bg-[#1c3a1e] text-white text-xs font-black px-4 py-2.5 rounded-2xl hover:bg-[#d4af37] hover:text-[#1c3a1e] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>+ Record Stock Delivery</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Ingredient</th>
                  <th className="p-3">Quantity Received</th>
                  <th className="p-3">Unit Cost USD</th>
                  <th className="p-3">Total Cost USD</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {receivingLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fafbfa]">
                    <td className="p-3 text-gray-500 font-bold">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 font-extrabold text-[#1c3a1e]">{log.ingredient_name}</td>
                    <td className="p-3 font-black text-emerald-700">+{log.quantity_added}</td>
                    <td className="p-3 font-bold">${log.unit_cost_usd.toFixed(3)}</td>
                    <td className="p-3 font-black text-[#1c3a1e]">${(log.quantity_added * log.unit_cost_usd).toFixed(2)}</td>
                    <td className="p-3 text-gray-700 font-bold">{log.supplier_name || 'N/A'}</td>
                    <td className="p-3 text-gray-500 italic">{log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: KITCHEN WASTE & SPOILAGE LOG */}
      {activeTab === 'waste' && (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
            <div>
              <h3 className="text-base font-black text-[#1c3a1e]">Kitchen Waste & Spoilage Log</h3>
              <p className="text-xs text-gray-500 font-medium">Record spoiled, expired, or dropped ingredients to keep stock counts 100% accurate</p>
            </div>

            <button
              onClick={() => {
                if (rawIngredients.length === 0) return alert('Create raw ingredients first.');
                setWasteForm({
                  ingredientId: rawIngredients[0].id,
                  quantityWasted: 1,
                  reason: 'Spoilage / Expired',
                  loggedBy: 'Kitchen Chef',
                });
                setShowWasteModal(true);
              }}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-black px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>+ Log Waste / Spoilage</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50 text-red-900 font-black uppercase tracking-wider border-b border-red-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Ingredient</th>
                  <th className="p-3">Quantity Wasted</th>
                  <th className="p-3">Financial Loss USD</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {wasteLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fafbfa]">
                    <td className="p-3 text-gray-500 font-bold">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 font-extrabold text-[#1c3a1e]">{log.ingredient_name}</td>
                    <td className="p-3 font-black text-red-600">-{log.quantity_wasted}</td>
                    <td className="p-3 font-black text-red-700">${log.total_cost_usd.toFixed(2)}</td>
                    <td className="p-3 font-bold text-gray-700">{log.reason}</td>
                    <td className="p-3 text-gray-500 font-bold">{log.logged_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: WEEKLY STOCK VARIANCE AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#1c3a1e]/15">
            <div>
              <h3 className="text-base font-black text-[#1c3a1e]">Weekly Stock Variance Audit</h3>
              <p className="text-xs text-gray-500 font-medium">Compare expected system stock vs physical count to detect theft or over-portioning</p>
            </div>

            <button
              onClick={() => {
                if (rawIngredients.length === 0) return alert('Create raw ingredients first.');
                setAuditForm({
                  ingredientId: rawIngredients[0].id,
                  actualStock: rawIngredients[0].current_stock,
                  notes: 'Physical weekly audit count',
                });
                setShowAuditModal(true);
              }}
              className="bg-[#1c3a1e] text-white text-xs font-black px-4 py-2.5 rounded-2xl hover:bg-[#d4af37] hover:text-[#1c3a1e] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Scale className="h-4 w-4" />
              <span>+ Record Physical Audit</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#eaf2eb] text-[#1c3a1e] font-black uppercase tracking-wider border-b border-[#1c3a1e]/15">
                <tr>
                  <th className="p-3">Audit Date</th>
                  <th className="p-3">Ingredient</th>
                  <th className="p-3">Expected Stock</th>
                  <th className="p-3">Actual Count</th>
                  <th className="p-3">Variance</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fafbfa]">
                    <td className="p-3 text-gray-500 font-bold">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 font-extrabold text-[#1c3a1e]">{log.ingredient_name}</td>
                    <td className="p-3 font-bold text-gray-700">{log.expected_stock}</td>
                    <td className="p-3 font-black text-[#1c3a1e]">{log.actual_stock}</td>
                    <td className="p-3">
                      {log.variance < 0 ? (
                        <span className="bg-red-100 text-red-900 border border-red-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                          {log.variance} (Missing / Shortage)
                        </span>
                      ) : log.variance > 0 ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                          +{log.variance} (Surplus)
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                          Exact Match (0)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 italic">{log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RAW INGREDIENT MODAL */}
      {showIngModal && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-base font-black text-[#1c3a1e]">
                {editIng.id ? 'Edit Raw Ingredient' : 'New Raw Ingredient'}
              </h3>
              <button onClick={() => setShowIngModal(false)} className="text-gray-400 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">Ingredient Name</label>
                <input
                  type="text"
                  value={editIng.name || ''}
                  onChange={(e) => setEditIng((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Marinated Chicken Tawook"
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editIng.category || ''}
                    onChange={(e) => setEditIng((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g. Poultry, Meat, Bakery"
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Measurement Unit</label>
                  <select
                    value={editIng.unit || 'kg'}
                    onChange={(e) => setEditIng((prev) => ({ ...prev, unit: e.target.value as any }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="pcs">Pieces / Items (pcs)</option>
                    <option value="liter">Liters (liter)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pack">Packs (pack)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editIng.current_stock || 0}
                    onChange={(e) => setEditIng((prev) => ({ ...prev, current_stock: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editIng.reorder_level || 0}
                    onChange={(e) => setEditIng((prev) => ({ ...prev, reorder_level: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Cost / Unit ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editIng.cost_per_unit_usd || 0}
                    onChange={(e) => setEditIng((prev) => ({ ...prev, cost_per_unit_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveIngredient}
              disabled={isSaving}
              className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              {isSaving ? 'Saving...' : 'Save Ingredient'}
            </button>
          </div>
        </div>
      )}

      {/* STOCK RECEIVING MODAL */}
      {showReceivingModal && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-base font-black text-[#1c3a1e]">Record Supplier Delivery (Stock In)</h3>
              <button onClick={() => setShowReceivingModal(false)} className="text-gray-400 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">Select Ingredient</label>
                <select
                  value={receivingForm.ingredientId}
                  onChange={(e) => {
                    const ingId = e.target.value;
                    const ing = rawIngredients.find((i) => i.id === ingId);
                    setReceivingForm((prev) => ({
                      ...prev,
                      ingredientId: ingId,
                      unitCostUsd: ing?.cost_per_unit_usd || 5.0,
                    }));
                  }}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                >
                  {rawIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit}) - Current: {i.current_stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">Quantity Received</label>
                  <input
                    type="number"
                    step="0.001"
                    value={receivingForm.quantityAdded}
                    onChange={(e) => setReceivingForm((prev) => ({ ...prev, quantityAdded: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Unit Cost USD ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={receivingForm.unitCostUsd}
                    onChange={(e) => setReceivingForm((prev) => ({ ...prev, unitCostUsd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={receivingForm.supplierName}
                  onChange={(e) => setReceivingForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                  placeholder="e.g. Al-Wadi Meat & Poultry"
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                />
              </div>
            </div>

            <button
              onClick={handleSaveReceiving}
              disabled={isSaving}
              className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              {isSaving ? 'Recording Delivery...' : 'Record Stock In'}
            </button>
          </div>
        </div>
      )}

      {/* WASTE MODAL */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-base font-black text-red-700">Log Kitchen Waste / Spoilage</h3>
              <button onClick={() => setShowWasteModal(false)} className="text-gray-400 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">Select Ingredient</label>
                <select
                  value={wasteForm.ingredientId}
                  onChange={(e) => setWasteForm((prev) => ({ ...prev, ingredientId: e.target.value }))}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                >
                  {rawIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Quantity Wasted</label>
                <input
                  type="number"
                  step="0.001"
                  value={wasteForm.quantityWasted}
                  onChange={(e) => setWasteForm((prev) => ({ ...prev, quantityWasted: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Reason for Waste</label>
                <select
                  value={wasteForm.reason}
                  onChange={(e) => setWasteForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                >
                  <option value="Spoilage / Expired">Spoilage / Expired</option>
                  <option value="Kitchen Prep Drop / Damage">Kitchen Prep Drop / Damage</option>
                  <option value="Over-cooking / Burnt">Over-cooking / Burnt</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveWaste}
              disabled={isSaving}
              className="w-full bg-red-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              {isSaving ? 'Logging Waste...' : 'Log Waste Loss'}
            </button>
          </div>
        </div>
      )}

      {/* AUDIT MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-base font-black text-[#1c3a1e]">Record Physical Stock Count</h3>
              <button onClick={() => setShowAuditModal(false)} className="text-gray-400 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">Select Ingredient</label>
                <select
                  value={auditForm.ingredientId}
                  onChange={(e) => {
                    const ingId = e.target.value;
                    const ing = rawIngredients.find((i) => i.id === ingId);
                    setAuditForm((prev) => ({
                      ...prev,
                      ingredientId: ingId,
                      actualStock: ing?.current_stock || 0,
                    }));
                  }}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                >
                  {rawIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit}) - System Stock: {i.current_stock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Actual Physical Count</label>
                <input
                  type="number"
                  step="0.001"
                  value={auditForm.actualStock}
                  onChange={(e) => setAuditForm((prev) => ({ ...prev, actualStock: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs font-black text-[#1c3a1e]"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Audit Notes / Reason</label>
                <input
                  type="text"
                  value={auditForm.notes}
                  onChange={(e) => setAuditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. End of week physical stock audit"
                  className="w-full bg-[#fafbfa] border rounded-xl p-2.5 text-xs text-[#1c3a1e]"
                />
              </div>
            </div>

            <button
              onClick={handleSaveAudit}
              disabled={isSaving}
              className="w-full bg-[#1c3a1e] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              {isSaving ? 'Recording Audit...' : 'Save Physical Count'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
