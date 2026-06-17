// app/(admin)/admin/tenants/page.tsx
import { getDb } from '@/lib/db';
import { tenants, buildings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string; status?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect('/pending-setup');

  const db = getDb();

  // Load all buildings for the filter dropdown
  const allBuildings = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId))
    .orderBy(buildings.name);

  // Load tenants with building join
  const rows = await db
    .select({
      id: tenants.id,
      fullName: tenants.fullName,
      phone: tenants.phone,
      email: tenants.email,
      inviteStatus: tenants.inviteStatus,
      status: tenants.status,
      buildingId: tenants.buildingId,
      buildingName: buildings.name,
      unitId: tenants.unitId,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .leftJoin(buildings, eq(tenants.buildingId, buildings.id))
    .where(eq(tenants.agencyId, agencyId))
    .orderBy(desc(tenants.createdAt));

  // Client-side filtering via searchParams
  const params = await searchParams;
  const filterBuilding = params.building;
  const filterStatus = params.status;

  const filtered = rows.filter((t) => {
    if (filterBuilding && t.buildingId !== filterBuilding) return false;
    if (filterStatus) {
      if (filterStatus === 'PENDING' && t.inviteStatus !== 'PENDING') return false;
      if (filterStatus === 'ACTIVE' && (t.status !== 'ACTIVE' || t.inviteStatus !== 'ACCEPTED')) return false;
      if (filterStatus === 'VACATED' && t.status !== 'VACATED') return false;
    }
    return true;
  });

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Tenant Management
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '48px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
          Tenants
        </h1>
        <a
          href="/admin/tenants/new"
          style={{
            fontSize: '12px', fontWeight: 500, letterSpacing: '0.16em', color: '#0b0b0b',
            backgroundColor: '#ffffff', border: '1px solid #ffffff', padding: '12px 24px',
            textDecoration: 'none', textTransform: 'uppercase', fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          + Add Tenant
        </a>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexWrap: 'wrap' }}>
        <select
          name="building"
          defaultValue={filterBuilding ?? ''}
          style={selectStyle}
        >
          <option value="">All Buildings</option>
          {allBuildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={filterStatus ?? ''}
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending Invite</option>
          <option value="ACTIVE">Active</option>
          <option value="VACATED">Vacated</option>
        </select>

        <button type="submit" style={filterBtnStyle}>Filter</button>
        <a href="/admin/tenants" style={{ ...filterBtnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Clear
        </a>
      </form>

      {/* Table */}
      <section>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {filtered.length} {filtered.length === 1 ? 'Tenant' : 'Tenants'}
        </p>

        {filtered.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No tenants found. Add your first tenant above.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '2px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 100px', gap: '16px', padding: '10px 20px', fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
              <span>Name</span>
              <span>Building</span>
              <span>Phone</span>
              <span>Invite</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {filtered.map((tenant) => (
              <div
                key={tenant.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 100px', gap: '16px', padding: '16px 20px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '14px', color: '#ffffff' }}
              >
                <span style={{ fontWeight: 500 }}>{tenant.fullName}</span>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{tenant.buildingName ?? '—'}</span>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{tenant.phone}</span>
                <span>
                  <InviteBadge status={tenant.inviteStatus ?? 'PENDING'} />
                </span>
                <span>
                  <StatusBadge status={tenant.status} />
                </span>
                <span>
                  <a
                    href={`/admin/tenants/${tenant.id}`}
                    style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', display: 'inline-block' }}
                  >
                    View
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InviteBadge({ status }: { status: string }) {
  const color = status === 'ACCEPTED' ? '#4ade80' : 'rgba(255,200,0,0.9)';
  return (
    <span style={{ fontSize: '11px', letterSpacing: '0.1em', color, textTransform: 'uppercase' }}>
      {status === 'ACCEPTED' ? 'Accepted' : 'Pending'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'ACTIVE' ? '#4ade80' : status === 'VACATED' ? 'rgba(255,255,255,0.35)' : 'rgba(255,200,0,0.9)';
  return (
    <span style={{ fontSize: '11px', letterSpacing: '0.1em', color, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', outline: 'none',
  fontFamily: '"Helvetica Neue", sans-serif', cursor: 'pointer', minWidth: '160px',
};

const filterBtnStyle: React.CSSProperties = {
  padding: '10px 20px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.14em',
  color: 'rgba(255,255,255,0.7)', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  cursor: 'pointer', textTransform: 'uppercase', fontFamily: '"Helvetica Neue", sans-serif',
};