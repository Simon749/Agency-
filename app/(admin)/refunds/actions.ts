// app/(admin)/refunds/actions.ts
'use server';

// Runbook (Phase C): duplicate payment detected -> investigate -> issue
// reversal entry -> trigger B2C refund -> SMS confirmation.
//
// Restricted to MANAGER / AGENCY_OWNER — this moves real money. A field
// agent should never trigger this unilaterally (same maker-checker spirit
// as Phase D, applied here since a refund is the financial mirror of a
// manual receipt).

import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { tenantLedger, tenants } from '@/db/schema';
import { getSessionMeta } from '@/lib/auth/getRole';
import { reverseLedgerEntry } from '@/lib/ledger/reverseLedgerEntry';
import { initiateB2CRefund } from '@/lib/daraja/b2c';
import { sendRefundConfirmationSms } from '@/lib/sms/triggers'; 
import { revalidatePath } from 'next/cache';

export async function refundDuplicatePayment(ledgerEntryId: string, reason: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const session = await getSessionMeta();
  if (!['AGENCY_OWNER', 'MANAGER'].includes(session.role ?? '')) {
    throw new Error('Unauthorized — refunds require Manager or Agency Owner');
  }

  const db = getDb();

  const [entry] = await db
    .select()
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.id, ledgerEntryId),
        eq(tenantLedger.agencyId, session.agencyId!)
      )
    )
    .limit(1);

  if (!entry) throw new Error('Ledger entry not found');
  if (entry.type !== 'CREDIT') {
    throw new Error('Only CREDIT entries (payments) can be refunded');
  }

  const [tenant] = await db
    .select({ phone: tenants.phone })
    .from(tenants)
    .where(eq(tenants.id, entry.tenantId))
    .limit(1);

  if (!tenant) throw new Error('Tenant not found');

  // 1. Reversal entry first — the ledger reflects the correction even if the
  //    downstream M-Pesa call is slow or fails; support can always see intent
  //    without waiting on Safaricom.
  const reversal = await reverseLedgerEntry(ledgerEntryId, reason, userId);

  // 2. Trigger the actual money movement.
  const b2cResult = await initiateB2CRefund({
    buildingId: entry.buildingId,
    phone: tenant.phone,
    amount: reversal.amount,
    remarks: `Refund: ${reason}`.slice(0, 100),
    resultUrl: `${process.env.APP_URL}/api/webhooks/mpesa/b2c-result/${entry.buildingId}`,
    timeoutUrl: `${process.env.APP_URL}/api/webhooks/mpesa/b2c-timeout/${entry.buildingId}`,
  });

  // 3. SMS confirmation — best-effort, never blocks the refund itself.
  try {
    await sendRefundConfirmationSms(entry.tenantId, reversal.amount.toString());
  } catch (err) {
    console.warn('[REFUND] SMS confirmation failed:', err);
  }

  revalidatePath(`/admin/tenants/${entry.tenantId}/ledger`);

  return {
    reversalEntryId: reversal.reversalEntryId,
    b2cConversationId: b2cResult.ConversationID,
  };
}

// NOTE: sendRefundConfirmationSms doesn't exist yet in lib/sms/triggers.ts —
// add it alongside sendPaymentReceivedSms / sendPaymentFailedSms, same pattern.