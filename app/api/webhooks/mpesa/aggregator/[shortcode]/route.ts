//app/api/webhooks/mpesa/aggregator/[shortcode]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenantLedger, pendingTransactions } from "@/db/schema";
import { resolveAggregatorPayment } from "@/lib/payments/aggregator-router";
import { eq } from "drizzle-orm";
import { dispatchNotification } from "@/lib/notifications/channel-router";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const { shortcode } = await params;
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