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

      const itemsRes = await pool.query('SELECT * FROM menu_items ORDER BY created_at ASC');
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
    this.staffMembers = [
    ];

    for (let i = 1; i <= 12; i++) {
      this.tables.push({
        id: `tbl-${i}`,
        table_number: i,
        qr_code_token: `token-table-${i}`,
        status: 'available',
        created_at: new Date().toISOString(),
      });
    }

    // Categories
    const catCold = 'cat-cold';
    const catHot = 'cat-hot';
    const catSalads = 'cat-salads';
    const catSajj = 'cat-sajj';
    const catBbq = 'cat-bbq';
    const catSubs = 'cat-subs';
    const catKids = 'cat-kids';
    const catColdBev = 'cat-cold-bev';
    const catHotBev = 'cat-hot-bev';
    const catSpirits = 'cat-spirits';
    const catShisha = 'cat-shisha';

    this.categories = [
      { id: catCold, name: 'Cold Mezza', sort_order: 1 },
      { id: catHot, name: 'Hot Mezza', sort_order: 2 },
      { id: catSalads, name: 'Salads', sort_order: 3 },
      { id: catSajj, name: 'Fresh From The Sajj', sort_order: 4 },
      { id: catBbq, name: 'BBQ', sort_order: 5 },
      { id: catSubs, name: 'Subs & Sandwiches', sort_order: 6 },
      { id: catKids, name: 'Kids Meals', sort_order: 7 },
      { id: catColdBev, name: 'Cold Refreshments', sort_order: 8 },
      { id: catHotBev, name: 'Hot Drinks', sort_order: 9 },
      { id: catSpirits, name: 'Spirits & Alcohol', sort_order: 10 },
      { id: catShisha, name: 'Shisha Lounge', sort_order: 11 },
    ];

    this.menuItems = [
      // COLD MEZZA
      { id: 'm-labneh', category_id: catCold, name: 'Labneh', price_usd: 4.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-labneh-toum', category_id: catCold, name: 'Labneh b Toum', price_usd: 4.50, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-hummus', category_id: catCold, name: 'Hummus', description: 'Chickpea puree with tahini, lemon & olive oil', price_usd: 5.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-moutabal', category_id: catCold, name: 'Moutabal', description: 'Smoked eggplant dip with tahini', price_usd: 5.50, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-shanklish', category_id: catCold, name: 'Shanklish', description: 'Aged cheese with diced tomato, onion & olive oil', price_usd: 6.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-kabiss', category_id: catCold, name: 'Kabiss Platter', description: 'Assorted Lebanese pickles & olives', price_usd: 4.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-veg-platter', category_id: catCold, name: 'Vegetable Platter', description: 'Fresh mint, cucumber, tomato & radish', price_usd: 5.00, station: 'mezza', available: true, modifier_groups: [] },

      // HOT MEZZA
      { id: 'm-fries', category_id: catHot, name: 'French Fries', price_usd: 4.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-batata-harra', category_id: catHot, name: 'Batata Harra', description: 'Spicy fried potato cubes with coriander & garlic', price_usd: 6.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-mouajjanet', category_id: catHot, name: 'Mixed Mouajjanet', description: '2 Kebbeh, 2 Sambousik, 2 Rkakat Cheese', price_usd: 9.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-makanek', category_id: catHot, name: 'Makanek', description: 'Sauteed mini sausages with pomegranate molasses', price_usd: 8.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-soujouk', category_id: catHot, name: 'Soujouk', description: 'Spicy Armenian sausages cooked with tomato & garlic', price_usd: 8.00, station: 'mezza', available: true, modifier_groups: [] },

      // SALADS
      { id: 'm-fattoush', category_id: catSalads, name: 'Fattoush', description: 'Garden greens, radish, sumac dressing & pita chips', price_usd: 7.00, station: 'mezza', available: true, modifier_groups: [] },
      { id: 'm-tabbouleh', category_id: catSalads, name: 'Tabbouleh', description: 'Finely chopped parsley, mint, tomato & bulgur', price_usd: 7.00, station: 'mezza', available: true, modifier_groups: [] },

      // FRESH FROM THE SAJJ
      { id: 'm-sajj-zaatar', category_id: catSajj, name: 'Zaatar Sajj', price_usd: 2.50, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-jebneh', category_id: catSajj, name: 'Jebneh Sajj', price_usd: 4.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-labneh', category_id: catSajj, name: 'Labneh Sajj', price_usd: 3.50, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-zl', category_id: catSajj, name: 'Zaatar & Labneh Sajj', price_usd: 4.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-cocktail', category_id: catSajj, name: 'Cocktail Sajj', price_usd: 5.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-jebne-jambon', category_id: catSajj, name: 'Jebne w Jambon Sajj', price_usd: 6.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-jebne-soujouk', category_id: catSajj, name: 'Jebne w Soujouk Sajj', price_usd: 6.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-jebne-kafta', category_id: catSajj, name: 'Jebne w Kafta Sajj', price_usd: 7.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-lahm', category_id: catSajj, name: 'Lahm Bi Ajeen Sajj', price_usd: 7.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-pizza', category_id: catSajj, name: 'Lebanese Pizza Sajj', price_usd: 8.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-chocobas', category_id: catSajj, name: 'Chocobas Sweet Sajj', price_usd: 6.00, station: 'sajj', available: true, modifier_groups: [] },
      { id: 'm-sajj-zebde', category_id: catSajj, name: 'Zebde & Sekkar Sajj', price_usd: 4.00, station: 'sajj', available: true, modifier_groups: [] },

      // BBQ PLATTERS
      {
        id: 'm-tawook-platter',
        category_id: catBbq,
        name: 'Tawook Platter',
        description: '2 chicken skewers served with fries, coleslaw, garlic dip & pickles',
        price_usd: 14.00,
        station: 'grill',
        available: true,
        modifier_groups: [
          {
            group_name: 'Preparation',
            required: false,
            options: [
              { name: 'Extra Garlic Dip', price_extra_usd: 0.50 },
              { name: 'No Coleslaw', price_extra_usd: 0 },
            ],
          },
        ],
      },
      {
        id: 'm-kafta-platter',
        category_id: catBbq,
        name: 'Kafta Platter',
        description: '2 kafta skewers served with fries, hummus, biwaz salad & chili bread',
        price_usd: 14.00,
        station: 'grill',
        available: true,
        modifier_groups: [],
      },
      {
        id: 'm-lahme-platter',
        category_id: catBbq,
        name: 'Lahme Platter',
        description: '2 meat skewers served with fries, hummus, biwaz salad, grilled onion & chili bread',
        price_usd: 17.00,
        station: 'grill',
        available: true,
        modifier_groups: [
          {
            group_name: 'Meat Doneness',
            required: false,
            options: [
              { name: 'Medium Well', price_extra_usd: 0 },
              { name: 'Well Done', price_extra_usd: 0 },
            ],
          },
        ],
      },
      {
        id: 'm-mixed-grill',
        category_id: catBbq,
        name: 'Mixed Grill Platter',
        description: '2 Tawook, 2 Kafta, 1 Lahme served with fries, garlic dip, biwaz salad & chili bread',
        price_usd: 22.00,
        station: 'grill',
        available: true,
        modifier_groups: [],
      },

      // SUBS & SANDWICHES
      { id: 'm-sub-chicken', category_id: catSubs, name: 'Chicken Sub', description: 'Served with French Fries', price_usd: 9.00, station: 'subs_sandwiches', available: true, modifier_groups: [] },
      { id: 'm-sub-submarine', category_id: catSubs, name: 'Submarine Sub', description: 'Served with French Fries', price_usd: 9.00, station: 'subs_sandwiches', available: true, modifier_groups: [] },
      { id: 'm-sub-fajita', category_id: catSubs, name: 'Chicken Fajita Sub', description: 'Served with French Fries', price_usd: 10.00, station: 'subs_sandwiches', available: true, modifier_groups: [] },

      // KIDS MEALS
      { id: 'm-kids-burger', category_id: catKids, name: 'Classic Kids Burger', description: 'Served with French Fries & Juice', price_usd: 7.50, station: 'subs_sandwiches', available: true, modifier_groups: [] },
      { id: 'm-kids-nuggets', category_id: catKids, name: 'Chicken Nuggets', description: 'Served with French Fries & Juice', price_usd: 7.50, station: 'subs_sandwiches', available: true, modifier_groups: [] },

      // COLD REFRESHMENTS
      { id: 'm-bev-water-sm', category_id: catColdBev, name: 'Small Mineral Water', price_usd: 1.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-bev-water-lg', category_id: catColdBev, name: 'Large Mineral Water', price_usd: 2.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-bev-soft', category_id: catColdBev, name: 'Soft Drinks (Pepsi / 7Up / Mirinda)', price_usd: 2.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-bev-energy', category_id: catColdBev, name: 'Energy Drinks (RedBull)', price_usd: 4.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-bev-juice', category_id: catColdBev, name: 'Fresh Fruit Juice', price_usd: 3.00, station: 'bar', available: true, modifier_groups: [] },

      // HOT DRINKS
      { id: 'm-hot-turkish', category_id: catHotBev, name: 'Turkish Coffee', price_usd: 2.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-hot-american', category_id: catHotBev, name: 'American Coffee', price_usd: 3.00, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-hot-nescafe', category_id: catHotBev, name: 'Nescafe (3in1 / 2in1)', price_usd: 2.50, station: 'bar', available: true, modifier_groups: [] },
      { id: 'm-hot-tea', category_id: catHotBev, name: 'Herbal / Black Tea', price_usd: 2.00, station: 'bar', available: true, modifier_groups: [] },

      // SPIRITS & ALCOHOL
      {
        id: 'm-alc-arak',
        category_id: catSpirits,
        name: 'Arak Lebanese Spirit',
        price_usd: 5.00,
        station: 'bar',
        available: true,
        modifier_groups: [
          {
            group_name: 'Serving Size',
            required: true,
            options: [
              { name: 'Glass', price_extra_usd: 0 },
              { name: 'Full Bottle', price_extra_usd: 25.00 },
            ],
          },
        ],
      },
      {
        id: 'm-alc-whiskey',
        category_id: catSpirits,
        name: 'Premium Whiskey',
        price_usd: 7.00,
        station: 'bar',
        available: true,
        modifier_groups: [
          {
            group_name: 'Serving Size',
            required: true,
            options: [
              { name: 'Glass', price_extra_usd: 0 },
              { name: 'Full Bottle', price_extra_usd: 48.00 },
            ],
          },
        ],
      },
      {
        id: 'm-alc-vodka',
        category_id: catSpirits,
        name: 'Vodka',
        price_usd: 7.00,
        station: 'bar',
        available: true,
        modifier_groups: [
          {
            group_name: 'Serving Size',
            required: true,
            options: [
              { name: 'Glass', price_extra_usd: 0 },
              { name: 'Full Bottle', price_extra_usd: 38.00 },
            ],
          },
        ],
      },
      {
        id: 'm-alc-gin',
        category_id: catSpirits,
        name: 'Gin',
        price_usd: 7.00,
        station: 'bar',
        available: true,
        modifier_groups: [
          {
            group_name: 'Serving Size',
            required: true,
            options: [
              { name: 'Glass', price_extra_usd: 0 },
              { name: 'Full Bottle', price_extra_usd: 38.00 },
            ],
          },
        ],
      },
      {
        id: 'm-alc-wine',
        category_id: catSpirits,
        name: 'Lebanese Wine (Red / White)',
        price_usd: 5.00,
        station: 'bar',
        available: true,
        modifier_groups: [
          {
            group_name: 'Serving Size',
            required: true,
            options: [
              { name: 'Glass', price_extra_usd: 0 },
              { name: 'Full Bottle', price_extra_usd: 20.00 },
            ],
          },
        ],
      },

      // SHISHA
      {
        id: 'm-shisha-apple',
        category_id: catShisha,
        name: 'Double Apple Shisha',
        description: 'Two Apples flavor Hookah',
        price_usd: 7.00,
        station: 'shisha',
        available: true,
        modifier_groups: [],
      },
      {
        id: 'm-shisha-lemon-mint',
        category_id: catShisha,
        name: 'Lemon & Mint Shisha',
        price_usd: 7.50,
        station: 'shisha',
        available: true,
        modifier_groups: [],
      },
      {
        id: 'm-shisha-love',
        category_id: catShisha,
        name: 'Love 66 Special Shisha',
        price_usd: 8.00,
        station: 'shisha',
        available: true,
        modifier_groups: [],
      },
    ];
  }
}

export const dbStore = new SkylightStore();
