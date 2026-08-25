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
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

async function createOrdersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES table_sessions(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ 'orders' table verified/created on Aiven PostgreSQL!");
  } catch (err) {
    console.error("Error creating orders table:", err);
  } finally {
    await pool.end();
  }
}

createOrdersTable();
