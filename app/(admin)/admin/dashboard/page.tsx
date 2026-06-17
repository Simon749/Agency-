// app/(admin)/admin/dashboard/page.tsx
import { getDb } from '@/lib/db';
import { buildings, units, tenants, agencies } from '@/db/schema';
import { eq, count, sql } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();

  const [buildingCount] = await db
    .select({ count: count() })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const [unitCount] = await db
    .select({ count: count() })
    .from(units)
    .where(eq(units.agencyId, agencyId));

  const [tenantCount] = await db
    .select({ count: count() })
    .from(tenants)
    .where(eq(tenants.agencyId, agencyId));

  const [occupiedCount] = await db
    .select({ count: count() })
    .from(units)
    .where(eq(units.agencyId, agencyId) && eq(units.isOccupied, true));

  const [agency] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  const occupancyRate = unitCount.count > 0
    ? Math.round((occupiedCount.count / unitCount.count) * 100)
    : 0;

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
        {agency?.name ?? 'Agency'} Dashboard
      </h1>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '2px',
          maxWidth: '900px',
          marginBottom: '56px',
        }}
      >
        <StatCard label="Buildings" value={String(buildingCount.count)} />
        <StatCard label="Total Units" value={String(unitCount.count)} />
        <StatCard label="Tenants" value={String(tenantCount.count)} />
        <StatCard label="Occupancy" value={`${occupancyRate}%`} />
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <a
          href="/admin/buildings"
          style={{
            fontSize: '13px',
            letterSpacing: '0.14em',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.35)',
            padding: '14px 28px',
            textDecoration: 'none',
            textTransform: 'uppercase',
            display: 'inline-block',
          }}
        >
          Manage Buildings →
        </a>
        {role === 'AGENCY_OWNER' && (
          <a
            href="/admin/settings"
            style={{
              fontSize: '13px',
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '14px 28px',
              textDecoration: 'none',
              textTransform: 'uppercase',
              display: 'inline-block',
            }}
          >
            Settings
          </a>
        )}
      </div>
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
