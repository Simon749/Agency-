// app/(admin)/admin/buildings/[id]/units/actions.ts
// FIX: Added explicit auth() checks and agencyId ownership verification.

'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { units, buildings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { auth } from '@clerk/nextjs/server';

export async function createUnit(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized: Not authenticated');

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) throw new Error('Unauthorized: No agency assigned');

  const buildingId = formData.get('buildingId') as string;
  const unitNumber = (formData.get('unitNumber') as string)?.trim();
  const floor = (formData.get('floor') as string)?.trim() || null;
  const type = (formData.get('type') as string)?.trim() || null;
  const rentAmount = (formData.get('rentAmount') as string) || '0';
  const depositAmount = (formData.get('depositAmount') as string) || '0';

  if (!buildingId || !unitNumber) {
    throw new Error('Missing required fields: buildingId and unitNumber are required');
  }

  const db = getDb();

  // Verify building belongs to this agency
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)))
    .limit(1);

  if (!building) {
    throw new Error('Building not found or does not belong to your agency');
  }

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

export async function bulkCreateUnits(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized: Not authenticated');

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) throw new Error('Unauthorized: No agency assigned');

  const buildingId = formData.get('buildingId') as string;
  const unitNumbersRaw = (formData.get('unitNumbers') as string)?.trim();
  const rentAmount = (formData.get('bulkRent') as string) || '0';
  const depositAmount = (formData.get('bulkDeposit') as string) || '0';

  if (!buildingId || !unitNumbersRaw) {
    throw new Error('Missing required fields');
  }

  const unitNumbers = unitNumbersRaw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (unitNumbers.length === 0) {
    throw new Error('No valid unit numbers provided');
  }

  const db = getDb();

  // Verify building ownership
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)))
    .limit(1);

  if (!building) {
    throw new Error('Building not found or access denied');
  }

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

export async function deleteUnit(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized: Not authenticated');

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (role !== 'AGENCY_OWNER') {
    throw new Error('Unauthorized: Only agency owners can delete units');
  }

  const unitId = formData.get('unitId') as string;
  const buildingId = formData.get('buildingId') as string;

  if (!unitId || !buildingId) {
    throw new Error('Missing unitId or buildingId');
  }

  const db = getDb();

  // Verify ownership before delete
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(
      eq(units.id, unitId), 
      eq(units.agencyId, agencyId!), 
      eq(units.buildingId, buildingId)
    ))
    .limit(1);

  if (!unit) {
    throw new Error('Unit not found or access denied');
  }

  await db
    .delete(units)
    .where(and(
      eq(units.id, unitId), 
      eq(units.agencyId, agencyId!), 
      eq(units.buildingId, buildingId)
    ));

  revalidatePath(`/admin/buildings/${buildingId}/units`);
}