// app/(super-admin)/dashboard/page.tsx
// Super Admin system-wide dashboard — KPIs across all agencies.
// Server Component with direct DB queries.

import { getSystemMetrics } from '@/lib/super-admin/queries';
import Link from 'next/link';

export const metadata = {
  title: 'Super Admin — PropFlow',
};

export default async function SuperAdminDashboard() {
  const metrics = await getSystemMetrics();

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
        System Overview
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
        Super Admin Dashboard
      </h1>

      {/* KPI Cards */}
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
          label="Agencies"
          value={String(metrics.totalAgencies)}
          sub={`${metrics.activeAgencies} active · ${metrics.suspendedAgencies} suspended`}
          accent="#3b82f6"
        />
        <StatCard
          label="Buildings"
          value={String(metrics.totalBuildings)}
          sub="Across all agencies"
          accent="#10b981"
        />
        <StatCard
          label="Units"
          value={`${metrics.occupiedUnits} / ${metrics.totalUnits}`}
          sub={`${metrics.totalUnits > 0 ? Math.round((metrics.occupiedUnits / metrics.totalUnits) * 100) : 0}% occupancy`}
          accent="#f59e0b"
        />
        <StatCard
          label="Tenants"
          value={`${metrics.activeTenants} / ${metrics.totalTenants}`}
          sub="Active / Total"
          accent="#8b5cf6"
        />
        <StatCard
          label="Rent Collected (This Month)"
          value={`KES ${metrics.totalRentCollectedThisMonth.toLocaleString('en-KE')}`}
          sub="All agencies combined"
          accent="#10b981"
        />
        <StatCard
          label="Outstanding Balance"
          value={`KES ${metrics.totalOutstandingBalance.toLocaleString('en-KE')}`}
          sub="Total arrears across all tenants"
          accent="#f43f5e"
        />
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Link
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
          }}
        >
          Manage Agencies →
        </Link>
      </div>
    </div>
  );
}

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