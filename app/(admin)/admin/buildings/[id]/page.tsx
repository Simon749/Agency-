// app/(admin)/admin/buildings/[id]/page.tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings, buildingUtilities, units } from '@/db/schema';
import { eq, count, and } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect, notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BuildingDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();

  // Fetch building — scoped to agency
  const [building] = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.id, id), eq(buildings.agencyId, agencyId)));

  if (!building) {
    notFound();
  }

  // Fetch utilities for this building
  const utilities = await db
    .select()
    .from(buildingUtilities)
    .where(and(eq(buildingUtilities.buildingId, id), eq(buildingUtilities.agencyId, agencyId)));

  // Count units
  const [unitCount] = await db
    .select({ count: count() })
    .from(units)
    .where(and(eq(units.buildingId, id), eq(units.agencyId, agencyId)));

  const utilityOptions = [
    { key: 'RENT', label: 'Rent', alwaysOn: true },
    { key: 'WATER', label: 'Water' },
    { key: 'ELECTRICITY', label: 'Electricity' },
    { key: 'GARBAGE', label: 'Garbage' },
    { key: 'SERVICE_CHARGE', label: 'Service Charge' },
    { key: 'WIFI', label: 'WiFi' },
    { key: 'SECURITY', label: 'Security' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        <a href="/admin/buildings" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
          Buildings
        </a>{' '}
        / {building.name}
      </p>

      <h1
        style={{
          fontSize: 'clamp(28px, 3.5vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '8px',
          color: '#ffffff',
        }}
      >
        {building.name}
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '48px' }}>
        {building.location}{building.locale ? ` · ${building.locale}` : ''} · {unitCount.count} units · Landlord: {building.landlordName}
      </p>

      {/* Daraja Credentials Section */}
      {role === 'AGENCY_OWNER' && (
        <section style={{ marginBottom: '72px' }}>
          <p
            style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              marginBottom: '24px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            M-Pesa Daraja Credentials
          </p>

          <form
            action={updateDarajaCredentials}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              maxWidth: '960px',
            }}
          >
            <input type="hidden" name="buildingId" value={building.id} />
            <FormField
              name="consumerKey"
              label="Consumer Key"
              placeholder="Paste consumer key"
              defaultValue={building.darajaConsumerKey ?? ''}
            />
            <FormField
              name="consumerSecret"
              label="Consumer Secret"
              placeholder="Paste consumer secret"
              type="password"
              defaultValue={building.darajaConsumerSecret ?? ''}
            />
            <FormField
              name="shortcode"
              label="Shortcode"
              placeholder="e.g. 174379"
              defaultValue={building.darajaShortcode ?? ''}
            />
            <FormField
              name="passkey"
              label="Passkey"
              placeholder="Paste passkey"
              type="password"
              defaultValue={building.darajaPasskey ?? ''}
            />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '13px 24px',
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
        </section>
      )}

      {/* Utilities Configuration */}
      <section style={{ marginBottom: '72px' }}>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            marginBottom: '24px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          Utility Configuration
        </p>

        <form action={saveUtilities}>
          <input type="hidden" name="buildingId" value={building.id} />

          <div style={{ display: 'grid', gap: '2px', maxWidth: '800px' }}>
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 80px 100px 120px 1fr',
                gap: '16px',
                padding: '10px 20px',
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}
            >
              <span>Utility</span>
              <span>Enabled</span>
              <span>Type</span>
              <span>Amount (KES)</span>
              <span>Unit</span>
            </div>

            {utilityOptions.map((opt) => {
              const existing = utilities.find((u) => u.name === opt.key);
              const isEnabled = existing?.isEnabled ?? opt.alwaysOn;
              const rateType = existing?.rateType ?? 'FIXED';
              const amount = existing?.defaultAmount ?? '0';
              const unit = existing?.unit ?? '';

              return (
                <div
                  key={opt.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 80px 100px 120px 1fr',
                    gap: '16px',
                    padding: '14px 20px',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: '14px',
                    color: '#ffffff',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <input
                    type="checkbox"
                    name={`enabled_${opt.key}`}
                    defaultChecked={isEnabled}
                    disabled={opt.alwaysOn}
                    style={{ accentColor: '#ffffff', width: '18px', height: '18px' }}
                  />
                  <select
                    name={`rateType_${opt.key}`}
                    defaultValue={rateType}
                    disabled={opt.alwaysOn}
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="PER_UNIT">Per Unit</option>
                  </select>
                  <input
                    type="number"
                    name={`amount_${opt.key}`}
                    defaultValue={amount}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="text"
                    name={`unit_${opt.key}`}
                    defaultValue={unit}
                    placeholder="e.g. m³, kWh"
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              type="submit"
              style={{
                padding: '13px 28px',
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
              Save Utilities
            </button>
          </div>
        </form>
      </section>

      {/* Quick Actions */}
      <section>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            marginBottom: '24px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          Quick Actions
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <a
            href={`/admin/buildings/${building.id}/units`}
            style={{
              fontSize: '13px',
              letterSpacing: '0.14em',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.35)',
              padding: '14px 28px',
              textDecoration: 'none',
              textTransform: 'uppercase',
              display: 'inline-block',
            }}
          >
            Manage Units →
          </a>
        </div>
      </section>
    </div>
  );
}

// ── Server Actions ────────────────────────────────────────────────────────

async function updateDarajaCredentials(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId, role } = session;
  if (!agencyId || role !== 'AGENCY_OWNER') return;

  const buildingId = formData.get('buildingId') as string;
  const consumerKey = (formData.get('consumerKey') as string)?.trim() || null;
  const consumerSecret = (formData.get('consumerSecret') as string)?.trim() || null;
  const shortcode = (formData.get('shortcode') as string)?.trim() || null;
  const passkey = (formData.get('passkey') as string)?.trim() || null;

  if (!buildingId) return;

  const db = getDb();
  await db
    .update(buildings)
    .set({
      darajaConsumerKey: consumerKey,
      darajaConsumerSecret: consumerSecret,
      darajaShortcode: shortcode,
      darajaPasskey: passkey,
    })
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  revalidatePath(`/admin/buildings/${buildingId}`);
}

async function saveUtilities(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return;

  const buildingId = formData.get('buildingId') as string;
  if (!buildingId) return;

  const db = getDb();

  // Delete existing utilities for this building
  await db
    .delete(buildingUtilities)
    .where(and(eq(buildingUtilities.buildingId, buildingId), eq(buildingUtilities.agencyId, agencyId)));

  const utilityOptions = ['RENT', 'WATER', 'ELECTRICITY', 'GARBAGE', 'SERVICE_CHARGE', 'WIFI', 'SECURITY'];

  for (const key of utilityOptions) {
    const isEnabled = formData.get(`enabled_${key}`) === 'on' || key === 'RENT';
    const rateType = (formData.get(`rateType_${key}`) as string) || 'FIXED';
    const amount = (formData.get(`amount_${key}`) as string) || '0';
    const unit = (formData.get(`unit_${key}`) as string)?.trim() || null;

    if (!isEnabled) continue;

    await db.insert(buildingUtilities).values({
      buildingId,
      agencyId,
      name: key as any,
      isEnabled: true,
      rateType,
      defaultAmount: amount,
      unit,
    });
  }

  revalidatePath(`/admin/buildings/${buildingId}`);
}

// ── Form Field Helper ─────────────────────────────────────────────────────

function FormField({
  name,
  label,
  placeholder,
  type = 'text',
  defaultValue = '',
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span
        style={{
          fontSize: '11px',
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
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
