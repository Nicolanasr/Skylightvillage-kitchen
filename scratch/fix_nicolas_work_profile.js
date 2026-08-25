require('dotenv').config({ path: '.env.local' });
const AIVEN_URL = process.env.DATABASE_URL || "";
const cleanAivenUrl = AIVEN_URL.replace(/\?sslmode=[^&]*/, '');
const pool = new Pool({ connectionString: cleanAivenUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🛠️ FIXING PROFILE +96181090746 ON AIVEN...");
  try {
    // 1. Update customers table name to 'nicolas work'
    await pool.query(
      "UPDATE customers SET name = 'nicolas work', updated_at = NOW() WHERE phone_number = '+96181090746' OR phone_number LIKE '%81090746'"
    );

    // 2. Link customer_loyalty to customers.id
    await pool.query(`
      UPDATE customer_loyalty cl
      SET customer_id = c.id, customer_name = c.name
      FROM customers c
      WHERE cl.phone_number = c.phone_number;
    `);

    const custRes = await pool.query("SELECT id, phone_number, name FROM customers WHERE phone_number LIKE '%81090746'");
    const loyRes = await pool.query("SELECT id, customer_id, phone_number, customer_name FROM customer_loyalty WHERE phone_number LIKE '%81090746'");

    console.log("  ✅ Customers table:", custRes.rows);
    console.log("  ✅ Customer_loyalty table:", loyRes.rows);
  } catch (e) {
    console.error("Error fixing profile:", e);
  } finally {
    await pool.end();
  }
}

main();
