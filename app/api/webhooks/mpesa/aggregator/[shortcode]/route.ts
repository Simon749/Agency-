//app/api/webhooks/mpesa/aggregator/[shortcode]/route.ts
//
// SECURITY FIX (Phase 0 audit): this route previously had NO verification
// at all — no IP allowlist, no callback key — while inserting real CREDIT
// ledger entries (i.e. marking rent as paid) from whatever the request
// body claimed. Anyone who could guess a valid BillRefNumber could forge
// a "payment received" for any tenant. Matched to the same pattern already
// used correctly in ../[shortcode]/route.ts and ../b2c-result/[shortcode]/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions } from "@/db/schema";
import { resolveAggregatorPayment } from "@/lib/payments/aggregator-router";
import { eq } from "drizzle-orm";
import { dispatchNotification } from "@/lib/notifications/channel-router";

const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const { shortcode } = await params;

  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[AGGREGATOR] Rejected callback from non-Safaricom IP: ${clientIp} for shortcode ${shortcode}`);
    return NextResponse.json({ ResultCode: "1", ResultDesc: "Rejected — Unauthorized IP" }, { status: 403 });
  }

  const callbackKey = req.headers.get("x-callback-key");
  const expectedKey = process.env.DARAJA_CALLBACK_KEY;
  if (expectedKey && callbackKey !== expectedKey) {
    console.warn(`[AGGREGATOR] Invalid callback key from ${clientIp} for shortcode ${shortcode}`);
    return NextResponse.json({ ResultCode: "1", ResultDesc: "Rejected — Invalid callback key" }, { status: 403 });
  }

  const body = await req.json();
  
  // Safaricom C2B confirmation payload structure
  const {
    TransID,
    TransTime,
    TransAmount,
    BusinessShortCode,
    BillRefNumber,
    MSISDN,
    ResultCode,
    ResultDesc,
  } = body;

  // Only process successful transactions
  if (ResultCode !== "0") {
    return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
  }

  // Resolve the payment to a tenant
  const resolution = await resolveAggregatorPayment(BillRefNumber, shortcode);
  
  if (!resolution) {
    console.warn(`[Aggregator] Unresolved payment: ref=${BillRefNumber}, shortcode=${shortcode}`);
    // Still return 200 to Safaricom so they don't retry
    return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
  }

  if (!resolution.isActive) {
    console.warn(`[Aggregator] Payment for vacated tenant: ${resolution.tenantId}`);
  }

  const db = getDb();

  // Idempotency: check if this TransID already exists
  const [existing] = await db
    .select({ id: tenantLedger.id })
    .from(tenantLedger)
    .where(eq(tenantLedger.referenceCode, TransID))
    .limit(1);

  if (existing) {
    return NextResponse.json({ ResultCode: "0", ResultDesc: "Duplicate accepted" });
  }

  // Insert CREDIT into ledger
  await db.insert(tenantLedger).values({
    tenantId: resolution.tenantId,
    buildingId: resolution.buildingId,
    agencyId: resolution.agencyId,
    type: "CREDIT",
    category: "RENT",
    amount: String(TransAmount),
    method: "MPESA_STK",
    referenceCode: TransID,
    description: `M-Pesa Paybill ${TransID}`,
    billingMonth: formatBillingMonth(TransTime),
  });

  // Notify tenant
  await dispatchNotification({
    userId: resolution.tenantId, // Actually we need clerkUserId, not tenantId. Hmm.
    agencyId: resolution.agencyId,
    phone: MSISDN,
    message: `Confirmed. KES ${TransAmount} received. Ref: ${TransID}.`,
    templateName: "payment_received",
    templateParams: { amount: TransAmount, month: formatBillingMonth(TransTime), code: TransID },
    type: "PAYMENT",
  }).catch(console.error);

  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}

function formatBillingMonth(transTime: string): string {
  // TransTime format: "20260727123045"
  if (!transTime || transTime.length < 6) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${transTime.slice(0, 4)}-${transTime.slice(4, 6)}`;
}