'use server';

import { pool } from '@/lib/db';
import { calculateBillTotals } from '@/lib/currency';
import { logStaffActivity } from './audit-actions';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { deductRecipeStockForItems, restockRecipeStockForItems } from './inventory-actions';
import { awardLoyaltyPointsForSession } from './loyalty-actions';
import { notifyPOSUpdate } from '@/lib/events';

let posCache: { timestamp: number; data: any } | null = null;

export async function invalidatePOSCache() {
  posCache = null;
}

export async function getPOSData() {
  let tables: any[] = [];
  let sessions: any[] = [];
  let serviceCalls: any[] = [];
  let orderItems: any[] = [];
  let discounts: any[] = [];
  let payments: any[] = [];
  let menuItems: any[] = [];
  let categories: any[] = [];

  let loyaltyEnabled = true;

  const now = Date.now();
  if (posCache && (now - posCache.timestamp < 3000)) {
    return posCache.data;
  }

  if (pool) {
    try {
      const [tblRes, sessRes, ordRes, payRes, discRes, callRes, itemRes, catRes, loyaltyRes] = await Promise.all([
        pool.query('SELECT * FROM tables ORDER BY table_number ASC'),
        pool.query("SELECT * FROM table_sessions WHERE status = 'active' OR created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 80"),
        pool.query(`
          SELECT oi.* FROM order_items oi
          LEFT JOIN table_sessions ts ON oi.session_id = ts.id
          WHERE oi.status != 'cancelled'
            AND (ts.status = 'active' OR oi.created_at > NOW() - INTERVAL '8 hours')
          ORDER BY oi.created_at ASC
        `),
        pool.query("SELECT * FROM payments WHERE created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 150"),
        pool.query("SELECT * FROM discounts WHERE created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 150"),
        pool.query("SELECT * FROM service_calls WHERE status = 'pending' ORDER BY created_at DESC"),
        pool.query(`
          SELECT id, category_id, name, description, price_usd, price_camping_usd, station, available, is_staff_only, sort_order, is_bestseller, modifier_groups,
                 CASE WHEN image_url IS NOT NULL AND image_url != '' THEN (CASE WHEN image_url LIKE 'data:image/%' THEN '/api/dish-image?id=' || id ELSE image_url END) ELSE '' END as image_url
          FROM menu_items 
          ORDER BY sort_order ASC, name ASC
        `),
        pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC'),
        pool.query("SELECT value FROM system_settings WHERE key = 'loyalty_program_enabled'").catch(() => ({ rows: [] })),
      ]);

      tables = tblRes.rows;
      sessions = sessRes.rows.map((s: any) => {
        let mergedArr: string[] = [];
        if (Array.isArray(s.merged_table_ids)) {
          mergedArr = s.merged_table_ids;
        } else if (typeof s.merged_table_ids === 'string' && s.merged_table_ids.trim()) {
          try {
            mergedArr = JSON.parse(s.merged_table_ids.replace(/^{/, '[').replace(/}$/, ']'));
          } catch (e) {}
        }
        return { ...s, merged_table_ids: mergedArr };
      });
      orderItems = ordRes.rows.map((r: any) => ({
        ...r,
        quantity: Math.round(Number(r.quantity || 1)),
        unit_price_usd: Number(r.unit_price_usd || 0),
      }));
      payments = payRes.rows;
      discounts = discRes.rows;
      serviceCalls = callRes.rows;
      menuItems = itemRes.rows.map((m: any) => ({
        ...m,
        image_url: m.image_url && m.image_url.startsWith('data:image/') ? `/api/dish-image?id=${m.id}` : (m.image_url || ''),
        modifier_groups: typeof m.modifier_groups === 'string' ? JSON.parse(m.modifier_groups) : (m.modifier_groups || []),
      }));
      categories = catRes.rows;

      if (loyaltyRes.rows && loyaltyRes.rows.length > 0 && loyaltyRes.rows[0].value !== null) {
        const val = loyaltyRes.rows[0].value;
        loyaltyEnabled = val === true || val === 'true' || val === '1';
      }
    } catch (e) {
      console.error('POS fetch error:', e);
    }
  }

  tables = tables.map((tbl) => {
    const activeSess = sessions.find(
      (s) =>
        s.status === 'active' &&
        s.order_type !== 'takeout' &&
        s.order_type !== 'camping' &&
        (s.primary_table_id === tbl.id ||
          (tbl.table_number && s.primary_table_id === `tbl-${tbl.table_number}`) ||
          s.merged_table_ids?.includes(tbl.id))
    );
    if (!activeSess) {
      return { ...tbl, status: 'available' };
    }
    return tbl;
  });

  const result = {
    tables,
    sessions,
    serviceCalls,
    orderItems,
    discounts,
    payments,
    menuItems,
    categories,
    loyaltyEnabled,
  };

  posCache = {
    timestamp: now,
    data: result,
  };

  return result;
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

    const allTableIds = Array.from(new Set([primaryTableId, ...secondaryTableIds]));
    const tablesRes = await pool.query("SELECT id, table_number FROM tables WHERE id::text = ANY($1::text[])", [allTableIds]);
    const mergedTableNums = tablesRes.rows.map((r: any) => r.table_number);

    for (const secId of secondaryTableIds) {
      const secSessRes = await pool.query(
        "SELECT id FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active' AND id != $2",
        [secId, primarySessionId]
      );
      for (const secSess of secSessRes.rows) {
        await pool.query("UPDATE table_sessions SET status = 'closed' WHERE id = $1", [secSess.id]);
        await pool.query('UPDATE order_items SET session_id = $1 WHERE session_id = $2', [primarySessionId, secSess.id]);
        await pool.query('UPDATE discounts SET session_id = $1 WHERE session_id = $2', [primarySessionId, secSess.id]);
        await pool.query('UPDATE payments SET session_id = $1 WHERE session_id = $2', [primarySessionId, secSess.id]);
      }
    }

    // Re-assign ONLY order items belonging to ACTIVE sessions of the merged tables to primarySessionId
    await pool.query(
      `UPDATE order_items SET session_id = $1 
       WHERE session_id IN (
         SELECT id FROM table_sessions 
         WHERE (primary_table_id::text = ANY($2::text[]) OR ANY(merged_table_ids)::text = ANY($2::text[]))
           AND status = 'active'
       )`,
      [primarySessionId, allTableIds]
    );

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

export async function unmergeAllTables(primarySessionId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [primarySessionId]);
    if (sessRes.rows.length === 0) return { success: false, error: 'Session not found' };

    const session = sessRes.rows[0];
    const mergedIds: string[] = session.merged_table_ids || [];

    await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [[], primarySessionId]);
    if (mergedIds.length > 0) {
      await pool.query("UPDATE tables SET status = 'available' WHERE id::text = ANY($1::text[])", [mergedIds]);
    }
    if (session.primary_table_id) {
      await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [session.primary_table_id]);
    }
  } catch (e) {
    console.error('Neon unmergeAllTables error:', e);
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

    await logStaffActivity({
      staffName: 'Manager',
      staffRole: 'Manager',
      actionType: 'discount_applied',
      details: `Applied ${type} discount of ${value} (${reason || 'General Discount'})`,
    });
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

    if (data.paymentType === 'full' || !data.itemIdsPaid || data.itemIdsPaid.length === 0) {
      await pool.query("UPDATE order_items SET is_paid = true WHERE session_id = $1 AND status != 'cancelled'", [data.sessionId]);
    } else if (data.itemIdsPaid && data.itemIdsPaid.length > 0) {
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
        await pool.query('UPDATE order_items SET is_paid = true WHERE session_id = $1', [session.id]);

        // Award 1 Point per $1 spent or generate anonymous thermal receipt claim token
        await awardLoyaltyPointsForSession(session.id, bill.finalTotalUsd, session.customer_phone, session.customer_name);
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

    // Award loyalty points for session before closing
    const ordRes = await pool.query("SELECT * FROM order_items WHERE session_id = $1 AND status != 'cancelled'", [sessionId]);
    const discRes = await pool.query('SELECT * FROM discounts WHERE session_id = $1', [sessionId]);
    const payRes = await pool.query('SELECT * FROM payments WHERE session_id = $1', [sessionId]);
    const bill = calculateBillTotals(ordRes.rows, discRes.rows, payRes.rows, 89500);

    await awardLoyaltyPointsForSession(session.id, bill.finalTotalUsd, session.customer_phone, session.customer_name);

    await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [sessionId]);
    await pool.query("UPDATE tables SET status = 'available' WHERE id::text = ANY($1::text[])", [tableIdsToReset]);
    await pool.query("UPDATE order_items SET is_paid = true WHERE session_id = $1", [sessionId]);
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

export async function compOrderItem(orderItemId: string, forceStatus?: boolean) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    if (forceStatus !== undefined) {
      await pool.query('UPDATE order_items SET is_comped = $1 WHERE id = $2', [forceStatus, orderItemId]);
    } else {
      await pool.query('UPDATE order_items SET is_comped = NOT is_comped WHERE id = $1', [orderItemId]);
    }
  } catch (e) {
    console.error('Neon error comping item:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function cancelOrderItem(orderItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1', [orderItemId]);
    if (itemRes.rows.length > 0) {
      const item = itemRes.rows[0];
      await pool.query("UPDATE order_items SET status = 'cancelled' WHERE id = $1", [orderItemId]);

      if (item.menu_item_id) {
        await restockRecipeStockForItems(
          [{ menuItemId: item.menu_item_id, quantity: Number(item.quantity || 1) }],
          `Cancelled: ${item.item_name} (Table #${item.table_number || 1})`
        );
      }
    }
  } catch (e) {
    console.error('Neon error cancelling item:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function restoreCancelledOrderItem(orderItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1', [orderItemId]);
    if (itemRes.rows.length > 0) {
      const item = itemRes.rows[0];
      await pool.query("UPDATE order_items SET status = 'pending' WHERE id = $1", [orderItemId]);

      if (item.menu_item_id) {
        await deductRecipeStockForItems(
          [{ menuItemId: item.menu_item_id, quantity: Number(item.quantity || 1) }],
          `Restored Order Item: ${item.item_name}`
        );
      }
    }
  } catch (e) {
    console.error('Neon error restoring item:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateOrderItemQuantity(orderItemId: string, newQty: number) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1', [orderItemId]);
    if (itemRes.rows.length > 0) {
      const item = itemRes.rows[0];
      const oldQty = Math.round(Number(item.quantity || 1));
      const targetQty = Math.round(Number(newQty || 1));
      const diff = targetQty - oldQty;

      if (targetQty <= 0) {
        await cancelOrderItem(orderItemId);
      } else {
        await pool.query('UPDATE order_items SET quantity = $1 WHERE id = $2', [targetQty, orderItemId]);
        if (diff > 0 && item.menu_item_id) {
          await deductRecipeStockForItems(
            [{ menuItemId: item.menu_item_id, quantity: diff }],
            `Added +${diff} Qty: ${item.item_name}`
          );
        } else if (diff < 0 && item.menu_item_id) {
          await restockRecipeStockForItems(
            [{ menuItemId: item.menu_item_id, quantity: Math.abs(diff) }],
            `Reduced -${Math.abs(diff)} Qty: ${item.item_name}`
          );
        }
      }
    }
  } catch (e) {
    console.error('Neon error updating item qty:', e);
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function requestPreBill(sessionId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    const sessRes = await pool.query('SELECT primary_table_id FROM table_sessions WHERE id = $1', [sessionId]);
    if (sessRes.rows.length > 0) {
      await pool.query("UPDATE tables SET status = 'bill_requested' WHERE id = $1", [sessRes.rows[0].primary_table_id]);
      invalidatePOSCache();
      notifyPOSUpdate();
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
    invalidatePOSCache();
    notifyPOSUpdate();
  } catch (e) {
    console.error('Neon error resolving service call:', e);
  }

  return { success: true };
}

/**
 * Assign Guest Name (e.g. Person A, Person B, Customer Name) to Order Items permanently in DB
 */
export async function assignGuestNameToOrderItems(itemIds: string[], guestName: string) {
  if (!pool || !itemIds || itemIds.length === 0) return { success: false, error: 'Missing item IDs' };

  try {
    const cleanName = guestName.trim();
    await pool.query(
      `UPDATE order_items 
       SET guest_name = $1, 
           customer_name = CASE WHEN $1 <> '' THEN $1 ELSE customer_name END 
       WHERE id = ANY($2)`,
      [cleanName, itemIds]
    );

    invalidatePOSCache();
    notifyPOSUpdate();
    return { success: true };
  } catch (e) {
    console.error('Error assigning guest name to order items:', e);
    return { success: false, error: 'Failed to assign guest name' };
  }
}
