// app/(admin)/admin/buildings/[id]/units/page.tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings, units } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect, notFound } from 'next/navigation';
import type { Unit } from '@/db/schema';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UnitsPage({ params }: Props) {
  const { id: buildingId } = await params;
  const session = await getSessionMeta();
  const { agencyId } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const db = getDb();

  // Verify building belongs to agency — use AND for combined conditions
  const buildingRows = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  const building = buildingRows[0];

  if (!building) {
    notFound();
  }

  // Fetch units for this building — use AND for combined conditions
  const allUnits = await db
    .select()
    .from(units)
    .where(and(eq(units.buildingId, buildingId), eq(units.agencyId, agencyId)))
    .orderBy(units.unitNumber);

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
        /{' '}
        <a href={`/admin/buildings/${buildingId}`} style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
          {building.name}
        </a>{' '}
        / Units
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
        {building.name} — Units
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '48px' }}>
        {allUnits.length} {allUnits.length === 1 ? 'unit' : 'units'} · {building.location}
      </p>

      {/* Add Unit Form */}
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
          Add New Unit
        </p>

        <form
          action={createUnit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '20px',
            maxWidth: '960px',
          }}
        >
          <input type="hidden" name="buildingId" value={buildingId} />
          <FormField name="unitNumber" label="Unit Number" placeholder="e.g. A1, B3, GF-01" />
          <FormField name="floor" label="Floor" placeholder="e.g. Ground, 1st, 2nd" />
          <SelectField
            name="type"
            label="Type"
            options={['STUDIO', 'BEDSITTER', '1BR', '2BR', '3BR', 'COMMERCIAL']}
          />
          <FormField name="rentAmount" label="Monthly Rent (KES)" placeholder="25000" type="number" min="0" step="0.01" />
          <FormField name="depositAmount" label="Deposit (KES)" placeholder="50000" type="number" min="0" step="0.01" />

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
              Add Unit
            </button>
          </div>
        </form>
      </section>

      {/* Bulk Add Section */}
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
          Bulk Add Units
        </p>
        <form action={bulkCreateUnits}>
          <input type="hidden" name="buildingId" value={buildingId} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '600px' }}>
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
              }}
            >
              Unit Numbers (comma-separated)
            </span>
            <input
              type="text"
              name="unitNumbers"
              placeholder="e.g. A1, A2, A3, B1, B2"
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
                maxWidth: '600px',
              }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', maxWidth: '600px', marginTop: '20px' }}>
            <FormField name="bulkRent" label="Rent per unit (KES)" placeholder="25000" type="number" min="0" step="0.01" />
            <FormField name="bulkDeposit" label="Deposit per unit (KES)" placeholder="50000" type="number" min="0" step="0.01" />
          </div>
          <button
            type="submit"
            style={{
              marginTop: '20px',
              padding: '13px 28px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.16em',
              color: '#ffffff',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.35)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: '"Helvetica Neue", sans-serif',
            }}
          >
            Bulk Add
          </button>
        </form>
      </section>

      {/* Units Table */}
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
          All Units
        </p>

        {allUnits.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No units yet. Add your first unit above.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '2px' }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px 80px',
                gap: '16px',
                padding: '10px 20px',
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}
            >
              <span>Unit</span>
              <span>Floor</span>
              <span>Type</span>
              <span>Rent (KES)</span>
              <span>Deposit (KES)</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {allUnits.map((unit: Unit) => (
              <UnitRow key={unit.id} unit={unit} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Server Actions ────────────────────────────────────────────────────────

async function createUnit(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return;

  const buildingId = formData.get('buildingId') as string;
  const unitNumber = (formData.get('unitNumber') as string)?.trim();
  const floor = (formData.get('floor') as string)?.trim() || null;
  const type = (formData.get('type') as string)?.trim() || null;
  const rentAmount = (formData.get('rentAmount') as string) || '0';
  const depositAmount = (formData.get('depositAmount') as string) || '0';

  if (!buildingId || !unitNumber) return;

  const db = getDb();
  await db.insert(units).values({
    buildingId,
    agencyId,
    unitNumber,
    floor,
    type,
    rentAmount,
    depositAmount,
  });

  revalidatePath(`/admin/buildings/${buildingId}/units`);
}

async function bulkCreateUnits(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return;

  const buildingId = formData.get('buildingId') as string;
  const unitNumbersRaw = (formData.get('unitNumbers') as string)?.trim();
  const rentAmount = (formData.get('bulkRent') as string) || '0';
  const depositAmount = (formData.get('bulkDeposit') as string) || '0';

  if (!buildingId || !unitNumbersRaw) return;

  const unitNumbers = unitNumbersRaw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (unitNumbers.length === 0) return;

  const db = getDb();

  for (const unitNumber of unitNumbers) {
    await db.insert(units).values({
      buildingId,
      agencyId,
      unitNumber,
      rentAmount,
      depositAmount,
    });
  }

  revalidatePath(`/admin/buildings/${buildingId}/units`);
}

// ── Unit Row ──────────────────────────────────────────────────────────────

function UnitRow({ unit }: { unit: Unit }) {
  const isOccupied = unit.isOccupied;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px 80px',
        gap: '16px',
        padding: '16px 20px',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        fontSize: '14px',
        color: '#ffffff',
      }}
    >
      <span style={{ fontWeight: 500 }}>{unit.unitNumber}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{unit.floor || '—'}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{unit.type || '—'}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>
        {Number(unit.rentAmount).toLocaleString('en-KE')}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>
        {Number(unit.depositAmount).toLocaleString('en-KE')}
      </span>
      <span>
        <span
          style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            backgroundColor: isOccupied ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
            color: isOccupied ? '#f87171' : '#4ade80',
            border: `1px solid ${isOccupied ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            whiteSpace: 'nowrap',
          }}
        >
          {isOccupied ? 'Occupied' : 'Vacant'}
        </span>
      </span>
      <span>
        <form action={deleteUnit}>
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="buildingId" value={unit.buildingId} />
          <button
            type="submit"
            style={{
              fontSize: '11px',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.5)',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '6px 10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </form>
      </span>
    </div>
  );
}

async function deleteUnit(formData: FormData) {
  'use server';

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return;

  const unitId = formData.get('unitId') as string;
  const buildingId = formData.get('buildingId') as string;
  if (!unitId || !buildingId) return;

  const db = getDb();
  await db
    .delete(units)
    .where(and(eq(units.id, unitId), eq(units.agencyId, agencyId), eq(units.buildingId, buildingId)));

  revalidatePath(`/admin/buildings/${buildingId}/units`);
}

// ── Form Helpers ────────────────────────────────────────────────────────

function FormField({
  name,
  label,
  placeholder,
  type = 'text',
  min,
  step,
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  min?: string;
  step?: string;
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
        min={min}
        step={step}
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

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
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
      <select
        name={name}
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
          appearance: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ color: '#000', backgroundColor: '#fff' }}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
