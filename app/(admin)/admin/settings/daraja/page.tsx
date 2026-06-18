// app/(admin)/admin/settings/daraja/page.tsx
// Daraja credentials per building — AGENCY_OWNER only.
// Shows masked credentials + update form per building.

import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getDb } from '@/lib/db';
import { buildings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { updateDarajaCredentials } from '@/lib/settings/actions';

export const metadata = {
  title: 'M-Pesa Settings — PropFlow',
};

export default async function DarajaSettingsPage() {
  await requireRole(['AGENCY_OWNER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) redirect('/pending-setup');

  const db = getDb();
  const buildingList = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      darajaConsumerKey: buildings.darajaConsumerKey,
      darajaConsumerSecret: buildings.darajaConsumerSecret,
      darajaShortcode: buildings.darajaShortcode,
      darajaPasskey: buildings.darajaPasskey,
    })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        M-Pesa (Daraja)
      </h1>

      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.6 }}>
        Configure Safaricom Daraja API credentials per building. Each building can have its own Paybill/Till number. Credentials are encrypted at rest.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {buildingList.map((b) => (
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
                await requireRole(['AGENCY_OWNER']);
                const result = await updateDarajaCredentials(b.id, agencyId, {
                  consumerKey: formData.get('consumerKey') as string,
                  consumerSecret: formData.get('consumerSecret') as string,
                  shortcode: formData.get('shortcode') as string,
                  passkey: formData.get('passkey') as string,
                });
                if (result.success) revalidatePath('/admin/settings/daraja');
              }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', maxWidth: '900px' }}
            >
              <input type="hidden" name="buildingId" value={b.id} />

              <FormField
                name="consumerKey"
                label="Consumer Key"
                placeholder={b.darajaConsumerKey ? '••••••••••••' : 'Enter consumer key'}
              />
              <FormField
                name="consumerSecret"
                label="Consumer Secret"
                placeholder={b.darajaConsumerSecret ? '••••••••••••' : 'Enter consumer secret'}
              />
              <FormField
                name="shortcode"
                label="Shortcode / Paybill"
                placeholder={b.darajaShortcode ? '••••••••••••' : 'e.g. 174379'}
              />
              <FormField
                name="passkey"
                label="Passkey"
                placeholder={b.darajaPasskey ? '••••••••••••' : 'Enter passkey'}
              />

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
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormField({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        style={{
          padding: '12px 0',
          fontSize: '14px',
          backgroundColor: 'transparent',
          color: '#ffffff',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.25)',
          outline: 'none',
          fontFamily: '"Helvetica Neue", sans-serif',
          letterSpacing: '0.01em',
        }}
      />
    </label>
  );
}