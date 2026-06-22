// app/(admin)/layout.tsx
// FIX: Removed the DB query for agency name — the dashboard page already
// fetches it. The layout only needs role/auth, not agency data.
// This eliminates one DB round-trip on every single /admin/* page load.

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/getRole';
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
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err;
    redirect('/sign-in');
  }

  const { role } = session;

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
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold tracking-[0.35em] uppercase">PROPFLOW</span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-white/60 md:inline-flex">
              {role?.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.18em] text-white/60 md:hidden">
              {role?.replace('_', ' ')}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="pt-16">
        <div className="md:flex">
          <aside className="hidden w-56 flex-shrink-0 border-r border-white/10 bg-slate-950/95 px-4 py-6 md:block">
            <div className="flex flex-col gap-1">
              {visibleNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </aside>

          <div className="md:hidden border-b border-white/10 bg-slate-950/95 px-4 py-3">
            <nav className="flex flex-wrap items-center gap-2">
              {visibleNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </a>
  );
}