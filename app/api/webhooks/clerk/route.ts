// app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { tenants, agencies } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    phone_numbers: { phone_number: string; id: string }[];
    public_metadata: Record<string, unknown>;
    first_name?: string;
    last_name?: string;
  };
}

// ── In-memory tracking for invited staff (fallback if DB table doesn't exist) ──
// You should create a proper staff_invites table, but this works for now:
const STAFF_INVITE_ROLES = ['MANAGER', 'FIELD_AGENT', 'AGENCY_OWNER'];

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkUserCreatedEvent;

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    console.error('[clerk-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  }

  const { id: clerkUserId, email_addresses, phone_numbers, public_metadata } = event.data;
  const email = email_addresses?.[0]?.email_address ?? null;
  const phone = phone_numbers?.[0]?.phone_number ?? null;

  // ── FIX: Read role from publicMetadata (set by Clerk invite) ──────────
  const role = (public_metadata?.role as string) ?? null;
  const agencyId = (public_metadata?.agencyId as string) ?? null;

  // ── Path A: Staff invite (MANAGER, FIELD_AGENT, AGENCY_OWNER) ─────────
  // The metadata SHOULD be set by Clerk automatically when they accept the invite.
  // If it's missing, they didn't use the invite link — we need to handle that.
  if (STAFF_INVITE_ROLES.includes(role ?? '') && agencyId) {
    console.log(`[clerk-webhook] Staff user created. role=${role} agencyId=${agencyId} clerkId=${clerkUserId}`);

    // Metadata is already correct from the invitation — nothing more to do.
    // Clerk handles this automatically when the user accepts the invite link.
    return NextResponse.json({ message: 'Staff user linked via invite metadata' }, { status: 200 });
  }

  // ── Path B: Staff user created WITHOUT invite metadata ──────────────────
  // This happens when someone signs up directly at /sign-up instead of using
  // the invite link. We need to check if they were pre-invited and fix their metadata.
  if (email && !role) {
    const clerk = await clerkClient();

    // Check if there's a pending invitation for this email
    const invitations = await clerk.invitations.getInvitationList({
      status: 'pending',
    });

    const matchingInvite = invitations.data.find(
      (inv) =>
        inv.emailAddress === email &&
        (inv.status === 'pending' || inv.status === 'accepted')
    );

    if (matchingInvite) {
      const inviteMeta = matchingInvite.publicMetadata as Record<string, unknown>;
      const inviteRole = inviteMeta.role as string;
      const inviteAgencyId = inviteMeta.agencyId as string;

      if (inviteRole && inviteAgencyId) {
        // Fix the user's metadata since they didn't use the invite link
        await clerk.users.updateUser(clerkUserId, {
          publicMetadata: {
            role: inviteRole,
            agencyId: inviteAgencyId,
            buildingId: null,
            unitId: null,
            ...inviteMeta,
          },
        });

        console.log(`[clerk-webhook] Fixed metadata for ${email} from pending invite`);
        return NextResponse.json({ message: 'Staff metadata fixed from invite' }, { status: 200 });
      }
    }
  }

  // ── Path C: Tenant accepted invite ────────────────────────────────────
  if (!email && !phone) {
    console.warn('[clerk-webhook] user.created has no email or phone — skipping');
    return NextResponse.json({ message: 'No identifiers' }, { status: 200 });
  }

  const db = getDb();
  const conditions = [];
  if (email) conditions.push(eq(tenants.email, email));
  if (phone) conditions.push(eq(tenants.phone, phone));

  const matchingTenants = await db
    .select()
    .from(tenants)
    .where(or(...conditions))
    .limit(1);

  if (matchingTenants.length === 0) {
    console.log(`[clerk-webhook] No tenant or staff match for ${email ?? phone}`);
    return NextResponse.json({ message: 'No matching user' }, { status: 200 });
  }

  const tenant = matchingTenants[0];

  await db
    .update(tenants)
    .set({
      clerkUserId,
      inviteStatus: 'ACCEPTED',
    })
    .where(eq(tenants.id, tenant.id));

  console.log(`[clerk-webhook] Tenant linked. clerkUserId=${clerkUserId} → tenantId=${tenant.id}`);
  return NextResponse.json({ message: 'Tenant linked' }, { status: 200 });
}