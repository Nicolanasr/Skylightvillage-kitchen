require('dotenv').config({ path: '.env.local' });
const AIVEN_URL = process.env.DATABASE_URL || "";
const cleanAivenUrl = AIVEN_URL.replace(/\?sslmode=[^&]*/, '');

const pool = new Pool({ connectionString: cleanAivenUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🔗 LINKING customer_loyalty TO customers TABLE...\n");

  try {
    // 1. Add customer_id column to customer_loyalty if missing
    await pool.query(`
      ALTER TABLE customer_loyalty 
      ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
    `);
    console.log("  ✅ Added 'customer_id' foreign key column to 'customer_loyalty' table.");

    // 2. Populate customer_id on customer_loyalty matching by phone_number or vip_code
    const updateRes = await pool.query(`
      UPDATE customer_loyalty cl
      SET customer_id = c.id
      FROM customers c
      WHERE (cl.phone_number = c.phone_number OR cl.vip_code = c.vip_code)
        AND cl.customer_id IS NULL;
    `);
    console.log(`  ✅ Synced customer_id links on ${updateRes.rowCount} loyalty profiles.`);

    // 3. Create relational index for ultra-fast joins
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer_id ON customer_loyalty(customer_id);
    `);
    console.log("  ✅ Created index 'idx_customer_loyalty_customer_id'.");

    console.log("\n🎉 RELATIONAL LINK BETWEEN customer_loyalty AND customers COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("Link migration error:", err);
  } finally {
    await pool.end();
  }
}

main();
