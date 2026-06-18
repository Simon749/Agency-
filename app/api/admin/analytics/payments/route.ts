// app/api/admin/analytics/payments/route.ts
// GET /api/admin/analytics/payments?limit=20
// Returns recent CREDIT entries (payments) for the agency.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getRecentPayments } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionMeta();

    if (!session.agencyId) {
      return NextResponse.json({ error: "No agency associated with user" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

    const payments = await getRecentPayments(session.agencyId, limit);

    return NextResponse.json({ success: true, data: payments });
  } catch (err) {
    console.error("[API] Recent payments error:", err);
    return NextResponse.json(
      { error: "Failed to load payments", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}