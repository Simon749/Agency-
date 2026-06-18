// lib/staff/queries.ts
// Staff queries — Clerk is the single source of truth.
// No DB staff table needed. All data comes from Clerk user objects.

import { clerkClient } from "@clerk/nextjs/server";
import { StaffRole } from "@/db/schema";

export interface StaffListItem {
  id: string;              // Clerk user ID
  clerkUserId: string;     // Same as id
  fullName: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  status: "ACTIVE" | "INACTIVE";
  nationalId: string | null;
  assignedBuildingIds: string[] | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  imageUrl: string | null;
}

/**
 * Get all staff members for an agency directly from Clerk.
 * Filters by publicMetadata.agencyId and staff roles.
 */
export async function getStaffByAgency(agencyId: string): Promise<StaffListItem[]> {
  const clerk = await clerkClient();
  
  // Fetch all users (Clerk pagination — 500 max per call)
  const { data: users } = await clerk.users.getUserList({
    limit: 500,
  });

  // Filter to staff roles only for this agency
  const staffUsers = users.filter((user) => {
    const meta = user.publicMetadata as Record<string, unknown>;
    return (
      meta.agencyId === agencyId &&
      ["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(meta.role as string)
    );
  });

  return staffUsers.map((user) => {
    const meta = user.publicMetadata as Record<string, unknown>;
    const primaryEmail = user.emailAddresses[0]?.emailAddress ?? "";
    const primaryPhone = user.phoneNumbers[0]?.phoneNumber ?? null;
    
    // Derive status from Clerk's banned status
    const isBanned = user.banned;
    
    return {
      id: user.id,
      clerkUserId: user.id,
      fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || primaryEmail,
      email: primaryEmail,
      phone: primaryPhone,
      role: (meta.role as StaffRole) ?? "FIELD_AGENT",
      status: isBanned ? "INACTIVE" : "ACTIVE",
      nationalId: (meta.nationalId as string) ?? null,
      assignedBuildingIds: (meta.assignedBuildingIds as string[]) ?? null,
      createdAt: new Date(user.createdAt),
      deactivatedAt: isBanned ? new Date() : null, // Approximate — Clerk doesn't track ban date
      imageUrl: user.imageUrl,
    };
  });
}

/**
 * Get a single staff member by Clerk user ID.
 */
export async function getStaffByClerkId(clerkUserId: string): Promise<StaffListItem | null> {
  const clerk = await clerkClient();
  
  try {
    const user = await clerk.users.getUser(clerkUserId);
    const meta = user.publicMetadata as Record<string, unknown>;
    
    if (!meta.agencyId) return null;
    
    const primaryEmail = user.emailAddresses[0]?.emailAddress ?? "";
    const primaryPhone = user.phoneNumbers[0]?.phoneNumber ?? null;
    const isBanned = user.banned;
    
    return {
      id: user.id,
      clerkUserId: user.id,
      fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || primaryEmail,
      email: primaryEmail,
      phone: primaryPhone,
      role: (meta.role as StaffRole) ?? "FIELD_AGENT",
      status: isBanned ? "INACTIVE" : "ACTIVE",
      nationalId: (meta.nationalId as string) ?? null,
      assignedBuildingIds: (meta.assignedBuildingIds as string[]) ?? null,
      createdAt: new Date(user.createdAt),
      deactivatedAt: isBanned ? new Date() : null,
      imageUrl: user.imageUrl,
    };
  } catch {
    return null;
  }
}

// ── Stub functions for compatibility with existing actions.ts ─────────

export async function insertStaff(_data: unknown) {
  // No-op: Clerk is the source of truth. Users are created via invitation.
  throw new Error("Use inviteStaff action instead. Clerk is the source of truth.");
}

export async function deactivateStaff(_staffId: string, _agencyId: string) {
  // No-op: handled by Clerk banUser in actions.ts
}

export async function reactivateStaff(_staffId: string, _agencyId: string) {
  // No-op: handled by Clerk unbanUser in actions.ts
}

export async function updateStaffBuildings(_staffId: string, _agencyId: string, _buildingIds: string[]) {
  // No-op: would need to update Clerk publicMetadata
  // Implementation: clerk.users.updateUserMetadata(staffId, { publicMetadata: { assignedBuildingIds } })
}