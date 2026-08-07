'use client';

import React from 'react';
import { Table, TableSession, OrderItem } from '@/lib/types';
import { calculateBillTotals } from '@/lib/currency';
import { Sparkles, Link2 } from 'lucide-react';

interface POSFloorPlanProps {
  tables: Table[];
  sessions: TableSession[];
  orderItems: OrderItem[];
  discounts: any[];
  payments: any[];
  selectedTable: Table | null;
  onSelectTable: (table: Table) => void;
}

export const POSFloorPlan: React.FC<POSFloorPlanProps> = ({
  tables,
  sessions,
  orderItems,
  discounts,
  payments,
  selectedTable,
  onSelectTable,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-black text-[#1c3a1e]">Floor Plan & Table Sessions Grid ({tables.length})</h2>
        <span className="text-xs font-bold text-gray-500">
          Tap a table card to open its active order cart & checkout receipt
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((tbl) => {
          // Find active session where tbl is primary OR secondary merged table
          const activeSess = sessions.find((s) => {
            if (s.status !== 'active') return false;
            if (s.primary_table_id === tbl.id) return true;

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
            return rawArr.includes(tbl.id);
          });

          let mergedTblNums: number[] = [];
          let primaryTblObj: Table | undefined = undefined;

          if (activeSess) {
            primaryTblObj = tables.find((t) => t.id === activeSess.primary_table_id);

            if (activeSess.merged_table_ids) {
              let rawArr: string[] = [];
              if (Array.isArray(activeSess.merged_table_ids)) {
                rawArr = activeSess.merged_table_ids;
              } else if (typeof activeSess.merged_table_ids === 'string') {
                try {
                  const formattedStr = (activeSess.merged_table_ids as string)
                    .replace(/^{/, '[')
                    .replace(/}$/, ']');
                  rawArr = JSON.parse(formattedStr);
                } catch (e) {}
              }
              mergedTblNums = rawArr
                .map((tid) => tables.find((t) => t.id === tid)?.table_number)
                .filter((num): num is number => num !== undefined);
            }
          }

          const primaryNum = primaryTblObj?.table_number || tbl.table_number;
          const allTableNums = Array.from(new Set([primaryNum, ...mergedTblNums])).sort((a, b) => a - b);
          const isMergedSession = mergedTblNums.length > 0;
          const isPrimaryTable = activeSess ? activeSess.primary_table_id === tbl.id : true;

          // Find combined items for this merged session
          const tblItems = activeSess
            ? orderItems.filter(
                (i) =>
                  (i.session_id === activeSess.id || allTableNums.includes(i.table_number as number)) &&
                  i.status !== 'cancelled'
              )
            : [];

          const tblDiscounts = activeSess ? discounts.filter((d) => d.session_id === activeSess.id) : [];
          const tblPayments = activeSess ? payments.filter((p) => p.session_id === activeSess.id) : [];
          const bill = calculateBillTotals(tblItems, tblDiscounts, tblPayments, 89500);

          const hasReadyItems = tblItems.some((i) => i.status === 'ready');
          const isBillRequested = tbl.status === 'bill_requested';
          const isSelected = selectedTable?.id === tbl.id || (primaryTblObj && selectedTable?.id === primaryTblObj.id);

          return (
            <div
              key={tbl.id}
              onClick={() => onSelectTable(primaryTblObj || tbl)}
              className={`rounded-3xl p-4 cursor-pointer transition-all border-2 relative overflow-hidden shadow-xs flex flex-col justify-between min-h-[130px] ${
                isSelected
                  ? 'border-[#1c3a1e] bg-[#1c3a1e] text-white ring-4 ring-[#1c3a1e]/20 scale-[1.02]'
                  : isBillRequested
                  ? 'border-amber-400 bg-amber-50/90 text-amber-950 hover:bg-amber-100 ring-2 ring-amber-400/50'
                  : activeSess
                  ? isMergedSession
                    ? 'border-purple-300 bg-purple-50/75 text-purple-950 hover:bg-purple-100'
                    : 'border-blue-300 bg-blue-50/70 text-blue-950 hover:bg-blue-100/80'
                  : 'border-[#1c3a1e]/15 bg-white text-[#1c3a1e] hover:bg-[#fafbfa]'
              }`}
            >
              {/* Ready Food Alert Banner */}
              {hasReadyItems && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-xl shadow-xs flex items-center gap-1 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Ready!</span>
                </div>
              )}

              {/* Table Number & Status Header */}
              <div>
                <div className="flex justify-between items-start">
                  <span
                    className={`font-black text-lg ${
                      isSelected ? 'text-white' : 'text-[#1c3a1e]'
                    }`}
                  >
                    TABLE #{tbl.table_number}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                      isSelected
                        ? 'bg-white/20 text-white border-white/30'
                        : isBillRequested
                        ? 'bg-amber-500/20 text-amber-900 border-amber-500/40 animate-pulse'
                        : activeSess
                        ? isMergedSession
                          ? 'bg-purple-500/10 text-purple-900 border-purple-500/30'
                          : 'bg-blue-500/10 text-blue-900 border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                    }`}
                  >
                    {isBillRequested ? 'BILL REQUESTED' : activeSess ? (isMergedSession ? 'MERGED' : 'OCCUPIED') : 'FREE'}
                  </span>
                </div>

                {/* Merged Status Sub-label */}
                {activeSess && isMergedSession && (
                  <div
                    className={`text-[10px] font-black mt-1 flex items-center gap-1 ${
                      isSelected ? 'text-amber-300' : 'text-purple-900'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>
                      {isPrimaryTable
                        ? `Merged with #${mergedTblNums.join(', #')}`
                        : `Merged into Table #${primaryNum}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Items & Subtotal */}
              <div className="pt-2 border-t border-current/10 mt-2 flex justify-between items-end">
                <span className="text-xs font-bold opacity-80">
                  {tblItems.length} {tblItems.length === 1 ? 'item' : 'items'}
                </span>
                {activeSess && (
                  <span className="text-sm font-black text-emerald-800">
                    ${bill.finalTotalUsd.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
