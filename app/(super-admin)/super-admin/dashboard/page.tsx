// app/(super-admin)/dashboard/page.tsx
import { getDb } from '@/lib/db';
import { agencies } from '@/db/schema';
import { eq, count } from 'drizzle-orm';

export default async function SuperAdminDashboard() {
  const db = getDb();

  const [totalAgencies]  = await db.select({ count: count() }).from(agencies);
  const [activeAgencies] = await db
    .select({ count: count() })
    .from(agencies)
    .where(eq(agencies.isActive, true));

  return (
    <div>
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        Overview
      </p>
      <h1
        style={{
          fontSize: 'clamp(28px, 3.5vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '48px',
          color: '#ffffff',
        }}
      >
        Console
      </h1>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2px',
          maxWidth: '720px',
          marginBottom: '56px',
        }}
      >
        <StatCard label="Total Agencies" value={String(totalAgencies.count)} />
        <StatCard label="Active Agencies" value={String(activeAgencies.count)} />
      </div>

      <a
        href="/super-admin/agencies"
        style={{
          fontSize: '13px',
          letterSpacing: '0.14em',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.35)',
          padding: '14px 28px',
          textDecoration: 'none',
          textTransform: 'uppercase',
          display: 'inline-block',
          transition: 'border-color 0.2s ease',
        }}
      >
        Manage Agencies →
      </a>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '28px 24px',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '40px',
          fontWeight: 400,
          letterSpacing: '-0.03em',
          color: '#ffffff',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}