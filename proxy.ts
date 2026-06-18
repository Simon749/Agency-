// middleware.ts — root of project
// Updated with agency.isActive kill switch for Week 14.
// Checks agency status on EVERY admin/tenant route hit and redirects to /suspended if inactive.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';

const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isAgentRoute = createRouteMatcher(['/admin/agent(.*)']);
const isTenantRoute = createRouteMatcher(['/tenant(.*)']);
const isProtectedRoute = createRouteMatcher([
  '/super-admin(.*)',
  '/admin(.*)',
  '/tenant(.*)',
]);

// ✅ Sign-in, suspended, and marketing page are always public
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/suspended',
]);

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  AGENCY_OWNER: '/admin/dashboard',
  MANAGER: '/admin/dashboard',
  FIELD_AGENT: '/admin/agent/meter-readings',
  TENANT: '/tenant/dashboard',
};

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const path = req.nextUrl.pathname;

  // 1. Always allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. Not signed in + protected route → sign-in
  if (!userId && isProtectedRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // 3. Not signed in + any other route → let through
  if (!userId || !sessionClaims) return NextResponse.next();

  // 4. Read role and agencyId from publicMetadata
  const meta = (sessionClaims.publicMetadata ?? {}) as Record<string, string>;
  const role = meta.role ?? null;
  const agencyId = meta.agencyId ?? null;

  // 5. Signed-in user on "/" → let app/page.tsx handle redirect server-side
  if (path === '/') {
    return NextResponse.next();
  }

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

  // 8. Tenant route guard
  if (isTenantRoute(req) && role !== 'TENANT') {
    return NextResponse.redirect(
      new URL(role ? (ROLE_HOME[role] ?? '/sign-in') : '/sign-in', req.url)
    );
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

    // ── KILL SWITCH: Check if agency is active ──────────────────────────────
    // This runs on EVERY admin route hit. If agency is suspended, redirect immediately.
    try {
      const db = getDb();
      const [agency] = await db
        .select({ isActive: agencies.isActive })
        .from(agencies)
        .where(eq(agencies.id, agencyId));

      if (agency && !agency.isActive) {
        console.warn(`[KILL SWITCH] Agency ${agencyId} is suspended. User ${userId} blocked from ${path}`);
        return NextResponse.redirect(new URL('/suspended', req.url));
      }
    } catch (err) {
      // If DB is unreachable, fail open (allow access) to prevent lockout
      console.error('[KILL SWITCH] DB error checking agency status:', err);
    }
    // ─────────────────────────────────────────────────────────────────────────

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