// lib/staff/queries.ts
// Staff queries — scoped to agencyId. No cross-agency leaks.

import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { staff, agencies } from "@/db/schema";
import { StaffRole } from "@/db/schema";

export interface StaffListItem {
  id: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: string;
  nationalId: string | null;
  assignedBuildingIds: string[] | null;
  createdAt: Date;
  deactivatedAt: Date | null;
}

export async function getStaffByAgency(agencyId: string): Promise<StaffListItem[]> {
  const db = getDb();
  return db
    .select({
      id: staff.id,
      clerkUserId: staff.clerkUserId,
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      status: staff.status,
      nationalId: staff.nationalId,
      assignedBuildingIds: staff.assignedBuildingIds,
      createdAt: staff.createdAt,
      deactivatedAt: staff.deactivatedAt,
    })
    .from(staff)
    .where(eq(staff.agencyId, agencyId))
    .orderBy(staff.createdAt);
}

export async function getStaffById(staffId: string, agencyId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));
  return row ?? null;
}

export async function getStaffByClerkId(clerkUserId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(staff)
    .where(eq(staff.clerkUserId, clerkUserId));
  return row ?? null;
}

export async function insertStaff(data: {
  clerkUserId: string;
  agencyId: string;
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  nationalId?: string;
  assignedBuildingIds?: string[];
}) {
  const db = getDb();
  const [result] = await db
    .insert(staff)
    .values({
      clerkUserId: data.clerkUserId,
      agencyId: data.agencyId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      role: data.role,
      nationalId: data.nationalId ?? null,
      assignedBuildingIds: data.assignedBuildingIds ?? [],
      status: "ACTIVE",
    })
    .returning();
  return result;
}

export async function deactivateStaff(staffId: string, agencyId: string) {
  const db = getDb();
  await db
    .update(staff)
    .set({ status: "INACTIVE", deactivatedAt: new Date() })
    .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));
}

export async function reactivateStaff(staffId: string, agencyId: string) {
  const db = getDb();
  await db
    .update(staff)
    .set({ status: "ACTIVE", deactivatedAt: null })
    .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));
}

export async function updateStaffBuildings(
  staffId: string,
  agencyId: string,
  buildingIds: string[]
) {
  const db = getDb();
  await db
    .update(staff)
    .set({ assignedBuildingIds: buildingIds })
    .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));
}