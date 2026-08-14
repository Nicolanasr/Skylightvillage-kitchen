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
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        available BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT REFERENCES menu_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price_usd NUMERIC(10,2) NOT NULL,
        price_camping_usd NUMERIC(10,2),
        station TEXT NOT NULL,
        available BOOLEAN DEFAULT true,
        image_url TEXT,
        is_staff_only BOOLEAN DEFAULT false,
        sort_order INT DEFAULT 0,
        is_bestseller BOOLEAN DEFAULT false,
        modifier_groups JSONB DEFAULT '[]'::jsonb
      );

      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        table_number INT UNIQUE NOT NULL,
        qr_code_token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'available'
      );

      CREATE TABLE IF NOT EXISTS table_sessions (
        id TEXT PRIMARY KEY,
        primary_table_id TEXT REFERENCES tables(id),
        merged_table_ids JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        order_type TEXT DEFAULT 'dine_in',
        customer_name TEXT,
        customer_phone TEXT
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
        table_number INT,
        menu_item_id TEXT REFERENCES menu_items(id),
        item_name TEXT NOT NULL,
        unit_price_usd NUMERIC(10,2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        selected_modifiers JSONB DEFAULT '[]'::jsonb,
        special_notes TEXT,
        status TEXT DEFAULT 'pending',
        is_paid BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        order_type TEXT DEFAULT 'dine_in',
        customer_name TEXT,
        customer_phone TEXT,
        guest_name TEXT,
        preparing_at TIMESTAMPTZ,
        ready_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        loyalty_phone TEXT
      );

      CREATE TABLE IF NOT EXISTS service_calls (
        id TEXT PRIMARY KEY,
        table_number INT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        details TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS discounts (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        value NUMERIC(10,2) NOT NULL,
        amount_usd NUMERIC(10,2) NOT NULL,
        reason TEXT,
        applied_by_staff TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
        amount_usd NUMERIC(10,2) NOT NULL,
        amount_lbp NUMERIC(15,2) NOT NULL,
        exchange_rate NUMERIC(10,2) NOT NULL,
        method TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        receipt_number TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS staff_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin_code TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        staff_name TEXT,
        staff_role TEXT,
        action_type TEXT,
        table_number INT,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customer_loyalty (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE,
        vip_code TEXT UNIQUE,
        customer_name TEXT DEFAULT 'Valued Guest',
        points_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_spent_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_visits INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loyalty_reward_tiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        points_required INT NOT NULL,
        reward_type TEXT NOT NULL CHECK (reward_type IN ('free_item', 'discount_usd')),
        discount_value NUMERIC(10,2) DEFAULT 0,
        menu_item_id TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loyalty_claim_tokens (
        token TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        points_value NUMERIC(10,2) NOT NULL,
        claimed BOOLEAN DEFAULT false,
        claimed_by_phone TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
      );

      CREATE TABLE IF NOT EXISTS loyalty_audit_logs (
        id TEXT PRIMARY KEY,
        customer_phone TEXT,
        action_type TEXT NOT NULL,
        points_amount NUMERIC(10,2) NOT NULL,
        session_id TEXT,
        reward_name TEXT,
        logged_by TEXT DEFAULT 'System',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_item_status_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_item_id TEXT REFERENCES order_items(id) ON DELETE CASCADE,
        session_id TEXT REFERENCES table_sessions(id) ON DELETE SET NULL,
        table_number INT,
        item_name TEXT,
        station VARCHAR(30),
        from_status VARCHAR(20),
        to_status VARCHAR(20),
        duration_seconds INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS raw_ingredients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        unit TEXT NOT NULL CHECK (unit IN ('kg', 'g', 'pcs', 'liter', 'ml', 'pack')),
        current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0,
        cost_per_unit_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS menu_item_recipes (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        quantity_required NUMERIC(12,3) NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_receiving (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        quantity_added NUMERIC(12,3) NOT NULL DEFAULT 0,
        unit_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
        supplier_name TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_waste (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        quantity_wasted NUMERIC(12,3) NOT NULL DEFAULT 0,
        total_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
        reason TEXT DEFAULT '',
        logged_by TEXT DEFAULT 'Staff',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_audits (
        id TEXT PRIMARY KEY,
        ingredient_id TEXT NOT NULL,
        expected_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        actual_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        variance NUMERIC(12,3) NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_deductions (
        id TEXT PRIMARY KEY,
        order_reference TEXT DEFAULT '',
        dish_name TEXT DEFAULT '',
        ingredient_id TEXT NOT NULL,
        ingredient_name TEXT DEFAULT '',
        quantity_deducted NUMERIC(12,3) NOT NULL DEFAULT 0,
        unit TEXT DEFAULT '',
        remaining_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

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

// In-Memory Database Cache Store Layer
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
      this.syncFromDatabase();
    }
  }

  async syncFromDatabase() {
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
      console.warn('Database Live Sync Fallback to Memory Store:', e);
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
