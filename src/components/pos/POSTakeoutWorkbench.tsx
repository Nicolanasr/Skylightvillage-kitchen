'use client';

import React, { useState } from 'react';
import { TableSession, OrderItem } from '@/lib/types';
import { createTakeoutOrCampingSession } from '@/app/actions/order-actions';
import { formatUsd } from '@/lib/currency';
import { ShoppingBag, MapPin, Plus, User, Phone, CheckCircle2, Clock, Eye, Search } from 'lucide-react';

interface POSTakeoutWorkbenchProps {
  sessions: TableSession[];
  orderItems: OrderItem[];
  discounts: any[];
  payments: any[];
  selectedSession: TableSession | null;
  onSelectSession: (sess: TableSession) => void;
  refreshPOSData: () => void;
}

export const POSTakeoutWorkbench: React.FC<POSTakeoutWorkbenchProps> = ({
  sessions,
  orderItems,
  discounts,
  payments,
  selectedSession,
  onSelectSession,
  refreshPOSData,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'takeout' | 'camping'>('takeout');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter non-table sessions (takeout & camping)
  const takeoutSessions = sessions.filter(
    (s) => (s.order_type === 'takeout' || s.order_type === 'camping') && s.status === 'active'
  );

  const filteredSessions = takeoutSessions.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (s.customer_name || '').toLowerCase().includes(term);
    const phoneMatch = (s.customer_phone || '').toLowerCase().includes(term);
    return nameMatch || phoneMatch;
  });

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return alert('Customer Name / Tag is required.');

    const res = await createTakeoutOrCampingSession({
      orderType: modalType,
      customerName: custName.trim(),
      customerPhone: custPhone.trim(),
    });

    if (res.success && res.session) {
      setIsModalOpen(false);
      setCustName('');
      setCustPhone('');
      refreshPOSData();
      onSelectSession(res.session);
    } else {
      alert(res.error || 'Failed to create session');
    }
  };

  return (
    <div className="space-y-6">
      {/* Workbench Header & Action Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-[#1c3a1e]/15 rounded-3xl p-5 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#1c3a1e] flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#d4af37]" />
            <span>Takeout & Camping Orders Workbench</span>
          </h2>
          <p className="text-xs text-gray-600 font-medium mt-0.5">
            Manage active pick-up orders, phone orders, and outdoor camping guests
          </p>
        </div>

        {/* Search & New Order Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or mobile #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-2xl pl-9 pr-3 py-2 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalType('takeout');
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-initial bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ New Takeout</span>
            </button>

            <button
              onClick={() => {
                setModalType('camping');
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-initial bg-purple-700 hover:bg-purple-800 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <MapPin className="h-4 w-4" />
              <span>+ New Camping</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Non-Table Orders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white border border-dashed border-gray-300 rounded-3xl text-xs font-bold text-gray-500 space-y-2">
            <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto" />
            <p>
              {searchTerm.trim()
                ? `No active orders match "${searchTerm}"`
                : 'No active Takeout or Camping orders at the moment.'}
            </p>
            <p className="text-gray-400 font-normal">Click "+ New Takeout" or "+ New Camping" to start a new order.</p>
          </div>
        ) : (
          filteredSessions.map((sess) => {
            const sessItems = orderItems.filter(
              (i) => i.session_id === sess.id && i.status !== 'cancelled'
            );
            const isSelected = selectedSession?.id === sess.id;
            const subtotal = sessItems.reduce((sum, i) => sum + Number(i.unit_price_usd) * i.quantity, 0);

            return (
              <div
                key={sess.id}
                onClick={() => onSelectSession(sess)}
                className={`rounded-3xl p-5 border-2 cursor-pointer transition-all shadow-xs flex flex-col justify-between min-h-[160px] ${
                  isSelected
                    ? 'border-[#1c3a1e] bg-[#1c3a1e] text-white ring-4 ring-[#1c3a1e]/20 scale-[1.02]'
                    : sess.order_type === 'camping'
                    ? 'border-purple-300 bg-purple-50/80 text-purple-950 hover:bg-purple-100'
                    : 'border-amber-300 bg-amber-50/80 text-amber-950 hover:bg-amber-100'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg border bg-white/20 border-black/10 flex items-center gap-1">
                      {sess.order_type === 'camping' ? (
                        <>
                          <MapPin className="h-3 w-3 text-purple-700" /> CAMPING ORDER
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="h-3 w-3 text-amber-700" /> TAKEOUT ORDER
                        </>
                      )}
                    </span>

                    <span className="text-[10px] font-mono font-extrabold opacity-75">
                      {new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-base font-black leading-tight mb-1">
                    {sess.customer_name || 'Anonymous Customer'}
                  </h3>

                  {sess.customer_phone && (
                    <div className="text-xs font-bold opacity-80 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{sess.customer_phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-current/15 flex justify-between items-center mt-3">
                  <span className="text-xs font-extrabold">
                    {sessItems.length} {sessItems.length === 1 ? 'item' : 'items'}
                  </span>
                  <span className="text-base font-black">{formatUsd(subtotal)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-base font-black">
                {modalType === 'takeout' ? '🛍️ Start New Takeout Order' : '🏕️ Start New Camping Order'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-black font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Customer Name / Tent Tag *
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder={modalType === 'takeout' ? 'e.g. Marc H.' : 'e.g. Tent #4 near River'}
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-extrabold focus:outline-none focus:border-[#1c3a1e]"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="e.g. +961 70 123 456"
                  className="w-full bg-[#fafbfa] border border-[#1c3a1e]/20 rounded-xl p-3 text-xs text-[#1c3a1e] font-bold focus:outline-none focus:border-[#1c3a1e]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md mt-2"
              >
                Open Order Cart
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
