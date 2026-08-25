const { Pool } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.replace('DATABASE_URL=', '').replace(/"/g, '').trim();
  }
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const todayDateStr = '2026-08-17';
  console.log(`Checking CockroachDB test data created on or after: ${todayDateStr}...\n`);

  try {
    // 1. Table Sessions
    const sessionsRes = await pool.query(
      `SELECT * FROM table_sessions WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 2. Order Items
    const itemsRes = await pool.query(
      `SELECT * FROM order_items WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 3. Payments
    const paymentsRes = await pool.query(
      `SELECT * FROM payments WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 4. Discounts
    const discountsRes = await pool.query(
      `SELECT * FROM discounts WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 5. Customer Loyalty Profiles
    const loyaltyRes = await pool.query(
      `SELECT * FROM customer_loyalty WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 6. Master CRM Customers
    const crmRes = await pool.query(
      `SELECT * FROM customers WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 7. Audit Logs
    const auditRes = await pool.query(
      `SELECT * FROM loyalty_audit_logs WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    // 8. Service Calls
    const serviceRes = await pool.query(
      `SELECT * FROM service_calls WHERE created_at >= $1::date ORDER BY created_at DESC`,
      [todayDateStr]
    );

    console.log(`=== SUMMARY OF TODAY'S CREATED TEST DATA (${todayDateStr}) ===`);
    console.log(`1. Table Sessions created today: ${sessionsRes.rows.length}`);
    console.log(`2. Order Items created today: ${itemsRes.rows.length}`);
    console.log(`3. Payments recorded today: ${paymentsRes.rows.length}`);
    console.log(`4. Discounts applied today: ${discountsRes.rows.length}`);
    console.log(`5. Loyalty Profiles created today: ${loyaltyRes.rows.length}`);
    console.log(`6. Master CRM Customers created today: ${crmRes.rows.length}`);
    console.log(`7. Loyalty Audit Logs created today: ${auditRes.rows.length}`);
    console.log(`8. Service Calls created today: ${serviceRes.rows.length}\n`);

    if (sessionsRes.rows.length > 0) {
      console.log("SESSIONS CREATED TODAY:");
      sessionsRes.rows.forEach(s => console.log(`  - ID: ${s.id} | Table #${s.primary_table_id} | Status: ${s.status} | Phone: ${s.customer_phone || 'None'} | Created: ${s.created_at}`));
    }

    if (itemsRes.rows.length > 0) {
      console.log("\nORDER ITEMS CREATED TODAY (Sample):");
      itemsRes.rows.slice(0, 10).forEach(i => console.log(`  - Dish: ${i.item_name} x${i.quantity} ($${i.unit_price_usd}) | Status: ${i.status} | Session: ${i.session_id}`));
    }

    if (loyaltyRes.rows.length > 0) {
      console.log("\nLOYALTY PROFILES CREATED TODAY:");
      loyaltyRes.rows.forEach(l => console.log(`  - Name: ${l.customer_name} | Phone: ${l.phone_number} | Points: ${l.points_balance} | Spent: $${l.total_spent_usd}`));
    }

    if (crmRes.rows.length > 0) {
      console.log("\nMASTER CRM CUSTOMERS CREATED TODAY:");
      crmRes.rows.forEach(c => console.log(`  - Name: ${c.name} | Phone: ${c.phone_number} | Orders: ${c.total_orders} | Spent: $${c.total_spent_usd}`));
    }

  } catch (err) {
    console.error('Error fetching today test data:', err);
  } finally {
    await pool.end();
  }
}

main();
