// app/api/admin/analytics/summary/route.ts
// GET /api/admin/analytics/summary?month=2026-06
// Returns dashboard KPIs scoped to the authenticated agency owner.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDashboardSummary } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionMeta();

    if (!session.agencyId) {
      return NextResponse.json({ error: "No agency associated with user" }, { status: 403 });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month") ?? undefined;

    const summary = await getDashboardSummary(session.agencyId, month);

    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    console.error("[API] Analytics summary error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}