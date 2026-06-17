// lib/lease/leaseActions.ts
// Server-side lease actions: generate, sign, check status, renew.

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leases, tenants, buildings, units, agencies } from "@/db/schema";
import { generateLease, defaultLeaseTemplate, type LeaseData } from "./generateLease";

export interface LeaseStatusResult {
  leaseId: string;
  status: string;
  generated: string | null;
  signedAt: Date | null;
  signedByTenantId: string | null;
  startDate: string;
  endDate: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  renewalDue: boolean;
}

export interface RenewalResult {
  newLeaseId: string;
  oldLeaseId: string;
  newRentAmount: number;
}

/**
 * Generate a lease agreement for a tenant and save it to the leases table.
 * Uses the building's custom template if available, otherwise the default.
 */
export async function generateLeaseForTenant(
  tenantId: string,
  leaseId: string
): Promise<{ leaseId: string; generatedText: string }> {
  const db = getDb();

  // Fetch lease
  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.tenantId, tenantId)))
    .limit(1);

  if (!lease) {
    throw new Error("Lease not found");
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Get buildingId via unit (leases doesn't have buildingId directly)
  const [unit] = await db
    .select({ buildingId: units.buildingId })
    .from(units)
    .where(eq(units.id, lease.unitId))
    .limit(1);

  if (!unit) {
    throw new Error("Unit not found for lease");
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, unit.buildingId))
    .limit(1);

  if (!building) {
    throw new Error("Building not found");
  }

  const [unitDetails] = await db
    .select()
    .from(units)
    .where(eq(units.id, lease.unitId))
    .limit(1);

  const [agency] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, tenant.agencyId))
    .limit(1);

  // Use building's custom template if available, otherwise the default
  const template = building.agreementTemplate ?? defaultLeaseTemplate;

  const data: LeaseData = {
    tenantName: tenant.fullName,
    tenantPhone: tenant.phone,
    tenantEmail: tenant.email,
    tenantNationalId: tenant.nationalId,
    agencyName: agency?.name ?? "PropFlow Agency",
    agencyEmail: agency?.email ?? "agency@propflow.co.ke",
    agencyPhone: agency?.phone ?? "N/A",
    landlordName: building.landlordName,
    landlordPhone: building.landlordPhone,
    buildingName: building.name,
    buildingLocation: building.location,
    buildingLocale: building.locale,
    unitNumber: unitDetails?.unitNumber ?? "N/A",
    unitType: unitDetails?.type,
    unitFloor: unitDetails?.floor,
    leaseStart: lease.startDate,
    leaseEnd: lease.endDate,
    rentAmount: Number(lease.rentAmount),
    depositAmount: Number(lease.depositAmount),
    escalationType: lease.escalationType,
    escalationValue: lease.escalationValue ? Number(lease.escalationValue) : null,
    billingMonth: new Date().toISOString().slice(0, 7),
  };

  const generatedText = generateLease(template, data);

  // Save generated text to lease
  await db
    .update(leases)
    .set({ agreementGenerated: generatedText })
    .where(eq(leases.id, leaseId));

  return { leaseId, generatedText };
}

/**
 * Tenant digitally signs a lease.
 * Sets signedAt = NOW() and signedByTenantId = clerkUserId.
 */
export async function signLease(
  leaseId: string,
  tenantClerkId: string
): Promise<{ success: boolean; signedAt: Date }> {
  const db = getDb();

  const now = new Date();

  await db
    .update(leases)
    .set({
      signedAt: now,
      signedByTenantId: tenantClerkId,
    })
    .where(eq(leases.id, leaseId));

  return { success: true, signedAt: now };
}

/**
 * Get lease status for a tenant — used in tenant portal and admin views.
 */
export async function getLeaseStatus(tenantId: string): Promise<LeaseStatusResult | null> {
  const db = getDb();

  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.tenantId, tenantId), eq(leases.status, "ACTIVE")))
    .orderBy(desc(leases.createdAt))
    .limit(1);

  if (!lease) return null;

  const endDate = new Date(lease.endDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const renewalDue = daysUntilExpiry <= 60 && daysUntilExpiry > 0 && !lease.signedAt;

  return {
    leaseId: lease.id,
    status: lease.status,
    generated: lease.agreementGenerated,
    signedAt: lease.signedAt,
    signedByTenantId: lease.signedByTenantId,
    startDate: lease.startDate,
    endDate: lease.endDate,
    daysUntilExpiry,
    isExpired,
    renewalDue,
  };
}

/**
 * Create a renewal lease with updated rent.
 * Old lease status → PENDING_RENEWAL.
 * New lease status → ACTIVE.
 */
export async function createRenewalLease(
  oldLeaseId: string,
  newRentAmount: number,
  newEndDate: string
): Promise<RenewalResult> {
  const db = getDb();

  // Fetch old lease
  const [oldLease] = await db
    .select()
    .from(leases)
    .where(eq(leases.id, oldLeaseId))
    .limit(1);

  if (!oldLease) {
    throw new Error("Old lease not found");
  }

  // Mark old lease as pending renewal
  await db
    .update(leases)
    .set({ status: "PENDING_RENEWAL" })
    .where(eq(leases.id, oldLeaseId));

  // Create new lease
  const [newLease] = await db
    .insert(leases)
    .values({
      tenantId: oldLease.tenantId,
      unitId: oldLease.unitId,
      agencyId: oldLease.agencyId,
      startDate: oldLease.endDate, // starts when old one ends
      endDate: newEndDate,
      rentAmount: newRentAmount.toFixed(2),
      depositAmount: oldLease.depositAmount,
      depositPaid: true, // deposit already paid in old lease
      escalationType: oldLease.escalationType,
      escalationValue: oldLease.escalationValue,
      agreementTemplate: oldLease.agreementTemplate,
      status: "ACTIVE",
    })
    .returning({ id: leases.id });

  return {
    newLeaseId: newLease.id,
    oldLeaseId: oldLease.id,
    newRentAmount,
  };
}