// scripts/backfillSnapshots.ts
//
// One-off backfill: write an initial balance_snapshot for every existing
// tenant, then verify each one matches full-history balance exactly.
// Do not switch getTenantBalance() over in production until mismatches = 0.
//
// Run with: npx tsx scripts/backfillSnapshots.ts

import { getDb } from "@/lib/db";
import { tenants } from "@/db/schema";
import { writeBalanceSnapshot } from "@/lib/ledger/writeBalanceSnapshot";
import { verifyBalanceMatchesFullHistory } from "@/lib/ledger/getBalance";

async function main() {
  const db = getDb();
  const allTenants = await db.select({ id: tenants.id }).from(tenants);

  const asOfMonth = new Date().toISOString().slice(0, 7);
  let ok = 0;
  const mismatches: string[] = [];
  const errors: string[] = [];

  for (const t of allTenants) {
    try {
      const snap = await writeBalanceSnapshot(t.id, asOfMonth);
      if (!snap) continue; // no ledger rows yet — nothing to backfill

      const verification = await verifyBalanceMatchesFullHistory(t.id);
      if (verification.matches) {
        ok++;
      } else {
        mismatches.push(
          `${t.id}: snapshot=${verification.snapshotBalance} full=${verification.fullHistoryBalance}`
        );
      }
    } catch (err) {
      errors.push(`${t.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`Backfilled ${ok}/${allTenants.length} tenants successfully.`);
  if (mismatches.length) {
    console.error(`MISMATCHES (do not ship until this is empty):`);
    mismatches.forEach((m) => console.error("  " + m));
  }
  if (errors.length) {
    console.error(`ERRORS:`);
    errors.forEach((e) => console.error("  " + e));
  }

  process.exit(mismatches.length || errors.length ? 1 : 0);
}

main();