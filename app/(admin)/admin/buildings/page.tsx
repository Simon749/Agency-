// app/(admin)/admin/buildings/page.tsx
// Buildings List — FULLY RESPONSIVE with Pagination
// Server Component with URL-based pagination

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Pagination as PaginationComponent } from '@/components/ui/pagination';
import { Suspense, type ComponentType } from 'react';

export const metadata = {
  title: 'Buildings — PropFlow',
};

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  showPageSizeSelector?: boolean;
};

const Pagination = PaginationComponent as unknown as ComponentType<PaginationProps>;

const DEFAULT_PAGE_SIZE = 10;

interface BuildingsPageProps {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}

export default async function BuildingsPage({
  searchParams,
}: BuildingsPageProps) {
  const session = await getSessionMeta();
  const { agencyId } = session;

  if (!agencyId) {
    redirect('/pending-setup');
  }

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params?.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params?.pageSize ?? '10', 10)));
  const offset = (currentPage - 1) * pageSize;

  const db = getDb();

  const [countResult, allBuildings] = await Promise.all([
    db.select({ count: count() }).from(buildings).where(eq(buildings.agencyId, agencyId)),
    db
      .select()
      .from(buildings)
      .where(eq(buildings.agencyId, agencyId))
      .orderBy(desc(buildings.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);

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
          fontSize: 'clamp(24px, 4vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '32px',
          color: '#ffffff',
          lineHeight: 1.2,
        }}
      >
        Buildings
      </h1>

      {/* Add Building Form */}
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
          Add New Building
        </p>

        <form
          action={createBuilding}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
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
              Add Building
            </button>
          </div>
        </form>
      </section>

      {/* Buildings List */}
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
          {totalCount} {totalCount === 1 ? 'Building' : 'Buildings'}
          {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
        </p>

        {allBuildings.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', paddingTop: '12px' }}>
            No buildings yet. Add your first property above.
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
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Name', 'Location', 'Locale', 'Landlord', 'Units', 'Action'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '14px 16px',
                            fontSize: '10px',
                            letterSpacing: '0.18em',
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase',
                            fontWeight: 400,
                            textAlign: h === 'Name' ? 'left' : 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allBuildings.map((building) => (
                      <tr
                        key={building.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <p style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, marginBottom: '2px' }}>
                            {building.name}
                          </p>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {building.location}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {building.locale || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {building.landlordName}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <Link
                            href={`/admin/buildings/${building.id}/units`}
                            style={{
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.65)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '3px',
                            }}
                          >
                            View
                          </Link>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <Link
                            href={`/admin/buildings/${building.id}`}
                            style={{
                              fontSize: '11px',
                              letterSpacing: '0.12em',
                              color: 'rgba(255,255,255,0.6)',
                              textDecoration: 'none',
                              textTransform: 'uppercase',
                              border: '1px solid rgba(255,255,255,0.2)',
                              padding: '8px 14px',
                              display: 'inline-block',
                              minHeight: '36px',
                              minWidth: '44px',
                            }}
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARDS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
              {allBuildings.map((building) => (
                <BuildingCard key={building.id} building={building} />
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

// ── Mobile Building Card ────────────────────────────────────────────────────

function BuildingCard({
  building,
}: {
  building: {
    id: string;
    name: string;
    location: string;
    locale: string | null;
    landlordName: string;
    landlordPhone: string | null;
  };
}) {
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
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3px',
          height: '100%',
          backgroundColor: '#3b82f6',
        }}
      />

      <div style={{ marginBottom: '16px', paddingLeft: '12px' }}>
        <p style={{ fontSize: '15px', color: '#ffffff', fontWeight: 500, marginBottom: '4px' }}>
          {building.name}
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          {building.location}{building.locale ? ` · ${building.locale}` : ''}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          marginLeft: '12px',
        }}
      >
        <MobileStat label="Landlord" value={building.landlordName} />
        <MobileStat label="Phone" value={building.landlordPhone || '—'} />
      </div>

      <div style={{ display: 'flex', gap: '8px', paddingLeft: '12px' }}>
        <Link
          href={`/admin/buildings/${building.id}/units`}
          style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            flex: 1,
          }}
        >
          View Units
        </Link>
        <Link
          href={`/admin/buildings/${building.id}`}
          style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: '#ffffff',
            textDecoration: 'none',
            textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.35)',
            padding: '10px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            flex: 1,
          }}
        >
          Details →
        </Link>
      </div>
    </div>
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