// lib/cache.ts
import { Redis } from "@upstash/redis";
import { getTenantBalance } from "./ledger";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCachedBalance(tenantId: string) {
  const key = `balance:${tenantId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached as string);
  
  const balance = await getTenantBalance(tenantId); // your existing function
  await redis.setex(key, 30, JSON.stringify(balance)); // 30s TTL
  return balance;
}

export async function invalidateBalance(tenantId: string) {
  await redis.del(`balance:${tenantId}`);
}