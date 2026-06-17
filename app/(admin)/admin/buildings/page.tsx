// app/(admin)/admin/buildings/page.tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';

export default async function BuildingsPage() {
  const session = await getSessionMeta();
  const { agencyId } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();
  const allBuildings = await db
    .select()
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId))
    .orderBy(desc(buildings.createdAt));

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
        Property Portfolio
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
        Buildings
      </h1>

      {/* Create Building Form */}
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
          Add New Building
        </p>

        <form
          action={createBuilding}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            maxWidth: '960px',
          }}
        >
          <FormField name="name" label="Building Name" placeholder="e.g. Westlands Heights" />
          <FormField name="location" label="Location" placeholder="e.g. Nairobi" />
          <FormField name="locale" label="Locale / Area" placeholder="e.g. Westlands" />
          <FormField name="landlordName" label="Landlord Name" placeholder="e.g. John Doe" />
          <FormField name="landlordPhone" label="Landlord Phone" placeholder="+254 700 000 000" type="tel" />

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
              Add Building
            </button>
          </div>
        </form>
      </section>

      {/* Buildings Table */}
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
          {allBuildings.length} {allBuildings.length === 1 ? 'Building' : 'Buildings'}
        </p>

        {allBuildings.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No buildings yet. Add your first property above.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '2px' }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr 100px 100px',
                gap: '16px',
                padding: '10px 20px',
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}
            >
              <span>Name</span>
              <span>Location</span>
              <span>Locale</span>
              <span>Landlord</span>
              <span>Units</span>
              <span>Action</span>
            </div>

            {allBuildings.map((building) => (
              <BuildingRow key={building.id} building={building} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Server Action ─────────────────────────────────────────────────────────

async function createBuilding(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return;

  const name = (formData.get('name') as string)?.trim();
  const location = (formData.get('location') as string)?.trim();
  const locale = (formData.get('locale') as string)?.trim() || null;
  const landlordName = (formData.get('landlordName') as string)?.trim();
  const landlordPhone = (formData.get('landlordPhone') as string)?.trim() || null;

  if (!name || !location || !landlordName) return;

  const db = getDb();
  await db.insert(buildings).values({
    agencyId,
    name,
    location,
    locale,
    landlordName,
    landlordPhone,
  });

  revalidatePath('/admin/buildings');
}

// ── Building Row ──────────────────────────────────────────────────────────

function BuildingRow({ building }: { building: typeof buildings.$inferSelect }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr 100px 100px',
        gap: '16px',
        padding: '16px 20px',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        fontSize: '14px',
        color: '#ffffff',
      }}
    >
      <span style={{ fontWeight: 500 }}>{building.name}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{building.location}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{building.locale || '—'}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{building.landlordName}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>
        <a
          href={`/admin/buildings/${building.id}/units`}
          style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          View
        </a>
      </span>
      <span>
        <a
          href={`/admin/buildings/${building.id}`}
          style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '6px 12px',
            display: 'inline-block',
          }}
        >
          Details
        </a>
      </span>
    </div>
  );
}

// ── Form Field Helper ─────────────────────────────────────────────────────

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
