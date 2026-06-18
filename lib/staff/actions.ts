// lib/staff/actions.ts
// Server Actions for staff management — Clerk is the single source of truth.
// No DB staff table. All state lives in Clerk.

"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { revalidatePath } from "next/cache";

// ── 1. Invite Staff (Manager or Field Agent) ───────────────────────────────

export async function inviteStaff(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: "MANAGER" | "FIELD_AGENT";
  nationalId?: string;
  assignedBuildingIds?: string[];
}): Promise<{ success: boolean; message: string; inviteUrl?: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated with account" };
  }

  const { email, fullName, phone, role, nationalId, assignedBuildingIds } = formData;

  try {
    const clerk = await clerkClient();

    // Parse fullName into first/last for Clerk
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") ?? "";

    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role,
        agencyId,
        buildingId: null,
        unitId: null,
        nationalId: nationalId ?? null,
        assignedBuildingIds: assignedBuildingIds ?? [],
      },
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${ 
        role === "FIELD_AGENT" ? "/admin/agent/meter-readings" : "/admin/dashboard" 
      }`,
    });

    revalidatePath("/admin/settings/staff");

    return {
      success: true,
      message: `Invitation sent to ${email}. They will appear in the list once they accept.`,
      inviteUrl: invitation.url,
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

export async function deactivateStaffAction(clerkUserId: string): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  try {
    const clerk = await clerkClient();
    
    // Verify the user belongs to this agency before banning
    const user = await clerk.users.getUser(clerkUserId);
    const meta = user.publicMetadata as Record<string, unknown>;
    
    if (meta.agencyId !== agencyId) {
      return { success: false, message: "Staff not found in your agency" };
    }

    await clerk.users.banUser(clerkUserId);

    revalidatePath("/admin/settings/staff");
    return { success: true, message: "Staff deactivated and access revoked" };
  } catch (err) {
    console.error("[STAFF DEACTIVATE] Failed:", err);
    return { success: false, message: "Failed to deactivate staff" };
  }
}

// ── 3. Reactivate Staff ────────────────────────────────────────────────────

export async function reactivateStaffAction(clerkUserId: string): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  try {
    const clerk = await clerkClient();
    
    // Verify ownership
    const user = await clerk.users.getUser(clerkUserId);
    const meta = user.publicMetadata as Record<string, unknown>;
    
    if (meta.agencyId !== agencyId) {
      return { success: false, message: "Staff not found in your agency" };
    }

    await clerk.users.unbanUser(clerkUserId);

    revalidatePath("/admin/settings/staff");
    return { success: true, message: "Staff reactivated" };
  } catch (err) {
    console.error("[STAFF REACTIVATE] Failed:", err);
    return { success: false, message: "Failed to reactivate staff" };
  }
}

// ── 4. Update Assigned Buildings ────────────────────────────────────────────

export async function updateStaffBuildingsAction(
  clerkUserId: string,
  buildingIds: string[]
): Promise<{ success: boolean; message: string }> {
  await requireRole(["AGENCY_OWNER"]);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) {
    return { success: false, message: "No agency associated" };
  }

  try {
    const clerk = await clerkClient();
    
    // Verify ownership
    const user = await clerk.users.getUser(clerkUserId);
    const meta = user.publicMetadata as Record<string, unknown>;
    
    if (meta.agencyId !== agencyId) {
      return { success: false, message: "Staff not found in your agency" };
    }

    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...meta,
        assignedBuildingIds: buildingIds,
      },
    });

    revalidatePath("/admin/settings/staff");
    return { success: true, message: "Building assignments updated" };
  } catch (err) {
    console.error("[STAFF BUILDINGS] Failed:", err);
    return { success: false, message: "Failed to update building assignments" };
  }
}