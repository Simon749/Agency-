// app/(admin)/admin/settings/lease-template/page.tsx
// Lease agreement template editor per building — AGENCY_OWNER only.
// Uses Markdown with {{placeholders}}. Preview + save per building.

import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { getDb } from '@/lib/db';
import { buildings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { updateLeaseTemplate } from '@/lib/settings/actions';

export const metadata = {
  title: 'Lease Templates — PropFlow',
};

export default async function LeaseTemplatePage() {
  await requireRole(['AGENCY_OWNER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) redirect('/pending-setup');

  const db = getDb();
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name, agreementTemplate: buildings.agreementTemplate })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const placeholders = [
    '{{AGENCY_NAME}}',
    '{{LANDLORD_NAME}}',
    '{{BUILDING_NAME}}',
    '{{UNIT_NUMBER}}',
    '{{BUILDING_LOCATION}}',
    '{{TENANT_NAME}}',
    '{{LEASE_START}}',
    '{{LEASE_END}}',
    '{{RENT_AMOUNT}}',
    '{{DEPOSIT_AMOUNT}}',
    '{{ESCALATION_VALUE}}',
    '{{ESCALATION_UNIT}}',
  ];

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Lease Templates
      </h1>

      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', maxWidth: '700px', lineHeight: 1.6 }}>
        Manage tenancy agreement templates per building. Use Markdown with placeholders. When a tenant is invited, the template is auto-populated with their details and sent for digital signing.
      </p>

      {/* Placeholder reference */}
      <div style={{ marginBottom: '48px', padding: '20px 24px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '700px' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
          Available Placeholders
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {placeholders.map((p) => (
            <code
              key={p}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'monospace',
                borderRadius: '2px',
              }}
            >
              {p}
            </code>
          ))}
        </div>
      </div>

      {/* Per-building templates */}
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
                await updateLeaseTemplate(b.id, agencyId, formData.get('template') as string);
                revalidatePath('/admin/settings/lease-template');
              }}
            >
              <textarea
                name="template"
                defaultValue={b.agreementTemplate ?? defaultTemplate}
                rows={20}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  outline: 'none',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  marginBottom: '20px',
                }}
              />
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
                Save Template
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

const defaultTemplate = `# TENANCY AGREEMENT

This agreement is made between **{{AGENCY_NAME}}** (the Agent) acting on behalf of **{{LANDLORD_NAME}}** (the Landlord) and **{{TENANT_NAME}}** (the Tenant).

**Property:** {{BUILDING_NAME}}, Unit {{UNIT_NUMBER}}, {{BUILDING_LOCATION}}

**Lease Term:** {{LEASE_START}} to {{LEASE_END}}

**Monthly Rent:** KES {{RENT_AMOUNT}}

**Deposit:** KES {{DEPOSIT_AMOUNT}}

**Rent Escalation:** Upon renewal, rent will increase by {{ESCALATION_VALUE}}{{ESCALATION_UNIT}}.

---

## Terms and Conditions

1. Rent is due on the 1st of every month.
2. Late payment attracts a penalty of 10% after the 5th day.
3. The tenant shall maintain the property in good condition.
4. Subletting is prohibited without written consent.
5. Either party may terminate with 30 days written notice.

---

Signed on behalf of the Landlord: ___________________

Signed by the Tenant: ___________________

Date: ___________________
`;