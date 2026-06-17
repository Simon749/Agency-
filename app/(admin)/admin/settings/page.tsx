// app/(admin)/admin/settings/page.tsx
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await getSessionMeta();
  if (session.role !== 'AGENCY_OWNER') {
    redirect('/admin/dashboard');
  }
  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Settings
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
        Agency settings coming in Week 15. This page will manage staff invites, Daraja credentials, and lease templates.
      </p>
    </div>
  );
}
