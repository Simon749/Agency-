// app/(admin)/admin/tenants/new/page.tsx
import { getDb } from '@/lib/db';
import { buildings, units } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';
import { InviteTenantForm } from './invite-form';

export default async function NewTenantPage() {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect('/pending-setup');

  const db = getDb();

  // Load buildings for the dropdown
  const allBuildings = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId))
    .orderBy(buildings.name);

  // Load all vacant units per building
  const vacantUnits = await db
    .select({
      id: units.id,
      buildingId: units.buildingId,
      unitNumber: units.unitNumber,
      type: units.type,
      rentAmount: units.rentAmount,
      depositAmount: units.depositAmount,
    })
    .from(units)
    .where(
      and(
        eq(units.agencyId, agencyId),
        eq(units.isOccupied, false)
      )
    )
    .orderBy(units.unitNumber);

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Tenant Management
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '56px' }}>
        <a
          href="/admin/tenants"
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', letterSpacing: '0.04em' }}
        >
          ← Tenants
        </a>
        <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
          Add Tenant
        </h1>
      </div>

      <InviteTenantForm
        buildings={allBuildings}
        vacantUnits={vacantUnits}
        agencyId={agencyId}
      />
    </div>
  );
}