// app/api/admin/analytics/buildings/route.ts
// GET /api/admin/analytics/buildings?month=2026-06&locale=Westlands
// Returns per-building financial breakdown.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getBuildingBreakdown } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionMeta();

    if (!session.agencyId) {
      return NextResponse.json({ error: "No agency associated with user" }, { status: 403 });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month") ?? undefined;
    const locale = url.searchParams.get("locale") ?? undefined;

    let breakdown = await getBuildingBreakdown(session.agencyId, month);

    if (locale) {
      breakdown = breakdown.filter((b) => b.locale?.toLowerCase() === locale.toLowerCase());
    }

    return NextResponse.json({ success: true, data: breakdown });
  } catch (err) {
    console.error("[API] Building breakdown error:", err);
    return NextResponse.json(
      { error: "Failed to load building breakdown", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}