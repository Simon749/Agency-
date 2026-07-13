// app/(admin)/admin/settings/staff/page.tsx
// Staff management: list, invite, deactivate, assign buildings.
// FULLY RESPONSIVE — desktop table + mobile cards
// AGENCY_OWNER only. Server Component with inline styles.

import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getStaffByAgency } from '@/lib/staff/queries';
import { getDb } from '@/lib/db';
import { buildings, staff } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { StaffInviteForm } from '@/components/StaffInviteForm';

export const metadata = {
  title: 'Staff Management — PropFlow',
};

// Type for staff member returned by getStaffByAgency
interface StaffMember {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  assignedBuildings?: { id: string; name: string }[];
}

export default async function StaffSettingsPage() {
  await requireRole(['AGENCY_OWNER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const staffList = (await getStaffByAgency(agencyId)) as StaffMember[];

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

      {/* Invite Form — client component for interactivity */}
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

        {staffList.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No staff members yet. Invite your first staff member above.
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
                      {['Name', 'Contact', 'Role', 'Buildings', 'Status', 'Action'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '14px 16px',
                            fontSize: '10px',
                            letterSpacing: '0.18em',
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase',
                            fontWeight: 400,
                            textAlign: h === 'Name' ? 'left' : 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((staff) => (
                      <tr
                        key={staff.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <p style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, marginBottom: '2px' }}>
                            {staff.fullName || '—'}
                          </p>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          <p style={{ margin: 0 }}>{staff.email}</p>
                          {staff.phone && (
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0' }}>
                              {staff.phone}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <RoleBadge role={staff.role} />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                          {staff.assignedBuildings && staff.assignedBuildings.length > 0
                            ? staff.assignedBuildings.map((b) => b.name).join(', ')
                            : 'All buildings'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <StatusBadge status={staff.status} />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {staff.role !== 'AGENCY_OWNER' && staff.status === 'ACTIVE' && (
                            <form action={deactivateStaff}>
                              <input type="hidden" name="staffId" value={staff.id} />
                              <button
                                type="submit"
                                style={{
                                  fontSize: '11px',
                                  letterSpacing: '0.12em',
                                  color: '#f87171',
                                  backgroundColor: 'transparent',
                                  border: '1px solid rgba(248,113,113,0.3)',
                                  padding: '8px 14px',
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                  fontFamily: 'inherit',
                                  minHeight: '36px',
                                  minWidth: '44px',
                                }}
                              >
                                Deactivate
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARDS — shown only on mobile */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
              {staffList.map((staff) => (
                <StaffCard key={staff.id} staff={staff} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Server Action: Deactivate Staff ──────────────────────────────────────

async function deactivateStaff(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (role !== 'AGENCY_OWNER' || !agencyId) return;

  const staffId = formData.get('staffId') as string;
  if (!staffId) return;

  const db = getDb();
  await db
    .update(staff)
    .set({ status: 'INACTIVE' })
    .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));

  revalidatePath('/admin/settings/staff');
}

// ── Mobile Staff Card ────────────────────────────────────────────────────

function StaffCard({ staff }: { staff: StaffMember }) {
  const roleColors: Record<string, string> = {
    AGENCY_OWNER: '#f59e0b',
    MANAGER: '#3b82f6',
    FIELD_AGENT: '#a855f7',
  };
  const accentColor = roleColors[staff.role] ?? 'rgba(255,255,255,0.5)';

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
          width: '3px',
          height: '100%',
          backgroundColor: accentColor,
        }}
      />

      {/* Header: Name + Status */}
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
            {staff.fullName || staff.email}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            {staff.email}
          </p>
        </div>
        <StatusBadge status={staff.status} />
      </div>

      {/* Details grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          marginLeft: '12px',
        }}
      >
        <MobileStat label="Role" value={staff.role.replace('_', ' ')} valueColor={accentColor} />
        <MobileStat label="Phone" value={staff.phone || '—'} />
        <MobileStat
          label="Buildings"
          value={
            staff.assignedBuildings && staff.assignedBuildings.length > 0
              ? staff.assignedBuildings.map((b) => b.name).join(', ')
              : 'All buildings'
          }
        />
        <MobileStat label="Status" value={staff.status} valueColor={staff.status === 'ACTIVE' ? '#4ade80' : '#f87171'} />
      </div>

      {/* Action */}
      {staff.role !== 'AGENCY_OWNER' && staff.status === 'ACTIVE' && (
        <div style={{ paddingLeft: '12px' }}>
          <form action={deactivateStaff} style={{ display: 'inline' }}>
            <input type="hidden" name="staffId" value={staff.id} />
            <button
              type="submit"
              style={{
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: '#f87171',
                backgroundColor: 'transparent',
                border: '1px solid rgba(248,113,113,0.3)',
                padding: '10px 16px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontFamily: 'inherit',
                minHeight: '44px',
                minWidth: '80px',
              }}
            >
              Deactivate
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MobileStat({
  label,
  value,
  valueColor = '#ffffff',
}: {
  label: string;
  value: string;
  valueColor?: string;
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
          color: valueColor,
          fontWeight: 500,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    AGENCY_OWNER: '#f59e0b',
    MANAGER: '#3b82f6',
    FIELD_AGENT: '#a855f7',
  };

  const color = colors[role] ?? 'rgba(255,255,255,0.5)';

  return (
    <span
      style={{
        fontSize: '10px',
        letterSpacing: '0.1em',
        color,
        textTransform: 'uppercase',
        border: `1px solid ${color}`,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {role.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'ACTIVE' ? '#4ade80' : '#f87171';

  return (
    <span
      style={{
        fontSize: '10px',
        letterSpacing: '0.1em',
        color,
        textTransform: 'uppercase',
        border: `1px solid ${color}`,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        marginLeft: '8px',
      }}
    >
      {status}
    </span>
  );
}