// lib/ledger/manualPayments.ts
// Phase D: Manual payment entry with maker-checker workflow.
// Field Agent submits → PENDING_APPROVAL → Manager approves → posts to ledger.

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger, tenants, auditLog } from "@/db/schema";
import type { InsertTenantLedgerEntry } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit"; // You'll need to create this
import { log } from "@/lib/monitoring";

const tenantLedgerTable = tenantLedger as any;

export interface ManualPaymentInput {
  tenantId: string;
  buildingId: string;
  agencyId: string;
  amount: number;
  method: "CASH" | "BANK_RECEIPT";
  referenceCode: string | null;
  description: string;
  billingMonth: string;
  recordedBy: string; // Field Agent clerkId
  receiptPhotoUrl?: string | null;
}

export interface ManualPaymentResult {
  success: boolean;
  ledgerId?: string;
  alreadyExists?: boolean;
  tenantName?: string;
  warning?: string;
  needsApproval?: boolean; // NEW: true if submitted for approval instead of posted
}

/**
 * Submit a manual payment for approval (Field Agent).
 * Does NOT post to live ledger — creates a PENDING_APPROVAL row.
 */
export async function submitManualPaymentForApproval(
  input: ManualPaymentInput
): Promise<ManualPaymentResult> {
  const db = getDb();

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

  // Check duplicate reference code
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
        warning: `A payment with reference "${input.referenceCode}" already exists.`,
      };
    }
  }

  // Insert as PENDING_APPROVAL — does NOT affect balance yet
  const [ledger] = await db
    .insert(tenantLedger)
    .values({
      tenantId: input.tenantId,
      buildingId: input.buildingId,
      agencyId: input.agencyId,
      type: "CREDIT",
      category: "RENT",
      amount: input.amount.toFixed(2),
      method: input.method,
      referenceCode: input.referenceCode,
      description: `[PENDING APPROVAL] ${input.description}`,
      billingMonth: input.billingMonth,
      recordedBy: input.recordedBy,
      submittedBy: input.recordedBy,
      approvalStatus: "PENDING_APPROVAL",
    } as any)
    .returning({ id: tenantLedger.id });

  // Audit log
  await logAuditEvent({
    actorClerkId: input.recordedBy,
    actorRole: "FIELD_AGENT",
    agencyId: input.agencyId,
    action: "MANUAL_LEDGER_ENTRY_SUBMITTED",
    targetTable: "tenant_ledger",
    targetId: ledger.id,
    afterValue: { amount: input.amount, method: input.method, status: "PENDING_APPROVAL" },
  });

  return {
    success: true,
    ledgerId: ledger.id,
    tenantName: tenant.fullName,
    needsApproval: true,
  };
}

/**
 * Approve a pending manual payment (Manager).
 * Changes approvalStatus to APPROVED — now affects balance.
 */
export async function approveManualPayment(
  ledgerEntryId: string,
  managerClerkId: string,
  managerRole: string
): Promise<{ success: boolean; error?: string }> {
  if (managerRole !== "MANAGER" && managerRole !== "AGENCY_OWNER") {
    return { success: false, error: "Only managers or agency owners can approve payments" };
  }

  const db = getDb();

  const [entry] = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.id, ledgerEntryId))
    .limit(1);

  if (!entry) {
    return { success: false, error: "Ledger entry not found" };
  }

  const entryWithApproval = entry as any;
  if (entryWithApproval.approvalStatus !== "PENDING_APPROVAL") {
    return { success: false, error: `Entry is ${entryWithApproval.approvalStatus}, not pending approval` };
  }

  // Update to APPROVED
  await db
    .update(tenantLedger)
    .set({
      approvalStatus: "APPROVED",
      approvedBy: managerClerkId,
      approvedAt: new Date(),
      description: entry.description?.replace("[PENDING APPROVAL] ", "") ?? entry.description,
    } as any)
    .where(eq(tenantLedger.id, ledgerEntryId));

  // Audit log
  await logAuditEvent({
    actorClerkId: managerClerkId,
    actorRole: managerRole as any,
    agencyId: entry.agencyId,
    action: "MANUAL_LEDGER_ENTRY_APPROVED",
    targetTable: "tenant_ledger",
    targetId: ledgerEntryId,
    beforeValue: { approvalStatus: "PENDING_APPROVAL" },
    afterValue: { approvalStatus: "APPROVED", approvedBy: managerClerkId },
  });

  log("info", `Manual payment ${ledgerEntryId} approved by ${managerClerkId}`, {
    service: "maker-checker",
    agencyId: entry.agencyId,
  });

  return { success: true };
}

