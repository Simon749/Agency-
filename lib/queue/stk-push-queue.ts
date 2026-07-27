import { eq, and, lte, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { stkPushQueue } from "@/db/schema";
import { checkRateLimit, getRateLimitKey, getRateLimitForEnv } from "@/lib/daraja/rate-limiter";
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

export async function enqueueStkPush(params: EnqueueStkPushParams): Promise<string> {
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
  
  // Fetch pending items that are scheduled for now or earlier
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
    // Determine which shortcode this will use
    let shortcode: string;
    try {
      const strategy = await getPaybillStrategy(item.buildingId, item.tenantId);
      shortcode = strategy.type === "OWN" ? strategy.shortcode : strategy.shortcode;
    } catch {
      // If strategy fails (e.g., no credentials), mark as failed
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
    
    const rateLimitKey = getRateLimitKey(shortcode, "STK_PUSH");
    const limits = getRateLimitForEnv("STK_PUSH");
    const limitResult = checkRateLimit(rateLimitKey, limits.maxRequests, limits.windowMs);
    
    if (!limitResult.allowed) {
      rateLimited++;
      // Reschedule for later
      await db
        .update(stkPushQueue)
        .set({
          scheduledAt: new Date(Date.now() + limitResult.retryAfterMs + 1000),
        })
        .where(eq(stkPushQueue.id, item.id));
      continue;
    }
    
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
        .set({ status: "PROCESSING", attemptCount: item.attemptCount + 1 })
        .where(eq(stkPushQueue.id, item.id));
      
      // Get callback URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://propflow.co.ke";
      const callbackUrl = `${baseUrl}/api/webhooks/mpesa/${shortcode}`;
      
      // Initiate STK Push
      await initiateStkPush({
        buildingId: item.buildingId,
        tenantId: item.tenantId,
        phone: item.phone,
        amount: Number(item.amount),
        accountReference: item.accountReference,
        transactionDesc: item.transactionDesc ?? undefined,
        callbackUrl,
      });
      
      recordSuccess(circuitKey);
      succeeded++;
      
      // Note: We don't mark as COMPLETED here — the webhook callback will do that
      // by linking to pendingTransactionId. For now, keep as PROCESSING.
    } catch (err) {
      recordFailure(circuitKey);
      failed++;
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      const shouldRetry = item.attemptCount + 1 < item.maxAttempts;
      
      await db
        .update(stkPushQueue)
        .set({
          status: shouldRetry ? "PENDING" : "FAILED",
          errorMessage: errorMsg,
          processedAt: new Date(),
          scheduledAt: shouldRetry ? new Date(Date.now() + 60000 * (item.attemptCount + 1)) : null,
        })
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