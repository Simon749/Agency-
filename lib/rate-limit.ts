// lib/rate-limit.ts
// PHASE 3: Rate limiting — replace with Redis in production for multi-instance

interface RateLimitEntry { count: number; windowStart: number; }
const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig { windowMs: number; maxRequests: number; }
export const DEFAULT_CONFIG: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };
export const STK_PUSH_CONFIG: RateLimitConfig = { windowMs: 30_000, maxRequests: 1 };

export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG):
  { limited: false } | { limited: true; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { limited: false };
  }
  if (entry.count >= config.maxRequests) {
    return { limited: true, retryAfter: Math.ceil((entry.windowStart + config.windowMs - now) / 1000) };
  }
  entry.count++;
  store.set(key, entry);
  return { limited: false };
}

export const RateLimitKeys = {
  stkPush: (tenantId: string) => `stk:${tenantId}`,
  perIp: (ip: string) => `ip:${ip}`,
  perUser: (userId: string) => `user:${userId}`,
};