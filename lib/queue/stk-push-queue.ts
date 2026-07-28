import { eq, and, lte, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { stkPushQueue, pendingTransactions } from "@/db/schema";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { canExecute, recordSuccess, recordFailure } from "@/lib/daraja/circuit-breaker";
import { initiateStkPush } from "@/lib/daraja/client";
import { getPaybillStrategy } from "@/lib/payments/paybill-strategy";

export interface EnqueueStkPushParams {
  tenantId: string;
  buildingId: string;
  agencyId: string;
  amount: number;
  phone: string;
  accountReference: string;
  transactionDesc?: string;
}

export async function enqueueStkPush(
  params: EnqueueStkPushParams
): Promise<string> {
  const db = getDb();

  const [item] = await db
    .insert(stkPushQueue)
    .values({
      tenantId: params.tenantId,
      buildingId: params.buildingId,
      agencyId: params.agencyId,
      amount: String(params.amount),
      phone: params.phone,
      accountReference: params.accountReference,
      transactionDesc: params.transactionDesc ?? "Rent Payment",
      status: "PENDING",
      scheduledAt: new Date(),
    })
    .returning({ id: stkPushQueue.id });

  return item.id;
}

export async function processQueueBatch(batchSize: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  rateLimited: number;
}> {
  const db = getDb();
  const now = new Date();

  // Fetch pending items scheduled for now or earlier
  const items = await db
    .select()
    .from(stkPushQueue)
    .where(
      and(
        eq(stkPushQueue.status, "PENDING"),
        lte(stkPushQueue.scheduledAt, now)
      )
    )
    .orderBy(asc(stkPushQueue.createdAt))
    .limit(batchSize);

  let succeeded = 0;
  let failed = 0;
  let rateLimited = 0;

  for (const item of items) {
    // Resolve shortcode for rate limiting
    let shortcode: string;
    try {
      const strategy = await getPaybillStrategy(item.buildingId, item.tenantId);
      shortcode =
        strategy.type === "OWN" ? strategy.shortcode : strategy.shortcode;
    } catch {
      await db
        .update(stkPushQueue)
        .set({
          status: "FAILED",
          errorMessage: "No paybill strategy found for building/tenant",
          processedAt: new Date(),
        })
        .where(eq(stkPushQueue.id, item.id));
      failed++;
      continue;
    }

    // Check Daraja rate limit (Redis-backed, per shortcode)
    const limitResult = await checkRateLimit(
      `daraja-stk-${shortcode}`,
      RATE_LIMITS.darajaStkPerShortcode
    );

    if (!limitResult.allowed) {
      rateLimited++;
      // Reschedule for later based on retryAfter
      await db
        .update(stkPushQueue)
        .set({
          scheduledAt: new Date(
            Date.now() + (limitResult.retryAfter || 60) * 1000
          ),
        })
        .where(eq(stkPushQueue.id, item.id));
      continue;
    }

    // Check circuit breaker
    const circuitKey = `daraja:stk:${shortcode}`;
    if (!canExecute(circuitKey)) {
      rateLimited++;
      await db
        .update(stkPushQueue)
        .set({
          scheduledAt: new Date(Date.now() + 30000),
        })
        .where(eq(stkPushQueue.id, item.id));
      continue;
    }

    try {
      // Mark as processing
      await db
        .update(stkPushQueue)
        .set({
          status: "PROCESSING",
          attemptCount: item.attemptCount + 1,
        })
        .where(eq(stkPushQueue.id, item.id));

      // Build callback URL (must match your unified webhook route)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://propflow.co.ke";
      const callbackUrl = `${baseUrl}/api/webhooks/mpesa/${shortcode}`;

      // Initiate STK Push
      const response = await initiateStkPush({
        buildingId: item.buildingId,
        tenantId: item.tenantId,
        phone: item.phone,
        amount: Number(item.amount),
        accountReference: item.accountReference,
        transactionDesc: item.transactionDesc ?? undefined,
        callbackUrl,
      });

      // Link to pending_transactions so webhook can mark queue item complete
      const [pendingTx] = await db
        .insert(pendingTransactions)
        .values({
          tenantId: item.tenantId,
          buildingId: item.buildingId,
          agencyId: item.agencyId,
          checkoutRequestId: response.CheckoutRequestID,
          merchantRequestId: response.MerchantRequestID,
          amount: item.amount,
          phone: item.phone,
          status: "PENDING",
        })
        .returning({ id: pendingTransactions.id });

      await db
        .update(stkPushQueue)
        .set({
          pendingTransactionId: pendingTx.id,
        })
        .where(eq(stkPushQueue.id, item.id));

      recordSuccess(circuitKey);
      succeeded++;

      // Note: queue item stays PROCESSING until webhook marks it COMPLETED
    } catch (err) {
      recordFailure(circuitKey);
      failed++;

      const errorMsg = err instanceof Error ? err.message : String(err);
      const shouldRetry = item.attemptCount + 1 < item.maxAttempts;

      const updateData: Record<string, any> = {
        status: shouldRetry ? "PENDING" : "FAILED",
        errorMessage: errorMsg,
        processedAt: new Date(),
      };
      if (shouldRetry) {
        updateData.scheduledAt = new Date(Date.now() + 60000 * (item.attemptCount + 1));
      }

      await db
        .update(stkPushQueue)
        .set(updateData)
        .where(eq(stkPushQueue.id, item.id));
    }
  }

  return {
    processed: items.length,
    succeeded,
    failed,
    rateLimited,
  };
}