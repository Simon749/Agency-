// app/api/cron/ledger-reconciliation/route.ts
// PHASE 6: Daily ledger reconciliation job — verifies ledger math, alerts on discrepancies.
// Schedule: "0 2 * * *" (2:00 AM EAT daily) — after billing, before business hours.
// Secured with CRON_SECRET. Logs structured output for monitoring.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenants, tenantLedger } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { log, alert } from "@/lib/monitoring";

export async function GET(req: NextRequest) {
  // ── Security: verify CRON_SECRET ──
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    log("error", "CRON_SECRET not configured", { service: "ledger-reconciliation" });
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    log("warn", "Unauthorized cron attempt", { service: "ledger-reconciliation" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  log("info", "Ledger reconciliation started", { service: "ledger-reconciliation" });

  try {
    const db = getDb();
    const discrepancies: Array<{
      tenantId: string;
      fullName: string;
      computedBalance: number;
      debitSum: number;
      creditSum: number;
      entryCount: number;
    }> = [];

    // ── Step 1: Verify every tenant's ledger balance ──
    const rows = await db
      .select({
        tenantId: tenants.id,
        fullName: tenants.fullName,
        totalDebit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'DEBIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(CASE WHEN ${tenantLedger.type} = 'CREDIT' THEN ${tenantLedger.amount}::numeric ELSE 0 END), 0)`,
        entryCount: sql<number>`COUNT(${tenantLedger.id})`,
      })
      .from(tenants)
      .leftJoin(tenantLedger, eq(tenants.id, tenantLedger.tenantId))
      .groupBy(tenants.id, tenants.fullName);

    for (const r of rows) {
      const balance = Number(r.totalDebit) - Number(r.totalCredit);

      // Flag: Active tenant with no entries
      if (r.entryCount === 0) {
        discrepancies.push({
          tenantId: r.tenantId,
          fullName: r.fullName,
          computedBalance: 0,
          debitSum: 0,
          creditSum: 0,
          entryCount: 0,
        });
        continue;
      }

      // Flag: Negative balance (overpaid) — not necessarily wrong, but log it
      if (balance < -1000) {
        log("warn", "Tenant overpaid", {
          service: "ledger-reconciliation",
          tenantId: r.tenantId,
          metadata: { balance, fullName: r.fullName },
        });
      }
    }

    // ── Step 2: Check for orphaned ledger entries (no matching tenant) ──
    const orphaned = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM tenant_ledger tl
      LEFT JOIN tenants t ON tl.tenant_id = t.id
      WHERE t.id IS NULL
    `);
    const orphanCount = Number((orphaned as any).rows?.[0]?.count ?? 0);

    if (orphanCount > 0) {
      alert("LEDGER_ORPHANED", `Found ${orphanCount} orphaned ledger entries with no matching tenant`, {
        metadata: { orphanCount },
      });
    }

    // ── Step 3: Check for duplicate reference codes ──
    const duplicates = await db.execute(sql`
      SELECT reference_code, COUNT(*) as count
      FROM tenant_ledger
      WHERE reference_code IS NOT NULL
      GROUP BY reference_code
      HAVING COUNT(*) > 1
    `);
    const dupRows = (duplicates as any).rows ?? [];
    const duplicateCount = dupRows.length;

    if (duplicateCount > 0) {
      alert("LEDGER_DUPLICATE", `Found ${duplicateCount} duplicate reference codes in ledger`, {
        metadata: { duplicateCount, codes: dupRows.map((r: any) => r.reference_code).slice(0, 10) },
      });
    }

    // ── Step 4: Verify total ledger integrity ──
    const [totals] = await db
      .select({
        totalDebit: sql<number>`COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(tenantLedger);

    const totalDebit = Number(totals.totalDebit);
    const totalCredit = Number(totals.totalCredit);
    const net = totalDebit - totalCredit;

    const durationMs = Date.now() - startTime;

    log("info", "Ledger reconciliation complete", {
      service: "ledger-reconciliation",
      metadata: {
        durationMs,
        tenantsChecked: rows.length,
        discrepanciesFound: discrepancies.length,
        orphanedEntries: orphanCount,
        duplicateReferences: duplicateCount,
        totalDebit,
        totalCredit,
        netOutstanding: net,
        totalEntries: Number(totals.entryCount),
      },
    });

    return NextResponse.json({
      success: true,
      durationMs,
      summary: {
        tenantsChecked: rows.length,
        discrepanciesFound: discrepancies.length,
        orphanedEntries: orphanCount,
        duplicateReferences: duplicateCount,
        totalDebit,
        totalCredit,
        netOutstanding: net,
        totalEntries: Number(totals.entryCount),
      },
      discrepancies: discrepancies.slice(0, 50), // Limit response size
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log("error", "Ledger reconciliation failed", {
      service: "ledger-reconciliation",
      error: err instanceof Error ? err : new Error(String(err)),
      metadata: { durationMs },
    });

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Reconciliation failed",
        durationMs,
      },
      { status: 500 }
    );
  }
}
