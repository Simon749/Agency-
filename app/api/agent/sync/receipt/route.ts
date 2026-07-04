// app/api/agent/sync/receipt/route.ts
// PHASE 7: API endpoint for syncing queued receipts from IndexedDB.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { logManualPayment } from "@/lib/ledger/manualPayments";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionMeta();
    if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      buildingId,
      tenantId,
      amount,
      method,
      referenceCode,
      billingMonth,
      description,
      recordedBy,
      receiptPhotoBase64,
    } = body;

    if (!buildingId || !tenantId || !amount || !method || !billingMonth || !recordedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // TODO: If receiptPhotoBase64 is provided, upload to Vercel Blob/Cloudinary
    // and pass the URL to logManualPayment. For now, ignore the photo in sync.
    if (receiptPhotoBase64) {
      console.log("[Sync Receipt] Photo present but not yet handled in sync");
    }

    const result = await logManualPayment({
      tenantId,
      buildingId,
      agencyId: session.agencyId!,
      amount,
      method,
      referenceCode: referenceCode || null,
      description: description || `${method} payment — ${billingMonth}`,
      billingMonth,
      recordedBy,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.warning || "Failed to log payment" }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[Sync Receipt] Error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}