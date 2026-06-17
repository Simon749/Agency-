// app/(admin)/admin/setup/page.tsx
// First-time setup for Agency Owner — links their Clerk account to the agency

import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function AgencySetupPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, string>;
  const role = meta.role ?? null;
  const existingAgencyId = meta.agencyId ?? null;

  // Already set up → go to dashboard
  if (role === 'AGENCY_OWNER' && existingAgencyId) {
    redirect('/admin/dashboard');
  }

  const db = getDb();

  // Find agency by email (the email used to invite the owner)
  // This assumes the Super Admin created the agency with the owner's email
  // In production, you'd use an invite token instead
  const userEmail = (sessionClaims?.email as string) ?? '';

  const [agency] = userEmail
    ? await db.select().from(agencies).where(eq(agencies.email, userEmail.toLowerCase()))
    : [];

  if (!agency) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0b0b0b',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          fontFamily: '"Helvetica Neue", sans-serif',
        }}
      >
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '24px' }}>
            Setup Required
          </p>
          <h1 style={{ fontSize: '28px', fontWeight: 400, marginBottom: '16px' }}>
            Agency Not Found
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            We couldn't find an agency linked to your email ({userEmail || 'unknown'}).
            Please contact your Super Admin to ensure your agency was created with the correct email.
          </p>
        </div>
      </div>
    );
  }

  // Auto-link: update Clerk metadata with agencyId
  // NOTE: In production, use a Clerk webhook or API call. This is a simplified flow.
  // For now, the Super Admin should manually set publicMetadata via Clerk dashboard
  // or you can add an API route to update metadata.

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b0b0b',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        fontFamily: '"Helvetica Neue", sans-serif',
      }}
    >
      <div style={{ maxWidth: '480px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '24px' }}>
          Welcome to PropFlow
        </p>
        <h1 style={{ fontSize: '28px', fontWeight: 400, marginBottom: '16px' }}>
          {agency.name}
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '32px' }}>
          Your agency has been registered. Your Super Admin needs to set your role to <strong>AGENCY_OWNER</strong> and link your account to this agency in the Clerk dashboard.
        </p>
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', textAlign: 'left', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '8px', fontWeight: 500, color: '#ffffff' }}>Clerk Dashboard Steps:</p>
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            <li>Go to your Clerk dashboard → Users</li>
            <li>Find this user ({userEmail})</li>
            <li>Edit <strong>publicMetadata</strong>:</li>
          </ol>
          <pre style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', overflow: 'auto' }}>
{JSON.stringify({
  role: "AGENCY_OWNER",
  agencyId: agency.id,
  buildingId: null,
  unitId: null
}, null, 2)}
          </pre>
          <p style={{ marginTop: '12px' }}>Then refresh this page.</p>
        </div>
      </div>
    </div>
  );
}
