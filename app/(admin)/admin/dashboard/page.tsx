// app/(admin)/admin/dashboard/page.tsx
// Agency Owner analytics dashboard — FULLY RESPONSIVE
// Uses inline styles (matching existing aesthetic) + Tailwind for responsive utilities
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
          fontSize: 'clamp(24px, 4vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '32px',
          color: '#ffffff',
          lineHeight: 1.2,
        }}
      >
        {agency?.name ?? 'Agency'} Dashboard
      </h1>

      {/* ── KPI Cards ── */}
      {/* RESPONSIVE: 1 col mobile → 2 col tablet → 4 col desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2px',
          maxWidth: '1100px',
          marginBottom: '40px',
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
      {/* RESPONSIVE: Stack on mobile, side-by-side on md+ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2px',
          maxWidth: '1100px',
          marginBottom: '40px',
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
      {/* RESPONSIVE: Stack buttons on mobile, wrap naturally */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '40px' }}>
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
            display: 'flex',
            textAlign: 'center',
            minHeight: '48px',
            alignItems: 'center',
            justifyContent: 'center',
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
            textAlign: 'center',
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
              textAlign: 'center',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Sub-components (inline styles, fully responsive) ───────────────────────────────

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
        padding: '24px 20px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
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
          fontSize: '10px',
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          lineHeight: 1.4,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 400,
          letterSpacing: '-0.03em',
          color: '#ffffff',
          lineHeight: 1.1,
          marginBottom: '8px',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.06em',
          lineHeight: 1.4,
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
        padding: '24px 20px',
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
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px', wordBreak: 'break-word' }}>
                  {p.tenantName}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {p.buildingName} · Unit {p.unitNumber}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
        padding: '24px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
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
                alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px', wordBreak: 'break-word' }}>
                  {a.fullName}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {a.buildingName} · Unit {a.unitNumber} · {a.daysOverdue}d overdue
                </p>
              </div>
              <p style={{ fontSize: '13px', color: '#f43f5e', fontWeight: 500, flexShrink: 0 }}>
                KES {a.balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))
        )}
      </div>

      <Link
        href="/admin/arrears"
        style={{
          marginTop: '16px',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: '#f43f5e',
          textDecoration: 'none',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '12px',
          border: '1px solid rgba(244,63,94,0.3)',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
    <div>
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
                        whiteSpace: 'nowrap',
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
                          whiteSpace: 'nowrap',
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
                        whiteSpace: 'nowrap',
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
                        whiteSpace: 'nowrap',
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
                        whiteSpace: 'nowrap',
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
                            flexShrink: 0,
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
      </div>

      {/* MOBILE CARDS — shown only on mobile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
        {buildings.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.35)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            No buildings found.
          </div>
        ) : (
          buildings.map((b) => (
            <BuildingCard key={b.buildingId} building={b} />
          ))
        )}
      </div>
    </div>
  );
}

// Mobile-only building card component
function BuildingCard({
  building: b,
}: {
  building: Awaited<ReturnType<typeof getBuildingBreakdown>>[number];
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '3px',
          backgroundColor: b.occupancyRate >= 90 ? '#10b981' : '#f59e0b',
        }}
      />

      {/* Building name + locale */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '15px', color: '#ffffff', fontWeight: 500, marginBottom: '4px' }}>
          {b.buildingName}
        </p>
        {b.locale && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{b.locale}</p>
        )}
      </div>

      {/* Stats grid — 2 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <StatItem label="Units" value={b.totalUnits.toString()} />
        <StatItem label="Occupied" value={`${b.occupiedUnits} (${b.occupancyRate}%)`} />
        <StatItem label="Expected" value={`KES ${b.expectedRent.toLocaleString('en-KE')}`} />
        <StatItem label="Collected" value={`KES ${b.totalRentCollected.toLocaleString('en-KE')}`} color="#10b981" />
        <StatItem label="Outstanding" value={`KES ${b.totalOutstanding.toLocaleString('en-KE')}`} color="#f43f5e" />
        <StatItem label="Collection" value={`${b.collectionRate}%`} />
      </div>

      {/* Collection rate bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', minWidth: '36px' }}>
          {b.collectionRate}%
        </span>
        <div
          style={{
            flex: 1,
            height: '4px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
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
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
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
          color: color || '#ffffff',
          fontWeight: 500,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
}