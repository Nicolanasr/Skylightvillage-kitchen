const fs = require('fs');
const path = require('path');

let envStr = '';
try {
  envStr = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
} catch (e) {
  try { envStr = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'); } catch (e2) {}
}

let dbUrl = '';
for (const line of envStr.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('DATABASE_URL=')[1].trim().replace(/^["']/, '').replace(/["']$/, '');
  }
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const res = await pool.query('SELECT id, name, LENGTH(image_url) as img_len, SUBSTRING(image_url FROM 1 FOR 40) as sample FROM menu_items ORDER BY img_len DESC');
  console.log("TOTAL DISHES:", res.rows.length);
  console.log("TOP DISHES BY IMAGE SIZE:");
  let totalBytes = 0;
  for (const row of res.rows) {
    totalBytes += Number(row.img_len || 0);
    if (row.img_len > 1000) {
      console.log(`Dish: "${row.name}" (${row.id}) -> ${(row.img_len / 1024).toFixed(2)} KB | Sample: ${row.sample}`);
    }
  }
  console.log(`TOTAL IMAGE URL BASE64 PAYLOAD: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  await pool.end();
}

main().catch(console.error);
