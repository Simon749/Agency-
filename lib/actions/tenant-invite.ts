// lib/actions/tenant-invite.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { leases, tenants, units } from '@/db/schema';
import { getSessionMeta } from '@/lib/auth/getRole';
import { clerkClient } from '@clerk/nextjs/server';
import { sendTenantInviteSms } from '@/lib/sms/triggers';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';

export async function inviteTenant(unitId: string, data: {
  fullName: string;
  phone: string;
  email?: string;
  nationalId?: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!['AGENCY_OWNER', 'MANAGER'].includes(role ?? '')) {
    throw new Error('Unauthorized');
  }

  const db = getDb();

  // Verify unit belongs to agency and is vacant
  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, unitId))
    .limit(1);

  if (!unit || unit.agencyId !== agencyId) throw new Error('Unit not found');
  if (unit.isOccupied) throw new Error('Unit is already occupied');

  const inviteToken = randomBytes(32).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create tenant record
  const [tenant] = await db
    .insert(tenants)
    .values({
      agencyId: agencyId!,
      buildingId: unit.buildingId,
      unitId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email ?? null,
      nationalId: data.nationalId ?? null,
      inviteStatus: 'PENDING',
      inviteToken,
      inviteExpiresAt,
      status: 'ACTIVE',
    })
    .returning({ id: tenants.id });

  // Create lease
  await db.insert(leases).values({
    tenantId: tenant.id,
    unitId,
    agencyId: agencyId!,
    startDate: data.startDate,
    endDate: data.endDate,
    rentAmount: data.rentAmount.toFixed(2),
    depositAmount: data.depositAmount.toFixed(2),
    status: 'ACTIVE',
  });

  // Mark unit as occupied
  await db.update(units).set({ isOccupied: true }).where(eq(units.id, unitId));

  // Generate invite link
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/sign-up?invite=${inviteToken}`;

  // Send SMS
  await sendTenantInviteSms(tenant.id, inviteLink, session.agencyName ?? 'Your Agency');

  revalidatePath(`/admin/buildings/${unit.buildingId}/units`);
  return { success: true, tenantId: tenant.id };
}