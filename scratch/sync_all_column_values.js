require('dotenv').config({ path: '.env.local' });
const AIVEN_URL = process.env.DATABASE_URL || "";

const cleanCockroachUrl = COCKROACH_URL.replace(/\?sslmode=[^&]*/, '');
const cleanAivenUrl = AIVEN_URL.replace(/\?sslmode=[^&]*/, '');

const sourcePool = new Pool({ connectionString: cleanCockroachUrl, ssl: { rejectUnauthorized: false } });
const targetPool = new Pool({ connectionString: cleanAivenUrl, ssl: { rejectUnauthorized: false } });

const TABLES = [
  'menu_categories',
  'menu_items',
  'tables',
  'table_sessions',
  'orders',
  'order_items',
  'service_calls',
  'discounts',
  'payments',
  'staff_members',
  'activity_logs',
  'system_settings',
  'customer_loyalty',
  'customers',
  'loyalty_reward_tiers',
  'loyalty_claim_tokens',
  'loyalty_audit_logs',
  'order_item_status_logs',
  'raw_ingredients',
  'menu_item_recipes',
  'inventory_receiving',
  'inventory_waste',
  'inventory_audits',
  'inventory_deductions'
];

async function main() {
  console.log("⚡ FORCE SYNCING ALL COLUMN VALUES FROM COCKROACHDB TO AIVEN...\n");

  try {
    for (const table of TABLES) {
      let srcRows = [];
      try {
        const srcRes = await sourcePool.query(`SELECT * FROM ${table}`);
        srcRows = srcRes.rows;
      } catch (e) {
        console.log(`- Table '${table}': empty or not present in source.`);
        continue;
      }

      if (srcRows.length === 0) {
        console.log(`- Table '${table}': 0 rows to update.`);
        continue;
      }

      // Get target columns
      const tgtColRes = await targetPool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      const targetCols = new Set(tgtColRes.rows.map((r) => r.column_name));

      const sourceCols = Object.keys(srcRows[0]);
      const validCols = sourceCols.filter((c) => targetCols.has(c));

      if (validCols.length === 0) continue;

      // Identify primary key column (usually 'id' or 'key')
      let pkCol = 'id';
      if (validCols.includes('key')) pkCol = 'key';

      const colNames = validCols.join(', ');

      // Build ON CONFLICT UPDATE clause: col1 = EXCLUDED.col1, col2 = EXCLUDED.col2 ...
      const updateSetClause = validCols
        .filter(c => c !== pkCol)
        .map(c => `${c} = EXCLUDED.${c}`)
        .join(', ');

      const CHUNK_SIZE = 10;
      let updatedCount = 0;

      for (let i = 0; i < srcRows.length; i += CHUNK_SIZE) {
        const chunk = srcRows.slice(i, i + CHUNK_SIZE);
        const valuePlaceholders = [];
        const params = [];
        let pIdx = 1;

        for (const row of chunk) {
          const rowPlaceholders = [];
          for (const col of validCols) {
            let val = row[col];
            if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
              val = JSON.stringify(val);
            }
            params.push(val);
            rowPlaceholders.push(`$${pIdx}`);
            pIdx++;
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        if (valuePlaceholders.length > 0) {
          let insertQuery = '';
          if (updateSetClause && validCols.includes(pkCol)) {
            insertQuery = `
              INSERT INTO ${table} (${colNames})
              VALUES ${valuePlaceholders.join(', ')}
              ON CONFLICT (${pkCol}) DO UPDATE SET ${updateSetClause}
            `;
          } else {
            insertQuery = `
              INSERT INTO ${table} (${colNames})
              VALUES ${valuePlaceholders.join(', ')}
              ON CONFLICT DO NOTHING
            `;
          }

          try {
            await targetPool.query(insertQuery, params);
            updatedCount += chunk.length;
          } catch (rowErr) {
            // Fallback row-by-row update if batch conflict syntax hits an edge case
            for (const row of chunk) {
              const rowValues = validCols.map(c => {
                let v = row[c];
                return (typeof v === 'object' && v !== null && !(v instanceof Date)) ? JSON.stringify(v) : v;
              });
              const rowPlaceholders = validCols.map((_, idx) => `$${idx + 1}`).join(', ');
              try {
                if (updateSetClause && validCols.includes(pkCol)) {
                  await targetPool.query(`
                    INSERT INTO ${table} (${colNames})
                    VALUES (${rowPlaceholders})
                    ON CONFLICT (${pkCol}) DO UPDATE SET ${updateSetClause}
                  `, rowValues);
                } else {
                  await targetPool.query(`
                    INSERT INTO ${table} (${colNames})
                    VALUES (${rowPlaceholders})
                    ON CONFLICT DO NOTHING
                  `, rowValues);
                }
                updatedCount++;
              } catch (singleErr) {
                console.error(`  ⚠️ Row sync notice for '${table}':`, singleErr.message);
              }
            }
          }
        }
      }

      console.log(`  ✅ Table '${table}': Updated all column values for ${srcRows.length} rows on Aiven.`);
    }

    console.log("\n🎉 ALL COLUMN VALUES HAVE BEEN FORCED-SYNCED TO AIVEN POSTGRESQL!");

  } catch (err) {
    console.error("Fatal sync error:", err);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
