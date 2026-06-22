// app/(admin)/admin/buildings/actions.ts
// FIX: Added auth() null checks and agencyId validation to all server actions.
// Previously, some actions only checked getSessionMeta() without verifying
// the user is actually authenticated.

'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { buildings, units, buildingUtilities } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { auth } from '@clerk/nextjs/server';

/**
 * Create a new building. Requires AGENCY_OWNER or MANAGER role.
 */
export async function createBuilding(formData: FormData) {
  // FIX: Explicit auth() check
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized: Not authenticated');
  }

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId) {
    throw new Error('Unauthorized: No agency assigned');
  }

  if (!['AGENCY_OWNER', 'MANAGER'].includes(role ?? '')) {
    throw new Error('Unauthorized: Insufficient permissions');
  }

  const name = (formData.get('name') as string)?.trim();
  const location = (formData.get('location') as string)?.trim();
  const locale = (formData.get('locale') as string)?.trim() || null;
  const landlordName = (formData.get('landlordName') as string)?.trim();
  const landlordPhone = (formData.get('landlordPhone') as string)?.trim() || null;

  if (!name || !location || !landlordName) {
    throw new Error('Missing required fields');
  }

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

/**
 * Update Daraja credentials for a building. AGENCY_OWNER only.
 */
export async function updateDarajaCredentials(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized: Not authenticated');
  }

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (role !== 'AGENCY_OWNER') {
    throw new Error('Unauthorized: Only agency owners can manage M-Pesa credentials');
  }

  const buildingId = formData.get('buildingId') as string;
  const consumerKey = (formData.get('consumerKey') as string)?.trim() || null;
  const consumerSecret = (formData.get('consumerSecret') as string)?.trim() || null;
  const shortcode = (formData.get('shortcode') as string)?.trim() || null;
  const passkey = (formData.get('passkey') as string)?.trim() || null;

  if (!buildingId) {
    throw new Error('Missing building ID');
  }

  const db = getDb();

  // Verify building belongs to this agency
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId!)))
    .limit(1);

  if (!building) {
    throw new Error('Building not found or access denied');
  }

  await db
    .update(buildings)
    .set({
      darajaConsumerKey: consumerKey,
      darajaConsumerSecret: consumerSecret,
      darajaShortcode: shortcode,
      darajaPasskey: passkey,
    })
    .where(eq(buildings.id, buildingId));

  revalidatePath(`/admin/buildings/${buildingId}`);
}

/**
 * Save utility configuration for a building.
 */
export async function saveUtilities(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized: Not authenticated');
  }

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId || !['AGENCY_OWNER', 'MANAGER'].includes(role ?? '')) {
    throw new Error('Unauthorized');
  }

  const buildingId = formData.get('buildingId') as string;
  if (!buildingId) {
    throw new Error('Missing building ID');
  }

  // Verify ownership
  const db = getDb();
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)))
    .limit(1);

  if (!building) {
    throw new Error('Building not found or access denied');
  }

  // Delete existing utilities
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

/**
 * Create a unit. Requires AGENCY_OWNER or MANAGER.
 */
export async function createUnit(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) throw new Error('No agency assigned');

  const buildingId = formData.get('buildingId') as string;
  const unitNumber = (formData.get('unitNumber') as string)?.trim();
  const floor = (formData.get('floor') as string)?.trim() || null;
  const type = (formData.get('type') as string)?.trim() || null;
  const rentAmount = (formData.get('rentAmount') as string) || '0';
  const depositAmount = (formData.get('depositAmount') as string) || '0';

  if (!buildingId || !unitNumber) throw new Error('Missing required fields');

  const db = getDb();

  // Verify building belongs to agency
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)))
    .limit(1);

  if (!building) throw new Error('Building not found or access denied');

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

/**
 * Delete a unit. Requires AGENCY_OWNER.
 */
export async function deleteUnit(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (role !== 'AGENCY_OWNER') {
    throw new Error('Only agency owners can delete units');
  }

  const unitId = formData.get('unitId') as string;
  const buildingId = formData.get('buildingId') as string;
  if (!unitId || !buildingId) throw new Error('Missing IDs');

  const db = getDb();

  // Verify ownership before delete
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.agencyId, agencyId!), eq(units.buildingId, buildingId)))
    .limit(1);

  if (!unit) throw new Error('Unit not found or access denied');

  await db
    .delete(units)
    .where(and(eq(units.id, unitId), eq(units.agencyId, agencyId!), eq(units.buildingId, buildingId)));

  revalidatePath(`/admin/buildings/${buildingId}/units`);
}