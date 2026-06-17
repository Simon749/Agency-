// app/(super-admin)/agencies/page.tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { agencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Agency } from '@/db/schema';

// ── Server Actions ─────────────────────────────────────────────────────────

async function createAgency(formData: FormData) {
  'use server';

  const name  = (formData.get('name')  as string).trim();
  const email = (formData.get('email') as string).trim().toLowerCase();
  const phone = (formData.get('phone') as string).trim();

  if (!name || !email || !phone) return;

  const db = getDb();
  await db.insert(agencies).values({ name, email, phone });

  revalidatePath('/super-admin/agencies');
}

async function toggleAgency(formData: FormData) {
  'use server';

  const id       = formData.get('id')       as string;
  const isActive = formData.get('isActive') === 'true';

  if (!id) return;

  const db = getDb();
  await db
    .update(agencies)
    .set({ isActive: !isActive })
    .where(eq(agencies.id, id));

  revalidatePath('/super-admin/agencies');
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function AgenciesPage() {
  const db = getDb();
  const allAgencies: Agency[] = await db
    .select()
    .from(agencies)
    .orderBy(agencies.createdAt);

  return (
    <div>
      {/* Page header */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        Agency Management
      </p>
      <h1
        style={{
          fontSize: 'clamp(28px, 3.5vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '56px',
          color: '#ffffff',
        }}
      >
        Agencies
      </h1>

      {/* ── Create Agency Form ── */}
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
          Create New Agency
        </p>

        <form
          action={createAgency}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            maxWidth: '860px',
          }}
        >
          <FormField name="name"  label="Agency Name"   placeholder="Westlands Realty Ltd" />
          <FormField name="email" label="Email Address"  placeholder="hello@agency.co.ke" type="email" />
          <FormField name="phone" label="Phone Number"   placeholder="+254 700 000 000" type="tel" />

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
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
              Create Agency
            </button>
          </div>
        </form>
      </section>

      {/* ── Agencies Table ── */}
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
          {allAgencies.length} {allAgencies.length === 1 ? 'Agency' : 'Agencies'} Registered
        </p>

        {allAgencies.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No agencies yet. Create the first one above.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '2px',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1.5fr 1fr 120px',
                gap: '16px',
                padding: '10px 20px',
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}
            >
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {allAgencies.map((agency) => (
              <AgencyRow key={agency.id} agency={agency} toggleAgency={toggleAgency} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Agency Row ─────────────────────────────────────────────────────────────

function AgencyRow({
  agency,
  toggleAgency,
}: {
  agency: Agency;
  toggleAgency: (formData: FormData) => Promise<void>;
}) {
  const isActive = agency.isActive;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 2fr 1.5fr 1fr 120px',
        gap: '16px',
        padding: '16px 20px',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        fontSize: '14px',
        color: '#ffffff',
      }}
    >
      <span style={{ fontWeight: 500 }}>{agency.name}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{agency.email}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{agency.phone}</span>

      {/* Status badge */}
      <span
        style={{
          display: 'inline-block',
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '4px 10px',
          backgroundColor: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: isActive ? '#4ade80' : '#f87171',
          border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          whiteSpace: 'nowrap',
        }}
      >
        {isActive ? 'Active' : 'Suspended'}
      </span>

      {/* Kill switch */}
      <form action={toggleAgency}>
        <input type="hidden" name="id"       value={agency.id} />
        <input type="hidden" name="isActive" value={String(isActive)} />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: isActive ? '#f87171' : '#4ade80',
            backgroundColor: 'transparent',
            border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
            cursor: 'pointer',
            textTransform: 'uppercase',
            fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          {isActive ? 'Suspend' : 'Activate'}
        </button>
      </form>
    </div>
  );
}

// ── Form field helper ──────────────────────────────────────────────────────

function FormField({
  name,
  label,
  placeholder,
  type = 'text',
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
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
        required
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