/**
 * Reject a pending manual payment (Manager).
 */
export async function rejectManualPayment(
  ledgerEntryId: string,
  managerClerkId: string,
  managerRole: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (managerRole !== "MANAGER" && managerRole !== "AGENCY_OWNER") {
    return { success: false, error: "Only managers or agency owners can reject payments" };
  }

  const db = getDb();

  const [entry] = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.id, ledgerEntryId))
    .limit(1);

  if (!entry) {
    return { success: false, error: "Ledger entry not found" };
  }

  if ((entry as any).approvalStatus !== "PENDING_APPROVAL") {
    return { success: false, error: `Entry is ${(entry as any).approvalStatus}, not pending approval` };
  }

  await db
    .update(tenantLedger)
    .set({
      approvalStatus: "REJECTED",
      approvedBy: managerClerkId,
      approvedAt: new Date(),
      rejectionReason: reason,
    } as any)
    .where(eq(tenantLedger.id, ledgerEntryId));

  await logAuditEvent({
    actorClerkId: managerClerkId,
    actorRole: managerRole as any,
    agencyId: entry.agencyId,
    action: "MANUAL_LEDGER_ENTRY_REJECTED",
    targetTable: "tenant_ledger",
    targetId: ledgerEntryId,
    beforeValue: { approvalStatus: "PENDING_APPROVAL" },
    afterValue: { approvalStatus: "REJECTED", rejectionReason: reason },
  });

  return { success: true };
}

/**
 * Get all pending approvals for a manager to review.
 */
export async function getPendingApprovals(agencyId: string) {
  const db = getDb();

  return db
    .select()
    .from(tenantLedger)
    .where(
      and(
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.approvalStatus, "PENDING_APPROVAL")
      )
    )
    .orderBy(tenantLedger.createdAt);
}

// ── Legacy: direct log (for backward compat / admin override) ──

export async function logManualPayment(
  input: ManualPaymentInput
): Promise<ManualPaymentResult> {
  // For AGENCY_OWNER or MANAGER: direct post (bypass approval)
  const db = getDb();

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
    return { success: false, warning: "Tenant not found" };
  }

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
        warning: `Reference "${input.referenceCode}" already exists.`,
      };
    }
  }

  const [ledger] = await db
    .insert(tenantLedger)
    .values({
      tenantId: input.tenantId,
      buildingId: input.buildingId,
      agencyId: input.agencyId,
      type: "CREDIT",
      category: "RENT",
      amount: input.amount.toFixed(2),
      method: input.method,
      referenceCode: input.referenceCode,
      description: input.description,
      billingMonth: input.billingMonth,
      recordedBy: input.recordedBy,
      approvalStatus: "APPROVED",
      approvedBy: input.recordedBy,
      approvedAt: new Date(),
    } as any)
    .returning({ id: tenantLedger.id });

  return { success: true, ledgerId: ledger.id, tenantName: tenant.fullName };
}

export async function checkReferenceCodeExists(referenceCode: string): Promise<boolean> {
  if (!referenceCode) return false;
  const db = getDb();
  const [existing] = await db
    .select({ id: tenantLedger.id })
    .from(tenantLedger)
    .where(eq(tenantLedger.referenceCode, referenceCode))
    .limit(1);
  return !!existing;
}