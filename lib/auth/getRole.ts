// lib/auth/getRole.ts
// ✅ Server-side helper — only call this from Server Components, layouts, or Server Actions.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export type AppRole =
  | 'SUPER_ADMIN'
  | 'AGENCY_OWNER'
  | 'MANAGER'
  | 'FIELD_AGENT'
  | 'TENANT';

export interface SessionMeta {
  agencyName: string;
  role: AppRole | null;
  agencyId: string | null;
  buildingId: string | null;
  unitId: string | null;
  userId: string;
}

/**
 * Returns the current user's session metadata from Clerk publicMetadata.
 * Redirects to /sign-in if the user is not authenticated.
 *
 * ✅ Requires publicMetadata to be included in the Clerk Session Token.
 *    See CLERK_SETUP.md for instructions.
 */
export async function getSessionMeta(): Promise<SessionMeta> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, string>;

  return {
    userId,
    role:       (meta.role as AppRole) ?? null,
    agencyName: meta.agencyName ?? null,
    agencyId:   meta.agencyId ?? null,
    buildingId: meta.buildingId ?? null,
    unitId:     meta.unitId ?? null,
  };
}

/**
 * Requires the current user to have one of the specified roles.
 * Throws (redirect) to /sign-in if not authenticated.
 * Throws (redirect) to / if authenticated but wrong role.
 *
 * Usage in a layout:
 *   await requireRole(['SUPER_ADMIN']);
 */
export async function requireRole(allowedRoles: AppRole[]): Promise<SessionMeta> {
  const session = await getSessionMeta();

  if (!session.role || !allowedRoles.includes(session.role)) {
    // ✅ This redirect() THROWS internally in Next.js — it must NOT be caught
    // by a generic catch block. In your layout, re-throw it if it's a redirect error.
    redirect('/sign-in');
  }

  return session;
}

/**
 * Returns the role without throwing. Useful for conditional UI rendering.
 * Returns null if unauthenticated or no role set.
 */
export async function getCurrentRole(): Promise<AppRole | null> {
  try {
    const { sessionClaims } = await auth();
    const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, string>;
    return (meta.role as AppRole) ?? null;
  } catch {
    return null;
  }
}