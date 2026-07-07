// lib/rate-limit.ts
// In-memory rate limiting with Redis fallback for production.
// For Phase 8: in-memory is sufficient. Upgrade to Redis @upstash/redis for multi-instance.

import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

export const STK_PUSH_CONFIG: RateLimitConfig = {
  windowMs: 30_000,    // 30 seconds
  maxRequests: 1,      // 1 STK Push per tenant per 30s
};

export const IP_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,    // 1 minute
  maxRequests: 100,    // 100 requests per IP per minute
};

export class RateLimitKeys {
  static stkPush(tenantId: string): string {
    return `ratelimit:stk:${tenantId}`;
  }
  
  static perIp(ip: string): string {
    return `ratelimit:ip:${ip}`;
  }
}

// In-memory fallback for single-instance or development
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  if (redis) {
    // Redis implementation - async, but we'll use sync wrapper for Server Actions
    // In production, make this async
    return checkMemoryRateLimit(key, config); // fallback for now
  }
  
  return checkMemoryRateLimit(key, config);
}

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);
  
  if (!existing || existing.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      retryAfter: 0,
    };
  }
  
  if (existing.count >= config.maxRequests) {
    return {
      limited: true,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  
  existing.count++;
  return {
    limited: false,
    remaining: config.maxRequests - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}, 300_000);