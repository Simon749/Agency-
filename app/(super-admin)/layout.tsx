// app/(super-admin)/super-admin/layout.tsx
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/getRole';
import SignOutCTA from '@/components/auth/SignOutCTA';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(['SUPER_ADMIN']);
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
      throw err;
    }
    redirect('/sign-in');
  }

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
            Super Admin Console
          </span>
          <SignOutCTA />
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
          <NavLink href="/super-admin/dashboard" label="Dashboard" />
          <NavLink href="/super-admin/agencies" label="Agencies" />
        </aside>

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