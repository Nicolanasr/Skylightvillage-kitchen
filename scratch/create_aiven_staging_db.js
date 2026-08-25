require('dotenv').config({ path: '.env.local' });
const { Pool, Client } = require('pg');

const AIVEN_ADMIN_URL = process.env.DATABASE_URL || "";
const cleanAdminUrl = AIVEN_ADMIN_URL.replace(/\?sslmode=[^&]*/, '');

async function main() {
  console.log("🚀 CREATING AIVEN STAGING DATABASE...");

  // 1. Connect to defaultdb to create database stagingdb
  const defaultClient = new Client({ connectionString: cleanAdminUrl, ssl: { rejectUnauthorized: false } });
  await defaultClient.connect();

  try {
    const checkDb = await defaultClient.query("SELECT 1 FROM pg_database WHERE datname = 'stagingdb'");
    if (checkDb.rows.length === 0) {
      console.log("  CREATE DATABASE stagingdb...");
      await defaultClient.query("CREATE DATABASE stagingdb;");
      console.log("  ✅ Database 'stagingdb' created successfully!");
    } else {
      console.log("  ℹ️ Database 'stagingdb' already exists.");
    }
  } catch (e) {
    console.error("  ❌ Error creating staging database:", e.message);
  } finally {
    await defaultClient.end();
  }

  // 2. Connect to stagingdb and copy tables from defaultdb
  const stagingUrl = cleanAdminUrl.replace(/\/defaultdb(\?|$)/, '/stagingdb$1');
  const cleanStagingUrl = stagingUrl.replace(/\?sslmode=[^&]*/, '');

  console.log("\n📦 CLONING SCHEMA AND DATA FROM PROD (defaultdb) TO STAGING (stagingdb)...");

  const prodPool = new Pool({ connectionString: cleanAdminUrl, ssl: { rejectUnauthorized: false } });
  const stagingPool = new Pool({ connectionString: cleanStagingUrl, ssl: { rejectUnauthorized: false } });

  try {
    // Get all tables in defaultdb
    const tablesRes = await prodPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`  Found ${tableNames.length} tables to migrate to staging:`, tableNames.join(", "));

    for (const table of tableNames) {
      // Fetch table creation DDL / structure
      const colRes = await prodPool.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      // Create table if not exists in staging
      const createCols = colRes.rows.map(c => {
        let colDef = `"${c.column_name}" ${c.data_type.toUpperCase()}`;
        if (c.is_nullable === 'NO') colDef += ' NOT NULL';
        if (c.column_default) colDef += ` DEFAULT ${c.column_default}`;
        return colDef;
      }).join(', ');

      // Primary Key inference
      const pkRes = await prodPool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
      `, [table]);

      let pkConstraint = '';
      if (pkRes.rows.length > 0) {
        const pkCols = pkRes.rows.map(r => `"${r.column_name}"`).join(', ');
        pkConstraint = `, PRIMARY KEY (${pkCols})`;
      }

      await stagingPool.query(`CREATE TABLE IF NOT EXISTS "${table}" (${createCols}${pkConstraint})`);

      // Copy data rows
      const dataRes = await prodPool.query(`SELECT * FROM "${table}"`);
      if (dataRes.rows.length > 0) {
        const columns = Object.keys(dataRes.rows[0]);
        const colNames = columns.map(c => `"${c}"`).join(', ');

        for (const row of dataRes.rows) {
          const values = columns.map(c => row[c]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          const conflictCol = columns.includes('id') ? 'id' : columns[0];

          const updateCols = columns.filter(c => c !== conflictCol).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
          const onConflictClause = updateCols 
            ? `ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateCols}` 
            : `ON CONFLICT ("${conflictCol}") DO NOTHING`;

          await stagingPool.query(
            `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ${onConflictClause}`,
            values
          ).catch(err => {
            // Fallback simple insert if conflict clause varies
            return stagingPool.query(
              `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            ).catch(e => console.error(`  Warning inserting row into ${table}:`, e.message));
          });
        }
      }
      console.log(`  ✅ Table '${table}' synced to stagingdb (${dataRes.rows.length} rows)`);
    }

    console.log("\n🎉 AIVEN STAGING DATABASE SETUP COMPLETE!");
    console.log("--------------------------------------------------");
    console.log("🔗 STAGING DATABASE URL:");
    console.log(stagingUrl);
    console.log("--------------------------------------------------");

  } catch (e) {
    console.error("❌ Error setting up staging database:", e);
  } finally {
    await prodPool.end();
    await stagingPool.end();
  }
}

main();
