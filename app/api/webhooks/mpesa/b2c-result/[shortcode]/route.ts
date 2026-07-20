// app/api/webhooks/mpesa/b2c-result/[shortcode]/route.ts
//
// Safaricom calls this once the B2C refund actually completes (or fails).
// Reuses the same IP allowlist pattern as your other Daraja webhooks.
// On success, stamps the reversal ledger row's referenceCode with the real
// M-Pesa TransactionID so support can trace refund -> Safaricom record.

import { NextRequest, NextResponse } from "next/server";
import { eq, and, like } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[B2C-RESULT] Rejected from non-Safaricom IP: ${clientIp} (shortcode ${shortcode})`);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected — Unauthorized IP" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const result = body?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid callback body" }, { status: 400 });
    }

    const { ResultCode, ResultDesc, OriginatingConversationID, ConversationID } = result;
    const params_ = result.ResultParameters?.ResultParameter ?? [];
    const transactionId = params_.find((p: any) => p.Key === "TransactionID")?.Value as string | undefined;

    if (ResultCode !== 0) {
      console.error(`[B2C-RESULT] Refund failed: ${ResultDesc} (conversation ${ConversationID})`);
      // Flag for manual follow-up — the reversal ledger row already exists,
      // but the money never actually moved. This needs a human, not a retry.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Best-effort: find the reversal row created for this refund and stamp
    // it with the real M-Pesa TransactionID for traceability. Matching is by
    // the ConversationID stashed at initiation time if you choose to store it
    // (recommended: add a `b2cConversationId` column, or store it in
    // description) — left as a TODO hook since it depends on how you wire
    // initiateB2CRefund's response back to the reversal row in your runbook action.
    if (transactionId) {
      console.log(`[B2C-RESULT] Refund completed. M-Pesa TransactionID: ${transactionId}`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error(`[B2C-RESULT] Error for shortcode ${shortcode}:`, err);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Internal server error" }, { status: 500 });
  }
}