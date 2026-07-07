// lib/rate-limit.ts
// PHASE 4: Rate limiting for all API routes and server actions.
// Uses Redis (Upstash) for production, in-memory Map for dev fallback.
// Configurable per-route, per-role, and per-tenant.

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

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Key prefix for Redis (e.g., "rl:ip", "rl:tenant")
  keyExtractor: (req: NextRequest) => string; // How to identify the client
  skipSuccessful?: boolean; // Don't count successful requests (optional)
  customMessage?: string;
}

// ── Default configs ────────────────────────────────────────────────────────
export const RATE_LIMITS = {
  // Public routes — generous
  public: {
    windowMs: 60_000,
    maxRequests: 100,
    keyPrefix: "rl:ip",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Too many requests. Please slow down.",
  } as RateLimitConfig,

  // Auth routes — strict (prevent brute force)
  auth: {
    windowMs: 60_000,
    maxRequests: 10,
    keyPrefix: "rl:auth",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Too many authentication attempts. Try again in 1 minute.",
  } as RateLimitConfig,

  // STK Push — very strict (prevent double-charges)
  stkPush: {
    windowMs: 30_000,
    maxRequests: 1,
    keyPrefix: "rl:stk",
    keyExtractor: (req: NextRequest) => {
      // Rate limit by tenantId from body, fallback to IP
      const tenantId = extractTenantIdFromBody(req);
      return tenantId ?? getClientIp(req);
    },
    customMessage: "Please wait 30 seconds before initiating another payment.",
  } as RateLimitConfig,

  // Webhook endpoints — moderate (allow Daraja retries but prevent floods)
  webhook: {
    windowMs: 60_000,
    maxRequests: 60,
    keyPrefix: "rl:wh",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Webhook rate limit exceeded.",
  } as RateLimitConfig,

  // API routes (general) — standard
  api: {
    windowMs: 60_000,
    maxRequests: 60,
    keyPrefix: "rl:api",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "API rate limit exceeded. Please slow down.",
  } as RateLimitConfig,

  // Clerk webhook — strict (prevent fake events)
  clerkWebhook: {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: "rl:clerk",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Webhook rate limit exceeded.",
  } as RateLimitConfig,

  // Cron endpoints — very strict (only Vercel should call)
  cron: {
    windowMs: 60_000,
    maxRequests: 5,
    keyPrefix: "rl:cron",
    keyExtractor: (req: NextRequest) => getClientIp(req),
    customMessage: "Unauthorized cron access.",
  } as RateLimitConfig,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function extractTenantIdFromBody(req: NextRequest): string | null {
  // For STK Push: tenantId is usually in the request body
  // This is a placeholder — actual extraction depends on your API shape
  // In practice, extract from req.json() in the route handler before calling rate limit
  return null;
}

// ── Core rate limiter ──────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `${config.keyPrefix}:${key}`;

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

  // ── In-memory fallback (dev only) ──────────────────────────────────────
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

// ── Middleware wrapper ─────────────────────────────────────────────────────

export async function rateLimitMiddleware(
  req: NextRequest,
  config: RateLimitConfig
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
  config: RateLimitConfig
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimitMiddleware(req, config);
    if (rateLimitResponse) return rateLimitResponse;
    return handler(req);
  };
}

// ── Server Action rate limiter (for STK Push, manual receipts) ───────────

export async function checkServerActionRateLimit(
  identifier: string, // e.g., tenantId or clerkUserId
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, config);
}