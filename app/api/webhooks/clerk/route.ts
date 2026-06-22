// app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { tenants, agencies } from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// ── Types ──────────────────────────────────────────────────────────────────

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkPhoneNumber {
  phone_number: string;
  id: string;
}

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    phone_numbers: ClerkPhoneNumber[];
    public_metadata: Record<string, unknown>;
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // 1. Verify svix signature
  const headerPayload = await headers();
  const svixId        = headerPayload.get('svix-id');
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
      'svix-id':        svixId,
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

  // 2. Read role from publicMetadata (set by Clerk invite)
  const role     = (public_metadata?.role as string) ?? null;
  const agencyId = (public_metadata?.agencyId as string) ?? null;

  // ── Path A: Agency Owner accepted their invite ─────────────────────────
  // When Super Admin sends an agency owner invite, publicMetadata already has
  // role: "AGENCY_OWNER" and agencyId set. We just need to mark the agency
  // inviteStatus as "ACCEPTED" so the super admin dashboard reflects it.
  if (role === 'AGENCY_OWNER' && agencyId) {
    console.log(
      `[clerk-webhook] Agency owner accepted invite. clerkUserId=${clerkUserId} agencyId=${agencyId}`
    );
    // NOTE: We do NOT update agencies.inviteStatus here because that column
    // doesn't exist on the agencies table. The invite status is tracked by
    // Clerk's invitation object itself. If you need DB-level tracking, add
    // inviteStatus text('invite_status').default('PENDING') to the schema.
    return NextResponse.json({ message: 'Agency owner linked' }, { status: 200 });
  }

  // ── Path B: Tenant accepted their invite ──────────────────────────────
  // Original behaviour — match by email or phone and link clerkUserId.
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
    // Staff invite — publicMetadata.role is set directly on the Clerk invite,
    // no DB row to update here.
    console.log(
      `[clerk-webhook] No tenant row for ${email ?? phone} (likely staff invite) — no action taken`
    );
    return NextResponse.json({ message: 'No matching tenant' }, { status: 200 });
  }

  const tenant = matchingTenants[0];

  await db
    .update(tenants)
    .set({
      clerkUserId,
      inviteStatus: 'ACCEPTED',
    })
    .where(eq(tenants.id, tenant.id));

  console.log(
    `[clerk-webhook] Tenant linked. clerkUserId=${clerkUserId} → tenantId=${tenant.id}`
  );

  return NextResponse.json({ message: 'Tenant linked' }, { status: 200 });
}