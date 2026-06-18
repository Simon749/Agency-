// app/(admin)/admin/settings/staff/page.tsx
// Staff management: list, invite, deactivate, assign buildings.
// AGENCY_OWNER only. Server Component with inline styles.

import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getStaffByAgency } from '@/lib/staff/queries';
import { getDb } from '@/lib/db';
import { buildings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { StaffInviteForm } from '@/components/StaffInviteForm';
import { StaffTable } from '@/components/StaffTable';

export const metadata = {
  title: 'Staff Management — PropFlow',
};

export default async function StaffSettingsPage() {
  await requireRole(['AGENCY_OWNER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const staffList = await getStaffByAgency(agencyId);

  // Get buildings for assignment dropdown
  const db = getDb();
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Staff Management
      </h1>

      {/* Invite Form */}
      <section style={{ marginBottom: '72px' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          Invite New Staff
        </p>
        <StaffInviteForm buildings={buildingList} />
      </section>

      {/* Staff List */}
      <section>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {staffList.length} {staffList.length === 1 ? 'Staff Member' : 'Staff Members'}
        </p>
        <StaffTable staffList={staffList} buildings={buildingList} />
      </section>
    </div>
  );
}