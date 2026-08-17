'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { normalizePhone, getPhoneLookupVariations } from '@/lib/phone';

export interface CustomerProfile {
  id: string;
  phone_number: string;
  name: string;
  email?: string;
  vip_code?: string;
  points_balance: number;
  total_spent_usd: number;
  total_orders: number;
  last_order_at?: string;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert or resolve a Customer Master Record (Optional/Non-mandatory).
 * If phone is empty or missing, returns null cleanly.
 */
export async function resolveOrUpsertCustomer(data: {
  phone?: string | null;
  name?: string | null;
  email?: string | null;
}): Promise<CustomerProfile | null> {
  if (!pool || !data.phone || !data.phone.trim()) {
    return null;
  }

  const canonicalPhone = normalizePhone(data.phone);
  if (!canonicalPhone || canonicalPhone.length < 5) {
    return null;
  }

  const variations = getPhoneLookupVariations(data.phone);
  const cleanName = (data.name && data.name.trim()) ? data.name.trim() : 'Valued Guest';

  try {
    // 1. Check existing customer across all phone variations (+961..., 03..., 3724473, etc.)
    const existingRes = await pool.query(
      `SELECT * FROM customers
       WHERE phone_number = ANY($1::text[]) OR id = $2 LIMIT 1`,
      [variations, `cust-${canonicalPhone}`]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // Update name if currently default and a better name is provided
      if (cleanName !== 'Valued Guest' && (existing.name === 'Valued Guest' || !existing.name)) {
        await pool.query('UPDATE customers SET name = $1, updated_at = NOW() WHERE id = $2', [cleanName, existing.id]);
        existing.name = cleanName;
      }
      return {
        ...existing,
        points_balance: Number(existing.points_balance || 0),
        total_spent_usd: Number(existing.total_spent_usd || 0),
        total_orders: Number(existing.total_orders || 0),
        tags: typeof existing.tags === 'string' ? JSON.parse(existing.tags) : (existing.tags || []),
        notes: existing.notes || '',
      };
    }

    // 2. Create new Customer Profile under canonical phone number
    const newId = `cust-${canonicalPhone.replace(/[^\d]/g, '')}`;
    const vipCode = `VIP-${randomUUID().slice(0, 6).toUpperCase()}`;

    const insertRes = await pool.query(
      `INSERT INTO customers (id, phone_number, name, email, vip_code, points_balance, total_spent_usd, total_orders, last_order_at, tags, notes)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 0, NOW(), '["New Guest"]'::jsonb, '')
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING *`,
      [newId, canonicalPhone, cleanName, data.email || null, vipCode]
    );

    const newCust = insertRes.rows[0];
    return {
      ...newCust,
      points_balance: 0,
      total_spent_usd: 0,
      total_orders: 0,
      tags: ['New Guest'],
      notes: '',
    };
  } catch (e: any) {
    console.error('resolveOrUpsertCustomer error:', e);
    return null;
  }
}

/**
 * Fetch all Customer Profiles for Admin CRM Portal
 */
export async function getAllCustomersCRM(params?: {
  search?: string;
  tag?: string;
  minSpent?: number;
}) {
  if (!pool) return { success: false, customers: [], stats: { total: 0, vips: 0, totalRevenue: 0 } };

  try {
    let queryStr = 'SELECT * FROM customers WHERE 1=1';
    const queryParams: any[] = [];
    let pIdx = 1;

    if (params?.search && params.search.trim()) {
      queryStr += ` AND (name ILIKE $${pIdx} OR phone_number ILIKE $${pIdx} OR vip_code ILIKE $${pIdx})`;
      queryParams.push(`%${params.search.trim()}%`);
      pIdx++;
    }

    if (params?.tag && params.tag !== 'all') {
      queryStr += ` AND tags @> $${pIdx}::jsonb`;
      queryParams.push(JSON.stringify([params.tag]));
      pIdx++;
    }

    if (params?.minSpent && params.minSpent > 0) {
      queryStr += ` AND total_spent_usd >= $${pIdx}`;
      queryParams.push(params.minSpent);
      pIdx++;
    }

    queryStr += ' ORDER BY total_spent_usd DESC, updated_at DESC LIMIT 300';

    const res = await pool.query(queryStr, queryParams);

    const customers: CustomerProfile[] = res.rows.map((row: any) => ({
      ...row,
      points_balance: Number(row.points_balance || 0),
      total_spent_usd: Number(row.total_spent_usd || 0),
      total_orders: Number(row.total_orders || 0),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
      notes: row.notes || '',
    }));

    // Calculate CRM Aggregate Stats
    const totalCount = customers.length;
    const vipsCount = customers.filter(c => c.total_spent_usd >= 100 || c.tags.includes('VIP')).length;
    const totalRev = customers.reduce((sum, c) => sum + c.total_spent_usd, 0);

    return {
      success: true,
      customers,
      stats: {
        total: totalCount,
        vips: vipsCount,
        totalRevenue: totalRev,
      },
    };
  } catch (e: any) {
    console.error('getAllCustomersCRM error:', e);
    return { success: false, customers: [], stats: { total: 0, vips: 0, totalRevenue: 0 }, error: e.message };
  }
}

/**
 * Fetch 360° Customer Profile Details including Item Purchase History Breakdown
 */
export async function getCustomer360CRM(customerId: string) {
  if (!pool || !customerId) return { success: false, error: 'Customer ID required' };

  try {
    const custRes = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (custRes.rows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }

    const customer: CustomerProfile = {
      ...custRes.rows[0],
      points_balance: Number(custRes.rows[0].points_balance || 0),
      total_spent_usd: Number(custRes.rows[0].total_spent_usd || 0),
      total_orders: Number(custRes.rows[0].total_orders || 0),
      tags: typeof custRes.rows[0].tags === 'string' ? JSON.parse(custRes.rows[0].tags) : (custRes.rows[0].tags || []),
      notes: custRes.rows[0].notes || '',
    };

    const phoneVariations = getPhoneLookupVariations(customer.phone_number);

    // Item Purchase History Breakdown across all phone variations
    const itemHistoryRes = await pool.query(
      `SELECT item_name, SUM(quantity)::int as total_qty, SUM(unit_price_usd * quantity)::numeric(10,2) as total_spent
       FROM order_items
       WHERE customer_id = $1 OR customer_phone = ANY($2::text[]) OR loyalty_phone = ANY($2::text[])
       GROUP BY item_name
       ORDER BY total_qty DESC
       LIMIT 30`,
      [customerId, phoneVariations]
    );

    // Recent Sessions across all phone variations
    const sessionsRes = await pool.query(
      `SELECT * FROM table_sessions
       WHERE customer_id = $1 OR customer_phone = ANY($2::text[])
       ORDER BY created_at DESC
       LIMIT 30`,
      [customerId, phoneVariations]
    );

    return {
      success: true,
      customer,
      itemHistory: itemHistoryRes.rows,
      recentSessions: sessionsRes.rows,
    };
  } catch (e: any) {
    console.error('getCustomer360CRM error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Update Customer Notes & Tags from Admin CRM
 */
export async function updateCustomerNotesAndTags(customerId: string, notes: string, tags: string[]) {
  if (!pool || !customerId) return { success: false, error: 'DB connection error' };

  try {
    await pool.query(
      `UPDATE customers
       SET notes = $1, tags = $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [notes || '', JSON.stringify(tags || []), customerId]
    );

    revalidatePath('/admin');
    revalidatePath('/pos');
    return { success: true };
  } catch (e: any) {
    console.error('updateCustomerNotesAndTags error:', e);
    return { success: false, error: e.message };
  }
}
