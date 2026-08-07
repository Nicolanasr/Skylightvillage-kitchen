'use server';

import { pool } from '@/lib/db';
import { ItemStatus, SelectedModifier, StationType, OrderItem } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { logItemStatusChange } from './report-actions';
import { deductRecipeStockForItems } from './inventory-actions';

// Data Fetch Action for Customer Order Page (Filters out staff-only items)
export async function getOrderPageData(tableNumber?: number | string, token?: string) {
  if (!pool) return { table: null, session: null, categories: [], menuItems: [], orderItems: [], discounts: [], payments: [], exchangeRate: 89500 };

  let table: any = null;
  let session: any = null;
  let liveItems: any[] = [];
  let liveCategories: any[] = [];
  let liveMenuItems: any[] = [];
  let liveDiscounts: any[] = [];
  let livePayments: any[] = [];

  try {
    const numTbl = Number(tableNumber);
    if (tableNumber !== undefined && tableNumber !== null && !isNaN(numTbl) && numTbl > 0) {
      const tblRes = await pool.query('SELECT * FROM tables WHERE table_number = $1', [numTbl]);
      if (tblRes.rows.length > 0) {
        table = tblRes.rows[0];
      } else {
        const newTblId = randomUUID();
        const insertTbl = await pool.query(
          'INSERT INTO tables (id, table_number, qr_code_token, status) VALUES ($1, $2, $3, $4) RETURNING *',
          [newTblId, numTbl, token || `token-table-${numTbl}`, 'occupied']
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
          session = { id: `virtual-${table.id}`, primary_table_id: table.id, status: 'active', is_virtual: true };
        }
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

    if (session && !session.is_virtual && !session.id.startsWith('virtual-')) {
      const ordItemsRes = await pool.query('SELECT * FROM order_items WHERE session_id = $1 ORDER BY created_at ASC', [session.id]);
      liveItems = ordItemsRes.rows;

      const discRes = await pool.query('SELECT * FROM discounts WHERE session_id = $1', [session.id]);
      liveDiscounts = discRes.rows;

    const payRes = await pool.query('SELECT * FROM payments WHERE session_id = $1', [session.id]);
      livePayments = payRes.rows;
    }

    let nextEventTicketNumber = 101;
    try {
      const evtRes = await pool.query(
        `SELECT customer_name FROM table_sessions 
         WHERE order_type = 'event_voucher' 
         ORDER BY created_at DESC LIMIT 100`
      );
      let maxNum = 100;
      for (const row of evtRes.rows) {
        if (row.customer_name) {
          const match = row.customer_name.match(/EVT-(\d+)/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      nextEventTicketNumber = maxNum + 1;
    } catch (e) {
      console.error('Neon nextEventTicketNumber query error:', e);
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
      nextEventTicketNumber,
    };
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
    nextEventTicketNumber: 101,
  };
}

export async function createTakeoutOrCampingSession(data: {
  orderType: 'takeout' | 'camping';
  customerName: string;
  customerPhone?: string;
}) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in'");
    await pool.query('ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_name TEXT');
    await pool.query('ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_phone TEXT');

    await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in'");
    await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_name TEXT');
    await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_phone TEXT');

    await pool.query('ALTER TABLE table_sessions ALTER COLUMN primary_table_id DROP NOT NULL').catch(() => {});

    // Check if there is already an active session for the same mobile number
    const cleanPhone = data.customerPhone ? data.customerPhone.trim() : '';
    if (cleanPhone) {
      const existingRes = await pool.query(
        "SELECT * FROM table_sessions WHERE customer_phone = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [cleanPhone]
      );
      if (existingRes.rows.length > 0) {
        const existingSess = existingRes.rows[0];
        if (data.customerName && data.customerName.trim()) {
          await pool.query('UPDATE table_sessions SET customer_name = $1 WHERE id = $2', [data.customerName.trim(), existingSess.id]);
        }
        revalidatePath('/pos');
        revalidatePath('/order');
        revalidatePath('/takeout');
        revalidatePath('/kds');
        return { success: true, sessionId: existingSess.id, session: { ...existingSess, customer_name: data.customerName.trim() || existingSess.customer_name } };
      }
    }

    const sessionId = randomUUID();
    const res = await pool.query(
      `INSERT INTO table_sessions (id, primary_table_id, merged_table_ids, status, order_type, customer_name, customer_phone)
       VALUES ($1, NULL, $2, 'active', $3, $4, $5) RETURNING *`,
      [sessionId, [], data.orderType, data.customerName, cleanPhone]
    );

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/takeout');
    revalidatePath('/kds');

    return { success: true, sessionId, session: res.rows[0] };
  } catch (e: any) {
    console.error('Neon createTakeoutOrCampingSession error:', e);
    return { success: false, error: e.message };
  }
}

// Action for submitting customer orders (inserts individual 1x items for per-dish KDS status tracking)
export async function submitCustomerOrder(data: {
  sessionId: string;
  orderType?: 'dine_in' | 'takeout' | 'camping';
  customerName?: string;
  customerPhone?: string;
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

  let activeSession: any = null;
  let primaryTable: any = null;
  let tableNumber = 1;

  try {
    let targetTableId = '';
    const isVirtual = data.sessionId.startsWith('virtual-');
    if (isVirtual) {
      targetTableId = data.sessionId.replace('virtual-', '');
    } else {
      const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id = $1 AND status = \'active\'', [data.sessionId]);
      if (sessRes.rows.length > 0) {
        activeSession = sessRes.rows[0];
      }
    }

    if (!activeSession) {
      // Session does not exist in DB yet (e.g. virtual or new order) -> resolve table and create session ON-DEMAND!
      let tblRes: any = { rows: [] };
      if (targetTableId) {
        tblRes = await pool.query('SELECT * FROM tables WHERE id = $1', [targetTableId]);
      }
      if (tblRes.rows.length === 0) {
        tblRes = await pool.query('SELECT * FROM tables ORDER BY table_number ASC LIMIT 1');
      }

      if (tblRes.rows.length > 0) {
        primaryTable = tblRes.rows[0];
        tableNumber = primaryTable.table_number;

        const activeSessRes = await pool.query(
          "SELECT * FROM table_sessions WHERE (primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
          [primaryTable.id]
        );
        if (activeSessRes.rows.length > 0) {
          activeSession = activeSessRes.rows[0];
        } else {
          // Create real active session in DB NOW because an order is actually being submitted!
          const newSessId = randomUUID();
          const insertSess = await pool.query(
            "INSERT INTO table_sessions (id, primary_table_id, status) VALUES ($1, $2, 'active') RETURNING *",
            [newSessId, primaryTable.id]
          );
          activeSession = insertSess.rows[0];
          await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [primaryTable.id]);
        }
      }
    }

    if (activeSession && !primaryTable) {
      const tblRes = await pool.query('SELECT * FROM tables WHERE id = $1', [activeSession.primary_table_id]);
      if (tblRes.rows.length > 0) {
        primaryTable = tblRes.rows[0];
        tableNumber = primaryTable.table_number;
      }
    }
  } catch (e) {
    console.error('Neon session query error in submitCustomerOrder:', e);
  }

  // Fallback check to ensure finalSessionId is NEVER a "virtual-" string
  let finalSessionId = activeSession ? activeSession.id : '';
  if (!finalSessionId || finalSessionId.startsWith('virtual-')) {
    const fallbackSessId = randomUUID();
    const fallbackTblId = primaryTable?.id || (await pool.query('SELECT id FROM tables LIMIT 1')).rows[0]?.id;
    const fallbackSess = await pool.query(
      "INSERT INTO table_sessions (id, primary_table_id, status) VALUES ($1, $2, 'active') RETURNING *",
      [fallbackSessId, fallbackTblId]
    );
    finalSessionId = fallbackSess.rows[0].id;
  }

  const isTakeoutOrCamping = data.orderType === 'takeout' || data.orderType === 'camping' || activeSession?.order_type === 'takeout' || activeSession?.order_type === 'camping';
  if (isTakeoutOrCamping) {
    tableNumber = 0;
  }
  const effOrderType = data.orderType || activeSession?.order_type || 'dine_in';
  const effCustName = data.customerName || activeSession?.customer_name || '';
  const effCustPhone = data.customerPhone || activeSession?.customer_phone || '';

  if (primaryTable && primaryTable.status === 'bill_requested' && !isTakeoutOrCamping) {
    return { success: false, error: 'Pre-bill has been printed. Cart is locked. Please contact your waiter.' };
  }

  const orderId = randomUUID();
  const itemsToInsert: OrderItem[] = [];

  for (const item of data.items) {
    const modifiersExtraSum = (item.selectedModifiers || []).reduce(
      (sum: number, mod: any) => sum + Number(mod.price_extra || mod.price_extra_usd || 0),
      0
    );
    const effectiveUnitPrice = Number(item.unitPriceUsd) + modifiersExtraSum;

    for (let q = 0; q < item.quantity; q++) {
      const newItem: OrderItem = {
        id: randomUUID(),
        order_id: orderId,
        session_id: finalSessionId,
        table_number: tableNumber,
        order_type: effOrderType,
        customer_name: effCustName,
        customer_phone: effCustPhone,
        menu_item_id: item.menuItemId,
        item_name: item.itemName,
        quantity: 1,
        unit_price_usd: effectiveUnitPrice,
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
    await pool.query('INSERT INTO orders (id, session_id) VALUES ($1, $2)', [orderId, finalSessionId]);

    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const newItem of itemsToInsert) {
      valuePlaceholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12}, $${pIdx+13}, $${pIdx+14})`);
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
        newItem.special_notes || '',
        effOrderType,
        effCustName,
        effCustPhone
      );
      pIdx += 15;
    }

    if (valuePlaceholders.length > 0) {
      await pool.query(
        `INSERT INTO order_items (id, order_id, session_id, table_number, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes, order_type, customer_name, customer_phone)
         VALUES ${valuePlaceholders.join(', ')}`,
        params
      );

      // Real-Time Stock Deduction
      await deductRecipeStockForItems(
        data.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        effOrderType === 'takeout' ? 'Takeout Order' : `Table #${tableNumber}`
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
      "SELECT * FROM table_sessions WHERE (id = $1 OR primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
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
      if (data.tableNumber !== 0) {
        await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1 OR table_number = $2", [data.tableId, data.tableNumber]);
      }
    }
  } catch (e) {
    console.error('Neon waiter session creation error:', e);
  }

  if (!session) return { success: false, error: 'Failed to find/create active session' };

  const isTakeoutOrCamping = session.order_type === 'takeout' || session.order_type === 'camping' || data.tableNumber === 0;
  const effTableNumber = isTakeoutOrCamping ? 0 : data.tableNumber;
  const effOrderType = session.order_type || 'dine_in';
  const effCustName = session.customer_name || '';
  const effCustPhone = session.customer_phone || '';

  const orderId = randomUUID();
  try {
    await pool.query('INSERT INTO orders (id, session_id) VALUES ($1, $2)', [orderId, session.id]);

    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    const modifiersExtraSum = (data.selectedModifiers || []).reduce(
      (sum: number, mod: any) => sum + Number(mod.price_extra || mod.price_extra_usd || 0),
      0
    );
    const effectiveUnitPriceUsd = Number(data.unitPriceUsd) + modifiersExtraSum;

    for (let i = 0; i < data.quantity; i++) {
      valuePlaceholders.push(
        `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11}, $${pIdx + 12}, $${pIdx + 13}, $${pIdx + 14})`
      );
      params.push(
        randomUUID(),
        orderId,
        session.id,
        effTableNumber,
        data.menuItemId,
        data.itemName,
        1,
        effectiveUnitPriceUsd,
        data.station,
        'pending',
        JSON.stringify(data.selectedModifiers || []),
        data.specialNotes || '',
        effOrderType,
        effCustName,
        effCustPhone
      );
      pIdx += 15;
    }

    if (valuePlaceholders.length > 0) {
      await pool.query(
        `INSERT INTO order_items (id, order_id, session_id, table_number, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes, order_type, customer_name, customer_phone)
         VALUES ${valuePlaceholders.join(', ')}`,
        params
      );

      // Real-Time Stock Deduction
      await deductRecipeStockForItems(
        [{ menuItemId: data.menuItemId, quantity: data.quantity }],
        effOrderType === 'takeout' ? 'Takeout POS' : `POS Table #${effTableNumber}`
      );
    }
  } catch (e) {
    console.error('Neon waiter manual order item insert error:', e);
  }

  return { success: true };
}

export async function addBatchWaiterManualOrderItems(data: {
  tableId: string;
  tableNumber: number;
  items: Array<{
    menuItemId: string;
    itemName: string;
    quantity: number;
    unitPriceUsd: number;
    station: StationType;
    selectedModifiers?: SelectedModifier[];
    specialNotes?: string;
  }>;
}) {
  if (!pool || !data.items || data.items.length === 0) return { success: false, error: 'No items provided' };

  let session: any = null;
  try {
    const sessRes = await pool.query(
      "SELECT * FROM table_sessions WHERE (id = $1 OR primary_table_id = $1 OR $1 = ANY(merged_table_ids)) AND status = 'active'",
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
      if (data.tableNumber !== 0) {
        await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1 OR table_number = $2", [data.tableId, data.tableNumber]);
      }
    }
  } catch (e) {
    console.error('Neon waiter session creation error:', e);
  }

  if (!session) return { success: false, error: 'Failed to find/create active session' };

  const isTakeoutOrCamping = session.order_type === 'takeout' || session.order_type === 'camping' || data.tableNumber === 0;
  const effTableNumber = isTakeoutOrCamping ? 0 : data.tableNumber;
  const effOrderType = session.order_type || 'dine_in';
  const effCustName = session.customer_name || '';
  const effCustPhone = session.customer_phone || '';

  const orderId = randomUUID();
  try {
    await pool.query('INSERT INTO orders (id, session_id) VALUES ($1, $2)', [orderId, session.id]);

    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const item of data.items) {
      const modifiersExtraSum = (item.selectedModifiers || []).reduce(
        (sum: number, mod: any) => sum + Number(mod.price_extra || mod.price_extra_usd || 0),
        0
      );
      const effectiveUnitPriceUsd = Number(item.unitPriceUsd) + modifiersExtraSum;

      for (let i = 0; i < item.quantity; i++) {
        valuePlaceholders.push(
          `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11}, $${pIdx + 12}, $${pIdx + 13}, $${pIdx + 14})`
        );
        params.push(
          randomUUID(),
          orderId,
          session.id,
          effTableNumber,
          item.menuItemId,
          item.itemName,
          1,
          effectiveUnitPriceUsd,
          item.station,
          'pending',
          JSON.stringify(item.selectedModifiers || []),
          item.specialNotes || '',
          effOrderType,
          effCustName,
          effCustPhone
        );
        pIdx += 15;
      }
    }

    if (valuePlaceholders.length > 0) {
      await pool.query(
        `INSERT INTO order_items (id, order_id, session_id, table_number, menu_item_id, item_name, quantity, unit_price_usd, station, status, selected_modifiers, special_notes, order_type, customer_name, customer_phone)
         VALUES ${valuePlaceholders.join(', ')}`,
        params
      );

      // Real-Time Stock Deduction
      await deductRecipeStockForItems(
        data.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        effOrderType === 'takeout' ? 'Takeout POS Batch' : `POS Batch Table #${effTableNumber}`
      );
    }
  } catch (e) {
    console.error('Neon addBatchWaiterManualOrderItems error:', e);
    return { success: false, error: 'Failed to insert batch items' };
  }

  revalidatePath('/pos');
  revalidatePath('/kds');
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
    // DB Normalization & Cleanup: cancel lingering pending items from closed sessions
    await pool.query("UPDATE order_items SET station = 'mezza' WHERE station IN ('cold_mezza', 'hot_mezza')").catch(() => {});
    await pool.query("UPDATE menu_items SET station = 'mezza' WHERE station IN ('cold_mezza', 'hot_mezza')").catch(() => {});
    await pool.query("UPDATE order_items SET status = 'cancelled' WHERE session_id IN (SELECT id FROM table_sessions WHERE status = 'closed') AND status IN ('pending', 'preparing')").catch(() => {});

    const query = `
      SELECT oi.*, COALESCE(mi.station, oi.station) AS station, ts.primary_table_id, ts.merged_table_ids
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN table_sessions ts ON oi.session_id = ts.id
      WHERE ts.status = 'active'
      AND (oi.is_paid IS NOT TRUE)
      AND oi.status NOT IN ('delivered', 'cancelled')
      ORDER BY oi.created_at ASC
    `;

    const [res, menuRes, tblRes] = await Promise.all([
      pool.query(query),
      pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC'),
      pool.query('SELECT * FROM tables ORDER BY table_number ASC'),
    ]);

    menuItems = menuRes.rows.filter((m: any) => !m.is_staff_only);
    const tables = tblRes.rows;

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
      .map((item: any) => {
        let mergedNums: number[] = [];
        if (item.merged_table_ids) {
          let rawArr: string[] = [];
          if (Array.isArray(item.merged_table_ids)) {
            rawArr = item.merged_table_ids;
          } else if (typeof item.merged_table_ids === 'string') {
            try {
              const formattedStr = (item.merged_table_ids as string)
                .replace(/^{/, '[')
                .replace(/}$/, ']');
              rawArr = JSON.parse(formattedStr);
            } catch (e) {}
          }
          mergedNums = rawArr
            .map((tid) => tables.find((t) => t.id === tid)?.table_number)
            .filter((num): num is number => num !== undefined);
        }

        const primaryTblNum = tables.find((t) => t.id === item.primary_table_id)?.table_number || item.table_number || 1;
        const allTableNums = Array.from(new Set([primaryTblNum, ...mergedNums])).sort((a, b) => a - b);
        const tableLabel = allTableNums.length > 1 ? `TABLE #${allTableNums.join(' & #')}` : `TABLE #${primaryTblNum}`;

        return {
          ...item,
          table_number: primaryTblNum,
          table_display_label: tableLabel,
          station: normalizeStation(item.station),
        };
      });
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
    await logItemStatusChange(itemId, status);
  } catch (e) {
    console.error('Neon updateOrderItemStatus error:', e);
  }

  return { success: true };
}

