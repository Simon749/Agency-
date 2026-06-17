// app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { tenants } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

// Clerk sends these headers for every webhook — used by svix to verify the signature
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
    id: string; // clerkUserId e.g. "user_2abc..."
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

  // 1. Read svix signature headers
  const headerPayload = await headers();
  const svixId        = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // 2. Verify signature with svix
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

  // 3. Only handle user.created
  if (event.type !== 'user.created') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  }

  const { id: clerkUserId, email_addresses, phone_numbers } = event.data;

  // Extract primary email and phone to match against tenants table
  const email = email_addresses?.[0]?.email_address ?? null;
  const phone = phone_numbers?.[0]?.phone_number ?? null;

  if (!email && !phone) {
    console.warn('[clerk-webhook] user.created has no email or phone — skipping');
    return NextResponse.json({ message: 'No identifiers' }, { status: 200 });
  }

  // 4. Look for a matching tenant row (pre-created by agency staff via invite)
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
    // No pre-existing tenant row — this is a non-tenant sign-up (staff, etc.)
    // Clerk publicMetadata.role will be set manually by Super Admin for staff
    console.log(`[clerk-webhook] No tenant row found for ${email ?? phone} — no action taken`);
    return NextResponse.json({ message: 'No matching tenant' }, { status: 200 });
  }

  const tenant = matchingTenants[0];

  // 5. Link the Clerk user to the tenant row and mark invite as accepted
  await db
    .update(tenants)
    .set({
      clerkUserId,
      inviteStatus: 'ACCEPTED',
    })
    .where(eq(tenants.id, tenant.id));

  console.log(`[clerk-webhook] Linked clerkUserId=${clerkUserId} → tenantId=${tenant.id}`);

  return NextResponse.json({ message: 'Tenant linked' }, { status: 200 });
}