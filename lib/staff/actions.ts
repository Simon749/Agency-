// lib/staff/actions.ts
// Server Actions for staff management — secured to AGENCY_OWNER only.
// Uses Clerk Invitation API for invites + DB staff table for tracking.

"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { staff, buildings } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { insertStaff, deactivateStaff, reactivateStaff, updateStaffBuildings } from "./queries";

// ── 1. Invite Staff (Manager or Field Agent) ───────────────────────────────

export async function inviteStaff(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: "MANAGER" | "FIELD_AGENT";
  nationalId?: string;
  assignedBuildingIds?: string[];
}): Promise<{ success: boolean; message: string; inviteUrl?: string }> {
  // Enforce AGENCY_OWNER only
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated with account" };
  }

  const { email, fullName, phone, role, nationalId, assignedBuildingIds } = formData;

  try {
    const clerk = await clerkClient();

    // Create invitation via Clerk
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role,
        agencyId,
        buildingId: null,
        unitId: null,
      },
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${
        role === "FIELD_AGENT" ? "/admin/agent/meter-readings" : "/admin/dashboard"
      }`,
    });

    // Insert into staff table for tracking
    await insertStaff({
      clerkUserId: invitation.id, // temp ID until they accept
      agencyId,
      fullName,
      email,
      phone,
      role,
      nationalId,
      assignedBuildingIds,
    });

    revalidatePath("/admin/settings/staff");

    return {
      success: true,
      message: `Invitation sent to ${email}. They will appear in the list once they accept.`,
      inviteUrl: invitation.url, // owner can copy-paste to WhatsApp if email fails
    };
  } catch (err) {
    console.error("[STAFF INVITE] Failed:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to send invitation",
    };
  }
}

// ── 2. Deactivate Staff ────────────────────────────────────────────────────

export async function deactivateStaffAction(staffId: string): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  try {
    const db = getDb();
    const [staffRow] = await db
      .select({ clerkUserId: staff.clerkUserId })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));

    if (!staffRow) {
      return { success: false, message: "Staff not found" };
    }

    // Deactivate in DB
    await deactivateStaff(staffId, agencyId);

    // Also ban in Clerk (they can no longer sign in)
    try {
      const clerk = await clerkClient();
      await clerk.users.banUser(staffRow.clerkUserId);
    } catch {
      // Clerk ban may fail if user hasn't accepted invite yet — that's OK
      console.warn(`[STAFF] Could not ban Clerk user ${staffRow.clerkUserId} — may be pending invite`);
    }

    revalidatePath("/admin/settings/staff");
    return { success: true, message: "Staff deactivated and access revoked" };
  } catch (err) {
    console.error("[STAFF DEACTIVATE] Failed:", err);
    return { success: false, message: "Failed to deactivate staff" };
  }
}

// ── 3. Reactivate Staff ────────────────────────────────────────────────────

export async function reactivateStaffAction(staffId: string): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  try {
    const db = getDb();
    const [staffRow] = await db
      .select({ clerkUserId: staff.clerkUserId })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.agencyId, agencyId)));

    if (!staffRow) {
      return { success: false, message: "Staff not found" };
    }

    await reactivateStaff(staffId, agencyId);

    // Unban in Clerk
    try {
      const clerk = await clerkClient();
      await clerk.users.unbanUser(staffRow.clerkUserId);
    } catch {
      console.warn(`[STAFF] Could not unban Clerk user ${staffRow.clerkUserId}`);
    }

    revalidatePath("/admin/settings/staff");
    return { success: true, message: "Staff reactivated" };
  } catch (err) {
    console.error("[STAFF REACTIVATE] Failed:", err);
    return { success: false, message: "Failed to reactivate staff" };
  }
}

// ── 4. Update Assigned Buildings ────────────────────────────────────────────

export async function updateStaffBuildingsAction(
  staffId: string,
  buildingIds: string[]
): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  // Verify all buildings belong to this agency
  const db = getDb();
  const validBuildings = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.agencyId, agencyId), inArray(buildings.id, buildingIds)));

  const validIds = validBuildings.map((b) => b.id);

  await updateStaffBuildings(staffId, agencyId, validIds);
  revalidatePath("/admin/settings/staff");

  return { success: true, message: "Building assignments updated" };
}

