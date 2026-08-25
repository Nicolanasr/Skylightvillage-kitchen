const { Pool } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.replace('DATABASE_URL=', '').replace(/"/g, '').trim();
  }
}

const cleanUrl = dbUrl.replace(/\?sslmode=[^&]*/, '');

const pool = new Pool({
  connectionString: cleanUrl,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  console.log('Testing Aiven PostgreSQL connection...');
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log('✅ AIVEN CONNECTION SUCCESSFUL!');
    console.log(`  - Database Time: ${res.rows[0].now}`);
    console.log(`  - Database Name: ${res.rows[0].db}`);

    const countRes = await pool.query('SELECT COUNT(*) FROM menu_items');
    console.log(`  - Menu Items Count: ${countRes.rows[0].count}`);
  } catch (err) {
    console.error('❌ Connection Failed:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
