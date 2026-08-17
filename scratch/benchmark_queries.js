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

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("--- TESTING OPTIMIZED GETPOSDATA PARALLEL FETCH ---");
  const start = Date.now();
  const [tblRes, sessRes, ordRes, payRes, discRes, callRes, itemRes, catRes, loyaltyRes] = await Promise.all([
    pool.query('SELECT * FROM tables ORDER BY table_number ASC'),
    pool.query("SELECT * FROM table_sessions WHERE status = 'active' OR created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 80"),
    pool.query(`
      SELECT oi.* FROM order_items oi
      LEFT JOIN table_sessions ts ON oi.session_id = ts.id
      WHERE oi.status != 'cancelled'
        AND (ts.status = 'active' OR oi.created_at > NOW() - INTERVAL '8 hours')
      ORDER BY oi.created_at ASC
    `),
    pool.query("SELECT * FROM payments WHERE created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 150"),
    pool.query("SELECT * FROM discounts WHERE created_at > NOW() - INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 150"),
    pool.query("SELECT * FROM service_calls WHERE status = 'pending' ORDER BY created_at DESC"),
    pool.query(`
      SELECT 
        id, category_id, name, description, price_usd, price_camping_usd, station, available, is_staff_only, sort_order, is_bestseller, modifier_groups,
        CASE WHEN image_url IS NOT NULL AND image_url != '' THEN '/api/dish-image?id=' || id ELSE '' END as image_url
      FROM menu_items 
      ORDER BY sort_order ASC, name ASC
    `),
    pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC'),
    pool.query("SELECT value FROM system_settings WHERE key = 'loyalty_program_enabled'").catch(() => ({ rows: [] })),
  ]);

  const duration = Date.now() - start;
  console.log(`🚀 TOTAL PROMISE.ALL DURATION: ${duration} ms (Fetched ${itemRes.rows.length} dishes, ${tblRes.rows.length} tables, ${sessRes.rows.length} sessions)`);
  await pool.end();
}

main().catch(console.error);
