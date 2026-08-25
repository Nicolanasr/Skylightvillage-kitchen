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
  console.log(`🧹 Deleting all test data created on or after: ${todayDateStr}...\n`);

  try {
    // 1. Delete Order Items created today
    const itemsRes = await pool.query(
      `DELETE FROM order_items WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 2. Delete Payments created today
    const paymentsRes = await pool.query(
      `DELETE FROM payments WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 3. Delete Discounts created today
    const discountsRes = await pool.query(
      `DELETE FROM discounts WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 4. Delete Service Calls created today
    const serviceRes = await pool.query(
      `DELETE FROM service_calls WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 5. Delete Table Sessions created today
    const sessionsRes = await pool.query(
      `DELETE FROM table_sessions WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 6. Delete Customer Loyalty Profiles created today
    const loyaltyRes = await pool.query(
      `DELETE FROM customer_loyalty WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 7. Delete Master CRM Customers created today
    const crmRes = await pool.query(
      `DELETE FROM customers WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // 8. Delete Loyalty Audit Logs created today
    const auditRes = await pool.query(
      `DELETE FROM loyalty_audit_logs WHERE created_at >= $1::date RETURNING id`,
      [todayDateStr]
    );

    // Reset all tables status to available if needed
    await pool.query("UPDATE tables SET status = 'available'");

    console.log(`✅ DELETION COMPLETED SUCCESSFULLY:`);
    console.log(`  - Deleted ${sessionsRes.rows.length} Table Sessions`);
    console.log(`  - Deleted ${itemsRes.rows.length} Order Items`);
    console.log(`  - Deleted ${paymentsRes.rows.length} Payments`);
    console.log(`  - Deleted ${discountsRes.rows.length} Discounts`);
    console.log(`  - Deleted ${loyaltyRes.rows.length} Loyalty Profiles`);
    console.log(`  - Deleted ${crmRes.rows.length} Master CRM Customers`);
    console.log(`  - Deleted ${auditRes.rows.length} Loyalty Audit Logs`);
    console.log(`  - Deleted ${serviceRes.rows.length} Service Calls`);
    console.log(`  - Reset all tables to 'available' status.`);

  } catch (err) {
    console.error('❌ Deletion Error:', err);
  } finally {
    await pool.end();
  }
}

main();
