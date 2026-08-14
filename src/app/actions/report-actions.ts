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
  return;
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

// 4. DDL Schema Initialization for Cashier Shifts, Cash Drops & Feedback
export async function ensureShiftTables() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cashier_shifts (
        id TEXT PRIMARY KEY,
        cashier_name TEXT NOT NULL,
        opening_float_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        opening_float_lbp NUMERIC(15,2) NOT NULL DEFAULT 0,
        cash_drops_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        cash_drops_lbp NUMERIC(15,2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        opened_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        actual_cash_usd NUMERIC(10,2),
        actual_cash_lbp NUMERIC(15,2),
        expected_cash_usd NUMERIC(10,2),
        expected_cash_lbp NUMERIC(15,2),
        variance_usd NUMERIC(10,2),
        variance_lbp NUMERIC(15,2),
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS cash_drops (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_lbp NUMERIC(15,2) NOT NULL DEFAULT 0,
        dropped_by TEXT NOT NULL,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customer_feedback (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        table_number INT,
        rating INT NOT NULL,
        tags JSONB DEFAULT '[]'::jsonb,
        comment TEXT DEFAULT '',
        customer_phone TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (e) {
    console.error('Error in ensureShiftTables:', e);
  }
}

/**
 * Fetch Current Open Cashier Shift if any
 */
export async function getActiveCashierShift() {
  if (!pool) return { activeShift: null, pastShifts: [] };
  await ensureShiftTables();

  try {
    const activeRes = await pool.query(
      "SELECT * FROM cashier_shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    );
    const pastRes = await pool.query(
      "SELECT * FROM cashier_shifts WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 50"
    );

    let activeShift = activeRes.rows.length > 0 ? activeRes.rows[0] : null;
    let cashDrops: any[] = [];

    if (activeShift) {
      const dropRes = await pool.query(
        'SELECT * FROM cash_drops WHERE shift_id = $1 ORDER BY created_at DESC',
        [activeShift.id]
      );
      cashDrops = dropRes.rows.map((d) => ({
        ...d,
        amount_usd: Number(d.amount_usd || 0),
        amount_lbp: Number(d.amount_lbp || 0),
      }));
      activeShift = {
        ...activeShift,
        opening_float_usd: Number(activeShift.opening_float_usd || 0),
        opening_float_lbp: Number(activeShift.opening_float_lbp || 0),
        cash_drops_usd: Number(activeShift.cash_drops_usd || 0),
        cash_drops_lbp: Number(activeShift.cash_drops_lbp || 0),
        cashDrops,
      };
    }

    return {
      activeShift,
      pastShifts: pastRes.rows.map((s) => ({
        ...s,
        opening_float_usd: Number(s.opening_float_usd || 0),
        opening_float_lbp: Number(s.opening_float_lbp || 0),
        cash_drops_usd: Number(s.cash_drops_usd || 0),
        cash_drops_lbp: Number(s.cash_drops_lbp || 0),
        actual_cash_usd: Number(s.actual_cash_usd || 0),
        actual_cash_lbp: Number(s.actual_cash_lbp || 0),
        expected_cash_usd: Number(s.expected_cash_usd || 0),
        expected_cash_lbp: Number(s.expected_cash_lbp || 0),
        variance_usd: Number(s.variance_usd || 0),
        variance_lbp: Number(s.variance_lbp || 0),
      })),
    };
  } catch (e) {
    console.error('Error fetching active cashier shift:', e);
    return { activeShift: null, pastShifts: [] };
  }
}

/**
 * Open a New Cashier Shift with Starting Float
 */
export async function openCashierShiftAction(data: {
  cashierName: string;
  openingFloatUsd: number;
  openingFloatLbp: number;
}) {
  if (!pool) return { success: false, error: 'Database connection error' };
  await ensureShiftTables();

  try {
    // Ensure no existing shift is open
    const checkRes = await pool.query("SELECT id FROM cashier_shifts WHERE status = 'open' LIMIT 1");
    if (checkRes.rows.length > 0) {
      return { success: false, error: 'A shift is already active! Perform a Z-Report close before opening a new shift.' };
    }

    const shiftId = `shift-${Date.now()}`;
    const name = data.cashierName.trim() || 'Cashier';
    const floatUsd = Math.max(0, Number(data.openingFloatUsd || 0));
    const floatLbp = Math.max(0, Number(data.openingFloatLbp || 0));

    await pool.query(
      `INSERT INTO cashier_shifts (id, cashier_name, opening_float_usd, opening_float_lbp, status, opened_at)
       VALUES ($1, $2, $3, $4, 'open', NOW())`,
      [shiftId, name, floatUsd, floatLbp]
    );

    return { success: true, shiftId };
  } catch (e: any) {
    console.error('Error opening cashier shift:', e);
    return { success: false, error: e.message || 'Failed to open shift' };
  }
}

/**
 * Record a Mid-Shift Cash Drop (Transfer cash to safe)
 */
export async function recordCashDropAction(data: {
  shiftId: string;
  amountUsd: number;
  amountLbp: number;
  droppedBy: string;
  notes?: string;
}) {
  if (!pool) return { success: false, error: 'Database connection error' };
  await ensureShiftTables();

  try {
    const dropId = `drop-${Date.now()}`;
    const amtUsd = Math.max(0, Number(data.amountUsd || 0));
    const amtLbp = Math.max(0, Number(data.amountLbp || 0));

    await pool.query(
      `INSERT INTO cash_drops (id, shift_id, amount_usd, amount_lbp, dropped_by, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [dropId, data.shiftId, amtUsd, amtLbp, data.droppedBy.trim() || 'Cashier', data.notes?.trim() || '']
    );

    // Update cumulative cash drops on shift record
    await pool.query(
      `UPDATE cashier_shifts
       SET cash_drops_usd = cash_drops_usd + $1,
           cash_drops_lbp = cash_drops_lbp + $2
       WHERE id = $3`,
      [amtUsd, amtLbp, data.shiftId]
    );

    return { success: true, dropId };
  } catch (e: any) {
    console.error('Error recording cash drop:', e);
    return { success: false, error: e.message || 'Failed to record cash drop' };
  }
}

/**
 * Perform End-of-Shift Blind Z-Report Reconciliation & Close Shift
 */
export async function performBlindZReportCloseAction(data: {
  shiftId: string;
  actualCashUsd: number;
  actualCashLbp: number;
  notes?: string;
}) {
  if (!pool) return { success: false, error: 'Database connection error' };
  await ensureShiftTables();

  try {
    // 1. Fetch shift details
    const shiftRes = await pool.query('SELECT * FROM cashier_shifts WHERE id = $1 LIMIT 1', [data.shiftId]);
    if (shiftRes.rows.length === 0) return { success: false, error: 'Shift record not found' };

    const shift = shiftRes.rows[0];

    // 2. Fetch total payments collected during this shift timeframe
    const paymentsRes = await pool.query(
      `SELECT payment_method, amount_usd, amount_lbp
       FROM payments
       WHERE created_at >= $1`,
      [shift.opened_at]
    );

    let collectedCashUsd = 0;
    let collectedCashLbp = 0;
    let collectedCardUsd = 0;

    for (const p of paymentsRes.rows) {
      const method = (p.payment_method || 'cash').toLowerCase();
      if (method === 'card' || method === 'credit_card') {
        collectedCardUsd += Number(p.amount_usd || 0);
      } else {
        // Cash payment
        collectedCashUsd += Number(p.amount_usd || 0);
        collectedCashLbp += Number(p.amount_lbp || 0);
      }
    }

    const openingFloatUsd = Number(shift.opening_float_usd || 0);
    const openingFloatLbp = Number(shift.opening_float_lbp || 0);
    const cashDropsUsd = Number(shift.cash_drops_usd || 0);
    const cashDropsLbp = Number(shift.cash_drops_lbp || 0);

    // Expected Cash in Drawer = Opening Float + Collected Cash - Cash Drops
    const expectedCashUsd = openingFloatUsd + collectedCashUsd - cashDropsUsd;
    const expectedCashLbp = openingFloatLbp + collectedCashLbp - cashDropsLbp;

    const actualCashUsd = Number(data.actualCashUsd || 0);
    const actualCashLbp = Number(data.actualCashLbp || 0);

    const varianceUsd = actualCashUsd - expectedCashUsd;
    const varianceLbp = actualCashLbp - expectedCashLbp;

    // 3. Update shift record to closed
    await pool.query(
      `UPDATE cashier_shifts
       SET status = 'closed',
           closed_at = NOW(),
           actual_cash_usd = $1,
           actual_cash_lbp = $2,
           expected_cash_usd = $3,
           expected_cash_lbp = $4,
           variance_usd = $5,
           variance_lbp = $6,
           notes = $7
       WHERE id = $8`,
      [
        actualCashUsd,
        actualCashLbp,
        expectedCashUsd,
        expectedCashLbp,
        varianceUsd,
        varianceLbp,
        data.notes?.trim() || '',
        data.shiftId,
      ]
    );

    return {
      success: true,
      zReport: {
        shiftId: shift.id,
        cashierName: shift.cashier_name,
        openedAt: shift.opened_at,
        closedAt: new Date().toISOString(),
        openingFloatUsd,
        openingFloatLbp,
        collectedCashUsd,
        collectedCashLbp,
        collectedCardUsd,
        cashDropsUsd,
        cashDropsLbp,
        expectedCashUsd,
        expectedCashLbp,
        actualCashUsd,
        actualCashLbp,
        varianceUsd,
        varianceLbp,
        notes: data.notes || '',
      },
    };
  } catch (e: any) {
    console.error('Error closing shift with Z-Report:', e);
    return { success: false, error: e.message || 'Failed to close shift' };
  }
}

/**
 * Submit Customer Post-Meal Feedback & Star Rating
 */
export async function submitCustomerFeedbackAction(data: {
  sessionId?: string;
  tableNumber?: number;
  rating: number;
  tags?: string[];
  comment?: string;
  customerPhone?: string;
}) {
  if (!pool) return { success: false, error: 'Database connection error' };
  await ensureShiftTables();

  try {
    const feedbackId = `fb-${Date.now()}`;
    const rating = Math.min(5, Math.max(1, Number(data.rating || 5)));

    await pool.query(
      `INSERT INTO customer_feedback (id, session_id, table_number, rating, tags, comment, customer_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        feedbackId,
        data.sessionId || null,
        data.tableNumber || 1,
        rating,
        JSON.stringify(data.tags || []),
        data.comment?.trim() || '',
        data.customerPhone?.trim() || '',
      ]
    );

    return { success: true, feedbackId };
  } catch (e: any) {
    console.error('Error submitting customer feedback:', e);
    return { success: false, error: e.message || 'Failed to submit feedback' };
  }
}
