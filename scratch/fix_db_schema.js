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
  console.log("Checking activity_logs table columns...");
  const res = await pool.query(`
    SELECT column_name, data_type 
    from information_schema.columns 
    WHERE table_name = 'activity_logs';
  `);
  console.log("COLUMNS IN activity_logs:", res.rows);

  // Add missing columns if any
  console.log("Ensuring action_type column exists in activity_logs...");
  await pool.query(`
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS staff_name TEXT;
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS staff_role TEXT;
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS table_number INT;
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
  `);
  console.log("✅ activity_logs table schema updated successfully!");
  await pool.end();
}

main().catch(console.error);