export async function updateMultipleOrderItemsStatus(itemIds: string[], status: ItemStatus) {
  if (!pool || !itemIds || itemIds.length === 0) return { success: false, error: 'DB connection error' };

  try {
    for (const id of itemIds) {
      await logItemStatusChange(id, status);
    }
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

    await logItemStatusChange(itemId, prevStatus, currentStatus);
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

export async function submitEventVoucherOrder(data: {
  items: Array<{
    menuItem: any;
    quantity: number;
    selectedModifiers?: any[];
    specialNotes?: string;
  }>;
  paymentMethod: 'cash_usd' | 'cash_lbp' | 'card';
  guestName?: string;
  ticketTag?: string;
}) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query("ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in'");
    await pool.query('ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_name TEXT');
    await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in'");
    await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_name TEXT');

    await pool.query('ALTER TABLE table_sessions ALTER COLUMN primary_table_id DROP NOT NULL').catch(() => {});

    const sessionId = randomUUID();
    const tag = data.ticketTag || `EVT-${Math.floor(100 + Math.random() * 900)}`;
    const fullCustomerName = `${tag}${data.guestName ? ` (${data.guestName})` : ''}`;

    const sessRes = await pool.query(
      `INSERT INTO table_sessions (id, primary_table_id, merged_table_ids, status, order_type, customer_name)
       VALUES ($1, NULL, $2, 'closed', 'event_voucher', $3) RETURNING *`,
      [sessionId, [], fullCustomerName]
    );

    const insertedOrderItems: any[] = [];
    let totalUsd = 0;

    for (const entry of data.items) {
      const item = entry.menuItem;
      const mods = entry.selectedModifiers || [];
      const modTotal = mods.reduce((sum: number, m: any) => sum + Number(m.price_extra || m.price || 0), 0);
      const unitPrice = Number(item.price_usd) + modTotal;
      const itemTotal = unitPrice * entry.quantity;
      totalUsd += itemTotal;

      const orderItemId = randomUUID();
      const itemRes = await pool.query(
        `INSERT INTO order_items (id, session_id, table_number, menu_item_id, item_name, unit_price_usd, quantity, selected_modifiers, special_notes, station, status, order_type, customer_name)
         VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, 'delivered', 'event_voucher', $10) RETURNING *`,
        [
          orderItemId,
          sessionId,
          item.id,
          item.name,
          unitPrice,
          entry.quantity,
          JSON.stringify(mods),
          entry.specialNotes || 'Event Voucher Claim',
          item.station || 'mezza',
          fullCustomerName,
        ]
      );
      insertedOrderItems.push(itemRes.rows[0]);
    }

    // Record Payment
    const mappedPaymentMethod =
      data.paymentMethod === 'cash_lbp' ? 'lbp' :
      data.paymentMethod === 'cash_usd' ? 'cash' :
      'card';

    const payId = randomUUID();
    await pool.query(
      `INSERT INTO payments (id, session_id, amount_usd, payment_method)
       VALUES ($1, $2, $3, $4)`,
      [payId, sessionId, totalUsd, mappedPaymentMethod]
    );

    // Real-time Recipe Ingredient Inventory Stock Deduction
    await deductRecipeStockForItems(
      data.items.map((e) => ({ menuItemId: e.menuItem.id, quantity: e.quantity })),
      `Event Voucher ${tag}`
    );

    revalidatePath('/events');
    revalidatePath('/pos/reports');
    revalidatePath('/admin');

    return {
      success: true,
      sessionId,
      ticketTag: tag,
      totalUsd,
      orderItems: insertedOrderItems,
    };
  } catch (e: any) {
    console.error('Neon submitEventVoucherOrder error:', e);
    return { success: false, error: e.message };
  }
}

