'use client';

import { useState, useEffect } from 'react';
import { useRealtimePOS } from '@/hooks/useRealtimePOS';
import { Table, TableSession, MenuItem, OrderItem, getMenuItemPrice } from '@/lib/types';
import { calculateBillTotals, formatLbp } from '@/lib/currency';
import { addWaiterManualOrderItem, addBatchWaiterManualOrderItems } from '../actions/order-actions';
import { ThermalReceipt } from '@/components/pos/invoice-receipt';
import { StaffAuthGuard } from '@/components/auth/staff-auth-guard';
import { POSHeader } from '@/components/pos/POSHeader';
import { POSFloorPlan } from '@/components/pos/POSFloorPlan';
import { POSTakeoutWorkbench } from '@/components/pos/POSTakeoutWorkbench';
import { POSMenuGrid } from '@/components/pos/POSMenuGrid';
import { POSCartPanel } from '@/components/pos/POSCartPanel';
import { POSModals } from '@/components/pos/POSModals';
import { Plus, Check, CheckCircle2 } from 'lucide-react';

export default function POSPage() {
  return (
    <StaffAuthGuard pageTitle="Waiter & Cashier POS Terminal">
      <POSContent />
    </StaffAuthGuard>
  );
}

function POSContent() {
  const { tables, sessions, serviceCalls, orderItems, discounts, payments, menuItems, categories, refreshPOSData } =
    useRealtimePOS();

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showAllFloorTables, setShowAllFloorTables] = useState(true);
  const [posViewMode, setPosViewMode] = useState<'tables' | 'takeout'>('tables');
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Modals state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Thermal Receipt Modal State
  const [isPreviewReceiptModalOpen, setIsPreviewReceiptModalOpen] = useState(false);

  // Multi-Item Modifier & Add Dish Modal State
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedMenuItemForWaiter, setSelectedMenuItemForWaiter] = useState<MenuItem | null>(null);
  const [selectedWaiterModifiers, setSelectedWaiterModifiers] = useState<any[]>([]);

  // Multi-Item Selector Cart State
  const [multiItemCart, setMultiItemCart] = useState<
    Array<{
      item: MenuItem;
      quantity: number;
      selectedModifiers: any[];
      specialNotes: string;
    }>
  >([]);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Split receipt state for standalone invoice printing
  const [activeSplitReceipt, setActiveSplitReceipt] = useState<{
    items: OrderItem[];
    amountUsd: number;
    guestName?: string;
    splitTypeLabel: string;
    paymentMethod: string;
  } | null>(null);

  // Auto-select Table #1 or first available table on initial load if none selected
  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0]);
    }
  }, [tables, selectedTable]);

  // Find active session where selectedTable is primary OR secondary merged table
  const activeSession = selectedTable
    ? sessions.find((s) => {
        if (s.status !== 'active') return false;

        // Non-table Takeout/Camping virtual selection
        if (selectedTable.table_number === 0 || selectedTable.qr_code_token === 'takeout') {
          return s.id === selectedTable.id;
        }

        // Physical floor table (table_number > 0): ignore takeout & camping non-table sessions
        if (s.order_type === 'takeout' || s.order_type === 'camping') return false;

        if (s.primary_table_id === selectedTable.id) return true;

        let rawArr: string[] = [];
        if (Array.isArray(s.merged_table_ids)) {
          rawArr = s.merged_table_ids;
        } else if (typeof s.merged_table_ids === 'string') {
          try {
            const formattedStr = (s.merged_table_ids as string)
              .replace(/^{/, '[')
              .replace(/}$/, ']');
            rawArr = JSON.parse(formattedStr);
          } catch (e) {}
        }
        return rawArr.includes(selectedTable.id);
      }) || null
    : null;

  const tableItems = selectedTable && activeSession
    ? orderItems.filter((i) => i.session_id === activeSession.id && i.status !== 'cancelled')
    : [];

  const handleSelectItemForCart = (menuItem: MenuItem) => {
    setSelectedMenuItemForWaiter(menuItem);
    setSelectedWaiterModifiers([]);
  };

  const handleAddSingleItemDirectly = async (menuItem: MenuItem, modifiers: any[] = []) => {
    if (!selectedTable) return;
    setAddingItemId(menuItem.id);
    try {
      await addWaiterManualOrderItem({
        tableId: selectedTable.id,
        tableNumber: selectedTable.table_number,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPriceUsd: getMenuItemPrice(menuItem, activeSession?.order_type),
        quantity: 1,
        station: menuItem.station,
        selectedModifiers: modifiers,
        specialNotes: 'Added by Waiter',
      });
      triggerToast(`✓ Added 1x ${menuItem.name} to Table #${selectedTable.table_number} cart`);
      refreshPOSData();
    } finally {
      setAddingItemId(null);
    }
  };

  const handleAddMultiItemToCart = (menuItem: MenuItem) => {
    setMultiItemCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.item.id === menuItem.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          item: menuItem,
          quantity: 1,
          selectedModifiers: selectedWaiterModifiers,
          specialNotes: 'Added by Waiter',
        },
      ];
    });
    setSelectedMenuItemForWaiter(null);
    triggerToast(`✓ Added 1x ${menuItem.name} to batch cart`);
  };

  const handleBatchSubmitMultiItems = async () => {
    if (!selectedTable || multiItemCart.length === 0) return;
    const batchItems = multiItemCart.map((c) => ({
      menuItemId: c.item.id,
      itemName: c.item.name,
      unitPriceUsd: Number(c.item.price_usd),
      quantity: c.quantity,
      station: c.item.station,
      selectedModifiers: c.selectedModifiers,
      specialNotes: c.specialNotes,
    }));

    await addBatchWaiterManualOrderItems({
      tableId: selectedTable.id,
      tableNumber: selectedTable.table_number,
      items: batchItems,
    });
    triggerToast(`✓ Added ${multiItemCart.length} items to Table #${selectedTable.table_number} cart`);
    setMultiItemCart([]);
    setIsAddItemModalOpen(false);
    refreshPOSData();
  };

  return (
    <div className="min-h-screen bg-[#fafbfa] p-4 sm:p-6 md:p-8 font-sans antialiased text-[#1c3a1e]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Navigation & Pending Service Calls */}
        <POSHeader
          serviceCalls={serviceCalls}
          refreshPOSData={refreshPOSData}
          showAllFloorTables={showAllFloorTables}
          setShowAllFloorTables={setShowAllFloorTables}
          posViewMode={posViewMode}
          setPosViewMode={setPosViewMode}
          orderItems={orderItems}
          sessions={sessions}
        />

        {/* Main Content Layout */}
        {showAllFloorTables ? (
          posViewMode === 'tables' ? (
            <POSFloorPlan
              tables={tables}
              sessions={sessions}
              orderItems={orderItems}
              discounts={discounts}
              payments={payments}
              selectedTable={selectedTable}
              onSelectTable={(tbl) => {
                setSelectedTable(tbl);
                setShowAllFloorTables(false);
              }}
            />
          ) : (
            <POSTakeoutWorkbench
              sessions={sessions}
              orderItems={orderItems}
              discounts={discounts}
              payments={payments}
              selectedSession={activeSession}
              onSelectSession={(sess) => {
                const virtualTbl: Table = {
                  id: sess.id,
                  table_number: 0,
                  qr_code_token: 'takeout',
                  status: 'occupied',
                };
                setSelectedTable(virtualTbl);
                setShowAllFloorTables(false);
              }}
              refreshPOSData={refreshPOSData}
            />
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Menu Grid */}
            <div className="lg:col-span-7 space-y-4">
              <POSMenuGrid
                categories={categories}
                menuItems={menuItems}
                addingItemId={addingItemId}
                activeOrderType={activeSession?.order_type}
                onSelectItemForCart={(item) => {
                  if (item.modifier_groups && item.modifier_groups.length > 0) {
                    handleSelectItemForCart(item);
                  } else {
                    handleAddSingleItemDirectly(item);
                  }
                }}
              />
            </div>

            {/* Right 5 Columns: Selected Table Cart & Bill Summary */}
            <div className="lg:col-span-5">
              <POSCartPanel
                selectedTable={selectedTable}
                activeSession={activeSession}
                tableItems={tableItems}
                discounts={discounts}
                payments={payments}
                menuItems={menuItems}
                refreshPOSData={refreshPOSData}
                onOpenAddItemModal={() => setIsAddItemModalOpen(true)}
                onOpenDiscountModal={() => setIsDiscountModalOpen(true)}
                onOpenPreviewReceipt={() => setIsPreviewReceiptModalOpen(true)}
                onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
                onOpenMergeModal={() => setIsMergeModalOpen(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Thermal Receipt Component (Single instance handles print portal and modal preview) */}
      {selectedTable && activeSession && (
        <ThermalReceipt
          tableNumber={selectedTable.table_number}
          items={activeSplitReceipt ? activeSplitReceipt.items : tableItems}
          totals={
            activeSplitReceipt
              ? {
                  subtotalUsd: activeSplitReceipt.amountUsd,
                  discountUsd: 0,
                  finalTotalUsd: activeSplitReceipt.amountUsd,
                  finalTotalLbp: formatLbp(activeSplitReceipt.amountUsd * 89500),
                  paidUsd: 0,
                  remainingUsd: activeSplitReceipt.amountUsd,
                  remainingLbp: formatLbp(activeSplitReceipt.amountUsd * 89500),
                }
              : calculateBillTotals(
                  tableItems,
                  discounts.filter((d) => d.session_id === activeSession.id),
                  payments.filter((p) => p.session_id === activeSession.id),
                  89500
                )
          }
          isFinal={activeSession.status === 'closed'}
          guestName={activeSplitReceipt?.guestName}
          sessionId={activeSession.id}
          forceVisible={isPreviewReceiptModalOpen}
          onClosePreview={() => {
            setIsPreviewReceiptModalOpen(false);
            setActiveSplitReceipt(null);
          }}
          splitPaymentDetails={
            activeSplitReceipt
              ? {
                  splitTypeLabel: activeSplitReceipt.splitTypeLabel,
                  amountPaidUsd: activeSplitReceipt.amountUsd,
                  paymentMethod: activeSplitReceipt.paymentMethod,
                }
              : undefined
          }
        />
      )}

      {/* POS Modals Container */}
      <POSModals
        isMergeModalOpen={isMergeModalOpen}
        onCloseMergeModal={() => setIsMergeModalOpen(false)}
        selectedTable={selectedTable}
        tables={tables}
        sessions={sessions}
        refreshPOSData={refreshPOSData}
        isDiscountModalOpen={isDiscountModalOpen}
        onCloseDiscountModal={() => setIsDiscountModalOpen(false)}
        activeSession={activeSession}
        selectedMenuItemForWaiter={selectedMenuItemForWaiter}
        onCloseModifierModal={() => setSelectedMenuItemForWaiter(null)}
        orderItems={orderItems}
        isPaymentModalOpen={isPaymentModalOpen}
        onClosePaymentModal={() => {
          setIsPaymentModalOpen(false);
          setActiveSplitReceipt(null);
        }}
        discounts={discounts}
        payments={payments}
        onPrintSplitInvoice={(details) => setActiveSplitReceipt(details)}
      />

      {/* MODIFIER SELECTION MODAL */}
      {selectedMenuItemForWaiter && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-md rounded-3xl p-6 shadow-2xl text-[#1c3a1e]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
              <h3 className="text-lg font-black text-[#1c3a1e]">
                Select Modifiers for {selectedMenuItemForWaiter.name}
              </h3>
              <button
                onClick={() => setSelectedMenuItemForWaiter(null)}
                className="text-gray-500 hover:text-black font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-60 overflow-y-auto mb-6">
              {selectedMenuItemForWaiter.modifier_groups?.map((group) => (
                <div key={group.group_name} className="space-y-2">
                  <span className="text-xs font-black text-[#1c3a1e] uppercase tracking-wider block">
                    {group.group_name}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedWaiterModifiers.some(
                        (m) => m.group === group.group_name && m.option === opt.name
                      );
                      return (
                        <button
                          key={opt.name}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedWaiterModifiers(
                                selectedWaiterModifiers.filter(
                                  (m) => !(m.group === group.group_name && m.option === opt.name)
                                )
                              );
                            } else {
                              setSelectedWaiterModifiers([
                                ...selectedWaiterModifiers.filter((m) => m.group !== group.group_name),
                                { group: group.group_name, option: opt.name, price_extra: opt.price_extra_usd || 0 },
                              ]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1c3a1e] text-white border-[#1c3a1e]'
                              : 'bg-[#fafbfa] text-[#1c3a1e] border-[#1c3a1e]/20'
                          }`}
                        >
                          {opt.name} {opt.price_extra_usd ? `(+$${opt.price_extra_usd})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedMenuItemForWaiter(null)}
                className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3 rounded-2xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedMenuItemForWaiter) {
                    await handleAddSingleItemDirectly(
                      selectedMenuItemForWaiter,
                      selectedWaiterModifiers
                    );
                    setSelectedMenuItemForWaiter(null);
                  }
                }}
                className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3 rounded-2xl text-xs shadow-xs transition-all cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-ITEM BATCH SELECTION MODAL */}
      {isAddItemModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-[#1c3a1e]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#1c3a1e]/15 w-full max-w-3xl rounded-3xl p-6 shadow-2xl text-[#1c3a1e] max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1c3a1e]/15">
                <div>
                  <h3 className="text-lg font-black text-[#1c3a1e]">
                    Multi-Item Batch Selector (Table #{selectedTable.table_number})
                  </h3>
                  <span className="text-xs font-bold text-gray-500">
                    Select multiple items before adding all to cart at once
                  </span>
                </div>
                <button
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="text-gray-500 hover:text-black font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Menu Grid in Modal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto mb-4 pr-1">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddMultiItemToCart(item)}
                    className="bg-[#fafbfa] border border-[#1c3a1e]/15 hover:border-[#1c3a1e] rounded-2xl p-3 flex justify-between items-center cursor-pointer transition-all shadow-xs"
                  >
                    <div>
                      <span className="font-extrabold text-xs text-[#1c3a1e] block leading-tight">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-black text-emerald-800">
                        ${Number(item.price_usd).toFixed(2)}
                      </span>
                    </div>
                    <button className="bg-[#1c3a1e] text-white p-1 rounded-lg">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Staged Cart Items Preview */}
              {multiItemCart.length > 0 && (
                <div className="bg-[#eaf2eb] border border-[#1c3a1e]/15 rounded-2xl p-4 mb-4">
                  <span className="text-xs font-black text-[#1c3a1e] block mb-2">
                    Staged Batch Cart Items ({multiItemCart.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {multiItemCart.map((c, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-[#1c3a1e]/20 text-[#1c3a1e] text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5"
                      >
                        {c.quantity}x {c.item.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#1c3a1e]/15">
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="w-1/2 bg-[#eaf2eb] hover:bg-[#d8e6da] border border-[#1c3a1e]/15 text-[#1c3a1e] font-bold py-3.5 rounded-2xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchSubmitMultiItems}
                disabled={multiItemCart.length === 0}
                className="w-1/2 bg-[#1c3a1e] hover:bg-[#d4af37] hover:text-[#1c3a1e] text-white font-black py-3.5 rounded-2xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Send Batch to Table Cart ({multiItemCart.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Success Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c3a1e] text-white px-5 py-3 rounded-2xl shadow-2xl font-black text-xs border border-[#d4af37]/50 flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="h-4 w-4 text-[#d4af37]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
