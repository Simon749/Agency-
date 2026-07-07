// app/(agent)/receipts/actions.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { tenantLedger, tenants } from '@/db/schema';
import { getSessionMeta } from '@/lib/auth/getRole';
import { insertPaymentCredit } from '@/lib/ledger';
import { revalidatePath } from 'next/cache';

export async function recordCashPayment(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!['AGENCY_OWNER', 'MANAGER', 'FIELD_AGENT'].includes(role ?? '')) {
    throw new Error('Unauthorized');
  }

  const tenantId = formData.get('tenantId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const referenceCode = (formData.get('referenceCode') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || 'Cash payment';
  const billingMonth = formData.get('billingMonth') as string || new Date().toISOString().slice(0, 7);

  if (!tenantId || isNaN(amount) || amount <= 0) {
    throw new Error('Invalid payment details');
  }

  const db = getDb();

  // Verify tenant belongs to agency
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.agencyId, agencyId!)))
    .limit(1);

  if (!tenant) throw new Error('Tenant not found');

  // Check for duplicate reference code
  if (referenceCode) {
    const [existing] = await db
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(eq(tenantLedger.referenceCode, referenceCode))
      .limit(1);

    if (existing) throw new Error(`Payment with reference ${referenceCode} already exists`);
  }

  const result = await insertPaymentCredit({
    tenantId,
    buildingId: tenant.buildingId,
    agencyId: agencyId!,
    category: 'RENT',
    amount: amount.toFixed(2),
    billingMonth,
    description,
    referenceCode: referenceCode || `CASH-${Date.now()}`,
    method: 'CASH',
    recordedBy: userId,
  });

  revalidatePath('/admin/agent/receipts');
  revalidatePath(`/admin/tenants/${tenantId}/ledger`);
  return result;
}