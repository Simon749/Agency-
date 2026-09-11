/**
 * middleware.ts — the real kill-switch + route-guard layer.
 *
 * HISTORY / WHY THIS COMMENT IS HERE:
 * This file used to live at the repo root as `proxy.ts`. Next.js only ever
 * executes a file literally named `middleware.ts` (or `.js`) — `proxy.ts`
 * was never picked up by the framework, which meant every check below
 * (kill-switch, role routing, super-admin guard, field-agent restriction)
 * had been fully written but had never actually run, since first commit.
 * If you're wondering why the kill switch "worked" in code review but not
 * in practice, this was why. See CODE_AUDIT_CLOSURE_TRACKER.md Phase 0.
 *
 * DB ACCESS NOTE:
 * Middleware runs on Next's Edge runtime by default, which does not
 * support the `ws` (websocket) package used by lib/db/index.ts's Pool.
 * The kill-switch check below therefore uses `neon()`, the HTTP-based
 * Neon client — a single fetch, no pool, no websocket, Edge-safe. This is
 * intentionally NOT the same DB client used elsewhere in the app; do not
 * "simplify" this to use getDb() without confirming Edge/Node runtime
 * compatibility first.
 *
 * The agencies table has a dedicated RLS policy (`agencies_public_read`,
 * `USING (true)`) specifically so this unauthenticated-context read is
 * allowed — see db/migrations/0004d_clean_rls_reset.sql. Without that
 * policy this query would silently return zero rows under RLS and the
 * kill switch would fail open (see the `?? true` fallback below).
 *
 * Tenant VACATED status is intentionally NOT checked here — that requires
 * RLS session context this layer doesn't have. It's enforced instead in
 * app/tenant/layout.tsx via withAgencyContext-style access, which already
 * exists and works. Don't duplicate that check here.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isAgentRoute = createRouteMatcher(['/admin/agent(.*)']);
const isTenantRoute = createRouteMatcher(['/tenant(.*)']);
const isProtectedRoute = createRouteMatcher(['/super-admin(.*)', '/admin(.*)', '/tenant(.*)']);
const isTenantDetailRoute = createRouteMatcher(['/admin/tenants/([^/]+)']);
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/pending-setup', '/suspended', '/deactivated']);
const isMfaRoute = createRouteMatcher(['/mfa/setup', '/api/mfa/(.*)']);


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

// Lazily created so a missing DATABASE_URL doesn't crash module load in
// environments (like some test runners) that never hit an admin route.
let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('[KILL SWITCH] DATABASE_URL is not set');
    _sql = neon(url);
  }
  return _sql;
}

/**
 * Kill-switch check. Edge-safe (HTTP fetch via neon(), no websocket pool).
 * Relies on the `agencies_public_read` RLS policy (USING (true)) so this
 * unauthenticated-context read is allowed. Fails OPEN on DB error (5-10s
 * cache) so a transient DB blip doesn't lock every agency out — that's a
 * deliberate availability tradeoff, not an oversight. If you want it to
 * fail CLOSED instead, change the catch block below and accept that a
 * Neon outage would then suspend every agency simultaneously.
 */
async function isAgencyActive(agencyId: string): Promise<boolean> {
  const now = Date.now();
  const cached = agencyStatusCache.get(agencyId);
  if (cached && cached.expiresAt > now) {
    return cached.isActive;
  }

  try {
    const sql = getSql();
    const rows = (await sql`SELECT is_active FROM agencies WHERE id = ${agencyId} LIMIT 1`) as Array<{ is_active: boolean }>;
    const isActive = rows[0]?.is_active ?? true;
    agencyStatusCache.set(agencyId, { isActive, expiresAt: now + CACHE_TTL_MS });
    return isActive;
  } catch (err) {
    console.error('[KILL SWITCH] DB error checking agency status:', err);
    agencyStatusCache.set(agencyId, { isActive: true, expiresAt: now + 10_000 });
    return true;
  }
}

// Tenant VACATED status is deliberately NOT checked here.
// See app/tenant/layout.tsx — it already performs this check with proper
// RLS/session context on every tenant page load. Duplicating it here would
// require a second DB round trip in Edge middleware for no real benefit.

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

  // ── Read role from sessionClaims (fast, no API call) ─────────────────────
  const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, string>;
  let role = meta.role ?? null;
  let agencyId = meta.agencyId ?? null;
  let buildingId = meta.buildingId ?? null;
  let unitId = meta.unitId ?? null;

  // If metadata is missing from session, try Clerk API once
  if (!role) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const freshMeta = user.publicMetadata as Record<string, string | null>;
      role = (freshMeta.role as string) ?? null;
      agencyId = (freshMeta.agencyId as string) ?? null;
      buildingId = (freshMeta.buildingId as string) ?? null;
      unitId = (freshMeta.unitId as string) ?? null;
    } catch (err) {
      console.error('[MIDDLEWARE] Failed to fetch user from Clerk API:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE G: MFA ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
 // const requiresMfa = ['AGENCY_OWNER', 'SUPER_ADMIN'].includes(role ?? '');
  //const mfaEnabled = (sessionClaims?.mfa_enabled as boolean) ?? false;

 // if (requiresMfa && !mfaEnabled && !isMfaRoute(req)) {
  //  console.warn(`[MFA] User ${userId} (${role}) blocked — MFA not enabled`);
   // return NextResponse.redirect(new URL('/mfa/setup', req.url));
 // }

  // 5. Signed-in user on "/" → let app/page.tsx handle redirect server-side
  if (path === '/') return NextResponse.next();

  // 6. Signed-in user hitting /sign-in or /sign-up → send to their dashboard
  if ((path.startsWith('/sign-in') || path.startsWith('/sign-up')) && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  // 7. Super-admin route guard
  if (isSuperAdminRoute(req) && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(
      new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
    );
  }

  // 8. Tenant route guard. VACATED status is checked in app/tenant/layout.tsx,
  // not here — see the file header comment for why.
  if (isTenantRoute(req)) {
    if (role !== 'TENANT') {
      return NextResponse.redirect(
        new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
      );
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

    if (role === 'FIELD_AGENT' && !isAgentRoute(req) && !isTenantDetailRoute(req)) {
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