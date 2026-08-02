'use server';

import { pool } from '@/lib/db';
import { calculateBillTotals } from '@/lib/currency';
import { logStaffActivity } from './audit-actions';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function getPOSData() {
  let tables: any[] = [];
  let sessions: any[] = [];
  let serviceCalls: any[] = [];
  let orderItems: any[] = [];
  let discounts: any[] = [];
  let payments: any[] = [];
  let menuItems: any[] = [];
  let categories: any[] = [];

  if (pool) {
    try {
      const [tblRes, sessRes, ordRes, payRes, discRes, callRes, itemRes, catRes] = await Promise.all([
        pool.query('SELECT * FROM tables ORDER BY table_number ASC'),
        pool.query('SELECT * FROM table_sessions ORDER BY created_at DESC'),
        pool.query('SELECT * FROM order_items ORDER BY created_at DESC'),
        pool.query('SELECT * FROM payments ORDER BY created_at DESC'),
        pool.query('SELECT * FROM discounts ORDER BY created_at DESC'),
        pool.query('SELECT * FROM service_calls ORDER BY created_at DESC'),
        pool.query('SELECT * FROM menu_items ORDER BY name ASC'),
        pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC'),
      ]);

      tables = tblRes.rows;
      sessions = sessRes.rows;
      orderItems = ordRes.rows;
      payments = payRes.rows;
      discounts = discRes.rows;
      serviceCalls = callRes.rows;
      menuItems = itemRes.rows.map((m: any) => ({
        ...m,
        modifier_groups: typeof m.modifier_groups === 'string' ? JSON.parse(m.modifier_groups) : (m.modifier_groups || []),
      }));
      categories = catRes.rows;
    } catch (e) {
      console.error('Neon getPOSData query error:', e);
    }
  }

  tables = tables.map((tbl) => {
    const activeSess = sessions.find(
      (s) =>
        s.status === 'active' &&
        (s.primary_table_id === tbl.id ||
          (tbl.table_number && s.primary_table_id === `tbl-${tbl.table_number}`) ||
          s.merged_table_ids?.includes(tbl.id))
    );
    if (!activeSess) {
      return { ...tbl, status: 'available' };
    }
    return tbl;
  });

  return {
    tables,
    sessions,
    serviceCalls,
    orderItems,
    discounts,
    payments,
    menuItems,
    categories,
  };
}

export async function updateTableStatusAction(tableId: string, status: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE tables SET status = $1 WHERE id = $2', [status, tableId]);

    if (status === 'available') {
      const sessRes = await pool.query("SELECT id FROM table_sessions WHERE primary_table_id = $1 AND status = 'active'", [tableId]);
      if (sessRes.rows.length > 0) {
        const sessId = sessRes.rows[0].id;
        await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [sessId]);
      }
    }

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/kds');
    revalidatePath('/admin');

    return { success: true };
  } catch (e: any) {
    console.error('Neon updateTableStatusAction error:', e);
    return { success: false, error: e.message };
  }
}

