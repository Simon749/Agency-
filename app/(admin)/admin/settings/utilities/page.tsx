// app/(admin)/admin/settings/utilities/page.tsx
// Building utility rates — AGENCY_OWNER + MANAGER.
// Configure water, electricity, garbage, service charge, etc.

import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getDb } from '@/lib/db';
import { buildings, buildingUtilities } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { updateUtilityRates } from '@/lib/settings/actions';

export const metadata = {
  title: 'Utility Rates — PropFlow',
};

export default async function UtilitiesSettingsPage() {
  await requireRole(['AGENCY_OWNER', 'MANAGER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) redirect('/pending-setup');

  const db = getDb();
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const utilitiesList = await db
    .select()
    .from(buildingUtilities)
    .where(eq(buildingUtilities.agencyId, agencyId));

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Utility Rates
      </h1>

      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.6 }}>
        Set fixed or per-unit rates for utilities per building. These rates are used when generating monthly bills and calculating meter reading charges.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {buildingList.map((b) => {
          const buildingUtils = utilitiesList.filter((u) => u.buildingId === b.id);
          return (
            <div
              key={b.id}
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '28px 24px',
              }}
            >
              <p style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', marginBottom: '20px' }}>
                {b.name}
              </p>

              <form
                action={async (formData: FormData) => {
                  'use server';
                  await requireRole(['AGENCY_OWNER', 'MANAGER']);
                  const utilities = [];
                  for (const [key, value] of formData.entries()) {
                    if (key.startsWith('utility_')) {
                      const [, utilityName] = key.split('_');
                      utilities.push({ name: utilityName, rate: value as string });
                    }
                  }
                  await updateUtilityRates(b.id, agencyId, utilities);
                  revalidatePath('/admin/settings/utilities');
                }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', maxWidth: '900px' }}
              >
                {['WATER', 'ELECTRICITY', 'GARBAGE', 'SERVICE_CHARGE', 'WIFI', 'SECURITY'].map((utility) => {
                  const existing = buildingUtils.find((u) => u.name === utility);
                  return (
                    <label key={utility} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                        {utility.replace('_', ' ')}
                      </span>
                      <input
                        type="text"
                        name={`utility_${utility}`}
                        defaultValue={existing?.defaultAmount ?? ''}
                        placeholder={existing ? `Current: ${existing.defaultAmount}` : 'Not set'}
                        style={{
                          padding: '12px 0',
                          fontSize: '14px',
                          backgroundColor: 'transparent',
                          color: '#ffffff',
                          border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.25)',
                          outline: 'none',
                          fontFamily: '"Helvetica Neue", sans-serif',
                        }}
                      />
                    </label>
                  );
                })}

                <div style={{ display: 'flex', alignItems: 'flex-end', gridColumn: '1 / -1' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '12px 28px',
                      fontSize: '12px',
                      fontWeight: 500,
                      letterSpacing: '0.16em',
                      color: '#0b0b0b',
                      backgroundColor: '#ffffff',
                      border: '1px solid #ffffff',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      fontFamily: '"Helvetica Neue", sans-serif',
                    }}
                  >
                    Save Rates
                  </button>
                </div>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}