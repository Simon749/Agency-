// middleware.ts — root of project
// FIXES:
// 1. Agency kill-switch uses in-memory LRU cache (60s TTL)
// 2. VACATED tenants are blocked from /tenant/* routes
// 3. All auth() calls now have null guards
// 4. Fetch fresh user data from Clerk API (not stale sessionClaims)

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { agencies, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';

const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isAgentRoute = createRouteMatcher(['/admin/agent(.*)']);
const isTenantRoute = createRouteMatcher(['/tenant(.*)']);
const isProtectedRoute = createRouteMatcher(['/super-admin(.*)', '/admin(.*)', '/tenant(.*)']);
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/suspended', '/deactivated']);

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  AGENCY_OWNER: '/admin/dashboard',
  MANAGER: '/admin/dashboard',
  FIELD_AGENT: '/admin/agent/meter-readings',
  TENANT: '/tenant/dashboard',
};

// ─── In-memory agency status cache ────────────────────────────────────────────
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  isActive: boolean;
  expiresAt: number;
}

const agencyStatusCache = new Map<string, CacheEntry>();

async function isAgencyActive(agencyId: string): Promise<boolean> {
  const now = Date.now();
  const cached = agencyStatusCache.get(agencyId);

  if (cached && cached.expiresAt > now) {
    return cached.isActive;
  }

  try {
    const db = getDb();
    const [agency] = await db
      .select({ isActive: agencies.isActive })
      .from(agencies)
      .where(eq(agencies.id, agencyId));

    const isActive = agency?.isActive ?? true;
    agencyStatusCache.set(agencyId, { isActive, expiresAt: now + CACHE_TTL_MS });
    return isActive;
  } catch (err) {
    console.error('[KILL SWITCH] DB error checking agency status:', err);
    return true;
  }
}

// ─── Check if tenant is VACATED ─────────────────────────────────────────────
async function isTenantVacated(clerkUserId: string): Promise<boolean> {
  try {
    const db = getDb();
    const [tenant] = await db
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.clerkUserId, clerkUserId))
      .limit(1);

    return tenant?.status === 'VACATED';
  } catch (err) {
    console.error('[MIDDLEWARE] Error checking tenant status:', err);
    // Fail open — don't block if DB is down
    return false;
  }
}

// ─── Exported cache invalidator ──────────────────────────────────────────────
export function invalidateAgencyCache(agencyId: string): void {
  agencyStatusCache.delete(agencyId);
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const path = req.nextUrl.pathname;

  // 1. Always allow public routes
  if (isPublicRoute(req)) return NextResponse.next();

  // 2. Not signed in + protected route → sign-in
  if (!userId && isProtectedRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // 3. Not signed in + any other route → let through
  if (!userId || !sessionClaims) return NextResponse.next();

  // ────────────────────────────────────────────────────────────────────────
  // FIX: Fetch fresh user data from Clerk API instead of relying on
  // sessionClaims.publicMetadata which may be stale or missing.
  // ────────────────────────────────────────────────────────────────────────
  let role: string | null = null;
  let agencyId: string | null = null;
  let buildingId: string | null = null;
  let unitId: string | null = null;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata as Record<string, string | null>;
    role = (meta.role as string) ?? null;
    agencyId = (meta.agencyId as string) ?? null;
    buildingId = (meta.buildingId as string) ?? null;
    unitId = (meta.unitId as string) ?? null;
  } catch (err) {
    console.error('[MIDDLEWARE] Failed to fetch user from Clerk API:', err);
    // Fall back to sessionClaims (may be stale but better than nothing)
    const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, string>;
    role = meta.role ?? null;
    agencyId = meta.agencyId ?? null;
  }

  // 5. Signed-in user on "/" → let app/page.tsx handle redirect server-side
  if (path === '/') return NextResponse.next();

  // 6. Signed-in user hitting /sign-in → send to their dashboard
  if (path.startsWith('/sign-in') && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  // 7. Super-admin route guard
  if (isSuperAdminRoute(req) && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(
      new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
    );
  }

  // 8. Tenant route guard + VACATED check
  if (isTenantRoute(req)) {
    if (role !== 'TENANT') {
      return NextResponse.redirect(
        new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
      );
    }

    const vacated = await isTenantVacated(userId);
    if (vacated && path !== '/deactivated') {
      return NextResponse.redirect(new URL('/deactivated', req.url));
    }
  }

  // 9. Admin route guard + KILL SWITCH check
  if (isAdminRoute(req)) {
    const isStaff = ['AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT'].includes(role ?? '');

    if (!isStaff) {
      return NextResponse.redirect(
        new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
      );
    }

    if (!agencyId) {
      return NextResponse.redirect(new URL('/pending-setup', req.url));
    }

    const active = await isAgencyActive(agencyId);
    if (!active) {
      console.warn(`[KILL SWITCH] Agency ${agencyId} is suspended. User ${userId} blocked from ${path}`);
      return NextResponse.redirect(new URL('/suspended', req.url));
    }

    if (role === 'FIELD_AGENT' && !isAgentRoute(req)) {
      return NextResponse.redirect(new URL('/admin/agent/meter-readings', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};