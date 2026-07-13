// app/(admin)/admin/buildings/[id]/units/page.tsx
// Units List — FULLY RESPONSIVE with Pagination
// Server Component with URL-based pagination

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings, units } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Pagination as PaginationComponent } from '@/components/ui/pagination';
import { ComponentType, Suspense } from 'react';
import type { Unit } from '@/db/schema';

export const metadata = {
  title: 'Units — PropFlow',
};

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  showPageSizeSelector?: boolean;
};

const Pagination = PaginationComponent as unknown as ComponentType<PaginationProps>;

const DEFAULT_PAGE_SIZE = 25;

interface UnitsPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}

export default async function UnitsPage({ params, searchParams }: UnitsPageProps) {
  const { id: buildingId } = await params;
  const session = await getSessionMeta();
  const { agencyId } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const paramsResolved = await searchParams;
  const currentPage = Math.max(1, parseInt(paramsResolved?.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(paramsResolved?.pageSize ?? '25', 10)));
  const offset = (currentPage - 1) * pageSize;

  const db = getDb();

  const buildingRows = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  const building = buildingRows[0];

  if (!building) {
    notFound();
  }

  const [countResult, allUnits] = await Promise.all([
    db
      .select({ count: count() })
      .from(units)
      .where(and(eq(units.buildingId, buildingId), eq(units.agencyId, agencyId))),
    db
      .select()
      .from(units)
      .where(and(eq(units.buildingId, buildingId), eq(units.agencyId, agencyId)))
      .orderBy(units.unitNumber)
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);

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
        <Link href="/admin/buildings" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
          Buildings
        </Link>{' '}
        /{' '}
        <Link href={`/admin/buildings/${buildingId}`} style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
          {building.name}
        </Link>{' '}
        / Units
      </p>

      <h1
        style={{
          fontSize: 'clamp(24px, 4vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '8px',
          color: '#ffffff',
          lineHeight: 1.2,
        }}
      >
        {building.name} — Units
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '40px' }}>
        {totalCount} {totalCount === 1 ? 'unit' : 'units'} · {building.location}
        {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
      </p>

      {/* Add Unit Form */}
      <section style={{ marginBottom: '56px' }}>
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                padding: '14px 24px',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.16em',
                color: '#0b0b0b',
                backgroundColor: '#ffffff',
                border: '1px solid #ffffff',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontFamily: '"Helvetica Neue", sans-serif',
                minHeight: '48px',
              }}
            >
              Add Unit
            </button>
          </div>
        </form>
      </section>

      {/* Bulk Add Section */}
      <section style={{ marginBottom: '56px' }}>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              maxWidth: '600px',
              marginTop: '20px',
            }}
          >
            <FormField name="bulkRent" label="Rent per unit (KES)" placeholder="25000" type="number" min="0" step="0.01" />
            <FormField name="bulkDeposit" label="Deposit per unit (KES)" placeholder="50000" type="number" min="0" step="0.01" />
          </div>
          <button
            type="submit"
            style={{
              marginTop: '20px',
              padding: '14px 28px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.16em',
              color: '#ffffff',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.35)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: '"Helvetica Neue", sans-serif',
              minHeight: '48px',
            }}
          >
            Bulk Add
          </button>
        </form>
      </section>

      {/* Units List */}
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
          <>
            {/* DESKTOP TABLE — hidden on mobile */}
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                display: 'none',
              }}
              className="md:block"
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Unit', 'Floor', 'Type', 'Rent (KES)', 'Deposit (KES)', 'Status', 'Action'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '14px 16px',
                            fontSize: '10px',
                            letterSpacing: '0.18em',
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase',
                            fontWeight: 400,
                            textAlign: h === 'Unit' ? 'left' : 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allUnits.map((unit: Unit) => (
                      <tr
                        key={unit.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <p style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500 }}>
                            {unit.unitNumber}
                          </p>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {unit.floor || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {unit.type || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {Number(unit.rentAmount).toLocaleString('en-KE')}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {Number(unit.depositAmount).toLocaleString('en-KE')}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <StatusBadge isOccupied={unit.isOccupied} />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
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
                                padding: '8px 12px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                fontFamily: 'inherit',
                                minHeight: '36px',
                                minWidth: '44px',
                              }}
                            >
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARDS — shown only on mobile */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
              {allUnits.map((unit: Unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ marginTop: '32px' }}>
                <Suspense fallback={<div style={{ height: '40px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />}>
                  <Pagination
                    totalPages={totalPages}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalItems={totalCount}
                    showPageSizeSelector
                  />
                </Suspense>
              </div>
            )}
          </>
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

// ── Mobile Unit Card ──────────────────────────────────────────────────────

function UnitCard({ unit }: { unit: Unit }) {
  const isOccupied = unit.isOccupied;

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Status accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '3px',
          backgroundColor: isOccupied ? '#ef4444' : '#22c55e',
        }}
      />

      {/* Header: Unit number + Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
        }}
      >
        <div>
          <p style={{ fontSize: '18px', color: '#ffffff', fontWeight: 500, marginBottom: '4px' }}>
            {unit.unitNumber}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            {unit.floor || 'No floor'} · {unit.type || 'No type'}
          </p>
        </div>
        <StatusBadge isOccupied={isOccupied} />
      </div>

      {/* Financial details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <MobileStat
          label="Monthly Rent"
          value={`KES ${Number(unit.rentAmount).toLocaleString('en-KE')}`}
        />
        <MobileStat
          label="Deposit"
          value={`KES ${Number(unit.depositAmount).toLocaleString('en-KE')}`}
        />
      </div>

      {/* Actions */}
      <form action={deleteUnit} style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            padding: '10px 16px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            minHeight: '44px',
            minWidth: '80px',
          }}
        >
          Delete
        </button>
      </form>
    </div>
  );
}

function StatusBadge({ isOccupied }: { isOccupied: boolean }) {
  return (
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
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: '10px',
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '14px',
          color: '#ffffff',
          fontWeight: 500,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
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