export async function assignItemsToGuest(
  assignments: Array<{ orderItemId: string; assignQty: number }>,
  guestName: string
) {
  if (!assignments || assignments.length === 0 || !pool) return { success: false, error: 'No items selected' };

  for (const { orderItemId, assignQty } of assignments) {
    if (assignQty <= 0) continue;

    try {
      const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1', [orderItemId]);
      if (itemRes.rows.length === 0) continue;
      const item = itemRes.rows[0];

      if (assignQty >= item.quantity) {
        await pool.query('UPDATE order_items SET guest_name = $1 WHERE id = $2', [guestName, item.id]);
      } else {
        const newItemId = randomUUID();
        await pool.query('UPDATE order_items SET quantity = quantity - $1 WHERE id = $2', [assignQty, item.id]);
        await pool.query(
          `INSERT INTO order_items (id, order_id, session_id, table_number, seat_number, guest_name, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes, is_comped, is_paid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            newItemId,
            item.order_id,
            item.session_id,
            item.table_number || 1,
            item.seat_number || 1,
            guestName,
            item.menu_item_id,
            item.item_name,
            assignQty,
            item.unit_price_usd,
            item.station,
            item.status,
            JSON.stringify(item.selected_modifiers || []),
            item.special_notes || '',
            !!item.is_comped,
            !!item.is_paid,
          ]
        );
      }
    } catch (e) {
      console.error('Neon split item guest assignment error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function mergeTables(primaryTableId: string, secondaryTableIds: string[]) {
  if (!secondaryTableIds || secondaryTableIds.length === 0 || !pool) {
    return { success: false, error: 'No tables selected to merge' };
  }

  try {
    let primarySessionId = '';
    const activeSessRes = await pool.query(
      "SELECT * FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
      [primaryTableId]
    );

    if (activeSessRes.rows.length > 0) {
      primarySessionId = activeSessRes.rows[0].id;
      const currentMerged = activeSessRes.rows[0].merged_table_ids || [];
      const updatedMerged = Array.from(new Set([...currentMerged, ...secondaryTableIds]));
      await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [updatedMerged, primarySessionId]);
    } else {
      primarySessionId = randomUUID();
      await pool.query(
        "INSERT INTO table_sessions (id, primary_table_id, merged_table_ids, status) VALUES ($1, $2, $3, 'active')",
        [primarySessionId, primaryTableId, secondaryTableIds]
      );
    }

    for (const secId of secondaryTableIds) {
      const secSessRes = await pool.query(
        "SELECT id FROM table_sessions WHERE primary_table_id = $1 AND status = 'active' AND id != $2",
        [secId, primarySessionId]
      );
      for (const secSess of secSessRes.rows) {
        await pool.query("UPDATE table_sessions SET status = 'closed' WHERE id = $1", [secSess.id]);
        await pool.query('UPDATE order_items SET session_id = $1 WHERE session_id = $2', [primarySessionId, secSess.id]);
      }
    }

    const allTableIds = Array.from(new Set([primaryTableId, ...secondaryTableIds]));
    await pool.query("UPDATE tables SET status = 'merged' WHERE id::text = ANY($1::text[])", [allTableIds]);
  } catch (e) {
    console.error('Neon mergeTables error:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function unmergeSingleTable(primarySessionId: string, tableIdToUnmerge: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [primarySessionId]);
    if (sessRes.rows.length === 0) return { success: false, error: 'Session not found' };

    const session = sessRes.rows[0];
    const updatedMerged = (session.merged_table_ids || []).filter((id: string) => id !== tableIdToUnmerge);

    await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [updatedMerged, primarySessionId]);
    await pool.query("UPDATE tables SET status = 'available' WHERE id = $1", [tableIdToUnmerge]);

    if (updatedMerged.length === 0 && session.primary_table_id) {
      await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [session.primary_table_id]);
    }
  } catch (e) {
    console.error('Neon unmergeSingleTable error:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function applyDiscount(sessionId: string, type: 'percentage' | 'fixed', value: number, reason = '') {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const discountId = randomUUID();
    await pool.query(
      `INSERT INTO discounts (id, session_id, type, value, reason) VALUES ($1, $2, $3, $4, $5)`,
      [discountId, sessionId, type, value, reason]
    );
  } catch (e) {
    console.error('Neon error applying discount:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function removeDiscount(discountId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('DELETE FROM discounts WHERE id = $1', [discountId]);
  } catch (e) {
    console.error('Neon error removing discount:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function processSplitPayment(data: {
  sessionId: string;
  paymentType: 'full' | 'item_split' | 'equal_split' | 'partial';
  amountUsd: number;
  currency: 'USD' | 'LBP';
  paymentMethod: 'cash' | 'card';
  itemIdsPaid?: string[];
  guestName?: string;
  staffName?: string;
  staffRole?: string;
}) {
  if (!pool) return { success: false, error: 'DB connection error' };

  const paymentId = randomUUID();
  const exchangeRateUsed = 89500;

  try {
    await pool.query(
      `INSERT INTO payments (id, session_id, amount_usd, currency, exchange_rate_used, payment_method, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        paymentId,
        data.sessionId,
        data.amountUsd,
        data.currency,
        exchangeRateUsed,
        data.paymentMethod,
        data.paymentType,
      ]
    );

    if (data.itemIdsPaid && data.itemIdsPaid.length > 0) {
      await pool.query('UPDATE order_items SET is_paid = true WHERE id::text = ANY($1::text[])', [data.itemIdsPaid]);
    }

    const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [data.sessionId]);
    if (sessRes.rows.length > 0) {
      const session = sessRes.rows[0];
      const ordRes = await pool.query("SELECT * FROM order_items WHERE session_id = $1 AND status != 'cancelled'", [data.sessionId]);
      const discRes = await pool.query('SELECT * FROM discounts WHERE session_id = $1', [data.sessionId]);
      const payRes = await pool.query('SELECT * FROM payments WHERE session_id = $1', [data.sessionId]);

      const bill = calculateBillTotals(ordRes.rows, discRes.rows, payRes.rows, exchangeRateUsed);

      if (bill.remainingUsd <= 0.01) {
        const tableIdsToReset = Array.from(new Set([session.primary_table_id, ...(session.merged_table_ids || [])]));
        await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [session.id]);
        await pool.query("UPDATE tables SET status = 'available' WHERE id::text = ANY($1::text[])", [tableIdsToReset]);
      }

      const tblRes = await pool.query('SELECT table_number FROM tables WHERE id = $1', [session.primary_table_id]);
      const tblNum = tblRes.rows.length > 0 ? tblRes.rows[0].table_number : undefined;

      await logStaffActivity({
        staffName: data.staffName || 'Staff Member',
        staffRole: data.staffRole || 'Cashier',
        actionType: 'payment_processed',
        tableNumber: tblNum,
        details: `Processed $${data.amountUsd.toFixed(2)} (${data.paymentMethod.toUpperCase()}) payment for Table #${tblNum || ''}`,
      });
    }
  } catch (e: any) {
    console.error('Neon processSplitPayment error:', e);
  }

  return { success: true, paymentId };
}

