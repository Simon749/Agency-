// app/(admin)/admin/tenants/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { tenants, units, leases, tenantLedger } from '@/db/schema';
import { getSessionMeta } from '@/lib/auth/getRole';
import { clerkClient } from '@clerk/nextjs/server';
import { getTenantBalance } from '@/lib/ledger';

export async function vacateTenant(tenantId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!['AGENCY_OWNER', 'MANAGER'].includes(role ?? '')) {
    throw new Error('Only agency owners and managers can vacate tenants');
  }

  const db = getDb();

  // Verify tenant belongs to this agency
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.agencyId, agencyId!)))
    .limit(1);

  if (!tenant) throw new Error('Tenant not found');

  // CRITICAL: Check zero balance
  const balance = await getTenantBalance(tenantId, agencyId!);
  if (balance.balance > 0) {
    throw new Error(
      `Cannot vacate tenant with outstanding balance of KES ${balance.balance.toLocaleString('en-KE')}. ` +
      `Please collect payment first.`
    );
  }

  // Execute vacation in transaction
  await db.transaction(async (tx) => {
    // 1. Mark tenant as VACATED
    await tx
      .update(tenants)
      .set({ status: 'VACATED', vacatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    // 2. Terminate active lease
    await tx
      .update(leases)
      .set({ status: 'TERMINATED' })
      .where(and(eq(leases.tenantId, tenantId), eq(leases.status, 'ACTIVE')));

    // 3. Free up the unit
    await tx
      .update(units)
      .set({ isOccupied: false })
      .where(eq(units.id, tenant.unitId));
  });

  // 4. Revoke Clerk access (non-blocking, don't fail if Clerk is down)
  if (tenant.clerkUserId) {
    try {
      const client = await clerkClient();
      await client.users.deleteUser(tenant.clerkUserId);
    } catch (err) {
      console.error('[VACATE] Failed to delete Clerk user:', err);
      // Don't throw - tenant is already vacated in DB
    }
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath('/admin/tenants');
  redirect('/admin/tenants');
}