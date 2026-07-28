// lib/rate-limit.ts
// PHASE G: Per-agency rate limiting + IP-based defense in depth.
// Uses Redis (Upstash) for production, in-memory Map for dev fallback.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

let redisClient: any = null;

try {
  const { Redis } = require("@upstash/redis");
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn("[RATE-LIMIT] Redis not available, using in-memory fallback (dev only)");
}

const memoryStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export const RATE_LIMITS = {
  public: { windowMs: 60_000, maxRequests: 100, keyPrefix: "rl:ip" } as RateLimitConfig,
  auth: { windowMs: 60_000, maxRequests: 10, keyPrefix: "rl:auth" } as RateLimitConfig,
  stkPush: { windowMs: 30_000, maxRequests: 1, keyPrefix: "rl:stk" } as RateLimitConfig,
  stkPushAgency: { windowMs: 60_000, maxRequests: 50, keyPrefix: "rl:agency:stk" } as RateLimitConfig,
  receiptEntry: { windowMs: 10_000, maxRequests: 5, keyPrefix: "rl:rcpt" } as RateLimitConfig,
  webhook: { windowMs: 60_000, maxRequests: 60, keyPrefix: "rl:wh" } as RateLimitConfig,
  api: { windowMs: 60_000, maxRequests: 60, keyPrefix: "rl:api" } as RateLimitConfig,
  agencyApi: { windowMs: 60_000, maxRequests: 1000, keyPrefix: "rl:agency:api" } as RateLimitConfig,
  agencyBurst: { windowMs: 60_000, maxRequests: 200, keyPrefix: "rl:agency:burst" } as RateLimitConfig,
  clerkWebhook: { windowMs: 60_000, maxRequests: 30, keyPrefix: "rl:clerk" } as RateLimitConfig,
  darajaStkPerShortcode: { windowMs: 60_000, maxRequests: 300, keyPrefix: "rl:daraja:stk" } as RateLimitConfig,
  cron: { windowMs: 60_000, maxRequests: 5, keyPrefix: "rl:cron" } as RateLimitConfig,
} as const;

export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const prefix = config.keyPrefix ?? "rl";
  const redisKey = `${prefix}:${key}`;

  if (redisClient) {
    const pipeline = redisClient.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
    pipeline.pexpire(redisKey, config.windowMs);
    const [, currentCount] = await pipeline.exec();
    const count = currentCount ?? 0;
    const allowed = count < config.maxRequests;
    const resetTime = now + config.windowMs;
    return { allowed, limit: config.maxRequests, remaining: Math.max(0, config.maxRequests - count - 1), resetTime, retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000) };
  }

  const entry = memoryStore.get(redisKey);
  if (!entry || now > entry.resetTime) {
    memoryStore.set(redisKey, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, limit: config.maxRequests, remaining: config.maxRequests - 1, resetTime: now + config.windowMs, retryAfter: 0 };
  }
  if (entry.count >= config.maxRequests) {
    return { allowed: false, limit: config.maxRequests, remaining: 0, resetTime: entry.resetTime, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, limit: config.maxRequests, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime, retryAfter: 0 };
}

export async function getAgencyIdFromRequest(req?: NextRequest): Promise<string | null> {
  try {
    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "").trim();
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        return payload.publicMetadata?.agencyId ?? null;
      }
    } else {
      const session = await auth();
      const meta = session?.sessionClaims?.publicMetadata as Record<string, string> | undefined;
      return meta?.agencyId ?? null;
    }
  } catch { /* silent fail */ }
  return null;
}

export async function checkAgencyRateLimit(identifier: string, config: RateLimitConfig, req?: NextRequest): Promise<RateLimitResult & { agencyScoped: boolean; agencyId: string | null }> {
  const agencyId = await getAgencyIdFromRequest(req);
  if (agencyId && config.keyPrefix?.includes(":agency:")) {
    const agencyKey = `${agencyId}:${identifier}`;
    const result = await checkRateLimit(agencyKey, config);
    return { ...result, agencyScoped: true, agencyId };
  }
  const result = await checkRateLimit(identifier, config);
  return { ...result, agencyScoped: false, agencyId };
}

