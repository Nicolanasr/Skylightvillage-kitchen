'use server';

import { dbStore, pool } from '@/lib/db';
import { StationType, MenuCategory, MenuItem, StaffMember, Table, TableStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function createCategory(name: string) {
  if (!name || name.trim() === '') return { success: false, error: 'Category name required' };

  const id = `cat-${randomUUID().slice(0, 8)}`;
  const sortOrder = dbStore.categories.length + 1;
  const newCat: MenuCategory = { id, name, sort_order: sortOrder };

  dbStore.categories.push(newCat);

  if (pool) {
    try {
      await pool.query('INSERT INTO menu_categories (id, name, sort_order) VALUES ($1, $2, $3)', [
        id,
        name,
        sortOrder,
      ]);
    } catch (e) {
      console.error('Neon createCategory error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/admin');
  return { success: true, category: newCat };
}

export async function deleteCategory(categoryId: string) {
  const idx = dbStore.categories.findIndex((c) => c.id === categoryId);
  if (idx !== -1) dbStore.categories.splice(idx, 1);

  if (pool) {
    try {
      await pool.query('DELETE FROM menu_categories WHERE id = $1', [categoryId]);
    } catch (e) {
      console.error('Neon deleteCategory error:', e);
    }
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
}) {
  if (!data.name || data.priceUsd < 0) return { success: false, error: 'Invalid name or price' };

  const newItem: MenuItem = {
    id: `m-${randomUUID().slice(0, 8)}`,
    category_id: data.categoryId,
    name: data.name,
    description: data.description || '',
    price_usd: Number(data.priceUsd),
    image_url: data.imageUrl || '',
    station: data.station,
    available: true,
    modifier_groups: [],
  };

  dbStore.menuItems.push(newItem);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO menu_items (id, category_id, name, description, price_usd, station, available, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newItem.id,
          newItem.category_id,
          newItem.name,
          newItem.description,
          newItem.price_usd,
          newItem.station,
          newItem.available,
          newItem.image_url,
        ]
      );
    } catch (e) {
      console.error('Neon createMenuItem error:', e);
    }
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
  }
) {
  const item = dbStore.menuItems.find((m) => m.id === menuItemId);
  if (!item) return { success: false, error: 'Item not found' };

  if (data.name !== undefined) item.name = data.name;
  if (data.description !== undefined) item.description = data.description;
  if (data.priceUsd !== undefined) item.price_usd = Number(data.priceUsd);
  if (data.station !== undefined) item.station = data.station;
  if (data.imageUrl !== undefined) item.image_url = data.imageUrl;
  if (data.available !== undefined) item.available = data.available;

  if (pool) {
    try {
      await pool.query(
        `UPDATE menu_items SET name = $1, description = $2, price_usd = $3, station = $4, image_url = $5, available = $6 WHERE id = $7`,
        [item.name, item.description, item.price_usd, item.station, item.image_url, item.available, menuItemId]
      );
    } catch (e) {
      console.error('Neon updateMenuItem error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true, item };
}

export async function deleteMenuItem(menuItemId: string) {
  const idx = dbStore.menuItems.findIndex((m) => m.id === menuItemId);
  if (idx !== -1) dbStore.menuItems.splice(idx, 1);

  if (pool) {
    try {
      await pool.query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
    } catch (e) {
      console.error('Neon deleteMenuItem error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true };
}

export async function addStaffMember(name: string, pin: string, role: string) {
  if (!name || !pin) return { success: false, error: 'Name and PIN required' };

  const newStaff: StaffMember = {
    id: `stf-${randomUUID().slice(0, 6)}`,
    name,
    pin,
    role: role as any,
  };

  dbStore.staffMembers.push(newStaff);

  if (pool) {
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS staff_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL UNIQUE, role TEXT NOT NULL)');
      await pool.query('INSERT INTO staff_members (id, name, pin, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, pin = EXCLUDED.pin, role = EXCLUDED.role', [
        newStaff.id,
        newStaff.name,
        newStaff.pin,
        newStaff.role,
      ]);
    } catch (e) {
      console.error('Neon addStaffMember error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  return { success: true, staff: newStaff };
}

export async function deleteStaffMember(staffId: string) {
  const idx = dbStore.staffMembers.findIndex((s) => s.id === staffId);
  if (idx !== -1) dbStore.staffMembers.splice(idx, 1);

  if (pool) {
    try {
      await pool.query('DELETE FROM staff_members WHERE id = $1', [staffId]);
    } catch (e) {
      console.error('Neon deleteStaffMember error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  return { success: true };
}

export async function seedDatabaseMenu() {
  if (!pool) return { success: true, message: 'Seeded in-memory database store' };

  try {
    await pool.query(`
      DROP TABLE IF EXISTS menu_items CASCADE;
      DROP TABLE IF EXISTS menu_categories CASCADE;

      CREATE TABLE menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0
      );

      CREATE TABLE menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
        station TEXT NOT NULL DEFAULT 'cold_mezza',
        available BOOLEAN DEFAULT true,
        image_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT false;
    `);

    for (const cat of dbStore.categories) {
      await pool.query(
        `INSERT INTO menu_categories (id, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [cat.id, cat.name, cat.sort_order]
      );
    }

    for (const item of dbStore.menuItems) {
      await pool.query(
        `INSERT INTO menu_items (id, category_id, name, description, price_usd, station, available, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_usd = EXCLUDED.price_usd,
           station = EXCLUDED.station,
           available = EXCLUDED.available,
           image_url = EXCLUDED.image_url`,
        [
          item.id,
          item.category_id,
          item.name,
          item.description || '',
          item.price_usd,
          item.station,
          item.available,
          item.image_url || '',
        ]
      );
    }

    revalidatePath('/pos');
    revalidatePath('/order');
    revalidatePath('/kds');
    revalidatePath('/admin');
    return { success: true, message: 'All Skylight Village categories & menu items successfully synced to Neon DB!' };
  } catch (e: any) {
    console.error('Seed Neon Database error:', e);
    return { success: false, error: e.message };
  }
}

export async function wipeAllDatabaseTestDataAction() {
  dbStore.orderItems = [];
  dbStore.tableSessions = [];
  dbStore.serviceCalls = [];
  dbStore.payments = [];
  dbStore.discounts = [];
  dbStore.activityLogs = [];
  dbStore.tables.forEach((t) => (t.status = 'available'));

  if (pool) {
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
    } catch (e) {
      console.error('Neon wipe error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/order');
  revalidatePath('/kds');
  revalidatePath('/admin');
  return { success: true, message: 'All test orders, active sessions & history wiped clean!' };
}

export async function addTableAction(tableNumber: number) {
  if (!tableNumber || tableNumber <= 0) return { success: false, error: 'Invalid table number' };

  const qrToken = `token-table-${tableNumber}`;

  if (pool) {
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

      const existingInStore = dbStore.tables.find((t) => t.table_number === tableNumber);
      if (!existingInStore) {
        dbStore.tables.push({
          id: tblId,
          table_number: tableNumber,
          qr_code_token: qrToken,
          status: 'available',
          created_at: new Date().toISOString(),
        });
      }

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

  const existing = dbStore.tables.find((t) => t.table_number === tableNumber);
  if (existing) return { success: false, error: `Table #${tableNumber} already exists!` };

  const newTable: Table = {
    id: randomUUID(),
    table_number: tableNumber,
    qr_code_token: qrToken,
    status: 'available',
    created_at: new Date().toISOString(),
  };

  dbStore.tables.push(newTable);

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');

  return { success: true, table: newTable };
}

export async function deleteTableAction(tableId: string) {
  const idx = dbStore.tables.findIndex((t) => t.id === tableId);
  if (idx !== -1) dbStore.tables.splice(idx, 1);

  if (pool) {
    try {
      await pool.query('DELETE FROM tables WHERE id = $1', [tableId]);
    } catch (e) {
      console.error('Neon deleteTable error:', e);
    }
  }

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');
  return { success: true };
}

export async function updateTableAction(tableId: string, newTableNumber: number) {
  if (!newTableNumber || newTableNumber <= 0) return { success: false, error: 'Invalid table number' };

  if (pool) {
    try {
      const checkRes = await pool.query('SELECT * FROM tables WHERE table_number = $1 AND id != $2', [newTableNumber, tableId]);
      if (checkRes.rows.length > 0) return { success: false, error: `Table #${newTableNumber} already exists!` };

      await pool.query('UPDATE tables SET table_number = $1 WHERE id = $2', [newTableNumber, tableId]);
    } catch (e: any) {
      console.error('Neon updateTable error:', e);
      return { success: false, error: e.message };
    }
  }

  const tbl = dbStore.tables.find((t) => t.id === tableId);
  if (tbl) tbl.table_number = newTableNumber;

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');

  return { success: true };
}

export async function setTotalTablesCountAction(targetCount: number) {
  if (targetCount < 1 || targetCount > 100) {
    return { success: false, error: 'Please enter a table count between 1 and 100.' };
  }

  if (pool) {
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
      dbStore.tables = allRes.rows;

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

  for (let i = 1; i <= targetCount; i++) {
    const existing = dbStore.tables.find((t) => t.table_number === i);
    if (!existing) {
      const tbl: Table = {
        id: randomUUID(),
        table_number: i,
        qr_code_token: `token-table-${i}`,
        status: 'available',
        created_at: new Date().toISOString(),
      };
      dbStore.tables.push(tbl);
    }
  }

  dbStore.tables.sort((a, b) => a.table_number - b.table_number);

  revalidatePath('/pos');
  revalidatePath('/admin');
  revalidatePath('/qr');
  revalidatePath('/order');

  return { success: true, message: `Successfully configured floor plan with ${targetCount} tables!`, tables: dbStore.tables };
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
