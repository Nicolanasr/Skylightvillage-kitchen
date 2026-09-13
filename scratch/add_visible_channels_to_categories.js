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

async function migrateDb(url, dbName) {
  const cleanUrl = url.replace(/\?sslmode=[^&]*/, '');
  const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

  console.log(`\n🔧 ADDING visible_channels TO menu_categories FOR: ${dbName}...`);

  try {
    // Add visible_channels JSONB column if not exists
    await pool.query(`
      ALTER TABLE menu_categories 
      ADD COLUMN IF NOT EXISTS visible_channels JSONB DEFAULT '["dine_in", "takeout", "camping", "pos"]'::jsonb;
    `);
    
    // Ensure any nulls get default channels
    await pool.query(`
      UPDATE menu_categories 
      SET visible_channels = '["dine_in", "takeout", "camping", "pos"]'::jsonb 
      WHERE visible_channels IS NULL;
    `);

    console.log(`  ✅ Column 'visible_channels' ensured on menu_categories in ${dbName}`);
  } catch (e) {
    console.error(`❌ Error migrating ${dbName}:`, e.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await migrateDb(PROD_URL, "PROD (defaultdb)");
  if (STAGING_URL !== PROD_URL) {
    await migrateDb(STAGING_URL, "STAGING (stagingdb)");
  }
  console.log("\n🎉 CATEGORY VISIBILITY MIGRATION COMPLETED SUCCESSFULLY!");
}

main();
