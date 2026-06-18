// app/api/admin/analytics/arrears/route.ts
// GET /api/admin/analytics/arrears?buildingId=xxx&sortBy=amount&sortOrder=desc
// Returns all tenants with outstanding balance > 0.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getArrearsReport } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionMeta();

    if (!session.agencyId) {
      return NextResponse.json({ error: "No agency associated with user" }, { status: 403 });
    }

    const url = new URL(req.url);
    const buildingId = url.searchParams.get("buildingId") ?? undefined;
    const sortBy = (url.searchParams.get("sortBy") as "amount" | "days") ?? "amount";
    const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") ?? "desc";
    const minBalance = parseFloat(url.searchParams.get("minBalance") ?? "0");

    const arrears = await getArrearsReport(session.agencyId, {
      buildingId,
      sortBy,
      sortOrder,
      minBalance,
    });

    return NextResponse.json({ success: true, data: arrears });
  } catch (err) {
    console.error("[API] Arrears report error:", err);
    return NextResponse.json(
      { error: "Failed to load arrears", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}