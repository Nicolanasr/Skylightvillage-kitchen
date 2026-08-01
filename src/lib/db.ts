import { Pool } from '@neondatabase/serverless';
import { Table, TableSession, MenuItem, MenuCategory, OrderItem, ServiceCall, Payment, Discount } from './types';

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
      const tablesRes = await pool.query('SELECT * FROM tables ORDER BY table_number ASC');
      if (tablesRes.rows.length > 0) this.tables = tablesRes.rows;

      const sessionsRes = await pool.query("SELECT * FROM table_sessions WHERE status = 'active'");
      if (sessionsRes.rows.length > 0) this.tableSessions = sessionsRes.rows;

      const categoriesRes = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
      if (categoriesRes.rows.length > 0) this.categories = categoriesRes.rows;

      const itemsRes = await pool.query('SELECT * FROM menu_items ORDER BY created_at ASC');
      if (itemsRes.rows.length > 0) this.menuItems = itemsRes.rows;

      const orderItemsRes = await pool.query('SELECT * FROM order_items ORDER BY created_at ASC');
      if (orderItemsRes.rows.length > 0) this.orderItems = orderItemsRes.rows;

      const callsRes = await pool.query("SELECT * FROM service_calls WHERE status = 'pending'");
      if (callsRes.rows.length > 0) this.serviceCalls = callsRes.rows;
    } catch (e) {
      console.warn('Neon Live Sync Fallback to Memory Store:', e);
    }
  }

  seedLocal() {
    for (let i = 1; i <= 12; i++) {
      this.tables.push({
        id: `tbl-${i}`,
        table_number: i,
        qr_code_token: `token-table-${i}`,
        status: i === 1 ? 'occupied' : i === 2 ? 'bill_requested' : 'available',
        created_at: new Date().toISOString(),
      });
    }

    const session1Id = 'sess-tbl-1';
    this.tableSessions.push({
      id: session1Id,
      primary_table_id: 'tbl-1',
      merged_table_ids: [],
      status: 'active',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    });

    const catCold = 'cat-cold';
    const catHot = 'cat-hot';
    const catGrill = 'cat-grill';
    const catBar = 'cat-bar';
    const catShisha = 'cat-shisha';

    this.categories = [
      { id: catCold, name: 'Cold Mezza', sort_order: 1 },
      { id: catHot, name: 'Hot Mezza', sort_order: 2 },
      { id: catGrill, name: 'Grill & Mains', sort_order: 3 },
      { id: catBar, name: 'Bar & Refreshments', sort_order: 4 },
      { id: catShisha, name: 'Shisha Lounge', sort_order: 5 },
    ];

    this.menuItems = [
      {
        id: 'item-hummus',
        category_id: catCold,
        name: 'Hummus Beiruti',
        description: 'Smooth chickpea puree with tahini, lemon juice, parsley, and olive oil drizzle',
        price_usd: 5.50,
        station: 'cold_mezza',
        available: true,
        modifier_groups: [
          {
            group_name: 'Garlic & Lemon Level',
            required: false,
            options: [
              { name: 'Standard Garlic', price_extra_usd: 0 },
              { name: 'Extra Garlic & Lemon', price_extra_usd: 0.50 },
            ],
          },
        ],
      },
      {
        id: 'item-fattoush',
        category_id: catCold,
        name: 'Authentic Fattoush Salad',
        description: 'Crisp garden greens, radish, pomegranate seeds, sumac dressing & toasted pita chips',
        price_usd: 6.50,
        station: 'cold_mezza',
        available: true,
        modifier_groups: [],
      },
      {
        id: 'item-batata-harra',
        category_id: catHot,
        name: 'Spicy Batata Harra',
        description: 'Golden fried potato cubes tossed with garlic, coriander, chili flakes & lemon juice',
        price_usd: 6.00,
        station: 'hot_mezza',
        available: true,
        modifier_groups: [
          {
            group_name: 'Spice Level',
            required: false,
            options: [
              { name: 'Medium Spice', price_extra_usd: 0 },
              { name: 'Extra Spicy Fire', price_extra_usd: 0 },
            ],
          },
        ],
      },
      {
        id: 'item-mixed-grill',
        category_id: catGrill,
        name: 'Skylight Mixed Grill Platter',
        description: 'Skewers of Shish Tawook, Kafta & Tender Lamb Fillet served with garlic paste & biwas pita',
        price_usd: 22.00,
        station: 'grill',
        available: true,
        modifier_groups: [
          {
            group_name: 'Doneness',
            required: true,
            options: [
              { name: 'Medium Well', price_extra_usd: 0 },
              { name: 'Well Done', price_extra_usd: 0 },
            ],
          },
        ],
      },
      {
        id: 'item-almaza',
        category_id: catBar,
        name: 'Chilled Almaza Beer (330ml)',
        description: 'Lebanon premium pilsner beer served icy cold',
        price_usd: 4.50,
        station: 'bar',
        available: true,
        modifier_groups: [],
      },
      {
        id: 'item-shisha-classic',
        category_id: catShisha,
        name: 'Premium Skylight Shisha',
        description: 'Handcrafted hookah served with natural coconut charcoal',
        price_usd: 12.00,
        station: 'shisha',
        available: true,
        modifier_groups: [
          {
            group_name: 'Shisha Flavor Selection',
            required: true,
            options: [
              { name: 'Two Apples (Al Fakher)', price_extra_usd: 0 },
              { name: 'Lemon Mint (Fresh)', price_extra_usd: 1.00 },
              { name: 'Love 66 Special Blend', price_extra_usd: 2.00 },
            ],
          },
        ],
      },
    ];

    this.orderItems.push(
      {
        id: 'ord-item-1',
        order_id: 'ord-101',
        session_id: session1Id,
        menu_item_id: 'item-hummus',
        item_name: 'Hummus Beiruti',
        quantity: 2,
        unit_price_usd: 5.50,
        station: 'cold_mezza',
        status: 'delivered',
        selected_modifiers: [{ group: 'Garlic & Lemon Level', option: 'Standard Garlic', price_extra: 0 }],
        special_notes: 'Extra pita bread on side',
        is_comped: false,
        created_at: new Date(Date.now() - 3000000).toISOString(),
      },
      {
        id: 'ord-item-2',
        order_id: 'ord-101',
        session_id: session1Id,
        menu_item_id: 'item-mixed-grill',
        item_name: 'Skylight Mixed Grill Platter',
        quantity: 1,
        unit_price_usd: 22.00,
        station: 'grill',
        status: 'preparing',
        selected_modifiers: [{ group: 'Doneness', option: 'Medium Well', price_extra: 0 }],
        special_notes: 'No onions in biwas',
        is_comped: false,
        created_at: new Date(Date.now() - 1200000).toISOString(),
      }
    );

    this.serviceCalls.push({
      id: 'call-1',
      session_id: session1Id,
      table_number: 1,
      type: 'charcoal',
      status: 'pending',
      created_at: new Date(Date.now() - 180000).toISOString(),
    });
  }
}

export const dbStore = new SkylightStore();
