'use client';

import React, { useState, useEffect } from 'react';
import { CustomerProfile, getAllCustomersCRM, getCustomer360CRM, updateCustomerNotesAndTags } from '@/app/actions/crm-actions';
import {
  Users,
  Crown,
  DollarSign,
  Search,
  Tag,
  Phone,
  MessageSquare,
  Clock,
  ChevronRight,
  Sparkles,
  Save,
  CheckCircle2,
  X,
  ShoppingBag,
  Plus
} from 'lucide-react';

export const AdminCRMManager: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [stats, setStats] = useState({ total: 0, vips: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Customer Detail Drawer Modal state
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [custDetail, setCustDetail] = useState<{
    customer: CustomerProfile;
    itemHistory: any[];
    recentSessions: any[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit notes & tags state inside drawer
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchCRMData = async () => {
    setLoading(true);
    try {
      const res = await getAllCustomersCRM({ search: searchTerm, tag: selectedTag });
      if (res.success) {
        setCustomers(res.customers);
        setStats(res.stats);
      }
    } catch (e) {
      console.error('CRM load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
  }, [searchTerm, selectedTag]);

  const handleOpenCustomer360 = async (id: string) => {
    setSelectedCustId(id);
    setLoadingDetail(true);
    try {
      const res = await getCustomer360CRM(id);
      if (res.success && res.customer) {
        setCustDetail({
          customer: res.customer,
          itemHistory: res.itemHistory || [],
          recentSessions: res.recentSessions || [],
        });
        setEditNotes(res.customer.notes || '');
        setEditTags(res.customer.tags || []);
      }
    } catch (e) {
      console.error('Customer 360 load error:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveNotesAndTags = async () => {
    if (!selectedCustId) return;
    setSavingNotes(true);
    try {
      const res = await updateCustomerNotesAndTags(selectedCustId, editNotes, editTags);
      if (res.success) {
        setToastMsg('Guest profile updated successfully!');
        setTimeout(() => setToastMsg(null), 3000);
        fetchCRMData();
        if (custDetail) {
          setCustDetail({
            ...custDetail,
            customer: {
              ...custDetail.customer,
              notes: editNotes,
              tags: editTags,
            },
          });
        }
      }
    } catch (e) {
      console.error('Save CRM error:', e);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const tagClean = newTagInput.trim();
    if (!editTags.includes(tagClean)) {
      setEditTags([...editTags, tagClean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c3a1e] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-[#d4af37]/30 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-[#d4af37]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & CRM Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Total Guest Profiles</p>
            <h3 className="text-2xl font-black text-[#1c3a1e] mt-1">{stats.total}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Automated CRM Database</p>
          </div>
          <div className="p-3 bg-[#1c3a1e]/5 rounded-2xl border border-[#1c3a1e]/10">
            <Users className="h-6 w-6 text-[#1c3a1e]" />
          </div>
        </div>

        <div className="bg-white border border-[#d4af37]/30 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-[#a38020] font-bold uppercase tracking-wider">VIP Guests</p>
            <h3 className="text-2xl font-black text-[#1c3a1e] mt-1">{stats.vips}</h3>
            <p className="text-[11px] text-[#a38020] mt-0.5">$100+ Spent or VIP Badge</p>
          </div>
          <div className="p-3 bg-[#d4af37]/10 rounded-2xl border border-[#d4af37]/20">
            <Crown className="h-6 w-6 text-[#d4af37]" />
          </div>
        </div>

        <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Tracked CRM Revenue</p>
            <h3 className="text-2xl font-black text-emerald-800 mt-1">${stats.totalRevenue.toFixed(2)}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Across All Customer Orders</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <DollarSign className="h-6 w-6 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or VIP code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#1c3a1e]/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1c3a1e] placeholder-gray-400 focus:outline-none focus:border-[#1c3a1e] shadow-xs"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {['all', 'VIP', 'New Guest', 'Regular', 'Hookah'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[#1c3a1e] text-white shadow-xs'
                  : 'bg-white border border-[#1c3a1e]/15 text-gray-600 hover:text-black'
              }`}
            >
              {tag === 'all' ? 'All Customers' : tag}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white border border-[#1c3a1e]/15 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1c3a1e]">
            <thead className="bg-[#1c3a1e]/5 border-b border-[#1c3a1e]/10 text-gray-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Guest Profile</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Tags & Badges</th>
                <th className="py-3 px-4">Orders</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4">Points</th>
                <th className="py-3 px-4 text-right">360° Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c3a1e]/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
                    Loading customer profiles...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
                    No customer profiles found matching your search.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                    onClick={() => handleOpenCustomer360(cust.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[#1c3a1e]/10 border border-[#1c3a1e]/20 flex items-center justify-center font-black text-xs text-[#1c3a1e]">
                          {cust.name ? cust.name.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div>
                          <p className="font-black text-xs text-[#1c3a1e] flex items-center gap-1.5">
                            {cust.name}
                            {cust.vip_code && (
                              <span className="text-[10px] bg-[#d4af37]/15 text-[#8a6b10] px-1.5 py-0.5 rounded-md font-bold">
                                {cust.vip_code}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-600 font-mono">{cust.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-gray-700">
                      {cust.phone_number ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-800" />
                          {cust.phone_number}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No phone</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(cust.tags || []).map((t, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              t === 'VIP'
                                ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#8a6b10]'
                                : 'bg-gray-100 border-gray-200 text-gray-700'
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-black">{cust.total_orders} visits</td>

                    <td className="py-3 px-4 font-black text-emerald-800">
                      ${cust.total_spent_usd.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-black text-[#a38020]">
                      {cust.points_balance} pts
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button className="text-xs text-[#1c3a1e] font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                        <span>View 360°</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 360° Customer Profile Drawer / Modal */}
      {selectedCustId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="bg-[#1c3a1e] text-white p-5 flex items-center justify-between border-b border-[#d4af37]/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center font-black text-base text-[#d4af37]">
                  {custDetail?.customer?.name ? custDetail.customer.name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    {custDetail?.customer?.name || 'Guest Profile'}
                    {custDetail?.customer?.vip_code && (
                      <span className="text-[10px] bg-[#d4af37] text-[#1c3a1e] font-black px-2 py-0.5 rounded-full">
                        {custDetail.customer.vip_code}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-300 font-mono">
                    Phone: {custDetail?.customer?.phone_number || 'None'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustId(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="py-12 text-center text-gray-500 font-medium">
                  Loading guest 360° analytics...
                </div>
              ) : custDetail ? (
                <>
                  {/* Quick Stat Highlights */}
                  <div className="grid grid-cols-3 gap-3 bg-[#1c3a1e]/5 p-4 rounded-2xl border border-[#1c3a1e]/10">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 font-bold uppercase">Total Spent</p>
                      <p className="text-base font-black text-emerald-800 mt-0.5">
                        ${custDetail.customer.total_spent_usd.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center border-x border-[#1c3a1e]/10">
                      <p className="text-[10px] text-gray-600 font-bold uppercase">Total Visits</p>
                      <p className="text-base font-black text-[#1c3a1e] mt-0.5">
                        {custDetail.customer.total_orders}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 font-bold uppercase">Loyalty Points</p>
                      <p className="text-base font-black text-[#a38020] mt-0.5">
                        {custDetail.customer.points_balance} pts
                      </p>
                    </div>
                  </div>

                  {/* Direct Contact Action */}
                  {custDetail.customer.phone_number && (
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://wa.me/${custDetail.customer.phone_number.replace(/[^\d]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat on WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${custDetail.customer.phone_number}`}
                        className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Phone className="h-4 w-4 text-gray-600" />
                        <span>Call</span>
                      </a>
                    </div>
                  )}

                  {/* Customer Tags Manager */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1c3a1e] flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-[#1c3a1e]" />
                      <span>Guest Tags & Badges</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {editTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-[#1c3a1e]/10 border border-[#1c3a1e]/20 text-[#1c3a1e] text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-600 cursor-pointer ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Add tag..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                          className="bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs text-black w-24 focus:outline-none focus:border-[#1c3a1e]"
                        />
                        <button
                          onClick={handleAddTag}
                          className="p-1 bg-[#1c3a1e] text-white rounded-lg hover:bg-black cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Staff Notes Editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1c3a1e] flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-[#1c3a1e]" />
                      <span>Staff & Waiter Notes</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add waiter notes (e.g., Prefers Outdoor Table #4, Allergic to nuts, Prefers well-done meat)..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-2xl p-3 text-xs text-[#1c3a1e] focus:outline-none focus:border-[#1c3a1e]"
                    />
                  </div>

                  {/* Item Order History Breakdown */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-[#1c3a1e]" />
                      <span>Favorite Dishes & Order History</span>
                    </h4>

                    {custDetail.itemHistory.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No specific dish history recorded yet.</p>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200 divide-y divide-gray-200">
                        {custDetail.itemHistory.map((item, idx) => (
                          <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                            <span className="font-bold text-[#1c3a1e]">
                              {item.total_qty}x {item.item_name}
                            </span>
                            <span className="font-black text-emerald-800">
                              ${Number(item.total_spent || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Previous Orders & Sessions History */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-[#1c3a1e]" />
                      <span>Previous Table Visits &amp; Order History ({custDetail.recentSessions.length})</span>
                    </h4>

                    {custDetail.recentSessions.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No visit session history recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {custDetail.recentSessions.map((sess) => (
                          <div key={sess.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-200 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-[#1c3a1e]">
                                Session #{sess.id.slice(0, 8)} • Status: <span className="uppercase text-emerald-800 font-bold">{sess.status}</span>
                              </span>
                              <span className="font-black text-emerald-800">
                                ${Number(sess.final_total_usd || sess.subtotal_usd || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium">
                              Date: {sess.created_at ? new Date(sess.created_at).toLocaleString() : 'Recent'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer Save Button */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleSaveNotesAndTags}
                disabled={savingNotes}
                className="bg-[#1c3a1e] hover:bg-black text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{savingNotes ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
