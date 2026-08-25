const { Pool } = require('pg');
const fs = require('fs');

// CockroachDB Source Connection String
const COCKROACH_URL = "postgresql://nicolas:JpZDkZ56Iex7-Jb4wrzk5A@umber-lioness-31915.j77.aws-eu-central-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

// Aiven Target Connection String (Passed via argument or AIVEN_URL)
const AIVEN_URL = process.argv[2] || process.env.AIVEN_URL;

if (!AIVEN_URL) {
  console.error("❌ Usage: node scratch/migrate_cockroach_to_aiven.js \"<YOUR_AIVEN_POSTGRES_URL>\"");
  console.error("Example: node scratch/migrate_cockroach_to_aiven.js \"postgres://avnadmin:password@host:port/defaultdb?sslmode=require\"");
  process.exit(1);
}

const cleanCockroachUrl = COCKROACH_URL.replace(/\?sslmode=[^&]*/, '');
const cleanAivenUrl = AIVEN_URL.replace(/\?sslmode=[^&]*/, '');

const sourcePool = new Pool({
  connectionString: cleanCockroachUrl,
  ssl: { rejectUnauthorized: false }
});

const targetPool = new Pool({
  connectionString: cleanAivenUrl,
  ssl: { rejectUnauthorized: false }
});

const TABLES = [
  'menu_categories',
  'menu_items',
  'tables',
  'table_sessions',
  'order_items',
  'service_calls',
  'discounts',
  'payments',
  'staff_members',
  'activity_logs',
  'system_settings',
  'customer_loyalty',
  'customers',
  'loyalty_reward_tiers',
  'raw_ingredients',
  'menu_item_recipes',
  'inventory_receiving',
  'inventory_waste',
  'inventory_audits',
  'inventory_deductions'
];

async function createTargetSchema(target) {
  console.log("⚙️  Creating table schemas & indexes on Aiven target database...");
  await target.query(`
    DROP TABLE IF EXISTS order_item_status_logs, loyalty_audit_logs, loyalty_claim_tokens, loyalty_reward_tiers, customer_loyalty, customers, inventory_deductions, inventory_audits, inventory_waste, inventory_receiving, menu_item_recipes, raw_ingredients, payments, discounts, service_calls, order_items, table_sessions, tables, menu_items, menu_categories, staff_members, activity_logs, system_settings CASCADE;

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
      customer_phone TEXT,
      customer_id TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT,
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
      loyalty_phone TEXT,
      is_comped BOOLEAN DEFAULT false,
      customer_id TEXT
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
      type TEXT NOT NULL DEFAULT 'percentage',
      value NUMERIC(10,2) DEFAULT 0,
      amount_usd NUMERIC(10,2) DEFAULT 0,
      reason TEXT,
      applied_by_staff TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
      amount_usd NUMERIC(10,2) DEFAULT 0,
      amount_lbp NUMERIC(15,2) DEFAULT 0,
      exchange_rate NUMERIC(10,2) DEFAULT 89500,
      method TEXT NOT NULL DEFAULT 'cash_usd',
      staff_name TEXT NOT NULL DEFAULT 'Cashier',
      receipt_number TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin_code TEXT DEFAULT '1234',
      role TEXT DEFAULT 'Staff',
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

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT 'Valued Guest',
      email TEXT,
      vip_code TEXT UNIQUE,
      points_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_spent_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_orders INT NOT NULL DEFAULT 0,
      last_order_at TIMESTAMPTZ,
      tags JSONB DEFAULT '[]'::jsonb,
      notes TEXT DEFAULT '',
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
  `);
}

async function migrateTable(tableName) {
  try {
    const srcRes = await sourcePool.query(`SELECT * FROM ${tableName}`);
    if (srcRes.rows.length === 0) {
      console.log(`  - Table '${tableName}': 0 rows to copy.`);
      return;
    }

    // Get target table columns
    const tgtColRes = await targetPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [tableName]
    );
    const targetCols = new Set(tgtColRes.rows.map((r) => r.column_name));

    const rows = srcRes.rows;
    const sourceCols = Object.keys(rows[0]);
    const validCols = sourceCols.filter((c) => targetCols.has(c));

    if (validCols.length === 0) {
      console.log(`  ⚠️ Table '${tableName}': No matching target columns found.`);
      return;
    }

    const colNames = validCols.join(', ');
    const CHUNK_SIZE = 10;
    let totalCopied = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const valuePlaceholders = [];
      const params = [];
      let pIdx = 1;

      for (const row of chunk) {
        const rowPlaceholders = [];
        for (const col of validCols) {
          let val = row[col];
          if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
            val = JSON.stringify(val);
          }
          params.push(val);
          rowPlaceholders.push(`$${pIdx}`);
          pIdx++;
        }
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      if (valuePlaceholders.length > 0) {
        const insertQuery = `
          INSERT INTO ${tableName} (${colNames})
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT DO NOTHING
        `;
        await targetPool.query(insertQuery, params);
        totalCopied += chunk.length;
      }
    }

    console.log(`  ✅ Table '${tableName}': Copied ${totalCopied} rows to Aiven.`);
  } catch (err) {
    console.error(`  ❌ Error migrating table '${tableName}':`, err.message);
  }
}

async function main() {
  console.log("🚀 Starting Data Migration from CockroachDB to Aiven PostgreSQL...\n");

  try {
    await createTargetSchema(targetPool);

    for (const table of TABLES) {
      await migrateTable(table);
    }

    console.log("\n🎉 DATA MIGRATION TO AIVEN COMPLETED SUCCESSFULLY!");
    console.log("Next step: Update DATABASE_URL in .env.local with your Aiven URI!");
  } catch (e) {
    console.error("Migration fatal error:", e);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
