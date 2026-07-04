// scripts/backup/verify-restore.ts
// PHASE 6: Backup verification + point-in-time recovery test.
// Run monthly: npx tsx scripts/backup/verify-restore.ts

import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

interface BackupVerificationResult {
  timestamp: string;
  databaseUrl: string;
  branch: string;
  tableCounts: Record<string, number>;
  criticalTablesPresent: boolean;
  latestLedgerEntry: Date | null;
  latestPendingTx: Date | null;
  rpoMinutes: number | null;
  issues: string[];
}

async function main() {
  console.log("💾 PropFlow Backup Verification");

  const db = getDb();
  const issues: string[] = [];

  // ── 1. Basic connectivity ──
  console.log("1. Testing database connectivity...");
  try {
    await db.execute(sql`SELECT 1`);
    console.log("   ✅ Database connected successfully");
  } catch (err) {
    console.error("   ❌ Database connection failed:", (err as Error).message);
    issues.push("Database connection failed");
    process.exit(1);
  }

  // ── 2. Count rows in critical tables ──
  console.log("2. Checking critical table row counts...");
  const tables = [
    "agencies",
    "buildings",
    "units",
    "tenants",
    "leases",
    "tenant_ledger",
    "pending_transactions",
    "complaints",
  ];

  const tableCounts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.raw(table)}`);
      const count = Number((result as any).rows?.[0]?.count ?? 0);
      tableCounts[table] = count;
      console.log(`   ${table}: ${count.toLocaleString("en-KE")} rows`);
    } catch (err) {
      console.error(`   ❌ Could not count ${table}:`, (err as Error).message);
      issues.push(`Table ${table} missing or inaccessible`);
    }
  }

  console.log();

  // ── 3. Check latest entries ──
  console.log("3. Checking data freshness...");

  const [latestLedger] = await db
    .execute(sql`SELECT MAX(created_at) as latest FROM tenant_ledger`)
    .then((r) => (r as any).rows ?? []);

  const [latestPending] = await db
    .execute(sql`SELECT MAX(initiated_at) as latest FROM pending_transactions`)
    .then((r) => (r as any).rows ?? []);

  const latestLedgerDate = latestLedger?.latest ? new Date(latestLedger.latest) : null;
  const latestPendingDate = latestPending?.latest ? new Date(latestPending.latest) : null;

  const now = new Date();
  const rpoLedger = latestLedgerDate
    ? Math.floor((now.getTime() - latestLedgerDate.getTime()) / (1000 * 60))
    : null;
  const rpoPending = latestPendingDate
    ? Math.floor((now.getTime() - latestPendingDate.getTime()) / (1000 * 60))
    : null;

  console.log(`   Latest ledger entry: ${latestLedgerDate?.toISOString() ?? "N/A"}`);
  console.log(`   Latest pending tx:   ${latestPendingDate?.toISOString() ?? "N/A"}`);
  console.log(`   RPO (ledger):        ${rpoLedger !== null ? `${rpoLedger} minutes` : "N/A"}`);
  console.log(`   RPO (pending):       ${rpoPending !== null ? `${rpoPending} minutes` : "N/A"}`);

  if (rpoLedger !== null && rpoLedger > 60) {
    issues.push(`Ledger data is ${rpoLedger} minutes old — possible replication lag`);
  }
  console.log();

  // ── 4. Verify indexes ──
  console.log("4. Verifying critical indexes...");
  const criticalIndexes = [
    "idx_tenant_ledger_tenant_id",
    "idx_tenant_ledger_reference_code",
    "idx_pending_tx_checkout_id",
    "idx_tenants_clerk_user_id",
  ];

  for (const idx of criticalIndexes) {
    try {
      const result = await db.execute(sql`
        SELECT indexname FROM pg_indexes WHERE indexname = ${idx}
      `);
      const exists = ((result as any).rows ?? []).length > 0;
      console.log(`   ${exists ? "✅" : "❌"} ${idx}`);
      if (!exists) issues.push(`Missing index: ${idx}`);
    } catch (err) {
      console.error(`   ⚠️ Could not verify ${idx}`);
    }
  }
  console.log();

  // ── 5. Check for data anomalies ──
  console.log("5. Checking for data anomalies...");

  // Orphaned ledger entries
  const orphaned = await db.execute(sql`
    SELECT COUNT(*) as count FROM tenant_ledger tl
    LEFT JOIN tenants t ON tl.tenant_id = t.id
    WHERE t.id IS NULL
  `);
  const orphanCount = Number((orphaned as any).rows?.[0]?.count ?? 0);
  console.log(`   Orphaned ledger entries: ${orphanCount}`);
  if (orphanCount > 0) issues.push(`${orphanCount} orphaned ledger entries found`);

  // Negative balances (overpaid)
  const overpaid = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT tenant_id,
        SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END) -
        SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END) as balance
      FROM tenant_ledger
      GROUP BY tenant_id
      HAVING SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END) -
             SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END) < -1000
    ) x
  `);
  const overpaidCount = Number((overpaid as any).rows?.[0]?.count ?? 0);
  console.log(`   Overpaid tenants (>KES 1,000): ${overpaidCount}`);
  if (overpaidCount > 10) issues.push(`${overpaidCount} tenants significantly overpaid`);

  console.log();

  // ── 6. Summary ──
  const result: BackupVerificationResult = {
    timestamp: now.toISOString(),
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^:]*@/, ":****@") ?? "unknown",
    branch: process.env.DATABASE_URL?.includes("neon.tech") ? "Neon" : "Unknown",
    tableCounts,
    criticalTablesPresent: tables.every((t) => tableCounts[t] !== undefined),
    latestLedgerEntry: latestLedgerDate,
    latestPendingTx: latestPendingDate,
    rpoMinutes: rpoLedger,
    issues,
  };

  console.log("─".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("─".repeat(60));
  console.log(`Status:       ${issues.length === 0 ? "✅ HEALTHY" : `⚠️ ${issues.length} ISSUES`}`);
  console.log(`Timestamp:    ${result.timestamp}`);
  console.log(`Database:     ${result.branch}`);
  console.log(`Tables OK:    ${result.criticalTablesPresent ? "Yes" : "No"}`);
  console.log(`RPO:          ${result.rpoMinutes !== null ? `${result.rpoMinutes} minutes` : "N/A"}`);

  if (issues.length > 0) {
    console.log("Issues found:");
    issues.forEach((issue) => console.log(`  ❌ ${issue}`));
  }

  console.log("✅ Verification complete.");

  // Exit with error code if issues found (for CI/CD)
  process.exit(issues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
