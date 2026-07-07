/*
 ── USAGE EXAMPLES ─────────────────────────────────────────────────────────

 1. Apply to API route (e.g., STK Push initiation)
 app/api/payments/stk-push/route.ts

 import { NextRequest, NextResponse } from "next/server";

 export async function POST(req: NextRequest) {
   // Rate limit by tenantId (from auth session)
   const { userId } = await auth();
   const tenantId = await getTenantIdFromUser(userId);

   const limitConfig = {
     ...RATE_LIMITS.stkPush,
     keyExtractor: () => tenantId, // Rate limit per tenant, not IP
   };

   const rateLimitResponse = await rateLimitMiddleware(req, limitConfig);
   if (rateLimitResponse) return rateLimitResponse;

   // ... proceed with STK Push
 }

 2. Apply to webhook route
 app/api/webhooks/mpesa/[shortcode]/route.ts

 import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/rate-limit";

 export async function POST(req: NextRequest, { params }) {
   const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.webhook);
   if (rateLimitResponse) return rateLimitResponse;

   // ... proceed with webhook handling
 }

 3. Apply to Clerk webhook
 app/api/webhooks/clerk/route.ts

 import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/rate-limit";

 export async function POST(req: NextRequest) {
   const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.clerkWebhook);
   if (rateLimitResponse) return rateLimitResponse;

   // ... proceed with svix verification
 }

 4. Apply to cron endpoint
 app/api/cron/monthly-billing/route.ts

 import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/rate-limit";

 export async function GET(req: NextRequest) {
   const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.cron);
   if (rateLimitResponse) return rateLimitResponse;

   // ... proceed with CRON_SECRET check
 }

 5. Server Action rate limit (e.g., manual receipt logging)
 app/admin/agent/receipts/actions.ts

 import { checkServerActionRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

 export async function logManualReceipt(formData: FormData) {
   const { userId } = await auth();
   const agentId = userId!;

   const limit = await checkServerActionRateLimit(agentId, {
     windowMs: 60_000,
     maxRequests: 10,
     keyPrefix: "rl:receipt",
     keyExtractor: () => agentId,
     customMessage: "Too many receipt entries. Please slow down.",
   });

   if (!limit.allowed) {
     throw new Error(`Rate limit exceeded. Retry in ${limit.retryAfter}s`);
   }

   // ... proceed with receipt logging
 }

 function getTenantIdFromUser(userId: any) {
     throw new Error("Function not implemented.");
 }
*/

// app/api/payments/stk-push/route.ts
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  // Rate limit by tenant (not IP) — prevents double-click "Pay"
  const body = await req.json().catch(() => ({}));
  const userId = (body && (body.userId || body.user_id)) ?? undefined;
  const tenantId = body?.tenantId ?? (userId ? getTenantIdFromUser(userId) : undefined);
  if (!tenantId) return new Response("Missing tenantId or userId", { status: 400 });
  const limitConfig = {
    ...RATE_LIMITS.stkPush,
    keyExtractor: () => tenantId,
  };
  
  const blocked = await rateLimitMiddleware(req, limitConfig);
  if (blocked) return blocked; // Returns 429 with Retry-After
  
  // ... proceed with STK Push
}
function getTenantIdFromUser(userId: any) {
  // Minimal implementation: assume tenantId equals userId for now.
  return String(userId);
}

