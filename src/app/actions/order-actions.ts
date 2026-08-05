'use server';

import { pool } from '@/lib/db';
import { ItemStatus, SelectedModifier, StationType, OrderItem } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

// Data Fetch Action for Customer Order Page (Filters out staff-only items)
export async function getOrderPageData(tableNumber: number, token: string) {
  if (!pool) return { table: null, session: null, categories: [], menuItems: [], orderItems: [], discounts: [], payments: [], exchangeRate: 89500 };

  let table: any = null;
  let session: any = null;
  let liveItems: any[] = [];
  let liveCategories: any[] = [];
  let liveMenuItems: any[] = [];
  let liveDiscounts: any[] = [];
  let livePayments: any[] = [];

  try {
    const tblRes = await pool.query('SELECT * FROM tables WHERE table_number = $1', [tableNumber]);
    if (tblRes.rows.length > 0) {
      table = tblRes.rows[0];
    } else {
      const newTblId = randomUUID();
      const insertTbl = await pool.query(
        'INSERT INTO tables (id, table_number, qr_code_token, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [newTblId, tableNumber, token || `token-table-${tableNumber}`, 'occupied']
      );
      table = insertTbl.rows[0];
    }

    if (table) {
      const sessRes = await pool.query(
        "SELECT * FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
        [table.id]
      );
      if (sessRes.rows.length > 0) {
        session = sessRes.rows[0];
      } else {
        const newSessId = randomUUID();
        const insertSess = await pool.query(
          "INSERT INTO table_sessions (id, primary_table_id, status) VALUES ($1, $2, 'active') RETURNING *",
          [newSessId, table.id]
        );
        session = insertSess.rows[0] || { id: newSessId, primary_table_id: table.id, status: 'active' };
      }
    }

    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_staff_only BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0');
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS modifier_groups JSONB DEFAULT \'[]\'::jsonb');
    const catRes = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
    liveCategories = catRes.rows;

    const itemRes = await pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC');
    liveMenuItems = itemRes.rows
      .filter((m: any) => !m.is_staff_only)
      .map((m: any) => ({
        ...m,
        modifier_groups: typeof m.modifier_groups === 'string' ? JSON.parse(m.modifier_groups) : (m.modifier_groups || []),
      }));

    if (session) {
      const ordItemsRes = await pool.query('SELECT * FROM order_items WHERE session_id = $1 ORDER BY created_at ASC', [session.id]);
      liveItems = ordItemsRes.rows;

      const discRes = await pool.query('SELECT * FROM discounts WHERE session_id = $1', [session.id]);
      liveDiscounts = discRes.rows;

      const payRes = await pool.query('SELECT * FROM payments WHERE session_id = $1', [session.id]);
      livePayments = payRes.rows;
    }
  } catch (e) {
    console.error('Neon getOrderPageData error:', e);
  }

  return {
    table,
    session,
    categories: liveCategories,
    menuItems: liveMenuItems,
    orderItems: liveItems,
    discounts: liveDiscounts,
    payments: livePayments,
    exchangeRate: 89500,
  };
}

