"use server";

// lib/super-admin/actions.ts
// Server Actions for Super Admin operations.
// All actions are secured — only SUPER_ADMIN can execute.

import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { toggleAgencyStatus as toggleInDb } from "./queries";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { agencies } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";

// ── 1. Kill Switch ─────────────────────────────────────────────────────────

export async function toggleAgencyStatus(
  agencyId: string,
  isActive: boolean
): Promise<{ success: boolean; agencyName: string }> {
  await requireRole(["SUPER_ADMIN"]);

  const session = await getSessionMeta();
  const userId = session.userId;

  console.log(
    `[KILL SWITCH] User ${userId} toggled agency ${agencyId} to isActive=${isActive}`
  );

  const result = await toggleInDb(agencyId, isActive);

  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin/dashboard");

  return result;
}

// ── 2. Create Agency + Invite Owner ───────────────────────────────────────

export interface CreateAgencyResult {
  success: boolean;
  agencyId?: string;
  error?: string;
}

export async function createAgencyAndInviteOwner(
  formData: FormData
): Promise<CreateAgencyResult> {
  // 1. Enforce Super Admin only
  await requireRole(["SUPER_ADMIN"]);

  const session = await getSessionMeta();

  // 2. Extract and validate fields
  const agencyName  = (formData.get("agencyName") as string)?.trim();
  const agencyEmail = (formData.get("agencyEmail") as string)?.trim().toLowerCase();
  const agencyPhone = (formData.get("agencyPhone") as string)?.trim();
  const ownerEmail  = (formData.get("ownerEmail") as string)?.trim().toLowerCase();

  if (!agencyName || !agencyEmail || !agencyPhone || !ownerEmail) {
    return { success: false, error: "All fields are required." };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(agencyEmail) || !emailRegex.test(ownerEmail)) {
    return { success: false, error: "Please enter valid email addresses." };
  }

  const db = getDb();

  // 3. Check name uniqueness — clean error before hitting DB constraint
  const [existingByName] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.name, agencyName))
    .limit(1);

  if (existingByName) {
    return {
      success: false,
      error: `An agency named "${agencyName}" already exists. Please use a unique name.`,
    };
  }

  // 4. Check email uniqueness
  const [existingByEmail] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.email, agencyEmail))
    .limit(1);

  if (existingByEmail) {
    return {
      success: false,
      error: `An agency with the email "${agencyEmail}" already exists.`,
    };
  }

  // 5. Insert the agency record
  // inviteStatus is managed by the DB/defaults and the Clerk webhook when the owner completes sign-up.
  let newAgencyId: string;

  try {
    const [inserted] = await db
      .insert(agencies)
      .values({
        name:  agencyName,
        email: agencyEmail,
        phone: agencyPhone,
        isActive: true,
      })
      .returning({ id: agencies.id });

    if (!inserted?.id) {
      throw new Error("Insert returned no ID.");
    }

    newAgencyId = inserted.id;
  } catch (err) {
    console.error("[createAgency] DB insert failed:", err);
    return {
      success: false,
      error: "Failed to create agency. Please try again.",
    };
  }

  // 6. Send Clerk invite to the Agency Owner
  // If this fails, roll back the agency insert so we don't have orphaned records.
  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: ownerEmail,
      publicMetadata: {
        role:       "AGENCY_OWNER",
        agencyId:   newAgencyId,
        buildingId: null,
        unitId:     null,
      },
      notify: true,
      // Send them straight to the admin dashboard after accepting
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`,
      ignoreExisting: false,
    });
  } catch (err) {
    // Roll back — delete the agency we just inserted
    console.error("[createAgency] Clerk invite failed — rolling back agency insert:", err);

    try {
      await db.delete(agencies).where(eq(agencies.id, newAgencyId));
    } catch (rollbackErr) {
      // Log but don't mask the original error
      console.error("[createAgency] Rollback also failed:", rollbackErr);
    }

    const clerkError = err instanceof Error ? err.message : String(err);

    // Give the super admin a meaningful message
    if (clerkError.includes("already")) {
      return {
        success: false,
        error: `The owner email "${ownerEmail}" already has a Clerk account. Ask them to sign in directly, then assign their agencyId via Clerk dashboard.`,
      };
    }

    return {
      success: false,
      error: "Agency created but invite email failed to send. Please try again.",
    };
  }

  console.log(
    `[createAgency] Agency "${agencyName}" (${newAgencyId}) created by ${session.userId}. Invite sent to ${ownerEmail}.`
  );

  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin/dashboard");

  return { success: true, agencyId: newAgencyId };
}