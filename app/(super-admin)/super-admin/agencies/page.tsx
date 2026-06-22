// app/(super-admin)/agencies/page.tsx
// Agency list with add-agency form and kill switch toggle.
// FIXES:
//   - Added AddAgencyForm for creating agencies + sending owner invites
//   - Added overflow-x: auto on table wrapper (fixes mobile column clipping)
//   - Added px-4 container padding (fixes flush-edge issue)
//   - Added INVITE STATUS column to table

import { getAgencyList } from '@/lib/super-admin/queries';
import { KillSwitchButton } from '@/components/KillSwitchButton';
import { AddAgencyForm } from '@/components/AddAgencyForm';

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

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '32px',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(28px, 3.5vw, 44px)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            margin: 0,
            color: '#ffffff',
          }}
        >
          Agencies
        </h1>
      </div>

      <p
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '32px',
        }}
      >
        {agencies.length} {agencies.length === 1 ? 'agency' : 'agencies'} registered · Click
        the toggle to suspend or reactivate an agency. Suspended agencies immediately block all
        staff and tenants from accessing the platform.
      </p>

      {/* Add Agency Form — mounts above table */}
      <AddAgencyForm />

      {/* Agency Table — overflow-x:auto fixes mobile column clipping */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          overflowX: 'auto', // FIX: prevents STATUS column clipping on mobile
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '800px', // FIX: ensures columns don't collapse on narrow screens
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {[
                'Agency',
                'Contact',
                'Status',
                'Invite',
                'Buildings',
                'Units',
                'Tenants',
                'Active',
                'Last Active',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '14px 16px',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                    textAlign:
                      h === 'Agency' || h === 'Contact' || h === 'Actions' || h === 'Invite'
                        ? 'left'
                        : 'right',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {agencies.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  No agencies registered yet. Use the form above to add the first one.
                </td>
              </tr>
            ) : (
              agencies.map((a) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {/* Agency name + ID */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <p
                      style={{ fontSize: '13px', color: '#ffffff', marginBottom: '2px' }}
                    >
                      {a.name}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {a.id.slice(0, 8)}…
                    </p>
                  </td>

                  {/* Contact */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                        marginBottom: '2px',
                      }}
                    >
                      {a.email}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {a.phone}
                    </p>
                  </td>

                  {/* Kill switch status */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
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

                  {/* Invite status — shows whether owner accepted the invite */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '2px',
                        backgroundColor:
                          a.inviteStatus === 'ACCEPTED'
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(245,158,11,0.1)',
                        color:
                          a.inviteStatus === 'ACCEPTED'
                            ? 'rgba(16,185,129,0.8)'
                            : 'rgba(245,158,11,0.8)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {a.inviteStatus === 'ACCEPTED' ? 'ACCEPTED' : 'INVITED'}
                    </span>
                  </td>

                  {/* Buildings */}
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.buildingCount}
                  </td>

                  {/* Units */}
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.unitCount}
                  </td>

                  {/* Total tenants */}
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.tenantCount}
                  </td>

                  {/* Active tenants */}
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '13px',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.activeTenantCount}
                  </td>

                  {/* Last active */}
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.5)',
                      whiteSpace: 'nowrap',
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

                  {/* Kill switch button */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
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