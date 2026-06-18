// app/(admin)/admin/layout.tsx
// Updated for Week 15: added Staff link (AGENCY_OWNER only), Arrears for Field Agent.

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/getRole';
import { getDb } from '@/lib/db';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import SignOutButton from '@/components/auth/SignOutCTA';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireRole(['AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT']);
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
      throw err;
    }
    redirect('/sign-in');
  }

  const { role, agencyId } = session;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let agencyName = 'Agency';
  if (agencyId && UUID_REGEX.test(agencyId)) {
    const db = getDb();
    const [agency] = await db
      .select({ name: agencies.name })
      .from(agencies)
      .where(eq(agencies.id, agencyId));
    if (agency) agencyName = agency.name;
  }

  const navItems: { href: string; label: string; roles: string[] }[] = [
    { href: '/admin/dashboard', label: 'Dashboard', roles: ['AGENCY_OWNER', 'MANAGER'] },
    { href: '/admin/buildings', label: 'Buildings', roles: ['AGENCY_OWNER', 'MANAGER'] },
    { href: '/admin/tenants', label: 'Tenants', roles: ['AGENCY_OWNER', 'MANAGER'] },
    { href: '/admin/leases', label: 'Leases', roles: ['AGENCY_OWNER', 'MANAGER'] },
    { href: '/admin/complaints', label: 'Complaints', roles: ['AGENCY_OWNER', 'MANAGER'] },
    { href: '/admin/arrears', label: 'Arrears', roles: ['AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT'] },
    { href: '/admin/agent/meter-readings', label: 'Meter Readings', roles: ['FIELD_AGENT', 'MANAGER', 'AGENCY_OWNER'] },
    { href: '/admin/agent/receipts', label: 'Receipts', roles: ['FIELD_AGENT', 'MANAGER', 'AGENCY_OWNER'] },
    { href: '/admin/settings', label: 'Settings', roles: ['AGENCY_OWNER'] },
  ];

  const visibleNav = navItems.filter((item) => item.roles.includes(role!));

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b0b0b',
        fontFamily: '"Helvetica Neue", sans-serif',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '64px',
          backgroundColor: '#0b0b0b',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(20px, 4vw, 48px)',
          zIndex: 100,
        }}
      >
        <span
          style={{
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.2em',
            color: '#ffffff',
          }}
        >
          PROPFLOW
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
            }}
          >
            {agencyName} — {role?.replace('_', ' ')}
          </span>
          <SignOutButton />
        </div>
      </header>

      {/* Sidebar + content */}
      <div
        style={{
          display: 'flex',
          paddingTop: '64px',
          minHeight: '100vh',
        }}
      >
        {/* Sidebar nav */}
        <aside
          style={{
            width: '220px',
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.1)',
            padding: '40px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {visibleNav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </aside>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: 'clamp(32px, 4vw, 56px) clamp(24px, 4vw, 56px)',
            color: '#ffffff',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: '10px 28px',
        fontSize: '13px',
        letterSpacing: '0.06em',
        color: 'rgba(255,255,255,0.65)',
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );
}