export async function getEventVouchersReport() {
  if (!pool)
    return {
      success: false,
      totalOrders: 0,
      totalUsd: 0,
      paymentMethods: { cash: 0, lbp: 0, card: 0 },
      items: [],
      recentSessions: [],
    };

  try {
    const sessRes = await pool.query(
      `SELECT ts.id, ts.customer_name, ts.created_at, p.amount_usd as paid_usd, p.payment_method
       FROM table_sessions ts
       LEFT JOIN payments p ON p.session_id = ts.id
       WHERE ts.order_type = 'event_voucher'
       ORDER BY ts.created_at DESC`
    );

    const itemRes = await pool.query(
      `SELECT item_name, station, SUM(quantity) as total_qty, SUM(unit_price_usd * quantity) as total_usd
       FROM order_items
       WHERE order_type = 'event_voucher'
       GROUP BY item_name, station
       ORDER BY total_qty DESC`
    );

    let totalUsd = 0;
    const paymentMethods: Record<string, number> = { cash: 0, lbp: 0, card: 0 };

    for (const row of sessRes.rows) {
      const amt = Number(row.paid_usd || 0);
      totalUsd += amt;
      const pm = row.payment_method || 'cash';
      paymentMethods[pm] = (paymentMethods[pm] || 0) + amt;
    }

    return {
      success: true,
      totalOrders: sessRes.rows.length,
      totalUsd,
      paymentMethods,
      items: itemRes.rows,
      recentSessions: sessRes.rows.slice(0, 50),
    };
  } catch (e: any) {
    console.error('Neon getEventVouchersReport error:', e);
    return {
      success: false,
      error: e.message,
      totalOrders: 0,
      totalUsd: 0,
      paymentMethods: { cash: 0, lbp: 0, card: 0 },
      items: [],
      recentSessions: [],
    };
  }
}