export async function checkActionRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  return checkRateLimit(identifier, config);
}

export async function checkActionAgencyRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult & { agencyScoped: boolean; agencyId: string | null }> {
  return checkAgencyRateLimit(identifier, config);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

interface MiddlewareConfig extends RateLimitConfig {
  keyExtractor: (req: NextRequest) => string | Promise<string>;
  customMessage?: string;
  agencyScoped?: boolean;
}

export async function rateLimitMiddleware(req: NextRequest, config: MiddlewareConfig): Promise<NextResponse | null> {
  const clientKey = await config.keyExtractor(req);

  if (config.agencyScoped) {
    const agencyId = await getAgencyIdFromRequest(req);
    if (agencyId) {
      const agencyResult = await checkRateLimit(`${agencyId}:${clientKey}`, config);
      if (!agencyResult.allowed) {
        return NextResponse.json(
          { error: config.customMessage ?? "Agency rate limit exceeded", retryAfter: agencyResult.retryAfter, scope: "agency", agencyId },
          {
            status: 429, headers: {
              "X-RateLimit-Limit": String(agencyResult.limit),
              "X-RateLimit-Remaining": String(agencyResult.remaining),
              "X-RateLimit-Reset": String(agencyResult.resetTime),
              "Retry-After": String(agencyResult.retryAfter),
              "X-RateLimit-Scope": "agency",
            }
          }
        );
      }
    }
  }

  const result = await checkRateLimit(clientKey, config);
  if (!result.allowed) {
    return NextResponse.json(
      { error: config.customMessage ?? "Rate limit exceeded", retryAfter: result.retryAfter },
      {
        status: 429, headers: {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetTime),
          "Retry-After": String(result.retryAfter),
        }
      }
    );
  }
  return null;
}

export function createRateLimitedHandler(handler: (req: NextRequest) => Promise<NextResponse>, config: MiddlewareConfig) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimitMiddleware(req, config);
    if (rateLimitResponse) return rateLimitResponse;
    return handler(req);
  };
}

export const MIDDLEWARE_CONFIGS = {
  mpesaWebhook: { ...RATE_LIMITS.webhook, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Webhook rate limit exceeded." } as MiddlewareConfig,
  clerkWebhook: { ...RATE_LIMITS.clerkWebhook, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Clerk webhook rate limit exceeded." } as MiddlewareConfig,
  cron: { ...RATE_LIMITS.cron, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Unauthorized cron access." } as MiddlewareConfig,
  api: { ...RATE_LIMITS.api, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "API rate limit exceeded. Please slow down." } as MiddlewareConfig,
  auth: { ...RATE_LIMITS.auth, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Too many authentication attempts. Try again in 1 minute." } as MiddlewareConfig,
  stkPush: { ...RATE_LIMITS.stkPush, keyExtractor: async (req: NextRequest) => { const body = await req.clone().json().catch(() => ({})); return `stk:${body.tenantId ?? getClientIp(req)}`; }, customMessage: "Please wait 30 seconds before requesting another STK Push." } as MiddlewareConfig,
  stkPushAgency: { ...RATE_LIMITS.stkPushAgency, keyExtractor: async (req: NextRequest) => { const body = await req.clone().json().catch(() => ({})); return body.tenantId ? `tenant:${body.tenantId}` : getClientIp(req); }, customMessage: "Your agency has reached the STK Push limit. Please try again in 1 minute.", agencyScoped: true } as MiddlewareConfig,
  agencyApi: { ...RATE_LIMITS.agencyApi, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Your agency has reached the API rate limit. Please try again in 1 minute.", agencyScoped: true } as MiddlewareConfig,
  agencyBurst: { ...RATE_LIMITS.agencyBurst, keyExtractor: (req: NextRequest) => getClientIp(req), customMessage: "Your agency has reached the burst limit. Please slow down.", agencyScoped: true } as MiddlewareConfig,
} as const;
