// proxy.ts  (or middleware.ts) — root of project
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isAgentRoute = createRouteMatcher(['/admin/agent(.*)']);
const isTenantRoute = createRouteMatcher(['/tenant(.*)']);
const isProtectedRoute = createRouteMatcher([
  '/super-admin(.*)',
  '/admin(.*)',
  '/tenant(.*)',
]);

// ✅ Sign-in and marketing page are always public
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
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

  // 1. Always allow public routes — marketing page and sign-in
  //    ✅ Fixes: signed-out users being blocked from seeing /
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. Not signed in + protected route → sign-in
  if (!userId && isProtectedRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // 3. Not signed in + any other route → let through
  if (!userId || !sessionClaims) return NextResponse.next();

  // 4. Read role from publicMetadata
  //    ✅ Requires "publicMetadata": "{{user.public_metadata}}" in Clerk Session Token
  const meta = (sessionClaims.publicMetadata ?? {}) as Record<string, string>;
  const role = meta.role ?? null;
  const agencyId = meta.agencyId ?? null;

  // 5. Signed-in user on "/" → app/page.tsx handles the role redirect server-side.
  //    Middleware does NOT redirect here — avoids double-redirect race condition.
  if (path === '/') {
    return NextResponse.next();
  }

  // 6. Signed-in user hitting /sign-in → send to their dashboard
  if (path.startsWith('/sign-in') && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }
  // No role = let them reach sign-in even if technically "signed in"

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

  // 9. Admin route guard
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
    if (role === 'FIELD_AGENT' && !isAgentRoute(req)) {
      return NextResponse.redirect(new URL('/admin/agent/meter-readings', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};