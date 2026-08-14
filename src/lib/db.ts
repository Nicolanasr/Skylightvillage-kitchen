import { Pool } from 'pg';
import { Table, TableSession, MenuItem, MenuCategory, OrderItem, ServiceCall, Payment, Discount, StaffMember, ActivityLog } from './types';

const connectionString = process.env.DATABASE_URL;
export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let isSchemaEnsured = false;

export async function ensureDatabaseSchemaAndIndexes() {
  if (!pool || isSchemaEnsured) return;
  isSchemaEnsured = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        staff_name TEXT,
        staff_role TEXT,
        action_type TEXT,
        table_number INT,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_staff_only BOOLEAN DEFAULT false;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS modifier_groups JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS price_camping_usd NUMERIC(10,2);

      ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in';
      ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE table_sessions ALTER COLUMN primary_table_id DROP NOT NULL;

      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in';
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS loyalty_phone TEXT;

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE service_calls ADD COLUMN IF NOT EXISTS details TEXT DEFAULT '';
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS idx_tables_number ON tables(table_number);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_primary ON table_sessions(primary_table_id);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_order_type ON table_sessions(order_type);
      CREATE INDEX IF NOT EXISTS idx_order_items_session ON order_items(session_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at);
      CREATE INDEX IF NOT EXISTS idx_discounts_session ON discounts(session_id);
      CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_staff ON menu_items(is_staff_only);
      CREATE INDEX IF NOT EXISTS idx_menu_categories_available ON menu_categories(available);
    `);
  } catch (e) {
    console.warn('Schema Indexing Init Warning:', e);
  }
}

// In-Memory Database Store & Neon Live Sync Connection Layer
class SkylightStore {
  tables: Table[] = [];
  tableSessions: TableSession[] = [];
  categories: MenuCategory[] = [];
  menuItems: MenuItem[] = [];
  orderItems: OrderItem[] = [];
  serviceCalls: ServiceCall[] = [];
  payments: Payment[] = [];
  discounts: Discount[] = [];
  staffMembers: StaffMember[] = [];
  activityLogs: ActivityLog[] = [];
  exchangeRate = 89500;

  constructor() {
    this.seedLocal();
    if (pool) {
      ensureDatabaseSchemaAndIndexes();
      this.syncFromNeon();
    }
  }

  async syncFromNeon() {
    if (!pool) return;
    try {
      const [
        tablesRes,
        sessionsRes,
        categoriesRes,
        itemsRes,
        orderItemsRes,
        callsRes,
        logsRes
      ] = await Promise.all([
        pool.query('SELECT * FROM tables ORDER BY table_number ASC'),
        pool.query("SELECT * FROM table_sessions WHERE status = 'active'"),
        pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC'),
        pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC'),
        pool.query('SELECT * FROM order_items ORDER BY created_at ASC'),
        pool.query("SELECT * FROM service_calls WHERE status = 'pending'"),
        pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100')
      ]);

      if (tablesRes.rows.length > 0) this.tables = tablesRes.rows;
      if (sessionsRes.rows.length > 0) this.tableSessions = sessionsRes.rows;
      if (categoriesRes.rows.length > 0) this.categories = categoriesRes.rows;
      if (itemsRes.rows.length > 0) this.menuItems = itemsRes.rows;
      if (orderItemsRes.rows.length > 0) this.orderItems = orderItemsRes.rows;
      if (callsRes.rows.length > 0) this.serviceCalls = callsRes.rows;
      if (logsRes.rows.length > 0) this.activityLogs = logsRes.rows;
    } catch (e) {
      console.warn('Neon Live Sync Fallback to Memory Store:', e);
    }
  }

  seedLocal() {
    this.staffMembers = [];
    this.tables = [];
    this.categories = [];
    this.menuItems = [];
  }
}

export const dbStore = new SkylightStore();
