// lib/daraja/rate-limiter.ts
/**
 * Token bucket rate limiter for Daraja API calls.
 * 
 * Safaricom Daraja documented limits (conservative):
 * - STK Push: ~500 requests per minute per shortcode (production)
 * - Sandbox: lower, typically ~100/min
 * 
 * We use a conservative default of 300/min (5/sec) per shortcode to stay safe.
 * 
 * NOTE: This is an in-memory implementation. On Vercel serverless, each invocation
 * gets a fresh process. For production scale, replace with Redis (Upstash) backed
 * buckets or use the DB queue's scheduledAt field to throttle.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_RPS = 5; // 5 per second = 300 per minute
const DEFAULT_WINDOW_MS = 1000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_RPS,
  windowMs: number = DEFAULT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: maxRequests, lastRefill: now };
  
  // Refill tokens based on elapsed time
  const elapsedMs = now - bucket.lastRefill;
  const tokensToAdd = Math.floor((elapsedMs / windowMs) * maxRequests);
  
  bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
  
  if (bucket.tokens > 0) {
    bucket.tokens--;
    buckets.set(key, bucket);
    return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
  }
  
  // Calculate time until next token is available
  const msPerToken = windowMs / maxRequests;
  const retryAfterMs = Math.ceil(msPerToken);
  
  buckets.set(key, bucket);
  return { allowed: false, remaining: 0, retryAfterMs };
}

export function getRateLimitKey(shortcode: string, action: "STK_PUSH" | "VALIDATION" | "CONFIRMATION"): string {
  return `daraja:${action}:${shortcode}`;
}

// Conservative limits by environment
export function getRateLimitForEnv(action: "STK_PUSH"): { maxRequests: number; windowMs: number } {
  const isProd = process.env.DARAJA_ENV === "production";
  if (action === "STK_PUSH") {
    return isProd 
      ? { maxRequests: 5, windowMs: 1000 }  // 5/sec = 300/min in prod
      : { maxRequests: 2, windowMs: 1000 }; // 2/sec = 120/min in sandbox
  }
  return { maxRequests: 10, windowMs: 1000 };
}