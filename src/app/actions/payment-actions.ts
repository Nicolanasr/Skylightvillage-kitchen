'use server';

import { dbStore, pool } from '@/lib/db';
import { calculateBillTotals } from '@/lib/currency';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function getPOSData() {
  let menuItems = dbStore.menuItems;
  let categories = dbStore.categories;

  if (pool) {
    try {
      const itemRes = await pool.query('SELECT * FROM menu_items ORDER BY name ASC');
      if (itemRes.rows.length > 0) menuItems = itemRes.rows;

      const catRes = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
      if (catRes.rows.length > 0) categories = catRes.rows;
    } catch (e) {}
  }

  return {
    tables: dbStore.tables,
    sessions: dbStore.tableSessions,
    serviceCalls: dbStore.serviceCalls,
    orderItems: dbStore.orderItems,
    discounts: dbStore.discounts,
    payments: dbStore.payments,
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
      // Assign full item
      item.guest_name = guestName;
      if (pool) {
        try {
          await pool.query('UPDATE order_items SET guest_name = $1 WHERE id = $2', [guestName, item.id]);
        } catch (e) {}
      }
    } else {
      // Split quantity: reduce original quantity and create a new item for guest
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

export async function processSplitPayment(data: {
  sessionId: string;
  amountUsd: number;
  currency: 'USD' | 'LBP';
  paymentMethod: 'cash' | 'card';
  paymentType: 'full' | 'item_split' | 'equal_split' | 'partial';
  paidItemIds?: Array<{ id: string; qty: number }>;
}) {
  const session = dbStore.tableSessions.find((s) => s.id === data.sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const payment = {
    id: `pay-${Date.now()}`,
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
      console.error('Neon error on processSplitPayment:', e);
    }
  }

  // Mark specific paid items as is_paid = true for Person A / Person B item split checks
  if (data.paidItemIds && data.paidItemIds.length > 0) {
    const itemIds = data.paidItemIds.map((i) => i.id);

    dbStore.orderItems.forEach((item) => {
      if (itemIds.includes(item.id)) {
        item.is_paid = true;
      }
    });

    if (pool) {
      try {
        await pool.query('UPDATE order_items SET is_paid = true WHERE id = ANY($1)', [itemIds]);
      } catch (e) {
        console.error('Neon error updating order_items is_paid:', e);
      }
    }
  }

  const sessionItems = dbStore.orderItems.filter((i) => i.session_id === data.sessionId);
  const sessionDiscounts = dbStore.discounts.filter((d) => d.session_id === data.sessionId);
  const sessionPayments = dbStore.payments.filter((p) => p.session_id === data.sessionId);

  const bill = calculateBillTotals(sessionItems, sessionDiscounts, sessionPayments, dbStore.exchangeRate);

  // Check if all non-cancelled items in session are paid/comped
  const unpaidItemsLeft = sessionItems.filter(
    (i) => i.status !== 'cancelled' && !i.is_comped && !i.is_paid
  );

  if (unpaidItemsLeft.length === 0 || bill.remainingUsd <= 0.01) {
    session.status = 'closed';
    session.closed_at = new Date().toISOString();

    const primaryTable = dbStore.tables.find((t) => t.id === session.primary_table_id);
    if (primaryTable) primaryTable.status = 'available';

    if (session.merged_table_ids && session.merged_table_ids.length > 0) {
      session.merged_table_ids.forEach((id) => {
        const mergedTbl = dbStore.tables.find((t) => t.id === id);
        if (mergedTbl) mergedTbl.status = 'available';
      });
    }

    if (pool) {
      try {
        await pool.query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [
          session.id,
        ]);
        await pool.query("UPDATE tables SET status = 'available' WHERE id = $1", [
          session.primary_table_id,
        ]);
        if (session.merged_table_ids && session.merged_table_ids.length > 0) {
          await pool.query("UPDATE tables SET status = 'available' WHERE id = ANY($1)", [
            session.merged_table_ids,
          ]);
        }
      } catch (e) {
        console.error('Neon error closing session:', e);
      }
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return {
    success: true,
    remainingUsd: bill.remainingUsd,
    sessionClosed: session.status === 'closed',
  };
}

export async function mergeTables(primaryTableId: string, secondaryTableIds: string[]) {
  if (!secondaryTableIds || secondaryTableIds.length === 0) {
    return { success: false, error: 'Select at least one table to merge' };
  }

  let primarySession = dbStore.tableSessions.find(
    (s) => s.primary_table_id === primaryTableId && s.status === 'active'
  );

  if (!primarySession) {
    primarySession = {
      id: `sess-${primaryTableId}-${Date.now()}`,
      primary_table_id: primaryTableId,
      merged_table_ids: secondaryTableIds,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    dbStore.tableSessions.push(primarySession);
  } else {
    primarySession.merged_table_ids = Array.from(
      new Set([...(primarySession.merged_table_ids || []), ...secondaryTableIds])
    );
  }

  const primaryTable = dbStore.tables.find((t) => t.id === primaryTableId);
  if (primaryTable) primaryTable.status = 'occupied';

  secondaryTableIds.forEach((id) => {
    const secTable = dbStore.tables.find((t) => t.id === id);
    if (secTable) secTable.status = 'merged';
  });

  if (pool) {
    try {
      await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [
        primarySession.merged_table_ids,
        primarySession.id,
      ]);
      await pool.query("UPDATE tables SET status = 'merged' WHERE id = ANY($1)", [secondaryTableIds]);
      await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [primaryTableId]);
    } catch (e) {
      console.error('Neon mergeTables error:', e);
    }
  }

  revalidatePath('/pos');
  return { success: true, sessionId: primarySession.id };
}

export async function unmergeSingleTable(sessionId: string, tableIdToUnmerge: string) {
  const session = dbStore.tableSessions.find((s) => s.id === sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  session.merged_table_ids = (session.merged_table_ids || []).filter((id) => id !== tableIdToUnmerge);
  const unmergedTable = dbStore.tables.find((t) => t.id === tableIdToUnmerge);
  if (unmergedTable) unmergedTable.status = 'available';

  if (pool) {
    try {
      await pool.query('UPDATE table_sessions SET merged_table_ids = $1 WHERE id = $2', [
        session.merged_table_ids,
        session.id,
      ]);
      await pool.query("UPDATE tables SET status = 'available' WHERE id = $1", [tableIdToUnmerge]);
    } catch (e) {
      console.error('Neon unmerge error:', e);
    }
  }

  revalidatePath('/pos');
  return { success: true };
}

export async function updateOrderItemQuantity(orderItemId: string, delta: number) {
  const itemIndex = dbStore.orderItems.findIndex((i) => i.id === orderItemId);
  if (itemIndex === -1) return { success: false, error: 'Item not found' };

  const item = dbStore.orderItems[itemIndex];
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    dbStore.orderItems.splice(itemIndex, 1);
    if (pool) {
      try {
        await pool.query('DELETE FROM order_items WHERE id = $1', [orderItemId]);
      } catch (e) {}
    }
  } else {
    item.quantity = newQty;
    if (pool) {
      try {
        await pool.query('UPDATE order_items SET quantity = $1 WHERE id = $2', [newQty, orderItemId]);
      } catch (e) {}
    }
  }

  revalidatePath('/pos');
  revalidatePath('/kds');
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
    } catch (e) {}
  }

  revalidatePath('/pos');
  revalidatePath('/kds');
  revalidatePath('/order');
  return { success: true };
}

export async function applyDiscount(
  sessionId: string,
  type: 'percentage' | 'fixed',
  value: number,
  reason?: string
) {
  if (value <= 0) return { success: false, error: 'Discount value must be greater than 0' };

  const discount = {
    id: `disc-${Date.now()}`,
    session_id: sessionId,
    type,
    value,
    reason: reason || 'Manager discount',
    created_at: new Date().toISOString(),
  };

  dbStore.discounts.push(discount);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO discounts (id, session_id, type, value, reason) VALUES ($1, $2, $3, $4, $5)`,
        [discount.id, discount.session_id, discount.type, discount.value, discount.reason]
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
    } catch (e) {}
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  return { success: true };
}

export async function compOrderItem(orderItemId: string, comped: boolean) {
  const item = dbStore.orderItems.find((i) => i.id === orderItemId);
  if (!item) return { success: false, error: 'Item not found' };

  item.is_comped = comped;

  if (pool) {
    try {
      await pool.query('UPDATE order_items SET is_comped = $1 WHERE id = $2', [comped, orderItemId]);
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
