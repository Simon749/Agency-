// lib/audit/integrations.ts
// Phase B — Pre-built audit wrappers for common mutations.
// Import these instead of calling logAuditEvent directly for standard ops.
//
// Pattern: always fetch BEFORE the mutation, then call audit AFTER success.
//
// Example:
//   const oldLease = await db.select().from(leases).where(eq(leases.id, id));
//   await db.update(leases).set({ rentAmount: newAmount }).where(eq(leases.id, id));
//   await auditRentAmountEdit(id, oldLease[0], { rentAmount: newAmount });

"use server";

import { logAuditEvent } from "./logger";
import type { AuditAction } from "./logger";

// ── Lease / Rent ──────────────────────────────────────────────────────────

export async function auditRentAmountEdit(
  leaseId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "RENT_AMOUNT_EDIT",
    targetTable: "leases",
    targetId: leaseId,
    agencyId,
    beforeValue: before,
    afterValue: after,
  });
}

export async function auditDepositAmountEdit(
  leaseId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "DEPOSIT_AMOUNT_EDIT",
    targetTable: "leases",
    targetId: leaseId,
    agencyId,
    beforeValue: before,
    afterValue: after,
  });
}

export async function auditLeaseCreate(
  leaseId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "LEASE_CREATE",
    targetTable: "leases",
    targetId: leaseId,
    agencyId,
    afterValue: after,
  });
}

export async function auditLeaseTerminate(
  leaseId: string,
  before: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "LEASE_TERMINATE",
    targetTable: "leases",
    targetId: leaseId,
    agencyId,
    beforeValue: before,
  });
}

// ── Tenant Lifecycle ──────────────────────────────────────────────────────

export async function auditTenantInvite(
  tenantId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "TENANT_INVITE",
    targetTable: "tenants",
    targetId: tenantId,
    agencyId,
    afterValue: after,
  });
}

export async function auditTenantVacate(
  tenantId: string,
  before: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "TENANT_VACATE",
    targetTable: "tenants",
    targetId: tenantId,
    agencyId,
    beforeValue: before,
  });
}

export async function auditTenantRemove(
  tenantId: string,
  before: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "TENANT_REMOVE",
    targetTable: "tenants",
    targetId: tenantId,
    agencyId,
    beforeValue: before,
  });
}

// ── Staff ─────────────────────────────────────────────────────────────────

export async function auditStaffInvite(
  staffId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "STAFF_INVITE",
    targetTable: "staff",
    targetId: staffId,
    agencyId,
    afterValue: after,
  });
}

export async function auditStaffRemove(
  staffId: string,
  before: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "STAFF_REMOVE",
    targetTable: "staff",
    targetId: staffId,
    agencyId,
    beforeValue: before,
  });
}

export async function auditRoleChange(
  userId: string,
  beforeRole: string,
  afterRole: string,
  agencyId?: string
) {
  await logAuditEvent({
    action: "ROLE_CHANGE",
    targetTable: "users", // conceptual — Clerk is the source of truth
    targetId: userId,
    agencyId,
    beforeValue: { role: beforeRole },
    afterValue: { role: afterRole },
  });
}

// ── Building & Daraja ─────────────────────────────────────────────────────

export async function auditDarajaCredentialUpdate(
  buildingId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  agencyId?: string
) {
  // STRIP actual credential values — log that they changed, not what they are
  const safeBefore = { ...before };
  const safeAfter = { ...after };
  // Remove actual secrets if present
  ["darajaConsumerKey", "darajaConsumerSecret", "darajaPasskey"].forEach((k) => {
    if (safeBefore[k]) safeBefore[k] = "[REDACTED]";
    if (safeAfter[k]) safeAfter[k] = "[REDACTED]";
  });

  await logAuditEvent({
    action: "DARAJA_CREDENTIAL_UPDATE",
    targetTable: "buildings",
    targetId: buildingId,
    agencyId,
    beforeValue: safeBefore,
    afterValue: safeAfter,
  });
}

export async function auditBuildingCreate(
  buildingId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "BUILDING_CREATE",
    targetTable: "buildings",
    targetId: buildingId,
    agencyId,
    afterValue: after,
  });
}

export async function auditBuildingDelete(
  buildingId: string,
  before: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "BUILDING_DELETE",
    targetTable: "buildings",
    targetId: buildingId,
    agencyId,
    beforeValue: before,
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────

export async function auditUtilityRateChange(
  utilityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "UTILITY_RATE_CHANGE",
    targetTable: "building_utilities",
    targetId: utilityId,
    agencyId,
    beforeValue: before,
    afterValue: after,
  });
}

export async function auditMeterReadingCreate(
  readingId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "METER_READING_CREATE",
    targetTable: "utility_readings",
    targetId: readingId,
    agencyId,
    afterValue: after,
  });
}

// ── Payments & Ledger ─────────────────────────────────────────────────────

export async function auditManualLedgerEntry(
  ledgerId: string,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "MANUAL_LEDGER_ENTRY",
    targetTable: "tenant_ledger",
    targetId: ledgerId,
    agencyId,
    afterValue: after,
  });
}

export async function auditLedgerReversal(
  originalLedgerId: string,
  reversalLedgerId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  agencyId?: string
) {
  await logAuditEvent({
    action: "LEDGER_REVERSAL",
    targetTable: "tenant_ledger",
    targetId: reversalLedgerId,
    agencyId,
    beforeValue: { originalEntryId: originalLedgerId, ...before },
    afterValue: after,
  });
}

// ── Kill Switch ───────────────────────────────────────────────────────────

export async function auditKillSwitchToggle(
  agencyId: string,
  beforeActive: boolean,
  afterActive: boolean
) {
  await logAuditEvent({
    action: afterActive ? "AGENCY_REACTIVATED" : "AGENCY_SUSPENDED",
    targetTable: "agencies",
    targetId: agencyId,
    agencyId,
    beforeValue: { isActive: beforeActive },
    afterValue: { isActive: afterActive },
  });
}

// ── National ID Access ────────────────────────────────────────────────────

export async function auditNationalIdAccess(
  tenantId: string,
  reason: string,
  agencyId?: string
) {
  await logAuditEvent({
    action: "NATIONAL_ID_ACCESS",
    targetTable: "tenants",
    targetId: tenantId,
    agencyId,
    afterValue: { accessReason: reason },
  });
}

// ── Complaints ──────────────────────────────────────────────────────────────

export async function auditComplaintAssign(
  complaintId: string,
  beforeAssignee: string | null,
  afterAssignee: string,
  agencyId?: string
) {
  await logAuditEvent({
    action: "COMPLAINT_ASSIGN",
    targetTable: "complaints",
    targetId: complaintId,
    agencyId,
    beforeValue: { assignedTo: beforeAssignee },
    afterValue: { assignedTo: afterAssignee },
  });
}