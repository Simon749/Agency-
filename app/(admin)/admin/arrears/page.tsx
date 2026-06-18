// app/(admin)/admin/arrears/page.tsx
// Full arrears report — rebuilt to match existing dark theme + inline styles.
// Server Component: fetches data directly, passes to client component for SMS button.

import { getDb } from '@/lib/db';
import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getArrearsReport } from '@/lib/analytics/queries';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrearsTableClient } from '@/components/ArrearsTableClient';

export const metadata = {
  title: 'Arrears Report — PropFlow',
};

export default async function ArrearsPage({
  searchParams,
}: {
  searchParams: Promise<{
    buildingId?: string;
    sortBy?: 'amount' | 'days';
    sortOrder?: 'asc' | 'desc';
  }>;
}) {
  const session = await requireRole(['AGENCY_OWNER', 'MANAGER']);
  const { agencyId } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();
  const [agency] = await db
    .select({ name: agencies.name })
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  const params = await searchParams;

  const arrears = await getArrearsReport(agencyId, {
    buildingId: params.buildingId,
    sortBy: params.sortBy ?? 'amount',
    sortOrder: params.sortOrder ?? 'desc',
    minBalance: 0.01,
  });

  const totalArrears = arrears.reduce((sum, a) => sum + a.balance, 0);
  const tenantCount = arrears.length;
  const avgDays = tenantCount > 0
    ? Math.round(arrears.reduce((sum, a) => sum + a.daysOverdue, 0) / tenantCount)
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
        Financials
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
        Arrears Report
      </h1>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2px',
          maxWidth: '900px',
          marginBottom: '48px',
        }}
      >
        <StatCard label="Total Arrears" value={`KES ${totalArrears.toLocaleString('en-KE')}`} accent="#f43f5e" />
        <StatCard label="Tenants in Arrears" value={String(tenantCount)} accent="#f43f5e" />
        <StatCard label="Avg. Days Overdue" value={`${avgDays} days`} accent="#f59e0b" />
      </div>

      {/* Arrears Table */}
      <ArrearsTableClient
        arrears={arrears}
        currentSortBy={params.sortBy ?? 'amount'}
        currentSortOrder={params.sortOrder ?? 'desc'}
      />

      {/* Back link */}
      <div style={{ marginTop: '32px' }}>
        <Link
          href="/admin/dashboard"
          style={{
            fontSize: '13px',
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            textTransform: 'uppercase',
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '28px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3px',
          height: '100%',
          backgroundColor: accent,
        }}
      />
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
          fontSize: '32px',
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