import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { Table, TableSession, MenuItem, MenuCategory, OrderItem, ServiceCall, Payment, Discount, StaffMember, ActivityLog } from './types';

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;
export const pool = connectionString ? new Pool({ connectionString }) : null;

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
      this.syncFromNeon();
    }
  }

  async syncFromNeon() {
    if (!pool) return;
    try {
      try {
        await pool.query('CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, staff_name TEXT, staff_role TEXT, action_type TEXT, table_number INT, details TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
        await pool.query('ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');
      } catch (e) {}

      const tablesRes = await pool.query('SELECT * FROM tables ORDER BY table_number ASC');
      if (tablesRes.rows.length > 0) this.tables = tablesRes.rows;

      const sessionsRes = await pool.query("SELECT * FROM table_sessions WHERE status = 'active'");
      if (sessionsRes.rows.length > 0) this.tableSessions = sessionsRes.rows;

      const categoriesRes = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
      if (categoriesRes.rows.length > 0) this.categories = categoriesRes.rows;

      const itemsRes = await pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC');
      if (itemsRes.rows.length > 0) this.menuItems = itemsRes.rows;

      const orderItemsRes = await pool.query('SELECT * FROM order_items ORDER BY created_at ASC');
      if (orderItemsRes.rows.length > 0) this.orderItems = orderItemsRes.rows;

      const callsRes = await pool.query("SELECT * FROM service_calls WHERE status = 'pending'");
      if (callsRes.rows.length > 0) this.serviceCalls = callsRes.rows;

      const logsRes = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
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
