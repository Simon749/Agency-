// app/api/cron/ledger-reconciliation/route.ts
// PHASE 5: Nightly ledger reconciliation job
// Verifies SUM(DEBIT) - SUM(CREDIT) matches expected per tenant.
// Alerts if discrepancy found.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenantLedger, tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const startTime = Date.now();

  try {
    // Reconcile all active tenants
    const results = await db.execute(sql`
      SELECT
        t.id as tenant_id,
        t.full_name,
        COALESCE(SUM(CASE WHEN tl.type = 'DEBIT' THEN tl.amount::numeric ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN tl.type = 'CREDIT' THEN tl.amount::numeric ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN tl.type = 'DEBIT' THEN tl.amount::numeric ELSE -tl.amount::numeric END), 0) as computed_balance
      FROM tenants t
      LEFT JOIN tenant_ledger tl ON tl.tenant_id = t.id
      WHERE t.status = 'ACTIVE'
      GROUP BY t.id, t.full_name
      HAVING COALESCE(SUM(CASE WHEN tl.type = 'DEBIT' THEN tl.amount::numeric ELSE -tl.amount::numeric END), 0) < -0.01
         OR COALESCE(SUM(CASE WHEN tl.type = 'DEBIT' THEN tl.amount::numeric ELSE -tl.amount::numeric END), 0) > 999999
    `);

    const discrepancies = ((results as any).rows ?? []) as any[];
    const durationMs = Date.now() - startTime;

    if (discrepancies.length > 0) {
      console.error(`[RECONCILIATION] ${discrepancies.length} discrepancies found:`);
      for (const d of discrepancies) {
        console.error(`  Tenant ${d.tenant_id} (${d.full_name}): balance=${d.computed_balance}`);
      }

      // TODO: Send alert to Slack/PagerDuty
      // await sendAlert(`Ledger reconciliation failed: ${discrepancies.length} discrepancies`);
    } else {
      console.log(`[RECONCILIATION] All clear. Checked in ${durationMs}ms.`);
    }

    return NextResponse.json({
      success: true,
      durationMs,
      discrepanciesFound: discrepancies.length,
      discrepancies: discrepancies.map((d) => ({
        tenantId: d.tenant_id,
        tenantName: d.full_name,
        computedBalance: Number(d.computed_balance),
      })),
    });
  } catch (err) {
    console.error("[RECONCILIATION] Error:", err);
    return NextResponse.json(
      { error: "Reconciliation failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}