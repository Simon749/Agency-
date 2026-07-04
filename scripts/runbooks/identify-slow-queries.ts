// scripts/runbooks/identify-slow-queries.ts
// PHASE 6: Investigative script — identifies slow queries and missing indexes.
// Run: npx tsx scripts/runbooks/identify-slow-queries.ts

import { getDb } from "@/lib/db";
import { sql, Table } from "drizzle-orm";

interface SlowQuery {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  rows: number;
}

interface MissingIndex {
  table: string;
  column: string;
  indexScore: number;
}

async function main() {
  const db = getDb();
  console.log("🔍 PropFlow Slow Query Investigator");

  // ── 1. Top 10 slowest queries (from pg_stat_statements) ──
  console.log("📊 Top 10 Slowest Queries (last 24h):");
  console.log("─".repeat(80));

  try {
    const slowQueries = await db.execute(sql`
      SELECT
        query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        rows
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%'
      ORDER BY total_exec_time DESC
      LIMIT 10
    `);

    const rows = (slowQueries as any).rows ?? [];
    if (rows.length === 0) {
      console.log("  pg_stat_statements not enabled. Enable with:");
      console.log("  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
      console.log("  # Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'");
    } else {
      rows.forEach((row: any, i: number) => {
        const query = (row.query as string).slice(0, 60).replace(/\s+/g, " ");
        console.log(`  ${i + 1}. ${query}...`);
        console.log(`     Calls: ${row.calls} | Total: ${Number(row.total_time).toFixed(2)}ms | Mean: ${Number(row.mean_time).toFixed(2)}ms | Rows: ${row.rows}`);
      });
    }
  } catch (err) {
    console.log("  Could not query pg_stat_statements:", (err as Error).message);
  }

  // ── 2. Missing index recommendations ──
  console.log("📋 Missing Index Recommendations:");
  console.log("─".repeat(80));

  const indexChecks = [
    { table: "tenant_ledger", column: "tenant_id", name: "idx_tenant_ledger_tenant_id" },
    { table: "tenant_ledger", column: "agency_id", name: "idx_tenant_ledger_agency_id" },
    { table: "tenant_ledger", column: "created_at", name: "idx_tenant_ledger_created_at" },
    { table: "tenant_ledger", column: "reference_code", name: "idx_tenant_ledger_reference_code" },
    { table: "pending_transactions", column: "checkout_request_id", name: "idx_pending_tx_checkout_id" },
    { table: "pending_transactions", column: "tenant_id", name: "idx_pending_tx_tenant_id" },
    { table: "tenants", column: "clerk_user_id", name: "idx_tenants_clerk_user_id" },
    { table: "tenants", column: "agency_id", name: "idx_tenants_agency_id" },
    { table: "buildings", column: "agency_id", name: "idx_buildings_agency_id" },
    { table: "buildings", column: "daraja_shortcode", name: "idx_buildings_shortcode" },
    { table: "units", column: "building_id", name: "idx_units_building_id" },
    { table: "complaints", column: "tenant_id", name: "idx_complaints_tenant_id" },
  ];

  for (const check of indexChecks) {
    try {
      const result = await db.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = ${check.table} AND indexname = ${check.name}
      `);
      const exists = ((result as any).rows ?? []).length > 0;
      console.log(`  ${exists ? "✅" : "❌"} ${check.name} ON ${check.table}(${check.column})`);
      if (!exists) {
        console.log(`     Suggested: CREATE INDEX ${check.name} ON ${check.table}(${check.column});`);
      }
    } catch (err) {
      console.log(`  ⚠️ Could not check ${check.name}:`, (err as Error).message);
    }
  }

  // ── 3. Table sizes ──
  console.log("💾 Table Sizes:");
  console.log("─".repeat(80));

  const tableSizes = await db.execute(sql`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_total_relation_size(relid) as bytes
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 10
  `);

  const sizeRows = (tableSizes as any).rows ?? [];
  sizeRows.forEach((row: any) => {
    console.log(`  ${row.table_name}: ${row.total_size}`);
  });

  // ── 4. Connection count ──
  console.log("🔌 Current Connections:");
  console.log("─".repeat(80));

  const connections = await db.execute(sql`
    SELECT count(*) as count, state
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
  `);

  const connRows = (connections as any).rows ?? [];
  connRows.forEach((row: any) => {
    console.log(`  ${row.state ?? "unknown"}: ${row.count}`);
  });

  console.log("✅ Investigation complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Investigation failed:", err);
  process.exit(1);
});