// Action for submitting customer orders (inserts individual 1x items for per-dish KDS status tracking)
export async function submitCustomerOrder(data: {
  sessionId: string;
  items: Array<{
    menuItemId: string;
    itemName: string;
    quantity: number;
    unitPriceUsd: number;
    station: StationType;
    selectedModifiers: SelectedModifier[];
    specialNotes?: string;
  }>;
}) {
  if (!data.items || data.items.length === 0 || !pool) {
    return { success: false, error: 'No items in order' };
  }

  let primaryTable: any = null;
  let tableNumber = 1;

  try {
    const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [data.sessionId]);
    if (sessRes.rows.length > 0) {
      const session = sessRes.rows[0];
      const tblRes = await pool.query('SELECT * FROM tables WHERE id = $1', [session.primary_table_id]);
      if (tblRes.rows.length > 0) {
        primaryTable = tblRes.rows[0];
        tableNumber = primaryTable.table_number;
      }
    }
  } catch (e) {
    console.error('Neon session query error:', e);
  }

  if (primaryTable && primaryTable.status === 'bill_requested') {
    return { success: false, error: 'Pre-bill has been printed. Cart is locked. Please contact your waiter.' };
  }

  const orderId = randomUUID();
  const itemsToInsert: OrderItem[] = [];

  for (const item of data.items) {
    for (let q = 0; q < item.quantity; q++) {
      const newItem: OrderItem = {
        id: randomUUID(),
        order_id: orderId,
        session_id: data.sessionId,
        table_number: tableNumber,
        menu_item_id: item.menuItemId,
        item_name: item.itemName,
        quantity: 1,
        unit_price_usd: item.unitPriceUsd,
        station: item.station,
        status: 'pending' as ItemStatus,
        selected_modifiers: item.selectedModifiers || [],
        special_notes: item.specialNotes || '',
        is_comped: false,
        created_at: new Date().toISOString(),
      };
      itemsToInsert.push(newItem);
    }
  }

  try {
    await pool.query('INSERT INTO orders (id, session_id) VALUES ($1, $2)', [orderId, data.sessionId]);

    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const newItem of itemsToInsert) {
      valuePlaceholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11})`);
      params.push(
        newItem.id,
        newItem.order_id,
        newItem.session_id,
        newItem.table_number,
        newItem.menu_item_id,
        newItem.item_name,
        1,
        newItem.unit_price_usd,
        newItem.station,
        newItem.status,
        JSON.stringify(newItem.selected_modifiers || []),
        newItem.special_notes || ''
      );
      pIdx += 12;
    }

    if (valuePlaceholders.length > 0) {
      await pool.query(
        `INSERT INTO order_items (id, order_id, session_id, table_number, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes)
         VALUES ${valuePlaceholders.join(', ')}`,
        params
      );
    }

    if (primaryTable) {
      await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1 OR table_number = $2", [primaryTable.id, tableNumber]);
    }
  } catch (e) {
    console.error('Neon fast bulk order insert error:', e);
  }

  return { success: true, orderId };
}

// Action for Waiters to Manually Add Items / Fees from POS
export async function addWaiterManualOrderItem(data: {
  tableId: string;
  tableNumber: number;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPriceUsd: number;
  station: StationType;
  selectedModifiers?: SelectedModifier[];
  specialNotes?: string;
}) {
  if (!pool) return { success: false, error: 'DB connection error' };

  let session: any = null;
  try {
    const sessRes = await pool.query(
      "SELECT * FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
      [data.tableId]
    );
    if (sessRes.rows.length > 0) {
      session = sessRes.rows[0];
    } else {
      const newSessId = randomUUID();
      const insertSess = await pool.query(
        "INSERT INTO table_sessions (id, primary_table_id, status) VALUES ($1, $2, 'active') RETURNING *",
        [newSessId, data.tableId]
      );
      session = insertSess.rows[0] || { id: newSessId, primary_table_id: data.tableId, status: 'active' };
      await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1 OR table_number = $2", [data.tableId, data.tableNumber]);
    }
  } catch (e) {
    console.error('Neon waiter session creation error:', e);
  }

  if (!session) return { success: false, error: 'Failed to find/create active session' };

  const orderId = randomUUID();
  try {
    await pool.query('INSERT INTO orders (id, session_id) VALUES ($1, $2)', [orderId, session.id]);

    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (let i = 0; i < data.quantity; i++) {
      valuePlaceholders.push(
        `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11})`
      );
      params.push(
        randomUUID(),
        orderId,
        session.id,
        data.tableNumber,
        data.menuItemId,
        data.itemName,
        1,
        data.unitPriceUsd,
        data.station,
        'pending',
        JSON.stringify(data.selectedModifiers || []),
        data.specialNotes || ''
      );
      pIdx += 12;
    }

    if (valuePlaceholders.length > 0) {
      await pool.query(
        `INSERT INTO order_items (id, order_id, session_id, table_number, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes)
         VALUES ${valuePlaceholders.join(', ')}`,
        params
      );
    }
  } catch (e) {
    console.error('Neon waiter manual order item insert error:', e);
  }

  return { success: true };
}

export async function triggerServiceCall(sessionId: string, tableNumber: number, type: 'waiter' | 'charcoal' | 'bill') {
  if (!pool) return { success: false, error: 'DB connection error' };

  const callId = randomUUID();
  try {
    await pool.query(
      `INSERT INTO service_calls (id, session_id, table_number, type, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [callId, sessionId, tableNumber, type]
    );

    if (type === 'bill') {
      const sessRes = await pool.query('SELECT primary_table_id FROM table_sessions WHERE id = $1', [sessionId]);
      if (sessRes.rows.length > 0) {
        await pool.query("UPDATE tables SET status = 'bill_requested' WHERE id = $1", [sessRes.rows[0].primary_table_id]);
      }
    }
  } catch (e) {
    console.error('Neon service call trigger error:', e);
  }

  return { success: true, callId };
}

