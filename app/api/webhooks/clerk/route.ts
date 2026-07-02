import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { tenants } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    phone_numbers: { phone_number: string; id: string }[];
    public_metadata: Record<string, unknown>;
    first_name?: string;
    last_name?: string;
  };
}

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
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[clerk-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── Handle user.updated ────────────────────────────────────────────────
  if (event.type === 'user.updated') {
    const { id: clerkUserId, public_metadata } = event.data;
    const role = public_metadata?.role as string | undefined;

    console.log(`[clerk-webhook] user.updated: clerkId=${clerkUserId} role=${role}`);

    const db = getDb();
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, clerkUserId))
      .limit(1);

    if (tenant && tenant.inviteStatus === 'PENDING') {
      await db
        .update(tenants)
        .set({ inviteStatus: 'ACCEPTED' })
        .where(eq(tenants.id, tenant.id));
      console.log(`[clerk-webhook] Tenant invite status updated to ACCEPTED`);
    }

    return NextResponse.json({ message: 'User updated synced' }, { status: 200 });
  }

  // ── Handle user.created ────────────────────────────────────────────────
  if (event.type !== 'user.created') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  }

  const { id: clerkUserId, email_addresses, phone_numbers, public_metadata } = event.data;
  const email = email_addresses?.[0]?.email_address ?? null;
  const phone = phone_numbers?.[0]?.phone_number ?? null;
  const role = (public_metadata?.role as string) ?? null;
  const agencyId = (public_metadata?.agencyId as string) ?? null;

  // ── Path A: Staff invite ──────────────────────────────────────────────
  if (STAFF_INVITE_ROLES.includes(role ?? '') && agencyId) {
    console.log(`[clerk-webhook] Staff user created. role=${role} agencyId=${agencyId}`);
    return NextResponse.json({ message: 'Staff user linked via invite metadata' }, { status: 200 });
  }

  // ── Path B: Staff user created WITHOUT invite metadata ──────────────────
  if (email && !role) {
    const clerk = await clerkClient();
    const invitations = await clerk.invitations.getInvitationList({ status: 'pending' });

    const matchingInvite = invitations.data.find(
      (inv) => inv.emailAddress === email && (inv.status === 'pending' || inv.status === 'accepted')
    );

    if (matchingInvite) {
      const inviteMeta = matchingInvite.publicMetadata as Record<string, unknown>;
      const inviteRole = inviteMeta.role as string;
      const inviteAgencyId = inviteMeta.agencyId as string;

      if (inviteRole && inviteAgencyId) {
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

  if (conditions.length === 0) {
    return NextResponse.json({ message: 'No identifiers' }, { status: 200 });
  }

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
    .set({ clerkUserId, inviteStatus: 'ACCEPTED' })
    .where(eq(tenants.id, tenant.id));

  console.log(`[clerk-webhook] Tenant linked. clerkUserId=${clerkUserId} → tenantId=${tenant.id}`);
  return NextResponse.json({ message: 'Tenant linked' }, { status: 200 });
}