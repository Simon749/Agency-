// app/(admin)/admin/tenants/[id]/page.tsx
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { tenants, buildings, units, tenantLedger } from '@/db/schema';
import { getSessionMeta } from '@/lib/auth/getRole';
import { getTenantBalance } from '@/lib/ledger';
import { vacateTenant } from './actions';
import Link from 'next/link';

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId) redirect('/pending-setup');

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant || tenant.agencyId !== agencyId) {
    redirect('/admin/tenants');
  }

  const [[building], [unit], balance] = await Promise.all([
    db.select().from(buildings).where(eq(buildings.id, tenant.buildingId)).limit(1),
    db.select().from(units).where(eq(units.id, tenant.unitId)).limit(1),
    getTenantBalance(id),
  ]);

  const canVacate = ['AGENCY_OWNER', 'MANAGER'].includes(role ?? '') && tenant.status !== 'VACATED';

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Tenant Profile
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        {tenant.fullName}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2px', marginBottom: '48px' }}>
        <InfoCard label="Status" value={tenant.status} color={tenant.status === 'VACATED' ? '#f87171' : '#4ade80'} />
        <InfoCard label="Phone" value={tenant.phone} />
        <InfoCard label="Email" value={tenant.email ?? '—'} />
        <InfoCard label="Building" value={building?.name ?? '—'} />
        <InfoCard label="Unit" value={unit?.unitNumber ?? '—'} />
        <InfoCard label="National ID" value={tenant.nationalId ?? '—'} />
      </div>

      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '16px' }}>
          Financial Summary
        </p>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Outstanding Balance</p>
            <p style={{ fontSize: '24px', color: balance.balance > 0 ? '#f87171' : '#4ade80', margin: 0 }}>
              KES {balance.balance.toLocaleString('en-KE')}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Total Charged</p>
            <p style={{ fontSize: '24px', color: '#ffffff', margin: 0 }}>
              KES {balance.totalCharged.toLocaleString('en-KE')}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Total Paid</p>
            <p style={{ fontSize: '24px', color: '#4ade80', margin: 0 }}>
              KES {balance.totalPaid.toLocaleString('en-KE')}
            </p>
          </div>
        </div>
      </div>

      {canVacate && (
        <form action={async () => {
          'use server';
          await vacateTenant(id);
        }}>
          <button
            type="submit"
            disabled={balance.balance > 0}
            style={{
              padding: '14px 28px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.16em',
              color: balance.balance > 0 ? 'rgba(255,255,255,0.3)' : '#0b0b0b',
              backgroundColor: balance.balance > 0 ? 'rgba(255,255,255,0.05)' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: balance.balance > 0 ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
            }}
            title={balance.balance > 0 ? `Outstanding balance: KES ${balance.balance.toLocaleString('en-KE')}` : 'Vacate tenant'}
          >
            {balance.balance > 0 ? 'Cannot Vacate — Outstanding Balance' : 'Vacate Tenant'}
          </button>
        </form>
      )}

      {tenant.status === 'VACATED' && (
        <div style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', padding: '20px' }}>
          <p style={{ fontSize: '14px', color: '#f87171', margin: 0 }}>
            ⚠️ This tenant was vacated on {tenant.vacatedAt?.toLocaleDateString('en-KE')}
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '16px', color: color ?? '#ffffff', margin: 0 }}>{value}</p>
    </div>
  );
}