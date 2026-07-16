// lib/cache.ts
import { Redis } from "@upstash/redis";
import { getTenantBalance } from "./ledger";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCachedBalance(tenantId: string, agencyId: string) {
  const key = `balance:${agencyId}:${tenantId}`; // ← include agencyId in the key too
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached as string);

  const balance = await getTenantBalance(tenantId, agencyId);
  await redis.setex(key, 30, JSON.stringify(balance));
  return balance;
}

export async function invalidateBalance(tenantId: string, agencyId: string) {
  await redis.del(`balance:${agencyId}:${tenantId}`);
}