export async function closeTableSessionAction(sessionId: string, staffName = 'Waiter', staffRole = 'Staff') {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [sessionId]);
    if (sessRes.rows.length === 0) return { success: false, error: 'Session not found' };

    const session = sessRes.rows[0];
    const tableIdsToReset = Array.from(new Set([session.primary_table_id, ...(session.merged_table_ids || [])]));

    await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [sessionId]);
    await pool.query("UPDATE tables SET status = 'available' WHERE id::text = ANY($1::text[])", [tableIdsToReset]);
    await pool.query("UPDATE order_items SET status = 'cancelled' WHERE session_id = $1 AND status IN ('pending', 'preparing')", [sessionId]);
    await pool.query("UPDATE service_calls SET status = 'resolved' WHERE session_id = $1 AND status = 'pending'", [sessionId]);

    const tblRes = await pool.query('SELECT table_number FROM tables WHERE id = $1', [session.primary_table_id]);
    const tblNum = tblRes.rows.length > 0 ? tblRes.rows[0].table_number : undefined;

    await logStaffActivity({
      staffName,
      staffRole,
      actionType: 'table_session_closed',
      tableNumber: tblNum,
      details: `Closed Table #${tblNum || ''} session & cleared pending items`,
    });
  } catch (e) {
    console.error('Neon closeTableSessionAction error:', e);
  }

  return { success: true };
}

export async function compOrderItem(orderItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE order_items SET is_comped = true WHERE id = $1', [orderItemId]);
  } catch (e) {
    console.error('Neon error comping item:', e);
  }

  return { success: true };
}

export async function cancelOrderItem(orderItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query("UPDATE order_items SET status = 'cancelled' WHERE id = $1", [orderItemId]);
  } catch (e) {
    console.error('Neon error cancelling item:', e);
  }

  return { success: true };
}

export async function restoreCancelledOrderItem(orderItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query("UPDATE order_items SET status = 'pending' WHERE id = $1", [orderItemId]);
  } catch (e) {
    console.error('Neon error restoring item:', e);
  }

  return { success: true };
}

export async function updateOrderItemQuantity(orderItemId: string, newQty: number) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    if (newQty <= 0) {
      await pool.query("UPDATE order_items SET status = 'cancelled' WHERE id = $1", [orderItemId]);
    } else {
      await pool.query('UPDATE order_items SET quantity = $1 WHERE id = $2', [newQty, orderItemId]);
    }
  } catch (e) {
    console.error('Neon error updating item qty:', e);
  }

  return { success: true };
}

export async function requestPreBill(sessionId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const sessRes = await pool.query('SELECT primary_table_id FROM table_sessions WHERE id = $1', [sessionId]);
    if (sessRes.rows.length > 0) {
      await pool.query("UPDATE tables SET status = 'bill_requested' WHERE id = $1", [sessRes.rows[0].primary_table_id]);
    }
  } catch (e) {
    console.error('Neon error requesting prebill:', e);
  }

  return { success: true };
}

export async function resolveServiceCall(callId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query("UPDATE service_calls SET status = 'resolved' WHERE id = $1", [callId]);
  } catch (e) {
    console.error('Neon error resolving service call:', e);
  }

  return { success: true };
}
