// app/(admin)/admin/dashboard/page.tsx
// Agency Owner analytics dashboard — rebuilt to match existing dark theme.
// Uses inline styles (not Tailwind classes) to match the layout.tsx aesthetic.
// Direct DB queries (Server Component) — no API routes.

import { getDb } from '@/lib/db';
import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import {
  buildings,
  units,
  tenants,
  tenantLedger,
  agencies,
} from '@/db/schema';
import { eq, and, count, sql, desc, sum, gte, lte } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getDashboardSummary,
  getBuildingBreakdown,
  getRecentPayments,
  getArrearsReport,
} from '@/lib/analytics/queries';

export const metadata = {
  title: 'Dashboard — PropFlow',
};

export default async function AdminDashboard() {
  const session = await requireRole(['AGENCY_OWNER', 'MANAGER']);
  const { agencyId, role } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();

  // Fetch agency name
  const [agency] = await db
    .select({ name: agencies.name })
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  // Fetch all analytics in parallel
  const [summary, breakdown, payments, arrears] = await Promise.all([
    getDashboardSummary(agencyId),
    getBuildingBreakdown(agencyId),
    getRecentPayments(agencyId, 8),
    getArrearsReport(agencyId, { sortBy: 'amount', sortOrder: 'desc', minBalance: 0.01 }),
  ]);

  const totalArrears = arrears.reduce((sum, a) => sum + a.balance, 0);
  const arrearsCount = arrears.length;

  return (
    <div>
      {/* Section label */}
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

      {/* ── KPI Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2px',
          maxWidth: '1100px',
          marginBottom: '56px',
        }}
      >
        <StatCard
          label="Rent Collected (This Month)"
          value={`KES ${summary.totalRentCollectedThisMonth.toLocaleString('en-KE')}`}
          sub={`${summary.collectionRate}% collection rate`}
          accent={summary.collectionRate >= 80 ? '#10b981' : '#f59e0b'}
        />
        <StatCard
          label="Outstanding Balance"
          value={`KES ${summary.totalOutstandingBalance.toLocaleString('en-KE')}`}
          sub={`${arrearsCount} tenants in arrears`}
          accent="#f43f5e"
        />
        <StatCard
          label="Occupancy Rate"
          value={`${summary.occupancyRate}%`}
          sub={`${summary.occupiedUnits} / ${summary.totalUnits} units occupied`}
          accent={summary.occupancyRate >= 90 ? '#10b981' : '#f59e0b'}
        />
        <StatCard
          label="Portfolio"
          value={`${summary.totalBuildings}`}
          sub={`${summary.totalUnits} units · ${summary.activeTenants} active tenants`}
          accent="#3b82f6"
        />
      </div>

      {/* ── Two Column: Recent Payments + Arrears Quick View ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px',
          maxWidth: '1100px',
          marginBottom: '56px',
        }}
      >
        <RecentPaymentsCard payments={payments} />
        <ArrearsQuickCard arrears={arrears.slice(0, 5)} totalArrears={totalArrears} />
      </div>

      {/* ── Building Breakdown Table ── */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '24px',
          marginTop: '48px',
        }}
      >
        Building Breakdown
      </p>
      <BuildingTable buildings={breakdown} />

      {/* ── CTA Links ── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '48px' }}>
        <Link
          href="/admin/arrears"
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
          View Arrears Report →
        </Link>
        <Link
          href="/admin/buildings"
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
          Manage Buildings
        </Link>
        {role === 'AGENCY_OWNER' && (
          <Link
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
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Sub-components (inline styles, no Tailwind) ───────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
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
          marginBottom: '8px',
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.06em',
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function RecentPaymentsCard({
  payments,
}: {
  payments: Awaited<ReturnType<typeof getRecentPayments>>;
}) {
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
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}
      >
        Recent Payments
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {payments.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            No payments this period.
          </p>
        ) : (
          payments.map((p) => (
            <div
              key={`${p.referenceCode ?? ''}-${p.date}-${p.tenantName}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div>
                <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px' }}>
                  {p.tenantName}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {p.buildingName} · Unit {p.unitNumber}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', color: '#10b981', fontWeight: 500 }}>
                  +KES {p.amount.toLocaleString('en-KE')}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
                  {p.method} · {new Date(p.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ArrearsQuickCard({
  arrears,
  totalArrears,
}: {
  arrears: Awaited<ReturnType<typeof getArrearsReport>>;
  totalArrears: number;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(244,63,94,0.06)',
        border: '1px solid rgba(244,63,94,0.2)',
        padding: '28px 24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
          }}
        >
          Arrears Alert
        </p>
        <p style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 500 }}>
          KES {totalArrears.toLocaleString('en-KE')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {arrears.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            No tenants in arrears. Great job!
          </p>
        ) : (
          arrears.map((a) => (
            <div
              key={a.tenantId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div>
                <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px' }}>
                  {a.fullName}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {a.buildingName} · Unit {a.unitNumber} · {a.daysOverdue}d overdue
                </p>
              </div>
              <p style={{ fontSize: '13px', color: '#f43f5e', fontWeight: 500 }}>
                KES {a.balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))
        )}
      </div>

      <Link
        href="/admin/arrears"
        style={{
          display: 'block',
          marginTop: '16px',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: '#f43f5e',
          textDecoration: 'none',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '10px',
          border: '1px solid rgba(244,63,94,0.3)',
        }}
      >
        View Full Arrears Report →
      </Link>
    </div>
  );
}

function BuildingTable({
  buildings,
}: {
  buildings: Awaited<ReturnType<typeof getBuildingBreakdown>>;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {['Building', 'Units', 'Occupied', 'Occupancy', 'Expected', 'Collected', 'Outstanding', 'Collection'].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    padding: '14px 16px',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    fontWeight: 400,
                    textAlign: h === 'Building' ? 'left' : 'right',
                  }}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {buildings.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                No buildings found.
              </td>
            </tr>
          ) : (
            buildings.map((b) => (
              <tr
                key={b.buildingId}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  transition: 'background-color 0.15s',
                }}
              >
                <td style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px' }}>{b.buildingName}</p>
                  {b.locale && (
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{b.locale}</p>
                  )}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: '#ffffff' }}>
                  {b.totalUnits}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: '#ffffff' }}>
                  {b.occupiedUnits}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '2px',
                      backgroundColor: b.occupancyRate >= 90 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: b.occupancyRate >= 90 ? '#10b981' : '#f59e0b',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {b.occupancyRate}%
                  </span>
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  KES {b.expectedRent.toLocaleString('en-KE')}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    color: '#10b981',
                    fontWeight: 500,
                  }}
                >
                  KES {b.totalRentCollected.toLocaleString('en-KE')}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    color: '#f43f5e',
                  }}
                >
                  KES {b.totalOutstanding.toLocaleString('en-KE')}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', minWidth: '28px' }}>
                      {b.collectionRate}%
                    </span>
                    <div
                      style={{
                        width: '40px',
                        height: '3px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${b.collectionRate}%`,
                          height: '100%',
                          backgroundColor: b.collectionRate >= 80 ? '#10b981' : '#f59e0b',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}