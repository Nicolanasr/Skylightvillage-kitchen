'use server';

import { pool } from '@/lib/db';
import { StationType, MenuCategory, MenuItem, StaffMember, Table, ModifierGroup } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function createCategory(name: string) {
  if (!name || name.trim() === '' || !pool) return { success: false, error: 'Category name required' };

  const id = `cat-${randomUUID().slice(0, 8)}`;
  try {
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM menu_categories');
    const sortOrder = (countRes.rows[0]?.count || 0) + 1;
    const newCat: MenuCategory = { id, name, sort_order: sortOrder };

    await pool.query('INSERT INTO menu_categories (id, name, sort_order) VALUES ($1, $2, $3)', [
      id,
      name,
      sortOrder,
    ]);

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/admin');
    return { success: true, category: newCat };
  } catch (e: any) {
    console.error('Neon createCategory error:', e);
    return { success: false, error: e.message };
  }
}

export async function deleteCategory(categoryId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('DELETE FROM menu_categories WHERE id = $1', [categoryId]);
  } catch (e: any) {
    console.error('Neon deleteCategory error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/admin');
  return { success: true };
}

export async function createMenuItem(data: {
  categoryId: string;
  name: string;
  description?: string;
  priceUsd: number;
  station: StationType;
  imageUrl?: string;
  isStaffOnly?: boolean;
  modifierGroups?: ModifierGroup[];
}) {
  if (!data.name || data.priceUsd < 0 || !pool) return { success: false, error: 'Invalid name or price' };

  const newItem: MenuItem = {
    id: `m-${randomUUID().slice(0, 8)}`,
    category_id: data.categoryId,
    name: data.name,
    description: data.description || '',
    price_usd: Number(data.priceUsd),
    image_url: data.imageUrl || '',
    station: data.station,
    available: true,
    is_staff_only: !!data.isStaffOnly,
    modifier_groups: data.modifierGroups || [],
  };

  try {
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_staff_only BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS modifier_groups JSONB DEFAULT \'[]\'::jsonb');

    await pool.query(
      `INSERT INTO menu_items (id, category_id, name, description, price_usd, station, available, image_url, is_staff_only, modifier_groups)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newItem.id,
        newItem.category_id,
        newItem.name,
        newItem.description,
        newItem.price_usd,
        newItem.station,
        newItem.available,
        newItem.image_url,
        newItem.is_staff_only,
        JSON.stringify(newItem.modifier_groups),
      ]
    );
  } catch (e: any) {
    console.error('Neon createMenuItem error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true, item: newItem };
}

export async function updateMenuItem(
  menuItemId: string,
  data: {
    name?: string;
    description?: string;
    priceUsd?: number;
    station?: StationType;
    imageUrl?: string;
    available?: boolean;
    isStaffOnly?: boolean;
    modifierGroups?: ModifierGroup[];
  }
) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_staff_only BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS modifier_groups JSONB DEFAULT \'[]\'::jsonb');

    const itemRes = await pool.query('SELECT * FROM menu_items WHERE id = $1', [menuItemId]);
    if (itemRes.rows.length === 0) return { success: false, error: 'Item not found' };

    const item = itemRes.rows[0];
    const name = data.name !== undefined ? data.name : item.name;
    const description = data.description !== undefined ? data.description : item.description;
    const price_usd = data.priceUsd !== undefined ? Number(data.priceUsd) : Number(item.price_usd);
    const station = data.station !== undefined ? data.station : item.station;
    const image_url = data.imageUrl !== undefined ? data.imageUrl : item.image_url;
    const available = data.available !== undefined ? data.available : item.available;
    const is_staff_only = data.isStaffOnly !== undefined ? !!data.isStaffOnly : !!item.is_staff_only;
    const modifier_groups = data.modifierGroups !== undefined ? data.modifierGroups : (item.modifier_groups || []);

    await pool.query(
      `UPDATE menu_items SET name = $1, description = $2, price_usd = $3, station = $4, image_url = $5, available = $6, is_staff_only = $7, modifier_groups = $8 WHERE id = $9`,
      [name, description, price_usd, station, image_url, available, is_staff_only, JSON.stringify(modifier_groups), menuItemId]
    );
  } catch (e: any) {
    console.error('Neon updateMenuItem error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteMenuItem(menuItemId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
  } catch (e: any) {
    console.error('Neon deleteMenuItem error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function addStaffMember(name: string, pin: string, role: string) {
  if (!name || !pin || !pool) return { success: false, error: 'Name and PIN required' };

  const newStaff: StaffMember = {
    id: `stf-${randomUUID().slice(0, 6)}`,
    name,
    pin,
    role: role as any,
  };

  try {
    await pool.query('CREATE TABLE IF NOT EXISTS staff_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL UNIQUE, role TEXT NOT NULL)');
    await pool.query('INSERT INTO staff_members (id, name, pin, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, pin = EXCLUDED.pin, role = EXCLUDED.role', [
      newStaff.id,
      newStaff.name,
      newStaff.pin,
      newStaff.role,
    ]);
  } catch (e: any) {
    console.error('Neon addStaffMember error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  return { success: true, staff: newStaff };
}

export async function deleteStaffMember(staffId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('DELETE FROM staff_members WHERE id = $1', [staffId]);
  } catch (e: any) {
    console.error('Neon deleteStaffMember error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  return { success: true };
}

export async function seedDatabaseMenu() {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
        station TEXT NOT NULL DEFAULT 'mezza',
        available BOOLEAN DEFAULT true,
        image_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/kds');
    revalidatePath('/admin');
    return { success: true, message: 'Database menu schema verified on Neon DB!' };
  } catch (e: any) {
    console.error('Seed Database error:', e);
    return { success: false, error: e.message };
  }
}

export async function wipeAllDatabaseTestDataAction() {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query(`
      TRUNCATE TABLE order_items CASCADE;
      TRUNCATE TABLE table_sessions CASCADE;
      TRUNCATE TABLE service_calls CASCADE;
      TRUNCATE TABLE payments CASCADE;
      TRUNCATE TABLE discounts CASCADE;
      TRUNCATE TABLE activity_logs CASCADE;
      UPDATE tables SET status = 'available';
    `);
  } catch (e: any) {
    console.error('Neon wipe error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true, message: 'All test orders, active sessions & history wiped clean!' };
}

export async function addTableAction(tableNumber: number) {
  if (!tableNumber || tableNumber <= 0 || !pool) return { success: false, error: 'Invalid table number' };

  const qrToken = `token-table-${tableNumber}`;

  try {
    const checkRes = await pool.query('SELECT * FROM tables WHERE table_number = $1', [tableNumber]);
    if (checkRes.rows.length > 0) return { success: false, error: `Table #${tableNumber} already exists!` };

    const tblId = randomUUID();
    const insertRes = await pool.query(
      `INSERT INTO tables (id, table_number, qr_code_token, status)
       VALUES ($1, $2, $3, 'available')
       ON CONFLICT (table_number) DO NOTHING RETURNING *`,
      [tblId, tableNumber, qrToken]
    );

    revalidatePath('/pos');
    revalidatePath('/admin');
    revalidatePath('/qr');
    revalidatePath('/order');

    return { success: true, table: insertRes.rows[0] || { id: tblId, table_number: tableNumber, qr_code_token: qrToken, status: 'available' } };
  } catch (e: any) {
    console.error('Neon addTable error:', e);
    return { success: false, error: e.message };
  }
}

