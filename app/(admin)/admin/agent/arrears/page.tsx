// app/(admin)/admin/agent/arrears/page.tsx
// Full arrears report — FULLY RESPONSIVE desktop table + mobile cards.
// Server Component: fetches data directly, renders responsive layout inline.

import { getDb } from '@/lib/db';
import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getArrearsReport } from '@/lib/analytics/queries';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Arrears Report — PropFlow',
};

const PAGE_SIZE = 25;

export default async function ArrearsPage({
  searchParams,
}: {
  searchParams: Promise<{
    buildingId?: string;
    sortBy?: 'amount' | 'days';
    sortOrder?: 'asc' | 'desc';
    page?: string;
  }>;
}) {
  const session = await requireRole(['AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT']);
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

  // Pagination
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const totalPages = Math.ceil(tenantCount / PAGE_SIZE);
  const offset = (page - 1) * PAGE_SIZE;
  const pagedArrears = arrears.slice(offset, offset + PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const buildPageLink = (newPage: number) => {
    const sp = new URLSearchParams();
    if (params.buildingId) sp.set('buildingId', params.buildingId);
    sp.set('sortBy', params.sortBy ?? 'amount');
    sp.set('sortOrder', params.sortOrder ?? 'desc');
    sp.set('page', String(newPage));
    return `/admin/arrears?${sp.toString()}`;
  };

  // Sort links helper
  const buildSortLink = (sortBy: 'amount' | 'days') => {
    const currentSortBy = params.sortBy ?? 'amount';
    const currentSortOrder = params.sortOrder ?? 'desc';
    const newOrder = currentSortBy === sortBy && currentSortOrder === 'desc' ? 'asc' : 'desc';
    const sp = new URLSearchParams();
    if (params.buildingId) sp.set('buildingId', params.buildingId);
    sp.set('sortBy', sortBy);
    sp.set('sortOrder', newOrder);
    sp.set('page', '1');
    return `/admin/arrears?${sp.toString()}`;
  };

  const currentSortBy = params.sortBy ?? 'amount';
  const currentSortOrder = params.sortOrder ?? 'desc';

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

      {/* Results count */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '24px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {tenantCount} {tenantCount === 1 ? 'Tenant' : 'Tenants'} in Arrears
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </p>

      {pagedArrears.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
          No tenants in arrears. Great job!
        </p>
      ) : (
        <>
          {/* DESKTOP TABLE — hidden on mobile */}
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              display: 'none',
            }}
            className="md:block"
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {[
                      { key: 'tenant', label: 'Tenant', sortable: false },
                      { key: 'unit', label: 'Unit', sortable: false },
                      { key: 'balance', label: 'Balance', sortable: true, sortKey: 'amount' as const },
                      { key: 'months', label: 'Months', sortable: false },
                      { key: 'days', label: 'Days Overdue', sortable: true, sortKey: 'days' as const },
                      { key: 'action', label: 'Action', sortable: false },
                    ].map((h) => (
                      <th
                        key={h.key}
                        style={{
                          padding: '14px 16px',
                          fontSize: '10px',
                          letterSpacing: '0.18em',
                          color: 'rgba(255,255,255,0.35)',
                          textTransform: 'uppercase',
                          fontWeight: 400,
                          textAlign: h.key === 'tenant' ? 'left' : 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h.sortable ? (
                          <Link
                            href={buildSortLink(h.sortKey!)}
                            style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            {h.label}
                            {currentSortBy === h.sortKey && (
                              <span style={{ fontSize: '10px' }}>
                                {currentSortOrder === 'desc' ? '↓' : '↑'}
                              </span>
                            )}
                          </Link>
                        ) : (
                          h.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedArrears.map((arrear) => (
                    <tr
                      key={arrear.tenantId}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, marginBottom: '2px' }}>
                          {arrear.tenantName}
                        </p>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                          {arrear.phone}
                        </p>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                        {arrear.unitNumber}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: '#f87171', fontWeight: 500 }}>
                        KES {arrear.balance.toLocaleString('en-KE')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                        {Math.floor(arrear.daysOverdue / 30)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                        {arrear.daysOverdue} days
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Link
                          href={`/admin/tenants/${arrear.tenantId}`}
                          style={{
                            fontSize: '11px',
                            letterSpacing: '0.12em',
                            color: 'rgba(255,255,255,0.6)',
                            textDecoration: 'none',
                            textTransform: 'uppercase',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '8px 14px',
                            display: 'inline-block',
                            minHeight: '36px',
                            minWidth: '44px',
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS — shown only on mobile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
            {pagedArrears.map((arrear) => (
              <ArrearCard key={arrear.tenantId} arrear={arrear} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px', alignItems: 'center' }}>
              <Link
                href={hasPrev ? buildPageLink(page - 1) : '#'}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  color: hasPrev ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  pointerEvents: hasPrev ? 'auto' : 'none',
                }}
              >
                ← Prev
              </Link>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '0 16px' }}>
                Page {page} of {totalPages}
              </span>
              <Link
                href={hasNext ? buildPageLink(page + 1) : '#'}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  color: hasNext ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  pointerEvents: hasNext ? 'auto' : 'none',
                }}
              >
                Next →
              </Link>
            </div>
          )}
        </>
      )}

      {/* Back link */}
      <div style={{ marginTop: '32px' }}>
        {/*
        <Link
          href="/admin/agent/dashboard"
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
        */}
      </div>
    </div>
  );
}

// ── Mobile Arrear Card ───────────────────────────────────────────────────

function ArrearCard({
  arrear,
}: {
  arrear: {
    tenantId: string;
    tenantName: string;
    phone: string;
    unitNumber: string;
    balance: number;
    daysOverdue: number;
  };
}) {
  const monthsOverdue = Math.floor(arrear.daysOverdue / 30);

  return (
    <Link
      href={`/admin/tenants/${arrear.tenantId}`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        display: 'block',
      }}
    >
      {/* Accent bar — red for arrears */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3px',
          height: '100%',
          backgroundColor: '#f43f5e',
        }}
      />

      {/* Header: Name + Balance */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          paddingLeft: '12px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: '15px', color: '#ffffff', fontWeight: 500, marginBottom: '4px', wordBreak: 'break-word' }}>
            {arrear.tenantName}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            {arrear.phone}
          </p>
        </div>
        <p style={{ fontSize: '14px', color: '#f87171', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: '8px' }}>
          KES {arrear.balance.toLocaleString('en-KE')}
        </p>
      </div>

      {/* Details grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          marginLeft: '12px',
        }}
      >
        <MobileStat label="Unit" value={arrear.unitNumber} />
        <MobileStat label="Months" value={String(monthsOverdue)} />
        <MobileStat label="Days Overdue" value={`${arrear.daysOverdue} days`} />
      </div>

      {/* Action */}
      <div style={{ paddingLeft: '12px' }}>
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '80px',
          }}
        >
          View →
        </span>
      </div>
    </Link>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: '10px',
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '14px',
          color: '#ffffff',
          fontWeight: 500,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
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