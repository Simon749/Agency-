// app/api/agent/sync/meter-reading/route.ts
// PHASE 7: API endpoint for syncing queued meter readings from IndexedDB.
// This is a regular API route (not Server Action) so the SW/client can reach it.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { submitMeterReading } from "@/lib/ledger/utilityBilling";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionMeta();
    if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      buildingId,
      unitId,
      utilityType,
      previousReading,
      currentReading,
      ratePerUnit,
      billingMonth,
      agentClerkId,
    } = body;

    if (!buildingId || !unitId || !utilityType || !billingMonth || !agentClerkId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (currentReading < previousReading) {
      return NextResponse.json(
        { error: "Current reading cannot be less than previous reading" },
        { status: 400 }
      );
    }

    const result = await submitMeterReading({
      unitId,
      buildingId,
      agencyId: session.agencyId!,
      agentClerkId,
      utilityType,
      previousReading,
      currentReading,
      ratePerUnit,
      billingMonth,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[Sync Meter Reading] Error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}