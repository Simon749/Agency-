// lib/super-admin/actions.ts
// Server Actions for Super Admin operations.
// Secured by Clerk session — only SUPER_ADMIN can execute.

"use server";

import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { toggleAgencyStatus as toggleInDb } from "./queries";
import { revalidatePath } from "next/cache";

export async function toggleAgencyStatus(
  agencyId: string,
  isActive: boolean
): Promise<{ success: boolean; agencyName: string }> {
  // Enforce SUPER_ADMIN role
  await requireRole(["SUPER_ADMIN"]);

  const session = await getSessionMeta();
  const userId = session.userId;

  // Prevent self-lockout (optional safety)
  // In a real system, you might want to prevent the super admin from suspending their own agency
  // But for now, we allow it — the super admin is above agencies anyway.

  console.log(`[KILL SWITCH] User ${userId} toggled agency ${agencyId} to isActive=${isActive}`);

  const result = await toggleInDb(agencyId, isActive);

  // Revalidate the agencies page so it shows updated status
  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin/dashboard");

  return result;
}