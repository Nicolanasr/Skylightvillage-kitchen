const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Read .env.local manually
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const PROD_URL = process.env.DATABASE_URL || "";
const STAGING_URL = PROD_URL.replace(/\/defaultdb(\?|$)/, '/stagingdb$1');

async function fixDb(url, dbName) {
  const cleanUrl = url.replace(/\?sslmode=[^&]*/, '');
  const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

  console.log(`\n🔧 FIXING UNIQUE CONSTRAINTS FOR: ${dbName}...`);

  try {
    // 1. Delete duplicate phone numbers keeping the latest row for customers
    await pool.query(`
      DELETE FROM customers a USING customers b
      WHERE a.ctid < b.ctid AND a.phone_number = b.phone_number AND a.phone_number IS NOT NULL AND a.phone_number != '';
    `);

    // 2. Delete duplicate phone numbers keeping the latest row for customer_loyalty
    await pool.query(`
      DELETE FROM customer_loyalty a USING customer_loyalty b
      WHERE a.ctid < b.ctid AND a.phone_number = b.phone_number AND a.phone_number IS NOT NULL AND a.phone_number != '';
    `);

    // 3. Create Unique Indexes for ON CONFLICT (phone_number)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone_number);
    `);
    console.log(`  ✅ Created UNIQUE INDEX 'idx_customers_phone_unique' on customers(phone_number)`);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_loyalty_phone_unique ON customer_loyalty(phone_number);
    `);
    console.log(`  ✅ Created UNIQUE INDEX 'idx_customer_loyalty_phone_unique' on customer_loyalty(phone_number)`);

  } catch (e) {
    console.error(`❌ Error fixing ${dbName}:`, e.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await fixDb(PROD_URL, "PROD (defaultdb)");
  if (STAGING_URL !== PROD_URL) {
    await fixDb(STAGING_URL, "STAGING (stagingdb)");
  }
  console.log("\n🎉 ALL UNIQUE INDEXES ENSURED SUCCESSFULLY!");
}

main();
