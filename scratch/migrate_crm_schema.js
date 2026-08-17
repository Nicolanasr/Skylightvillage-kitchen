const fs = require('fs');
const path = require('path');

let envStr = '';
try { envStr = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8'); } catch (e) {
  try { envStr = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'); } catch (e2) {}
}

let dbUrl = '';
for (const line of envStr.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('DATABASE_URL=')[1].trim().replace(/^["']/, '').replace(/["']$/, '');
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🚀 Starting Customer CRM Database Schema Migration...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE,
      name TEXT DEFAULT 'Valued Guest',
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

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
    CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent_usd DESC);
    CREATE INDEX IF NOT EXISTS idx_customers_vip ON customers(vip_code);

    ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id);
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id);
  `);

  console.log("Copying existing customer_loyalty data into customers table...");
  await pool.query(`
    INSERT INTO customers (id, phone_number, name, vip_code, points_balance, total_spent_usd, total_orders, created_at, updated_at)
    SELECT id, phone_number, customer_name, vip_code, points_balance, total_spent_usd, total_visits, created_at, updated_at
    FROM customer_loyalty
    ON CONFLICT (phone_number) DO UPDATE SET
      points_balance = EXCLUDED.points_balance,
      total_spent_usd = EXCLUDED.total_spent_usd,
      total_orders = EXCLUDED.total_orders;
  `);

  console.log("✅ Customer CRM Database Schema Migration Complete!");
  await pool.end();
}

main().catch(console.error);
