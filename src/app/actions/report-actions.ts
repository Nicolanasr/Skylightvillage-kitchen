'use server';

import { pool } from '@/lib/db';
import { ItemStatus } from '@/lib/types';
import { restockRecipeStockForItems } from './inventory-actions';

export interface StatusLogEntry {
  id: string;
  order_item_id: string;
  session_id?: string;
  table_number?: number;
  item_name: string;
  station: string;
  from_status: string;
  to_status: string;
  duration_seconds: number;
  created_at: string;
}

// 1. DDL Schema Initialization for Status Transition Logs & Timestamps
export async function initReportSchema() {
  if (!pool) return;
  try {
    await pool.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS order_item_status_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
          session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
          table_number INT,
          item_name TEXT,
          station VARCHAR(30),
          from_status VARCHAR(20),
          to_status VARCHAR(20),
          duration_seconds INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (e) {
    console.error('Neon initReportSchema error:', e);
  }
}

// 2. Helper to log item status transition and update milestone timestamps
export async function logItemStatusChange(
  itemId: string,
  newStatus: ItemStatus,
  oldStatus?: ItemStatus
) {
  if (!pool || !itemId) return;

  try {
    await initReportSchema();

    // Fetch current item details
    const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1', [itemId]);
    if (itemRes.rows.length === 0) return;
    const item = itemRes.rows[0];
    const currentStatus = oldStatus || item.status;

    if (currentStatus === newStatus) return;

    const now = new Date();

    // Calculate duration in previous status
    let durationSeconds = 0;
    const lastLogRes = await pool.query(
      'SELECT created_at FROM order_item_status_logs WHERE order_item_id = $1 ORDER BY created_at DESC LIMIT 1',
      [itemId]
    );

    const prevTimestamp = lastLogRes.rows.length > 0 ? new Date(lastLogRes.rows[0].created_at) : new Date(item.created_at);
    durationSeconds = Math.max(0, Math.floor((now.getTime() - prevTimestamp.getTime()) / 1000));

    // Update milestone timestamp on order_items
    let timestampCol = '';
    if (newStatus === 'preparing') timestampCol = 'preparing_at = NOW()';
    else if (newStatus === 'ready') timestampCol = 'ready_at = NOW()';
    else if (newStatus === 'delivered') timestampCol = 'delivered_at = NOW()';
    else if (newStatus === 'cancelled') timestampCol = 'cancelled_at = NOW()';

    if (timestampCol) {
      await pool.query(`UPDATE order_items SET status = $1, ${timestampCol} WHERE id = $2`, [newStatus, itemId]);
    } else {
      await pool.query('UPDATE order_items SET status = $1 WHERE id = $2', [newStatus, itemId]);
    }

    // Restock Raw Ingredients if Item was Cancelled / Voided
    if (newStatus === 'cancelled' && item.menu_item_id) {
      await restockRecipeStockForItems(
        [{ menuItemId: item.menu_item_id, quantity: Number(item.quantity || 1) }],
        `Cancelled: ${item.item_name} (Table #${item.table_number || 1})`
      );
    }

    // Insert transition log
    await pool.query(
      `INSERT INTO order_item_status_logs (order_item_id, session_id, table_number, item_name, station, from_status, to_status, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        itemId,
        item.session_id,
        item.table_number,
        item.item_name,
        item.station,
        currentStatus,
        newStatus,
        durationSeconds,
      ]
    );
  } catch (e) {
    console.error('Neon logItemStatusChange error:', e);
  }
}

// 3. Batch Helper to log multiple items (e.g. KDS batch station ready)
export async function logBatchItemStatusChange(itemIds: string[], newStatus: ItemStatus) {
  if (!pool || !itemIds || itemIds.length === 0) return;
  for (const id of itemIds) {
    await logItemStatusChange(id, newStatus);
  }
}

// 4. Fetch Detailed Report Analytics with Odoo Filters
export async function getDetailedOdooReportData() {
  if (!pool) {
    return {
      orderItems: [],
      statusLogs: [],
      sessions: [],
      payments: [],
      discounts: [],
      categories: [],
      menuItems: [],
    };
  }

  try {
    await initReportSchema();

    const [ordRes, logRes, sessRes, payRes, discRes, catRes, menuRes] = await Promise.all([
      pool.query('SELECT * FROM order_items ORDER BY created_at DESC'),
      pool.query('SELECT * FROM order_item_status_logs ORDER BY created_at DESC'),
      pool.query('SELECT * FROM table_sessions ORDER BY created_at DESC'),
      pool.query('SELECT * FROM payments ORDER BY created_at DESC'),
      pool.query('SELECT * FROM discounts ORDER BY created_at DESC'),
      pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC'),
      pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC'),
    ]);

    return {
      orderItems: ordRes.rows,
      statusLogs: logRes.rows,
      sessions: sessRes.rows,
      payments: payRes.rows,
      discounts: discRes.rows,
      categories: catRes.rows,
      menuItems: menuRes.rows,
    };
  } catch (e) {
    console.error('Neon getDetailedOdooReportData error:', e);
    return {
      orderItems: [],
      statusLogs: [],
      sessions: [],
      payments: [],
      discounts: [],
      categories: [],
      menuItems: [],
    };
  }
}
