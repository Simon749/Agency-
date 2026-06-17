// lib/ledger/manualPayments.ts
// Manual payment entry — cash or bank receipt. Idempotent via referenceCode.

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, tenants } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";

export interface ManualPaymentInput {
  tenantId: string;
  buildingId: string;
  agencyId: string;
  amount: number;
  method: "CASH" | "BANK_RECEIPT";
  referenceCode: string | null; // bank slip number, receipt number, or null for cash
  description: string;
  billingMonth: string;
  recordedBy: string; // agent clerkId
  receiptPhotoUrl?: string | null;
}

export interface ManualPaymentResult {
  success: boolean;
  ledgerId?: string;
  alreadyExists?: boolean;
  tenantName?: string;
  warning?: string;
}

/**
 * Log a manual payment (CASH or BANK_RECEIPT) as a CREDIT in tenant_ledger.
 *
 * Idempotency rules:
 *   - If referenceCode is provided and already exists → reject (already logged)
 *   - If referenceCode is null (cash) → always allow (cash has no paper trail)
 *   - For cash without referenceCode, rely on agent discipline + confirmation UI
 */
export async function logManualPayment(
  input: ManualPaymentInput
): Promise<ManualPaymentResult> {
  const db = getDb();

  // Fetch tenant name for the confirmation message
  const [tenant] = await db
    .select({ fullName: tenants.fullName })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, input.tenantId),
        eq(tenants.buildingId, input.buildingId),
        eq(tenants.agencyId, input.agencyId)
      )
    )
    .limit(1);

  if (!tenant) {
    return { success: false, warning: "Tenant not found or does not belong to this building" };
  }

  // ── Duplicate prevention ──
  if (input.referenceCode) {
    const [existing] = await db
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(eq(tenantLedger.referenceCode, input.referenceCode))
      .limit(1);

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        tenantName: tenant.fullName,
        warning: `A payment with reference "${input.referenceCode}" already exists in the ledger.`,
      };
    }
  }

  // ── Insert CREDIT ──
  const [ledger] = await db
    .insert(tenantLedger)
    .values({
      tenantId: input.tenantId,
      buildingId: input.buildingId,
      agencyId: input.agencyId,
      type: "CREDIT",
      category: "RENT", // manual payments default to rent; agent can override if needed
      amount: input.amount.toFixed(2),
      method: input.method,
      referenceCode: input.referenceCode,
      description: input.description,
      billingMonth: input.billingMonth,
      recordedBy: input.recordedBy,
    })
    .returning({ id: tenantLedger.id });

  return {
    success: true,
    ledgerId: ledger.id,
    tenantName: tenant.fullName,
  };
}

/**
 * Check if a reference code already exists in the ledger.
 * Used for real-time validation in the form before submission.
 */
export async function checkReferenceCodeExists(
  referenceCode: string
): Promise<boolean> {
  if (!referenceCode) return false;

  const db = getDb();
  const [existing] = await db
    .select({ id: tenantLedger.id })
    .from(tenantLedger)
    .where(eq(tenantLedger.referenceCode, referenceCode))
    .limit(1);

  return !!existing;
}