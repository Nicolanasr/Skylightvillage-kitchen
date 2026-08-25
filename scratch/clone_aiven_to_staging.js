require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const PROD_URL = process.env.DATABASE_URL || "";
const STAGING_URL = PROD_URL.replace(/\/defaultdb(\?|$)/, '/stagingdb$1');

const cleanProdUrl = PROD_URL.replace(/\?sslmode=[^&]*/, '');
const cleanStagingUrl = STAGING_URL.replace(/\?sslmode=[^&]*/, '');

const prodPool = new Pool({ connectionString: cleanProdUrl, ssl: { rejectUnauthorized: false } });
const stagingPool = new Pool({ connectionString: cleanStagingUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🚀 CLONING EXACT PROD SCHEMA & DATA TO STAGINGDB ON AIVEN...");

  try {
    // 1. Get all table definitions from prod
    const tablesRes = await prodPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    for (const table of tables) {
      console.log(`\n📋 Processing table: '${table}'...`);

      // Get exact column names and data types from prod
      const colsRes = await prodPool.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      const cols = colsRes.rows;
      const colDefs = cols.map(c => {
        let typeStr = c.data_type.toUpperCase();
        if (c.data_type === 'ARRAY') typeStr = `${c.udt_name.replace(/^_/, '').toUpperCase()}[]`;
        if (c.data_type === 'USER-DEFINED') typeStr = c.udt_name.toUpperCase();
        
        let def = `"${c.column_name}" ${typeStr}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        return def;
      }).join(', ');

      // Primary Keys
      const pkRes = await prodPool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
      `, [table]);

      let pkDef = '';
      if (pkRes.rows.length > 0) {
        pkDef = `, PRIMARY KEY (${pkRes.rows.map(r => `"${r.column_name}"`).join(', ')})`;
      }

      // Create table in stagingdb
      await stagingPool.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs}${pkDef})`);

      // Fetch prod data rows
      const prodRowsRes = await prodPool.query(`SELECT * FROM "${table}"`);
      const rows = prodRowsRes.rows;

      if (rows.length > 0) {
        const colNames = cols.map(c => `"${c.column_name}"`).join(', ');
        const conflictCol = pkRes.rows.length > 0 ? pkRes.rows[0].column_name : cols[0].column_name;

        for (const row of rows) {
          const values = cols.map(c => {
            const val = row[c.column_name];
            if (val === null || val === undefined) return null;
            if (typeof val === 'object' && !(val instanceof Date)) {
              return JSON.stringify(val);
            }
            return val;
          });

          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          const updateSet = cols
            .filter(c => c.column_name !== conflictCol)
            .map(c => `"${c.column_name}" = EXCLUDED."${c.column_name}"`)
            .join(', ');

          const query = `
            INSERT INTO "${table}" (${colNames}) 
            VALUES (${placeholders})
            ON CONFLICT ("${conflictCol}") DO ${updateSet ? `UPDATE SET ${updateSet}` : 'NOTHING'}
          `;

          try {
            await stagingPool.query(query, values);
          } catch (err) {
            console.error(`  ⚠️ Row insert error in '${table}':`, err.message);
          }
        }
      }

      console.log(`  ✅ Table '${table}' synced (${rows.length} rows)`);
    }

    console.log("\n🎉 STAGING DATABASE CLONE SUCCESSFUL!");
    console.log("==================================================");
    console.log("🔗 STAGING DATABASE URL:");
    console.log(STAGING_URL);
    console.log("==================================================");

  } catch (e) {
    console.error("❌ Error during staging database clone:", e);
  } finally {
    await prodPool.end();
    await stagingPool.end();
  }
}

main();
