'use server';

// app/(admin)/admin/tenants/new/actions.ts
import { getDb } from '@/lib/db';
import { tenants, leases, units } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionMeta } from '@/lib/auth/getRole';
import { revalidatePath } from 'next/cache';
import { clerkClient } from '@clerk/nextjs/server';

export async function inviteTenant(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return { error: 'Not authenticated.' };

  // Extract form values
  const fullName    = (formData.get('fullName') as string)?.trim();
  const phone       = (formData.get('phone') as string)?.trim();
  const email       = (formData.get('email') as string)?.trim();
  const nationalId  = (formData.get('nationalId') as string)?.trim() || null;
  const buildingId  = formData.get('buildingId') as string;
  const unitId      = formData.get('unitId') as string;
  const startDate   = formData.get('startDate') as string;
  const duration    = parseInt(formData.get('duration') as string, 10);
  const rentAmount  = formData.get('rentAmount') as string;
  const depositAmount = formData.get('depositAmount') as string;

  // Basic validation
  if (!fullName || !phone || !email || !buildingId || !unitId || !startDate || !rentAmount || !depositAmount) {
    return { error: 'All required fields must be filled in.' };
  }

  // Calculate end date
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + duration);
  const endDate = end.toISOString().split('T')[0];

  const db = getDb();

  try {
    // 1. INSERT tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        agencyId,
        buildingId,
        unitId,
        fullName,
        phone,
        email,
        nationalId,
        inviteStatus: 'PENDING',
        status: 'ACTIVE',
      })
      .returning({ id: tenants.id });

    // 2. INSERT lease
    await db.insert(leases).values({
      tenantId: newTenant.id,
      unitId,
      agencyId,
      startDate,
      endDate,
      rentAmount,
      depositAmount,
      status: 'ACTIVE',
    });

    // 3. Mark unit as occupied
    await db
      .update(units)
      .set({ isOccupied: true })
      .where(eq(units.id, unitId));

    // 4. Send Clerk invitation
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role: 'TENANT',
        agencyId,
        buildingId,
        unitId,
      },
      notify: true, // Clerk sends the invite email automatically
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`,
    });

  } catch (err: unknown) {
    console.error('[inviteTenant]', err);

    // Handle duplicate email from Clerk
    if (err instanceof Error && err.message.includes('duplicate')) {
      return { error: 'A user with this email already exists in Clerk.' };
    }

    return { error: 'Something went wrong. Please try again.' };
  }

  revalidatePath('/admin/tenants');
}

// ── Resend Invite ─────────────────────────────────────────────────────────

export async function resendInvite(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) return { error: 'Not authenticated.' };

  const email      = formData.get('email') as string;
  const buildingId = formData.get('buildingId') as string;
  const unitId     = formData.get('unitId') as string;

  if (!email) return { error: 'No email found for this tenant.' };

  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role: 'TENANT',
        agencyId,
        buildingId,
        unitId,
      },
      notify: true,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`,
    });
  } catch (err) {
    console.error('[resendInvite]', err);
    return { error: 'Failed to resend invite. The user may have already accepted.' };
  }

  revalidatePath('/admin/tenants');
}