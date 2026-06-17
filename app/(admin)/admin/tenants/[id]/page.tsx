// app/(admin)/admin/tenants/[id]/page.tsx
import { getDb } from '@/lib/db';
import { tenants, buildings, units, leases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect, notFound } from 'next/navigation';
import { ResendInviteButton } from './resend-button';
import { LedgerSummary } from '@/components/ledger/page';

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect('/pending-setup');

  const db = getDb();

  // Load tenant (scoped to agency)
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, params.id), eq(tenants.agencyId, agencyId)));

  if (!tenant) notFound();

  // Load building + unit
  const [building] = await db
    .select({ name: buildings.name, location: buildings.location })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId));

  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, tenant.unitId));

  // Load active lease
  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.tenantId, tenant.id), eq(leases.status, 'ACTIVE')));

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Tenant Management
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '56px', flexWrap: 'wrap' }}>
        <a href="/admin/tenants" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          ← Tenants
        </a>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 400, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
          {tenant.fullName}
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StatusPill label={tenant.inviteStatus ?? 'PENDING'} type="invite" />
          <StatusPill label={tenant.status} type="status" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2px', marginBottom: '48px' }}>

        {/* Tenant Info */}
        <InfoCard title="Tenant Info">
          <InfoRow label="Phone" value={tenant.phone} />
          <InfoRow label="Email" value={tenant.email ?? '—'} />
          <InfoRow label="National ID" value={tenant.nationalId ?? '—'} />
          <InfoRow label="Joined" value={new Date(tenant.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} />
        </InfoCard>

        {/* Unit Info */}
        <InfoCard title="Unit">
          <InfoRow label="Building" value={building?.name ?? '—'} />
          <InfoRow label="Location" value={building?.location ?? '—'} />
          <InfoRow label="Unit Number" value={unit?.unitNumber ?? '—'} />
          <InfoRow label="Type" value={unit?.type ?? '—'} />
        </InfoCard>

        {/* Lease Summary */}
        <InfoCard title="Active Lease">
          {lease ? (
            <>
              <InfoRow label="Start" value={lease.startDate} />
              <InfoRow label="End" value={lease.endDate} />
              <InfoRow label="Rent" value={`KES ${Number(lease.rentAmount).toLocaleString('en-KE')}`} />
              <InfoRow label="Deposit" value={`KES ${Number(lease.depositAmount).toLocaleString('en-KE')}`} />
              <InfoRow label="Deposit Paid" value={lease.depositPaid ? 'Yes' : 'No'} />
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', paddingTop: '8px' }}>No active lease found.</p>
          )}
        </InfoCard>

        {/* Ledger Summary — placeholder for Week 7 */}
        {/* Ledger Summary — Week 6 */}
        <InfoCard title="Ledger Balance">
          <LedgerSummary tenantId={tenant.id} />
        </InfoCard>
      </div>

      {/* Actions */}
      {tenant.inviteStatus === 'PENDING' && tenant.email && (
        <section>
          <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            Actions
          </p>
          <ResendInviteButton
            email={tenant.email}
            buildingId={tenant.buildingId}
            unitId={tenant.unitId}
          />
        </section>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '28px' }}>
      <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '20px', marginTop: 0 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '16px' }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#ffffff', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatusPill({ label, type }: { label: string; type: 'invite' | 'status' }) {
  const colorMap: Record<string, string> = {
    PENDING: 'rgba(255,200,0,0.85)',
    ACCEPTED: '#4ade80',
    ACTIVE: '#4ade80',
    VACATED: 'rgba(255,255,255,0.35)',
    TERMINATED: '#f87171',
  };
  const color = colorMap[label] ?? 'rgba(255,255,255,0.5)';
  return (
    <span style={{ fontSize: '11px', letterSpacing: '0.12em', color, textTransform: 'uppercase', border: `1px solid ${color}`, padding: '4px 10px' }}>
      {type === 'invite' ? `Invite: ${label}` : label}
    </span>
  );
}