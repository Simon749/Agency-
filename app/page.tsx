// app/page.tsx — FIXED
// redirect() throws internally in Next.js — do NOT catch it.

import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import MarketingPage from './MarketingPage';

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  AGENCY_OWNER: '/admin/dashboard',
  MANAGER: '/admin/dashboard',
  FIELD_AGENT: '/admin/agent/meter-readings',
  TENANT: '/tenant/dashboard',
};

export default async function RootPage() {
  const { userId } = await auth();

  // Not signed in → show marketing page immediately
  if (!userId) {
    return <MarketingPage />;
  }

  // Signed in → fetch role and redirect (this is NOT in try/catch!)
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = user.publicMetadata as Record<string, string | null>;
  const role = meta.role ?? null;

  const destination = role ? ROLE_HOME[role] : null;

  if (destination) {
    redirect(destination); 
  }

  // Signed in but no role → show marketing page (edge case)
  return <MarketingPage />;
}