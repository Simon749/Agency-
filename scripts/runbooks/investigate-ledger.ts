// scripts/runbooks/investigate-ledger.ts
// PHASE 6: Investigative script — deep-dive into a tenant's ledger for audit/dispute resolution.
// Run: npx tsx scripts/runbooks/investigate-ledger.ts --tenant-id <UUID> [--reference <CODE>]

import { getDb } from "@/lib/db";
import { tenants, tenantLedger, buildings, units, pendingTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function parseArgs() {
  const args = process.argv.slice(2);
  const tenantId = args.find((_, i) => args[i - 1] === "--tenant-id");
  const reference = args.find((_, i) => args[i - 1] === "--reference");
  return { tenantId, reference };
}

async function main() {
  const { tenantId, reference } = parseArgs();

  if (!tenantId) {
    console.log(`
Usage: npx tsx scripts/runbooks/investigate-ledger.ts --tenant-id <UUID> [--reference <CODE>]

Options:
  --tenant-id    Required. The tenant UUID to investigate.
  --reference    Optional. Filter by a specific M-Pesa reference code.

Examples:
  npx tsx scripts/runbooks/investigate-ledger.ts --tenant-id 2362492e-8de5-5219-9685-d01fc2190ccb
  npx tsx scripts/runbooks/investigate-ledger.ts --tenant-id 2362492e-8de5-5219-9685-d01fc2190ccb --reference RFI392KDM
`);
    process.exit(1);
  }

  const db = getDb();
  console.log(`🔍 Ledger Investigation for Tenant: ${tenantId}
`);

  // ── 1. Tenant Info ──
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    console.error("❌ Tenant not found");
    process.exit(1);
  }

  const [building] = await db
    .select({ name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId))
    .limit(1);

  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, tenant.unitId))
    .limit(1);

  console.log("👤 Tenant Profile:");
  console.log("─".repeat(60));
  console.log(`  Name:        ${tenant.fullName}`);
  console.log(`  Phone:       ${tenant.phone}`);
  console.log(`  Email:       ${tenant.email ?? "N/A"}`);
  console.log(`  Status:      ${tenant.status}`);
  console.log(`  Building:    ${building?.name ?? "N/A"}`);
  console.log(`  Unit:        ${unit?.unitNumber ?? "N/A"}`);
  console.log(`  Invite:      ${tenant.inviteStatus}`);
  console.log();

  // ── 2. Ledger Entries ──
  const conditions = [eq(tenantLedger.tenantId, tenantId)];
  if (reference) {
    console.log(`📋 Filtering by reference: ${reference}
`);
    // Note: referenceCode is on tenantLedger, not a direct condition in this query structure
    // We'll filter in JS for simplicity in this script
  }

  const entries = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId))
    .orderBy(tenantLedger.createdAt);

  const filteredEntries = reference
    ? entries.filter((e) => e.referenceCode === reference)
    : entries;

  console.log(`📒 Ledger Entries (${filteredEntries.length} total):`);
  console.log("─".repeat(60));

  let runningBalance = 0;
  filteredEntries.forEach((entry, i) => {
    const amount = Number(entry.amount);
    const delta = entry.type === "DEBIT" ? amount : -amount;
    runningBalance += delta;

    const ref = entry.referenceCode ? ` [${entry.referenceCode}]` : "";
    const method = entry.method ? ` (${entry.method})` : "";

    console.log(
      `  ${i + 1}. ${entry.type.padEnd(6)} KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2 }).padStart(12)}${ref}${method}`
    );
    console.log(`      ${entry.description}`);
    console.log(`      ${entry.createdAt.toISOString()} | Running: KES ${runningBalance.toLocaleString("en-KE")}`);
    console.log();
  });

  // ── 3. Balance Summary ──
  const totalDebit = filteredEntries
    .filter((e) => e.type === "DEBIT")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = filteredEntries
    .filter((e) => e.type === "CREDIT")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = totalDebit - totalCredit;

  console.log("💰 Balance Summary:");
  console.log("─".repeat(60));
  console.log(`  Total Charged (DEBIT):  KES ${totalDebit.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`);
  console.log(`  Total Paid (CREDIT):    KES ${totalCredit.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Current Balance:        KES ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`);
  console.log(`  Status:                 ${balance > 0 ? "🔴 IN ARREARS" : balance < 0 ? "🟢 OVERPAID" : "✅ CURRENT"}`);
  console.log();

  // ── 4. Pending Transactions ──
  const pending = await db
    .select()
    .from(pendingTransactions)
    .where(eq(pendingTransactions.tenantId, tenantId))
    .orderBy(pendingTransactions.initiatedAt);

  if (pending.length > 0) {
    console.log(`⏳ Pending Transactions (${pending.length}):`);
    console.log("─".repeat(60));
    pending.forEach((p) => {
      const age = Math.floor((Date.now() - new Date(p.initiatedAt).getTime()) / (1000 * 60 * 60));
      console.log(`  ${p.status} | KES ${Number(p.amount).toLocaleString("en-KE")} | ${age}h ago | ${p.checkoutRequestId}`);
    });
    console.log();
  }

  // ── 5. Duplicate Check ──
  const refs = filteredEntries.map((e) => e.referenceCode).filter(Boolean);
  const duplicates = refs.filter((item, index) => refs.indexOf(item) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    console.log("⚠️  DUPLICATE REFERENCE CODES DETECTED:");
    console.log("─".repeat(60));
    uniqueDuplicates.forEach((ref) => {
      console.log(`  ${ref} appears ${refs.filter((r) => r === ref).length} times`);
    });
    console.log();
  }

  console.log("✅ Investigation complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Investigation failed:", err);
  process.exit(1);
});
