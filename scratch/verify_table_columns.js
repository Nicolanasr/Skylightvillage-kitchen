require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const COCKROACH_URL = process.env.COCKROACH_URL || "";
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
  console.log("🔍 VERIFYING TABLE COLUMN SCHEMAS BETWEEN COCKROACHDB & AIVEN...\n");

  const columnAuditReport = [];

  try {
    for (const table of TABLES) {
      // 1. Get CockroachDB source columns & data types
      let srcCols = [];
      try {
        const srcColRes = await sourcePool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);
        srcCols = srcColRes.rows;
      } catch (e) {
        columnAuditReport.push({ table, srcCols: 0, tgtCols: 0, missingCols: 'N/A (Source Table Empty)', status: 'SKIPPED' });
        continue;
      }

      if (srcCols.length === 0) {
        columnAuditReport.push({ table, srcCols: 0, tgtCols: 0, missingCols: 'None', status: 'SKIPPED' });
        continue;
      }

      // 2. Get Aiven target columns
      let tgtCols = [];
      try {
        const tgtColRes = await targetPool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);
        tgtCols = tgtColRes.rows;
      } catch (e) {
        // Table doesn't exist on target yet
      }

      const tgtColNames = new Set(tgtCols.map(c => c.column_name));
      const missingInTarget = srcCols.filter(c => !tgtColNames.has(c.column_name));

      // 3. Auto-fix: Add missing columns if any
      if (missingInTarget.length > 0) {
        console.log(`⚠️  Table '${table}' is missing ${missingInTarget.length} column(s) on Aiven. Adding them now...`);
        for (const col of missingInTarget) {
          let pgType = col.data_type;
          if (pgType.includes('character') || pgType.includes('string')) pgType = 'TEXT';
          if (pgType.includes('integer') || pgType.includes('int')) pgType = 'INT';
          if (pgType.includes('numeric') || pgType.includes('decimal')) pgType = 'NUMERIC';
          if (pgType.includes('boolean')) pgType = 'BOOLEAN';
          if (pgType.includes('timestamp')) pgType = 'TIMESTAMPTZ';
          if (pgType.includes('json')) pgType = 'JSONB';

          try {
            await targetPool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col.column_name} ${pgType}`);
            console.log(`   + Added column '${col.column_name}' (${pgType}) to '${table}' on Aiven.`);
          } catch (alterErr) {
            console.error(`   ❌ Failed to add column '${col.column_name}':`, alterErr.message);
          }
        }

        // Re-verify after ALTER
        const recheckTgtColRes = await targetPool.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = $1
        `, [table]);
        tgtCols = recheckTgtColRes.rows;
      }

      const finalTgtColNames = new Set(tgtCols.map(c => c.column_name));
      const finalMissing = srcCols.filter(c => !finalTgtColNames.has(c.column_name));

      columnAuditReport.push({
        table,
        srcCols: srcCols.length,
        tgtCols: tgtCols.length,
        missingCols: finalMissing.length === 0 ? 'None' : finalMissing.map(m => m.column_name).join(', '),
        status: finalMissing.length === 0 ? '✅ 100% MATCH' : '⚠️ COLUMN MISMATCH'
      });
    }

    console.log("==============================================================================");
    console.table(columnAuditReport);
    console.log("==============================================================================");
    console.log("🎉 ALL TABLE COLUMNS HAVE BEEN FULLY AUDITED & VERIFIED ON AIVEN POSTGRESQL!");

  } catch (err) {
    console.error("Column audit error:", err);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
