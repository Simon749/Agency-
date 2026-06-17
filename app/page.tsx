// app/page.tsx — SERVER COMPONENT
// Handles role-based redirect for signed-in users.
// Unauthenticated visitors see the marketing page normally.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import MarketingPage from './MarketingPage';

// add this temporarily:
console.log('SESSION:', JSON.stringify((await auth()).sessionClaims?.publicMetadata));

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:  '/super-admin/dashboard',
  AGENCY_OWNER: '/admin/dashboard',
  MANAGER:      '/admin/dashboard',
  FIELD_AGENT:  '/admin/agent/meter-readings',
  TENANT:       '/tenant/dashboard',
};

export default async function RootPage() {
  const { userId, sessionClaims } = await auth();

  // Only redirect if we have BOTH a session AND a known role.
  // ✅ If role is null (publicMetadata not set in Clerk yet), fall through to
  //    marketing page — prevents blank screen for misconfigured accounts.
  if (userId && sessionClaims) {
    const meta = (sessionClaims.publicMetadata ?? {}) as Record<string, string>;
    const role = meta.role ?? null;
    const destination = role ? ROLE_HOME[role] : null;
    if (destination) redirect(destination);
  }

  // Not signed in OR no role → show marketing page
  return <MarketingPage />;
}