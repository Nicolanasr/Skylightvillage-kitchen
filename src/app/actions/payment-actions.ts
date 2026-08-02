'use server';

import { dbStore, pool } from '@/lib/db';
import { calculateBillTotals } from '@/lib/currency';
import { logStaffActivity } from './audit-actions';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function getPOSData() {
  let tables = dbStore.tables;
  let sessions = dbStore.tableSessions;
  let serviceCalls = dbStore.serviceCalls;
  let orderItems = dbStore.orderItems;
  let discounts = dbStore.discounts;
  let payments = dbStore.payments;
  let menuItems = dbStore.menuItems;
  let categories = dbStore.categories;

  if (pool) {
    try {
      const tblRes = await pool.query('SELECT * FROM tables ORDER BY table_number ASC');
      if (tblRes.rows.length > 0) tables = tblRes.rows;

      const sessRes = await pool.query('SELECT * FROM table_sessions ORDER BY created_at DESC');
      if (sessRes.rows.length > 0) sessions = sessRes.rows;

      const ordRes = await pool.query('SELECT * FROM order_items ORDER BY created_at DESC');
      if (ordRes.rows.length > 0) orderItems = ordRes.rows;

      const payRes = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
      if (payRes.rows.length > 0) payments = payRes.rows;

      const discRes = await pool.query('SELECT * FROM discounts ORDER BY created_at DESC');
      if (discRes.rows.length > 0) discounts = discRes.rows;

      const callRes = await pool.query('SELECT * FROM service_calls ORDER BY created_at DESC');
      if (callRes.rows.length > 0) serviceCalls = callRes.rows;

      const itemRes = await pool.query('SELECT * FROM menu_items ORDER BY name ASC');
      if (itemRes.rows.length > 0) menuItems = itemRes.rows;

      const catRes = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
      if (catRes.rows.length > 0) categories = catRes.rows;
    } catch (e) {
      console.error('Neon getPOSData query error:', e);
    }
  }

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

export async function assignItemsToGuest(
  assignments: Array<{ orderItemId: string; assignQty: number }>,
  guestName: string
) {
  if (!assignments || assignments.length === 0) return { success: false, error: 'No items selected' };

  for (const { orderItemId, assignQty } of assignments) {
    const item = dbStore.orderItems.find((i) => i.id === orderItemId);
    if (!item || assignQty <= 0) continue;

    if (assignQty >= item.quantity) {
      item.guest_name = guestName;
      if (pool) {
        try {
          await pool.query('UPDATE order_items SET guest_name = $1 WHERE id = $2', [guestName, item.id]);
        } catch (e) {}
      }
    } else {
      item.quantity -= assignQty;
      const newItemId = randomUUID();

      const newItem = {
        ...item,
        id: newItemId,
        quantity: assignQty,
        guest_name: guestName,
        created_at: new Date().toISOString(),
      };

      dbStore.orderItems.push(newItem);

      if (pool) {
        try {
          await pool.query('UPDATE order_items SET quantity = quantity - $1 WHERE id = $2', [assignQty, item.id]);
          await pool.query(
            `INSERT INTO order_items (id, order_id, session_id, table_number, seat_number, guest_name, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes, is_comped, is_paid)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              newItem.id,
              newItem.order_id,
              newItem.session_id,
              newItem.table_number || 1,
              newItem.seat_number || 1,
              newItem.guest_name,
              newItem.menu_item_id,
              newItem.item_name,
              newItem.quantity,
              newItem.unit_price_usd,
              newItem.station,
              newItem.status,
              JSON.stringify(newItem.selected_modifiers || []),
              newItem.special_notes || '',
              !!newItem.is_comped,
              !!newItem.is_paid,
            ]
          );
        } catch (e) {
          console.error('Neon split item guest assignment error:', e);
        }
      }
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function mergeTables(primaryTableId: string, secondaryTableIds: string[]) {
  if (!secondaryTableIds || secondaryTableIds.length === 0) {
    return { success: false, error: 'No tables selected to merge' };
  }

  let primarySession = dbStore.tableSessions.find(
    (s) => (s.primary_table_id === primaryTableId || s.merged_table_ids.includes(primaryTableId)) && s.status === 'active'
  );

  if (!primarySession) {
    const newSessId = randomUUID();
    primarySession = {
      id: newSessId,
      primary_table_id: primaryTableId,
      merged_table_ids: [],
      status: 'active',
      created_at: new Date().toISOString(),
    };
    dbStore.tableSessions.push(primarySession);

    if (pool) {
      try {
        await pool.query(
          "INSERT INTO table_sessions (id, primary_table_id, merged_table_ids, status) VALUES ($1, $2, '{}', 'active')",
          [primarySession.id, primaryTableId]
        );
      } catch (e) {}
    }
  }

  const primaryTbl = dbStore.tables.find((t) => t.id === primaryTableId);
  if (primaryTbl) primaryTbl.status = 'merged';

  for (const secId of secondaryTableIds) {
    if (!primarySession.merged_table_ids.includes(secId)) {
      primarySession.merged_table_ids.push(secId);
    }
    const secTbl = dbStore.tables.find((t) => t.id === secId);
    if (secTbl) secTbl.status = 'merged';

    const secSession = dbStore.tableSessions.find(
      (s) => s.primary_table_id === secId && s.status === 'active' && s.id !== primarySession.id
    );
    if (secSession) {
      secSession.status = 'closed';
      dbStore.orderItems.forEach((i) => {
        if (i.session_id === secSession.id) {
          i.session_id = primarySession.id;
        }
      });
      if (pool) {
        try {
          await pool.query("UPDATE table_sessions SET status = 'closed' WHERE id = $1", [secSession.id]);
          await pool.query('UPDATE order_items SET session_id = $1 WHERE session_id = $2', [
            primarySession.id,
            secSession.id,
          ]);
        } catch (e) {}
      }
    }
  }

  if (pool) {
    try {
      await pool.query(
        "UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2",
        [primarySession.merged_table_ids, primarySession.id]
      );
      await pool.query("UPDATE tables SET status = 'merged' WHERE id = ANY($1::text[])", [
        [primaryTableId, ...secondaryTableIds],
      ]);
    } catch (e) {
      console.error('Neon mergeTables error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function unmergeSingleTable(primarySessionId: string, tableIdToUnmerge: string) {
  const session = dbStore.tableSessions.find((s) => s.id === primarySessionId);
  if (!session) return { success: false, error: 'Session not found' };

  session.merged_table_ids = session.merged_table_ids.filter((id) => id !== tableIdToUnmerge);
  const tbl = dbStore.tables.find((t) => t.id === tableIdToUnmerge);
  if (tbl) tbl.status = 'available';

  if (session.merged_table_ids.length === 0 && session.primary_table_id) {
    const primTbl = dbStore.tables.find((t) => t.id === session.primary_table_id);
    if (primTbl) primTbl.status = 'occupied';
  }

  if (pool) {
    try {
      await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [
        session.merged_table_ids,
        session.id,
      ]);
      await pool.query("UPDATE tables SET status = 'available' WHERE id = $1", [tableIdToUnmerge]);
      if (session.merged_table_ids.length === 0) {
        await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [session.primary_table_id]);
      }
    } catch (e) {
      console.error('Neon unmergeSingleTable error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function applyDiscount(sessionId: string, type: 'percentage' | 'fixed', value: number, reason = '') {
  const discountId = randomUUID();
  const disc = {
    id: discountId,
    session_id: sessionId,
    type,
    value,
    reason,
    created_at: new Date().toISOString(),
  };

  dbStore.discounts.push(disc);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO discounts (id, session_id, type, value, reason) VALUES ($1, $2, $3, $4, $5)`,
        [disc.id, disc.session_id, disc.type, disc.value, disc.reason]
      );
    } catch (e) {
      console.error('Neon error applying discount:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function removeDiscount(discountId: string) {
  const idx = dbStore.discounts.findIndex((d) => d.id === discountId);
  if (idx !== -1) dbStore.discounts.splice(idx, 1);

  if (pool) {
    try {
      await pool.query('DELETE FROM discounts WHERE id = $1', [discountId]);
    } catch (e) {
      console.error('Neon error removing discount:', e);
    }
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
  const paymentId = randomUUID();

  const payment = {
    id: paymentId,
    session_id: data.sessionId,
    amount_usd: data.amountUsd,
    currency: data.currency,
    exchange_rate_used: dbStore.exchangeRate,
    payment_method: data.paymentMethod,
    payment_type: data.paymentType,
    created_at: new Date().toISOString(),
  };

  dbStore.payments.push(payment);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO payments (id, session_id, amount_usd, currency, exchange_rate_used, payment_method, payment_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payment.id,
          payment.session_id,
          payment.amount_usd,
          payment.currency,
          payment.exchange_rate_used,
          payment.payment_method,
          payment.payment_type,
        ]
      );
    } catch (e) {
      console.error('Neon payment insert error:', e);
    }
  }

  if (data.itemIdsPaid && data.itemIdsPaid.length > 0) {
    for (const itemId of data.itemIdsPaid) {
      const item = dbStore.orderItems.find((i) => i.id === itemId);
      if (item) {
        item.is_paid = true;
        if (pool) {
          try {
            await pool.query('UPDATE order_items SET is_paid = true WHERE id = $1', [itemId]);
          } catch (e) {}
        }
      }
    }
  }

  const session = dbStore.tableSessions.find((s) => s.id === data.sessionId);
  if (session) {
    const sessionOrderItems = dbStore.orderItems.filter((i) => i.session_id === data.sessionId && i.status !== 'cancelled');
    const sessionDiscounts = dbStore.discounts.filter((d) => d.session_id === data.sessionId);
    const sessionPayments = dbStore.payments.filter((p) => p.session_id === data.sessionId);

    const bill = calculateBillTotals(sessionOrderItems, sessionDiscounts, sessionPayments, dbStore.exchangeRate);

    if (bill.remainingUsd <= 0.01) {
      session.status = 'closed';
      session.closed_at = new Date().toISOString();

      const tableIdsToReset = [session.primary_table_id, ...(session.merged_table_ids || [])];
      tableIdsToReset.forEach((tblId) => {
        const tbl = dbStore.tables.find((t) => t.id === tblId);
        if (tbl) tbl.status = 'available';
      });

      if (pool) {
        try {
          await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [session.id]);
          await pool.query(
            "UPDATE tables SET status = 'available' WHERE id = ANY($1::text[]) OR id = $2",
            [tableIdsToReset, session.primary_table_id]
          );
        } catch (e) {
          console.error('Neon session close error:', e);
        }
      }
    }
  }

  const tblNum = dbStore.tables.find((t) => t.id === session?.primary_table_id)?.table_number;
  await logStaffActivity({
    staffName: data.staffName || 'Staff Member',
    staffRole: data.staffRole || 'Cashier',
    actionType: 'payment_processed',
    tableNumber: tblNum,
    details: `Processed $${data.amountUsd.toFixed(2)} (${data.paymentMethod.toUpperCase()}) payment for Table #${tblNum}`,
  });

  revalidatePath('/pos');
  revalidatePath('/kds');
  revalidatePath('/order');
  revalidatePath('/admin');
  return { success: true, paymentId };
}

export async function closeTableSessionAction(sessionId: string, staffName = 'Waiter', staffRole = 'Staff') {
  const session = dbStore.tableSessions.find((s) => s.id === sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  session.status = 'closed';
  session.closed_at = new Date().toISOString();

  const tableIdsToReset = [session.primary_table_id, ...(session.merged_table_ids || [])];
  tableIdsToReset.forEach((tblId) => {
    const tbl = dbStore.tables.find((t) => t.id === tblId);
    if (tbl) tbl.status = 'available';
  });

  dbStore.orderItems.forEach((item) => {
    if (item.session_id === sessionId && (item.status === 'pending' || item.status === 'preparing')) {
      item.status = 'cancelled';
    }
  });

  dbStore.serviceCalls.forEach((call) => {
    if (call.session_id === sessionId && call.status === 'pending') {
      call.status = 'resolved';
    }
  });

  if (pool) {
    try {
      await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [session.id]);
      await pool.query(
        "UPDATE tables SET status = 'available' WHERE id = ANY($1::text[]) OR id = $2",
        [tableIdsToReset, session.primary_table_id]
      );
      await pool.query("UPDATE order_items SET status = 'cancelled' WHERE session_id = $1 AND status IN ('pending', 'preparing')", [sessionId]);
      await pool.query("UPDATE service_calls SET status = 'resolved' WHERE session_id = $1 AND status = 'pending'", [sessionId]);
    } catch (e) {
      console.error('Neon closeTableSessionAction error:', e);
    }
  }

  const tblNum = dbStore.tables.find((t) => t.id === session.primary_table_id)?.table_number;
  await logStaffActivity({
    staffName,
    staffRole,
    actionType: 'table_session_closed',
    tableNumber: tblNum,
    details: `Closed Table #${tblNum} session & cleared pending items`,
  });

  revalidatePath('/pos');
  revalidatePath('/kds');
  revalidatePath('/order');
  revalidatePath('/admin');
  return { success: true };
}

export async function compOrderItem(orderItemId: string) {
  const item = dbStore.orderItems.find((i) => i.id === orderItemId);
  if (!item) return { success: false, error: 'Item not found' };

  item.is_comped = true;

  if (pool) {
    try {
      await pool.query('UPDATE order_items SET is_comped = true WHERE id = $1', [orderItemId]);
    } catch (e) {
      console.error('Neon error comping item:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function cancelOrderItem(orderItemId: string) {
  const item = dbStore.orderItems.find((i) => i.id === orderItemId);
  if (!item) return { success: false, error: 'Item not found' };

  item.status = 'cancelled';

  if (pool) {
    try {
      await pool.query("UPDATE order_items SET status = 'cancelled' WHERE id = $1", [orderItemId]);
    } catch (e) {
      console.error('Neon error cancelling item:', e);
    }
  }

  revalidatePath('/kds');
  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function restoreCancelledOrderItem(orderItemId: string) {
  const item = dbStore.orderItems.find((i) => i.id === orderItemId);
  if (!item) return { success: false, error: 'Item not found' };

  item.status = 'pending';

  if (pool) {
    try {
      await pool.query("UPDATE order_items SET status = 'pending' WHERE id = $1", [orderItemId]);
    } catch (e) {
      console.error('Neon error restoring item:', e);
    }
  }

  revalidatePath('/kds');
  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function updateOrderItemQuantity(orderItemId: string, newQty: number) {
  const item = dbStore.orderItems.find((i) => i.id === orderItemId);
  if (!item) return { success: false, error: 'Item not found' };

  if (newQty <= 0) {
    item.status = 'cancelled';
  } else {
    item.quantity = newQty;
  }

  if (pool) {
    try {
      if (newQty <= 0) {
        await pool.query("UPDATE order_items SET status = 'cancelled' WHERE id = $1", [orderItemId]);
      } else {
        await pool.query("UPDATE order_items SET quantity = $1 WHERE id = $2", [newQty, orderItemId]);
      }
    } catch (e) {
      console.error('Neon error updating item qty:', e);
    }
  }

  revalidatePath('/kds');
  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function requestPreBill(sessionId: string) {
  const session = dbStore.tableSessions.find((s) => s.id === sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const primaryTable = dbStore.tables.find((t) => t.id === session.primary_table_id);
  if (primaryTable) primaryTable.status = 'bill_requested';

  if (pool) {
    try {
      await pool.query("UPDATE tables SET status = 'bill_requested' WHERE id = $1", [session.primary_table_id]);
    } catch (e) {
      console.error('Neon error requesting prebill:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function resolveServiceCall(callId: string) {
  const call = dbStore.serviceCalls.find((c) => c.id === callId);
  if (!call) return { success: false, error: 'Call not found' };

  call.status = 'resolved';

  if (pool) {
    try {
      await pool.query("UPDATE service_calls SET status = 'resolved' WHERE id = $1", [callId]);
    } catch (e) {
      console.error('Neon error resolving service call:', e);
    }
  }

  revalidatePath('/pos');
  return { success: true };
}
