// app/(admin)/admin/settings/staff/page.tsx
import { getDb } from '@/lib/db';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';
import { clerkClient } from '@clerk/nextjs/server';
import { StaffInviteForm } from './staff-invite-form';

export default async function StaffPage() {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  // Only AGENCY_OWNER can manage staff
  if (!agencyId || role !== 'AGENCY_OWNER') redirect('/admin/dashboard');

  // List existing staff from Clerk (users with this agencyId)
  const clerk = await clerkClient();
  const { data: allUsers } = await clerk.users.getUserList({ limit: 100 });

  const staff = allUsers.filter((u) => {
    const meta = u.publicMetadata as Record<string, string>;
    return meta.agencyId === agencyId && meta.role !== 'TENANT' && meta.role !== 'SUPER_ADMIN';
  });

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', color: '#ffffff', marginBottom: '56px' }}>
        Staff Management
      </h1>

      {/* Invite Form */}
      <section style={{ marginBottom: '72px' }}>
        <p style={sectionLabelStyle}>Invite Staff Member</p>
        <StaffInviteForm agencyId={agencyId} />
      </section>

      {/* Staff List */}
      <section>
        <p style={sectionLabelStyle}>
          {staff.length} Staff Member{staff.length !== 1 ? 's' : ''}
        </p>

        {staff.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
            No staff members yet. Invite a Manager or Field Agent above.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '2px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', padding: '10px 20px', fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
            </div>
            {staff.map((user) => {
              const meta = user.publicMetadata as Record<string, string>;
              const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
              const email = user.emailAddresses[0]?.emailAddress ?? '—';
              return (
                <div
                  key={user.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', padding: '16px 20px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '14px', color: '#ffffff' }}
                >
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>{email}</span>
                  <span style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                    {(meta.role ?? '—').replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', marginBottom: '24px', paddingBottom: '12px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};