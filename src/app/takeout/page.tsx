'use client';

import React, { useState, useEffect } from 'react';
import { getOrderPageData, submitCustomerOrder, createTakeoutOrCampingSession } from '@/app/actions/order-actions';
import { MenuItem, MenuCategory, SelectedModifier } from '@/lib/types';
import { transformGoogleDriveUrl } from '@/lib/drive';
import { ShoppingBag, CheckCircle, Search, Sparkles, User, Phone, MapPin, PackageCheck, AlertCircle, ArrowRight, Edit3, Plus } from 'lucide-react';

export default function CustomerTakeoutPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Step 1 vs Step 2 State
  const [takeoutStep, setTakeoutStep] = useState<1 | 2>(1);

  // Takeout & Camping Customer State
  const [orderType, setOrderType] = useState<'takeout' | 'camping'>('takeout');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [campingLocation, setCampingLocation] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Menu Search & Category Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart State: menuItemId -> { item, quantity, selectedModifiers, specialNotes }
  const [cart, setCart] = useState<{
    [key: string]: {
      item: MenuItem;
      quantity: number;
      selectedModifiers: SelectedModifier[];
      specialNotes: string;
    };
  }>({});

  // Active item modifier modal state
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);
  const [modalModifiers, setModalModifiers] = useState<SelectedModifier[]>([]);
  const [modalNotes, setModalNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const res = await getOrderPageData('takeout-session');
      setData(res);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c3a1e] flex flex-col items-center justify-center text-white p-4">
        <div className="h-10 w-10 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-extrabold text-sm tracking-wider uppercase">Loading Skylight Menu...</p>
      </div>
    );
  }

  const categories: MenuCategory[] = data?.categories || [];
  const menuItems: MenuItem[] = (data?.menuItems || []).filter((m: MenuItem) => m.available && !m.is_staff_only);

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter your Name.');
      return;
    }
    if (orderType === 'takeout' && !customerPhone.trim()) {
      alert('Please enter your Phone Number for Pick-Up notification.');
      return;
    }
    setTakeoutStep(2);
  };

  const handleOpenModifierModal = (item: MenuItem) => {
    setActiveModalItem(item);
    setModalModifiers([]);
    setModalNotes('');
  };

  const handleToggleModifierOption = (groupName: string, optionName: string, priceExtra: number) => {
    setModalModifiers((prev) => {
      const exists = prev.some((m) => m.group === groupName && m.option === optionName);
      if (exists) {
        return prev.filter((m) => !(m.group === groupName && m.option === optionName));
      } else {
        const filtered = prev.filter((m) => m.group !== groupName);
        return [...filtered, { group: groupName, option: optionName, price_extra: priceExtra }];
      }
    });
  };

  const handleAddModalItemToCart = () => {
    if (!activeModalItem) return;

    if (activeModalItem.modifier_groups && activeModalItem.modifier_groups.length > 0) {
      for (const group of activeModalItem.modifier_groups) {
        if (group.required) {
          const hasSelected = modalModifiers.some((m) => m.group === group.group_name);
          if (!hasSelected) {
            alert(`Please select an option for required group: "${group.group_name}"`);
            return;
          }
        }
      }
    }

    const key = `${activeModalItem.id}-${JSON.stringify(modalModifiers)}-${modalNotes}`;
    setCart((prev) => {
      const existing = prev[key];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [key]: {
          item: activeModalItem,
          quantity: newQty,
          selectedModifiers: modalModifiers,
          specialNotes: modalNotes,
        },
      };
    });

    setActiveModalItem(null);
  };

  const cartItemsList = Object.values(cart);
  const cartItemCount = cartItemsList.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotalUsd = cartItemsList.reduce((sum, i) => {
    const modSum = i.selectedModifiers.reduce((mSum, m) => mSum + m.price_extra, 0);
    return sum + (i.item.price_usd + modSum) * i.quantity;
  }, 0);

  const handleCheckoutSubmit = async () => {
    if (cartItemsList.length === 0) return;
    if (!customerName.trim()) return alert('Please enter your Name for Takeout / Camping pick-up.');

    setIsSubmitting(true);
    setOrderError(null);

    const displayName = orderType === 'camping' && campingLocation.trim()
      ? `${customerName.trim()} (Camping: ${campingLocation.trim()})`
      : customerName.trim();

    // 1. Create Takeout/Camping session
    const sessRes = await createTakeoutOrCampingSession({
      orderType,
      customerName: displayName,
      customerPhone: customerPhone.trim(),
    });

    if (!sessRes.success || !sessRes.sessionId) {
      setIsSubmitting(false);
      setOrderError(sessRes.error || 'Failed to initialize Takeout session.');
      return;
    }

    // 2. Submit Order Items
    const itemsPayload = cartItemsList.map((ci) => ({
      menuItemId: ci.item.id,
      itemName: ci.item.name,
      quantity: ci.quantity,
      unitPriceUsd: ci.item.price_usd,
      station: ci.item.station,
      selectedModifiers: ci.selectedModifiers,
      specialNotes: ci.specialNotes,
    }));

    const submitRes = await submitCustomerOrder({
      sessionId: sessRes.sessionId,
      orderType,
      customerName: displayName,
      customerPhone: customerPhone.trim(),
      items: itemsPayload,
    });

    setIsSubmitting(false);

    if (submitRes.success) {
      setSessionId(sessRes.sessionId);
      setOrderSuccess(true);
      setCart({});
    } else {
      setOrderError(submitRes.error || 'Order submission failed');
    }
  };

  // SUCCESS SCREEN
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#1c3a1e] text-white flex flex-col items-center justify-center p-6 text-center antialiased">
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/30 animate-bounce">
          <PackageCheck className="h-10 w-10" />
        </div>

        <span className="text-xs font-black text-[#d4af37] uppercase tracking-widest bg-[#d4af37]/10 px-3 py-1 rounded-full border border-[#d4af37]/30 mb-3">
          {orderType === 'takeout' ? '🛍️ TAKEOUT ORDER RECEIVED' : '🏕️ CAMPING ORDER RECEIVED'}
        </span>

        <h1 className="text-2xl sm:text-3xl font-black mb-2">Thank You, {customerName}!</h1>
        <p className="text-sm text-emerald-100/80 max-w-md mb-6">
          Your order has been transmitted directly to our kitchen. We are preparing it now!
        </p>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 w-full max-w-sm text-left mb-6 space-y-2 text-xs">
          <div className="flex justify-between font-bold border-b border-white/10 pb-2">
            <span>Customer Name:</span>
            <span className="text-[#d4af37]">{customerName}</span>
          </div>
          {customerPhone && (
            <div className="flex justify-between font-bold border-b border-white/10 pb-2">
              <span>Phone Number:</span>
              <span>{customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Estimated Prep Time:</span>
            <span className="text-emerald-400 font-black">15–20 Mins</span>
          </div>
        </div>

        <button
          onClick={() => {
            setOrderSuccess(false);
            setSessionId(null);
            setTakeoutStep(1);
          }}
          className="bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-black px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
        >
          Place Another Order
        </button>
      </div>
    );
  }

  // STEP 1: CUSTOMER INFO & PICKUP MODE FORM
  if (takeoutStep === 1) {
    return (
      <div className="min-h-screen bg-[#1c3a1e] text-white flex flex-col justify-center items-center p-4 sm:p-6 antialiased">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest bg-[#d4af37]/15 px-3 py-1 rounded-full border border-[#d4af37]/30">
              Skylight Village Ordering
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Step 1: Enter Your Pick-Up Info</h1>
            <p className="text-xs text-emerald-100/80">
              Please choose your order type and enter your details to view our menu.
            </p>
          </div>

          <form onSubmit={handleStep1Submit} className="space-y-4">
            {/* Order Type Toggle */}
            <div className="bg-white/10 p-1.5 rounded-2xl border border-white/15 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setOrderType('takeout')}
                className={`py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  orderType === 'takeout'
                    ? 'bg-[#d4af37] text-[#1c3a1e] shadow-md'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>🛍️ Takeout / Pick-Up</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('camping')}
                className={`py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  orderType === 'camping'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <MapPin className="h-4 w-4" />
                <span>🏕️ Camping / Outdoor</span>
              </button>
            </div>

            {/* Input Fields */}
            <div>
              <label className="block text-xs font-bold text-white/90 mb-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Your Full Name *</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Marc H."
                className="w-full bg-white text-[#1c3a1e] font-extrabold rounded-2xl px-4 py-3 text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-gray-400"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/90 mb-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Phone Number {orderType === 'takeout' ? '*' : '(Optional)'}</span>
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +961 70 123 456"
                className="w-full bg-white text-[#1c3a1e] font-extrabold rounded-2xl px-4 py-3 text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-gray-400"
                required={orderType === 'takeout'}
              />
            </div>

            {orderType === 'camping' && (
              <div>
                <label className="block text-xs font-bold text-white/90 mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
                  <span>Tent / Location Tag (Optional)</span>
                </label>
                <input
                  type="text"
                  value={campingLocation}
                  onChange={(e) => setCampingLocation(e.target.value)}
                  placeholder="e.g. Tent #4 near River"
                  className="w-full bg-white text-[#1c3a1e] font-extrabold rounded-2xl px-4 py-3 text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-gray-400"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#d4af37] hover:bg-[#b89728] text-[#1c3a1e] font-black py-4 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-4"
            >
              <span>Continue to Menu</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // STEP 2: BROWSE MENU & SELECT ITEMS
  return (
    <div className="min-h-screen bg-[#fafbfa] text-[#1c3a1e] font-sans pb-28 antialiased">
      {/* Top Customer Info Bar */}
      <div className="bg-[#1c3a1e] text-white p-4 sm:p-6 shadow-md rounded-b-3xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest bg-[#d4af37]/15 px-2.5 py-0.5 rounded-full border border-[#d4af37]/30">
                {orderType === 'takeout' ? '🛍️ TAKEOUT ORDER' : '🏕️ CAMPING ORDER'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-1">
              Ordering for: <span className="text-[#d4af37]">{customerName}</span>
            </h1>
            {customerPhone && (
              <p className="text-xs text-emerald-100/80 mt-0.5">Phone: {customerPhone}</p>
            )}
          </div>

          <button
            onClick={() => setTakeoutStep(1)}
            className="bg-white/10 hover:bg-white/20 text-white font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Edit Info</span>
          </button>
        </div>
      </div>

      {/* Sticky Category Navigation & Search Bar */}
      <div className="sticky top-0 z-30 bg-[#fafbfa]/95 backdrop-blur-md py-3 px-4 border-b border-[#1c3a1e]/10 shadow-xs space-y-2.5">
        <div className="max-w-3xl mx-auto space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search delicious dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#1c3a1e]/15 rounded-2xl pl-10 pr-8 py-2 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e] shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar scrollbar-none pb-0.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1c3a1e] text-white shadow-md'
                  : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#1c3a1e] text-white shadow-md'
                    : 'bg-[#eaf2eb] text-[#1c3a1e] hover:bg-[#d8e6da]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Menu Items Rendered by Category Sections (like /order) */}
        {categories.map((cat) => {
          const catItems = filteredItems
            .filter((item) => item.category_id === cat.id)
            .sort((a, b) => {
              const orderA = a.sort_order ?? 0;
              const orderB = b.sort_order ?? 0;
              if (orderA !== orderB) return orderA - orderB;
              return a.name.localeCompare(b.name);
            });

          if (catItems.length === 0) return null;

          return (
            <section key={cat.id} className="scroll-mt-36">
              {/* Category Header */}
              <div className="sticky top-[110px] z-20 bg-[#fafbfa]/95 backdrop-blur-md px-4 py-1.5 mb-3 border-b border-[#1c3a1e]/15 flex items-center justify-between shadow-xs">
                <h2 className="text-base font-black text-[#1c3a1e] flex items-center gap-2 tracking-wide">
                  <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-pulse" />
                  <span>{cat.name}</span>
                </h2>
                <span className="text-[11px] font-bold text-[#1c3a1e] bg-[#eaf2eb] px-2.5 py-1 rounded-full border border-[#1c3a1e]/10">
                  {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Horizontal Row Layout Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {catItems.map((item) => {
                  const rawImg = item.image_url || '';
                  const displayImage = transformGoogleDriveUrl(rawImg) || '/images/Skylight-logo-icon.png';
                  const hasModifiers = item.modifier_groups && item.modifier_groups.length > 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenModifierModal(item)}
                      className="bg-white rounded-2xl overflow-hidden flex flex-row items-center p-3 gap-3.5 transition-all group border border-[#1c3a1e]/10 shadow-xs hover:border-[#d4af37] hover:shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      {/* Left Thumbnail Image */}
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 bg-[#f4f7f4] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#1c3a1e]/10">
                        <img
                          src={displayImage}
                          alt={item.name}
                          className={`w-full h-full ${item.image_url ? 'object-cover' : 'object-contain p-4 opacity-50 filter invert'} group-hover:scale-105 transition-transform duration-300`}
                          onError={(e: any) => {
                            e.target.src = '/images/Skylight-logo-icon.png';
                            e.target.className = 'w-full h-full object-contain p-4 opacity-50';
                          }}
                        />
                        {item.is_bestseller && (
                          <div className="absolute top-1 left-1 bg-[#d4af37] text-[#1c3a1e] font-black text-[9px] px-1.5 py-0.5 rounded-md shadow-sm z-10 flex items-center gap-0.5">
                            ⭐ Speciality
                          </div>
                        )}
                      </div>

                      {/* Right Content */}
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

                        <div className="flex items-center justify-between pt-1.5 mt-auto border-t border-[#1c3a1e]/10">
                          <span className="text-xs font-black text-[#1c3a1e]">
                            ${Number(item.price_usd).toFixed(2)}
                          </span>

                          <div className="bg-[#eaf2eb] group-hover:bg-[#1c3a1e] group-hover:text-white text-[#1c3a1e] h-8 px-3 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shadow-xs">
                            <Plus className="h-3.5 w-3.5" />
                            <span>{hasModifiers ? 'Customize' : 'Add'}</span>
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
      </div>

      {/* Floating Checkout Footer Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#1c3a1e]/20 p-4 shadow-2xl z-40">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-[#1c3a1e] uppercase tracking-wider block">
                Total ({cartItemCount} items)
              </span>
              <span className="text-xl font-black text-[#1c3a1e]">${cartTotalUsd.toFixed(2)}</span>
            </div>

            {orderError && (
              <div className="text-xs text-red-600 font-bold flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                <span>{orderError}</span>
              </div>
            )}

            <button
              onClick={handleCheckoutSubmit}
              disabled={isSubmitting}
              className="bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Transmitting Order...</span>
              ) : (
                <>
                  <span>Submit {orderType === 'takeout' ? 'Takeout' : 'Camping'} Order</span>
                  <CheckCircle className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Item Modifier Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <div>
                <h3 className="text-lg font-black">{activeModalItem.name}</h3>
                <span className="text-xs font-bold text-gray-500">${Number(activeModalItem.price_usd).toFixed(2)}</span>
              </div>
              <button
                onClick={() => setActiveModalItem(null)}
                className="text-gray-400 hover:text-black font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 mb-4">
              {activeModalItem.modifier_groups && activeModalItem.modifier_groups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-[#1c3a1e]">{group.group_name}</span>
                    {group.required ? (
                      <span className="text-[9px] font-extrabold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        Required
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Optional</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map((opt, oIdx) => {
                      const isSelected = modalModifiers.some(
                        (m) => m.group === group.group_name && m.option === opt.name
                      );

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleToggleModifierOption(group.group_name, opt.name, opt.price_extra_usd)}
                          className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all cursor-pointer flex justify-between items-center ${
                            isSelected
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20 hover:bg-[#eaf2eb]'
                          }`}
                        >
                          <span>{opt.name}</span>
                          {opt.price_extra_usd > 0 && (
                            <span className={isSelected ? 'text-[#d4af37]' : 'text-gray-500'}>
                              +${opt.price_extra_usd.toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Special Preparation Notes</label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Extra sauce, no onions..."
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                />
              </div>
            </div>

            <button
              onClick={handleAddModalItemToCart}
              className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Add to Takeout Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