// Data Fetch Action for KDS (Strictly filters for ACTIVE table sessions only)
export async function getKDSData(stationFilter?: string) {
  if (!pool) return { items: [], menuItems: [] };

  let items: any[] = [];
  let menuItems: any[] = [];

  try {
    // DB Normalization: update legacy cold_mezza / hot_mezza DB values
    await pool.query("UPDATE order_items SET station = 'mezza' WHERE station IN ('cold_mezza', 'hot_mezza')").catch(() => {});
    await pool.query("UPDATE menu_items SET station = 'mezza' WHERE station IN ('cold_mezza', 'hot_mezza')").catch(() => {});

    const query = `
      SELECT oi.*, COALESCE(mi.station, oi.station) AS station 
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN table_sessions ts ON oi.session_id = ts.id
      WHERE ts.status = 'active'
      AND oi.status NOT IN ('delivered', 'cancelled')
      ORDER BY oi.created_at ASC
    `;

    const [res, menuRes] = await Promise.all([
      pool.query(query),
      pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC'),
    ]);

    menuItems = menuRes.rows.filter((m: any) => !m.is_staff_only);

    const staffOnlyItemIds = new Set(
      menuRes.rows.filter((m: any) => m.is_staff_only).map((m: any) => m.id)
    );

    const normalizeStation = (st: string) => {
      if (!st || st === 'cold_mezza' || st === 'hot_mezza') return 'mezza';
      if (st === 'bbq') return 'grill';
      if (st === 'subs' || st === 'sandwiches' || st === 'kids') return 'subs_sandwiches';
      return st;
    };

    items = res.rows
      .filter((item: any) => !staffOnlyItemIds.has(item.menu_item_id))
      .map((item: any) => ({
        ...item,
        station: normalizeStation(item.station),
      }));
  } catch (e) {
    console.error('Neon KDS fetch error:', e);
  }

  return {
    items,
    menuItems,
  };
}

export async function updateOrderItemStatus(itemId: string, status: ItemStatus) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE order_items SET status = $1 WHERE id = $2', [status, itemId]);
  } catch (e) {
    console.error('Neon updateOrderItemStatus error:', e);
  }

  return { success: true };
}

export async function updateMultipleOrderItemsStatus(itemIds: string[], status: ItemStatus) {
  if (!pool || !itemIds || itemIds.length === 0) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE order_items SET status = $1 WHERE id::text = ANY($2::text[])', [status, itemIds]);
  } catch (e) {
    console.error('Neon updateMultipleOrderItemsStatus error:', e);
  }

  return { success: true };
}

// Revert Status Step-Back Undo for KDS tickets
export async function revertOrderItemStatus(itemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  const prevStatusMap: Record<ItemStatus, ItemStatus> = {
    pending: 'pending',
    preparing: 'pending',
    ready: 'preparing',
    delivered: 'ready',
    cancelled: 'pending',
  };

  try {
    const res = await pool.query('SELECT status FROM order_items WHERE id = $1', [itemId]);
    if (res.rows.length === 0) return { success: false, error: 'Item not found' };

    const currentStatus = res.rows[0].status as ItemStatus;
    const prevStatus = prevStatusMap[currentStatus] || 'pending';

    await pool.query('UPDATE order_items SET status = $1 WHERE id = $2', [prevStatus, itemId]);
  } catch (e) {
    console.error('Neon revertOrderItemStatus error:', e);
  }

  return { success: true };
}

export async function toggleMenuItemAvailability(menuItemId: string, available: boolean) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE menu_items SET available = $1 WHERE id = $2', [available, menuItemId]);
  } catch (e) {
    console.error('Neon toggleMenuItemAvailability error:', e);
  }

  return { success: true, available };
}

export async function updateMenuItemImageUrl(menuItemId: string, imageUrl: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [imageUrl, menuItemId]);
  } catch (e) {
    console.error('Neon updateMenuItemImageUrl error:', e);
  }

  return { success: true, imageUrl };
}

export async function markKDSItemsPrinted(itemIds: string[]) {
  if (!itemIds || itemIds.length === 0 || !pool) return { success: true };

  try {
    await pool.query(
      `UPDATE order_items 
       SET is_printed = true, 
           status = CASE WHEN status = 'pending' THEN 'preparing' ELSE status END 
       WHERE id::text = ANY($1::text[])`,
      [itemIds]
    );

    revalidatePath('/kds');
    revalidatePath('/pos');
    revalidatePath('/order');
  } catch (e) {
    console.error('Neon markKDSItemsPrinted error:', e);
  }

  return { success: true };
}
