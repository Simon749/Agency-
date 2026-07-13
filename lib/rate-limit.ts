// lib/rate-limit.ts
// PHASE 4: Rate limiting for API routes, server actions, and webhooks.
// Uses Redis (Upstash) for production, in-memory Map for dev fallback.

import { NextRequest, NextResponse } from "next/server";

// ── Redis client (production) ──────────────────────────────────────────────
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

// ── In-memory fallback (dev only — lost on cold starts) ────────────────────
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// ── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Key prefix for Redis (e.g., "rl:ip", "rl:stk")
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

// ── Pre-configured rate limits ───────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Public routes — generous (100 req/min per IP) */
  public: { windowMs: 60_000, maxRequests: 100, keyPrefix: "rl:ip" } as RateLimitConfig,

  /** Auth routes — strict (10 req/min per IP, prevent brute force) */
  auth: { windowMs: 60_000, maxRequests: 10, keyPrefix: "rl:auth" } as RateLimitConfig,

  /** STK Push — very strict (1 per 30s per tenant, prevent double-charges) */
  stkPush: { windowMs: 30_000, maxRequests: 1, keyPrefix: "rl:stk" } as RateLimitConfig,

  /** Manual receipt entry — moderate (5 per 10s per agent) */
  receiptEntry: { windowMs: 10_000, maxRequests: 5, keyPrefix: "rl:rcpt" } as RateLimitConfig,

  /** Webhook endpoints — moderate (60 req/min per IP, allow Daraja retries) */
  webhook: { windowMs: 60_000, maxRequests: 60, keyPrefix: "rl:wh" } as RateLimitConfig,

  /** General API — standard (60 req/min per IP) */
  api: { windowMs: 60_000, maxRequests: 60, keyPrefix: "rl:api" } as RateLimitConfig,

  /** Clerk webhook — strict (30 req/min per IP, prevent fake events) */
  clerkWebhook: { windowMs: 60_000, maxRequests: 30, keyPrefix: "rl:clerk" } as RateLimitConfig,

  /** Cron endpoints — very strict (5 req/min per IP, only Vercel should call) */
  cron: { windowMs: 60_000, maxRequests: 5, keyPrefix: "rl:cron" } as RateLimitConfig,
} as const;

// ── Core rate limiter (used by both middleware and server actions) ─────────

export async function checkRateLimit(
  key: string,           // Unique identifier (e.g., tenantId, IP, userId)
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const prefix = config.keyPrefix ?? "rl";
  const redisKey = `${prefix}:${key}`;

  if (redisClient) {
    // ── Redis implementation (production) ────────────────────────────────
    const pipeline = redisClient.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
    pipeline.pexpire(redisKey, config.windowMs);

    const [, currentCount] = await pipeline.exec();
    const count = currentCount ?? 0;
    const allowed = count < config.maxRequests;
    const resetTime = now + config.windowMs;

    return {
      allowed,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count - 1),
      resetTime,
      retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000),
    };
  }

  // ── In-memory fallback (dev only) ────────────────────────────────────
  const entry = memoryStore.get(redisKey);

  if (!entry || now > entry.resetTime) {
    // New window
    memoryStore.set(redisKey, { count: 1, resetTime: now + config.windowMs });
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      retryAfter: 0,
    };
  }

  // Existing window
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
    retryAfter: 0,
  };
}

// ── Server Action helpers (no NextRequest needed) ──────────────────────────

/**
 * Check rate limit for a server action.
 * 
 * Usage:
 *   const result = await checkActionRateLimit(`stk:${tenantId}`, RATE_LIMITS.stkPush);
 *   if (!result.allowed) { return { error: `Wait ${result.retryAfter}s` }; }
 */
export async function checkActionRateLimit(
  identifier: string,    // e.g., `stk:${tenantId}`, `ip:${ip}`, `rcpt:${agentId}`
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, config);
}

// ── Middleware helpers (for API routes) ────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

interface MiddlewareConfig extends RateLimitConfig {
  keyExtractor: (req: NextRequest) => string;
  customMessage?: string;
}

export async function rateLimitMiddleware(
  req: NextRequest,
  config: MiddlewareConfig
): Promise<NextResponse | null> {
  const clientKey = config.keyExtractor(req);
  const result = await checkRateLimit(clientKey, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: config.customMessage ?? "Rate limit exceeded",
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetTime),
          "Retry-After": String(result.retryAfter),
        },
      }
    );
  }

  return null; // Allowed — proceed to next handler
}

// ── Route-specific middleware factory ──────────────────────────────────────

export function createRateLimitedHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: MiddlewareConfig
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimitMiddleware(req, config);
    if (rateLimitResponse) return rateLimitResponse;
    return handler(req);
  };
}

// ── Preset middleware configs for common routes ───────────────────────────

export const MIDDLEWARE_CONFIGS = {
  /** For /api/webhooks/mpesa/* — moderate, by IP */
  mpesaWebhook: {
    ...RATE_LIMITS.webhook,
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Webhook rate limit exceeded.",
  } as MiddlewareConfig,

  /** For /api/webhooks/clerk — strict, by IP */
  clerkWebhook: {
    ...RATE_LIMITS.clerkWebhook,
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Clerk webhook rate limit exceeded.",
  } as MiddlewareConfig,

  /** For /api/cron/* — very strict, by IP + CRON_SECRET check */
  cron: {
    ...RATE_LIMITS.cron,
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Unauthorized cron access.",
  } as MiddlewareConfig,

  /** For general API routes — standard, by IP */
  api: {
    ...RATE_LIMITS.api,
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "API rate limit exceeded. Please slow down.",
  } as MiddlewareConfig,

  /** For auth-related API routes — strict, by IP */
  auth: {
    ...RATE_LIMITS.auth,
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Too many authentication attempts. Try again in 1 minute.",
  } as MiddlewareConfig,
} as const;