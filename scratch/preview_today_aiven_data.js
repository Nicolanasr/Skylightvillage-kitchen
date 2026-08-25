require('dotenv').config({ path: '.env.local' });
const AIVEN_URL = process.env.DATABASE_URL || "";
const cleanAivenUrl = AIVEN_URL.replace(/\?sslmode=[^&]*/, '');

const pool = new Pool({ connectionString: cleanAivenUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🔍 PREVIEWING TODAY'S TEST DATA ON AIVEN POSTGRESQL...\n");

  try {
    const resSessions = await pool.query("SELECT COUNT(*) FROM table_sessions WHERE created_at >= CURRENT_DATE");
    const resOrders = await pool.query("SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE");
    const resItems = await pool.query("SELECT COUNT(*) FROM order_items WHERE created_at >= CURRENT_DATE");
    const resPayments = await pool.query("SELECT COUNT(*) FROM payments WHERE created_at >= CURRENT_DATE");
    const resDiscounts = await pool.query("SELECT COUNT(*) FROM discounts WHERE created_at >= CURRENT_DATE");
    const resCalls = await pool.query("SELECT COUNT(*) FROM service_calls WHERE created_at >= CURRENT_DATE");
    const resLogs = await pool.query("SELECT COUNT(*) FROM activity_logs WHERE created_at >= CURRENT_DATE");

    console.log(`- Table Sessions created today: ${resSessions.rows[0].count}`);
    console.log(`- Orders created today: ${resOrders.rows[0].count}`);
    console.log(`- Order Items created today: ${resItems.rows[0].count}`);
    console.log(`- Payments created today: ${resPayments.rows[0].count}`);
    console.log(`- Discounts created today: ${resDiscounts.rows[0].count}`);
    console.log(`- Service Calls created today: ${resCalls.rows[0].count}`);
    console.log(`- Activity Logs created today: ${resLogs.rows[0].count}`);

  } catch (err) {
    console.error("Error previewing today's data:", err);
  } finally {
    await pool.end();
  }
}

main();
