// app/(super-admin)/agencies/page.tsx
// Agency list with kill switch toggle. Server Component fetches data.
// Kill switch is a Client Component button that calls a Server Action.

import { getAgencyList } from '@/lib/super-admin/queries';
import { KillSwitchButton } from '@/components/KillSwitchButton';

export const metadata = {
  title: 'Agencies — Super Admin',
};

export default async function AgenciesPage() {
  const agencies = await getAgencyList();

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
        System Management
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
        Agencies
      </h1>

      <p
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '32px',
        }}
      >
        {agencies.length} agencies registered · Click the toggle to suspend or reactivate an agency.
        Suspended agencies immediately block all staff and tenants from accessing the platform.
      </p>

      {/* Agency Table */}
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
              {['Agency', 'Contact', 'Status', 'Buildings', 'Units', 'Tenants', 'Active', 'Last Active', 'Actions'].map(
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
                      textAlign: h === 'Agency' || h === 'Contact' || h === 'Actions' ? 'left' : 'right',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {agencies.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  No agencies registered yet.
                </td>
              </tr>
            ) : (
              agencies.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px' }}>
                      {a.name}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {a.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                      {a.email}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {a.phone}
                    </p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '2px',
                        backgroundColor: a.isActive
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(244,63,94,0.15)',
                        color: a.isActive ? '#10b981' : '#f43f5e',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {a.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                    }}
                  >
                    {a.buildingCount}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                    }}
                  >
                    {a.unitCount}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                    }}
                  >
                    {a.tenantCount}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                    }}
                  >
                    {a.activeTenantCount}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {a.lastActiveAt
                      ? new Date(a.lastActiveAt).toLocaleDateString('en-KE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <KillSwitchButton
                      agencyId={a.id}
                      agencyName={a.name}
                      isActive={a.isActive}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}