export async function deleteTableAction(tableId: string) {
  if (!pool) return { success: false, error: 'DB connection error' };

  try {
    await pool.query('DELETE FROM tables WHERE id = $1', [tableId]);
  } catch (e: any) {
    console.error('Neon deleteTable error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');
  return { success: true };
}

export async function updateTableAction(tableId: string, newTableNumber: number) {
  if (!newTableNumber || newTableNumber <= 0 || !pool) return { success: false, error: 'Invalid table number' };

  try {
    const checkRes = await pool.query('SELECT * FROM tables WHERE table_number = $1 AND id != $2', [newTableNumber, tableId]);
    if (checkRes.rows.length > 0) return { success: false, error: `Table #${newTableNumber} already exists!` };

    await pool.query('UPDATE tables SET table_number = $1 WHERE id = $2', [newTableNumber, tableId]);
  } catch (e: any) {
    console.error('Neon updateTable error:', e);
    return { success: false, error: e.message };
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');

  return { success: true };
}

export async function setTotalTablesCountAction(targetCount: number) {
  if (targetCount < 1 || targetCount > 100 || !pool) {
    return { success: false, error: 'Please enter a table count between 1 and 100.' };
  }

  try {
    const existingRes = await pool.query('SELECT table_number FROM tables');
    const existingNums = new Set(existingRes.rows.map((r) => Number(r.table_number)));

    for (let i = 1; i <= targetCount; i++) {
      if (!existingNums.has(i)) {
        const tblId = randomUUID();
        await pool.query(
          `INSERT INTO tables (id, table_number, qr_code_token, status)
           VALUES ($1, $2, $3, 'available')
           ON CONFLICT (table_number) DO NOTHING`,
          [tblId, i, `token-table-${i}`]
        );
      }
    }

    const allRes = await pool.query('SELECT * FROM tables ORDER BY table_number ASC');

    revalidatePath('/pos');
    revalidatePath('/admin');
    revalidatePath('/qr');
    revalidatePath('/order');

    return { success: true, message: `Successfully configured floor plan with ${targetCount} tables!`, tables: allRes.rows };
  } catch (e: any) {
    console.error('Neon setTotalTablesCountAction error:', e);
    return { success: false, error: e.message };
  }
}

export async function testDatabaseConnectionAction() {
  if (!process.env.DATABASE_URL) {
    return {
      connected: false,
      databaseUrlConfigured: false,
      reason: 'DATABASE_URL environment variable is missing in Vercel settings.',
    };
  }

  if (!pool) {
    return {
      connected: false,
      databaseUrlConfigured: true,
      reason: 'Neon Pool failed to initialize.',
    };
  }

  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db_name');
    const tablesRes = await pool.query('SELECT COUNT(*)::int as count FROM tables');
    const itemsRes = await pool.query('SELECT COUNT(*)::int as count FROM menu_items');
    const ordersRes = await pool.query('SELECT COUNT(*)::int as count FROM order_items');

    return {
      connected: true,
      databaseUrlConfigured: true,
      timestamp: String(res.rows[0]?.now),
      databaseName: String(res.rows[0]?.db_name),
      tablesCount: Number(tablesRes.rows[0]?.count || 0),
      menuItemsCount: Number(itemsRes.rows[0]?.count || 0),
      orderItemsCount: Number(ordersRes.rows[0]?.count || 0),
    };
  } catch (e: any) {
    return {
      connected: false,
      databaseUrlConfigured: true,
      reason: e.message,
    };
  }
}
