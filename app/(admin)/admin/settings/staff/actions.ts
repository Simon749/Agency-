'use server';

// app/(admin)/admin/settings/staff/actions.ts
import { getSessionMeta } from '@/lib/auth/getRole';
import { clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

type StaffRole = 'MANAGER' | 'FIELD_AGENT';

export async function inviteStaff(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!agencyId || role !== 'AGENCY_OWNER') {
    return { error: 'Only Agency Owners can invite staff.' };
  }

  const email    = (formData.get('email') as string)?.trim();
  const staffRole = (formData.get('role') as StaffRole);

  if (!email || !staffRole) {
    return { error: 'Email and role are required.' };
  }

  if (!['MANAGER', 'FIELD_AGENT'].includes(staffRole)) {
    return { error: 'Invalid role selected.' };
  }

  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role: staffRole,
        agencyId,
        buildingId: null,
        unitId: null,
      },
      notify: true,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`,
    });
  } catch (err) {
    console.error('[inviteStaff]', err);
    return { error: 'Failed to send invite. The user may already have an account.' };
  }

  revalidatePath('/admin/settings/staff');
}