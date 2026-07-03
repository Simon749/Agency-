// app/api/webhooks/mpesa/[shortcode]/route.ts
// PHASE 4 HARDENED: Transaction-wrapped, non-blocking SMS, dedup cache,
// IP allowlist, X-Callback-Key verification.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pendingTransactions, tenantLedger } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPendingTransaction } from "@/lib/ledger";
import { sendPaymentReceivedSms, sendPaymentFailedSms } from "@/lib/sms/triggers";
import type { StkCallbackBody } from "@/lib/daraja/types";

const processedCallbacks = new Map<string, number>();
const CALLBACK_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

// Safaricom Daraja IP ranges
const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

function isDuplicateCallback(checkoutRequestId: string): boolean {
  const lastSeen = processedCallbacks.get(checkoutRequestId);
  if (lastSeen && Date.now() - lastSeen < CALLBACK_DEDUP_TTL_MS) return true;
  processedCallbacks.set(checkoutRequestId, Date.now());
  return false;
}

async function sendSmsNonBlocking(sendFn: () => Promise<boolean>, timeoutMs: number = 3000): Promise<void> {
  const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("SMS timeout")), timeoutMs));
  try { await Promise.race([sendFn(), timeout]); }
  catch (err) { console.warn("[SMS] Non-blocking send failed:", err); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  // ── PHASE 4 FIX: IP Allowlist ──
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[WEBHOOK] Rejected callback from non-Safaricom IP: ${clientIp} for shortcode ${shortcode}`);
    return NextResponse.json({ error: "Unauthorized IP" }, { status: 403 });
  }

  // ── PHASE 4 FIX: X-Callback-Key verification ──
  const callbackKey = req.headers.get("x-callback-key");
  const expectedKey = process.env.DARAJA_CALLBACK_KEY;
  if (expectedKey && callbackKey !== expectedKey) {
    console.warn(`[WEBHOOK] Invalid callback key from ${clientIp}`);
    return NextResponse.json({ error: "Invalid callback key" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as StkCallbackBody;
    const callback = body.stkCallback;
    if (!callback) return NextResponse.json({ error: "Invalid callback body" }, { status: 400 });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    if (isDuplicateCallback(CheckoutRequestID)) {
      return NextResponse.json({ result: "Already processed (dedup cache)" });
    }

    const pendingTx = await getPendingTransaction(CheckoutRequestID);
    if (!pendingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (ResultCode !== 0) {
      const db = getDb();
      await db.update(pendingTransactions).set({
        status: "FAILED", resultCode: ResultCode.toString(), resultDesc: ResultDesc, completedAt: new Date(),
      }).where(eq(pendingTransactions.checkoutRequestId, CheckoutRequestID));
      sendSmsNonBlocking(() => sendPaymentFailedSms(pendingTx.tenantId, pendingTx.amount, ResultDesc));
      return NextResponse.json({ result: "Failed recorded" });
    }

    const metadata = CallbackMetadata?.Item ?? [];
    const mpesaReceiptNumber = metadata.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string | undefined;
    const amount = metadata.find((i) => i.Name === "Amount")?.Value as number | undefined;
    const billingMonth = new Date().toISOString().slice(0, 7);

    if (pendingTx.status === "COMPLETED") {
      return NextResponse.json({ result: "Already processed" });
    }

    const db = getDb();
    const ledgerResult = await db.transaction(async (tx) => {
      await tx.select({ id: pendingTransactions.id }).from(pendingTransactions)
        .where(eq(pendingTransactions.checkoutRequestId, CheckoutRequestID))
        .for("update").limit(1);

      const [currentTx] = await tx.select({ status: pendingTransactions.status }).from(pendingTransactions)
        .where(eq(pendingTransactions.checkoutRequestId, CheckoutRequestID)).limit(1);

      if (currentTx?.status === "COMPLETED") return { alreadyProcessed: true, ledgerId: null };

      await tx.update(pendingTransactions).set({
        status: "COMPLETED", resultCode: ResultCode.toString(), resultDesc: ResultDesc,
        mpesaCode: mpesaReceiptNumber, completedAt: new Date(),
      }).where(eq(pendingTransactions.checkoutRequestId, CheckoutRequestID));

      const [ledgerEntry] = await tx.insert(tenantLedger).values({
        tenantId: pendingTx.tenantId, buildingId: pendingTx.buildingId, agencyId: pendingTx.agencyId,
        type: "CREDIT", category: "RENT", amount: (amount?.toString() ?? pendingTx.amount).toString(),
        billingMonth, description: `M-Pesa STK Push — ${mpesaReceiptNumber ?? "N/A"}`,
        referenceCode: mpesaReceiptNumber ?? CheckoutRequestID, method: "MPESA_STK", recordedBy: "system",
      }).returning({ id: tenantLedger.id });

      return { alreadyProcessed: false, ledgerId: ledgerEntry.id };
    });

    if (ledgerResult.alreadyProcessed) {
      return NextResponse.json({ result: "Already processed (post-lock check)" });
    }

    sendSmsNonBlocking(() => sendPaymentReceivedSms(
      pendingTx.tenantId, amount?.toString() ?? pendingTx.amount,
      mpesaReceiptNumber ?? CheckoutRequestID, billingMonth
    ));

    return NextResponse.json({ result: "Success", ledgerId: ledgerResult.ledgerId });
  } catch (err) {
    console.error(`M-Pesa callback error for shortcode ${shortcode}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}