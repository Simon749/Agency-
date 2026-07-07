// lib/agency-cache.ts
// Shared cache invalidation for the middleware kill-switch.
//
// Call `invalidateAgencyCache(agencyId)` from your server action
// whenever you suspend or reactivate an agency, so the middleware
// picks up the change immediately instead of waiting 60 seconds.
//
// Usage in a server action:
//   import { invalidateAgencyCache } from '@/lib/agency-cache';
//   await db.update(agencies).set({ isActive: false }).where(eq(agencies.id, id));
//   invalidateAgencyCache(id);

// NOTE: This works in the same Node.js process as middleware.
// In a multi-instance deployment (multiple Vercel serverless workers),
// each worker has its own cache — suspension may take up to 60s on
// other workers. That is acceptable for a kill-switch use case.

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
    isActive: boolean;
    expiresAt: number;
}

// This is the shared cache — imported by both middleware.ts and this file.
// Both must reference the SAME Map instance (same module singleton).
export const agencyStatusCache = new Map<string, CacheEntry>();


export function getCachedAgencyStatus(agencyId: string) {
  return agencyStatusCache.get(agencyId);
}

/**
 * Force-expire the cached status for an agency.
 * The next middleware hit will re-query the DB.
 */
export function invalidateAgencyCache(agencyId: string): void {
    agencyStatusCache.delete(agencyId);
}

/**
 * Pre-warm the cache with a known status (e.g. after an update).
 * Avoids the next DB round-trip entirely.
 */
export function setAgencyCacheStatus(agencyId: string, isActive: boolean): void {
    agencyStatusCache.set(agencyId, {
        isActive,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}