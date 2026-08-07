'use client';

import React from 'react';
import { TableSession, MenuItem } from '@/lib/types';
import { StatusLogEntry } from '@/app/actions/report-actions';
import { getInvoiceReference } from '@/lib/currency';
import { ChevronRight } from 'lucide-react';

interface OrderDetailsDrawerProps {
  selectedOrderForDrawer: TableSession | null;
  onClose: () => void;
  tables: any[];
  menuItems: MenuItem[];
  statusLogs: StatusLogEntry[];
  getSessionDetails: (sess: TableSession) => any;
}

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  selectedOrderForDrawer,
  onClose,
  tables,
  menuItems,
  statusLogs,
  getSessionDetails,
}) => {
  if (!selectedOrderForDrawer) return null;

  const drawerDetails = getSessionDetails(selectedOrderForDrawer);
  const primaryTbl = tables.find((t) => t.id === selectedOrderForDrawer.primary_table_id);
  const primaryNum = primaryTbl?.table_number || 1;
  const invoiceRef = getInvoiceReference(primaryNum, selectedOrderForDrawer.id);

  // Consolidate identical items into single lines (e.g. 2x Pepsi)
  const consolidatedDrawerItems = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const item of (drawerDetails?.sessItems || [])) {
      const modKey = JSON.stringify(item.selected_modifiers || []);
      const compKey = item.is_comped ? 'comped' : 'normal';
      const key = `${item.item_name}_${item.unit_price_usd}_${modKey}_${compKey}`;

      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity += (item.quantity || 1);
        if (!existing.all_ids) existing.all_ids = [existing.id];
        existing.all_ids.push(item.id);
      } else {
        map.set(key, { ...item, quantity: item.quantity || 1, all_ids: [item.id] });
      }
    }
    return Array.from(map.values());
  }, [drawerDetails?.sessItems]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1c3a1e]/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-3xl rounded-3xl p-6 shadow-2xl max-h-[92vh] flex flex-col justify-between overflow-hidden text-[#1c3a1e]">
        <div>
          {/* Drawer Header */}
          <div className="flex justify-between items-start pb-4 border-b border-[#1c3a1e]/15 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-[#1c3a1e]">{invoiceRef}</h3>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                    selectedOrderForDrawer.status === 'closed'
                      ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                  }`}
                >
                  {selectedOrderForDrawer.status === 'closed' ? 'CLOSED (PAID)' : 'ACTIVE TABLE SESSION'}
                </span>
              </div>
              <div className="text-xs text-gray-600 font-medium mt-1">
                Table #{primaryNum} • Session UUID:{' '}
                <span className="font-mono text-[#1c3a1e] font-bold">{selectedOrderForDrawer.id}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer text-xs font-bold"
            >
              ✕ Close
            </button>
          </div>

          {/* Itemized Dish Breakdown */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 mb-4">
            <h4 className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider flex justify-between items-center">
              <span>Ordered Dishes Summary & Status Timelines:</span>
              <span className="font-extrabold text-[#1c3a1e] text-[11px] bg-[#eaf2eb] px-2.5 py-1 rounded-lg border border-[#1c3a1e]/15">
                {consolidatedDrawerItems.length} Unique Dishes ({drawerDetails.sessItems.length} Total Units)
              </span>
            </h4>

            {consolidatedDrawerItems.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-500">
                No order line items recorded for this table session.
              </div>
            ) : (
              consolidatedDrawerItems.map((item: any) => {
                const itemIds = item.all_ids || [item.id];
                const itemLogs = statusLogs
                  .filter((l) => itemIds.includes(l.order_item_id))
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                const lineTotal = Number(item.unit_price_usd) * item.quantity;
                const menuItemObj =
                  menuItems.find((m) => m.id === item.menu_item_id) ||
                  menuItems.find((m) => m.name.toLowerCase().trim() === item.item_name.toLowerCase().trim()) ||
                  menuItems.find(
                    (m) =>
                      item.item_name.toLowerCase().includes(m.name.toLowerCase()) ||
                      m.name.toLowerCase().includes(item.item_name.toLowerCase())
                  );

                const rawImg = menuItemObj?.image_url || item.image_url || '';
                const imgUrl = rawImg.includes('drive.google.com')
                  ? `/api/image-proxy?url=${encodeURIComponent(rawImg)}`
                  : rawImg;

                return (
                  <div key={item.id} className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl border border-[#1c3a1e]/15 bg-amber-50 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.item_name}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <span className="text-base font-black text-[#1c3a1e] select-none">
                            {item.item_name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-[#1c3a1e]">
                              {item.quantity}x {item.item_name}
                            </span>
                            <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                              Station: {item.station}
                            </span>
                            {item.table_number !== undefined && (
                              <span className="text-[10px] font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md">
                                Table #{item.table_number}
                              </span>
                            )}
                            {item.guest_name && (
                              <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-md">
                                Guest: {item.guest_name}
                              </span>
                            )}
                          </div>

                          {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                            <div className="text-[11px] text-gray-600 font-semibold mt-0.5">
                              Modifiers:{' '}
                              {item.selected_modifiers
                                .map((m: any) => `${m.group || ''}: ${m.option || m.name || ''}`)
                                .join(', ')}
                            </div>
                          )}
                          {item.special_notes && (
                            <div className="text-[11px] text-gray-700 font-bold italic mt-0.5">
                              Note: {item.special_notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-sm text-emerald-800">
                          {item.is_comped ? 'COMP' : `$${lineTotal.toFixed(2)}`}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase block mt-0.5 ${
                            item.is_paid ? 'text-emerald-800' : 'text-amber-800'
                          }`}
                        >
                          {item.is_paid ? 'PAID' : item.status}
                        </span>
                      </div>
                    </div>

                    {/* Status Logs Timeline */}
                    <div className="border-t border-[#1c3a1e]/10 pt-2 text-[11px]">
                      <span className="font-extrabold text-gray-600 block mb-1">Status Duration Lifecycle Logs ⏱️:</span>
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="bg-white border border-amber-300 text-amber-900 px-2 py-1 rounded-lg font-bold text-[10.5px]">
                          🟡 Pending ({new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </div>

                        {itemLogs.map((log) => {
                          const durText =
                            log.duration_seconds > 60
                              ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s`
                              : `${log.duration_seconds}s`;
                          return (
                            <div key={log.id} className="flex items-center gap-1.5">
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <div
                                className={`px-2 py-1 rounded-lg font-bold text-[10.5px] border ${
                                  log.to_status === 'preparing'
                                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                                    : log.to_status === 'ready'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : log.to_status === 'delivered'
                                    ? 'bg-purple-50 border-purple-300 text-purple-900'
                                    : 'bg-red-50 border-red-300 text-red-900'
                                }`}
                              >
                                <span>{log.to_status.toUpperCase()}</span>
                                <span className="ml-1 text-[9.5px] opacity-75">({durText} wait)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Drawer Footer Summary */}
        <div className="border-t border-[#1c3a1e]/15 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <div className="bg-[#fafbfa] border border-[#1c3a1e]/15 rounded-2xl p-3.5 text-xs space-y-1.5 min-w-[300px]">
              <div className="flex justify-between items-center text-gray-600 font-bold">
                <span>Subtotal Amount:</span>
                <span className="font-black text-[#1c3a1e]">${drawerDetails.bill.subtotalUsd.toFixed(2)}</span>
              </div>

              {drawerDetails.bill.discountUsd > 0 && (
                <div className="flex justify-between items-center text-amber-800 font-extrabold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                  <span>Discount Applied 🏷️:</span>
                  <span>-${drawerDetails.bill.discountUsd.toFixed(2)} Off</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[#1c3a1e] font-black text-sm pt-1 border-t border-gray-200">
                <span>Final Total Check:</span>
                <span className="text-emerald-800">${drawerDetails.bill.finalTotalUsd.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-gray-500 font-bold text-[11px]">
                <span>Paid So Far:</span>
                <span className="text-emerald-700">${drawerDetails.bill.paidUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black px-6 py-3 rounded-2xl text-xs shadow-xs transition-all cursor-pointer text-center"
          >
            Done & Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
