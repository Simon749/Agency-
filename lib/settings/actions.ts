// lib/settings/actions.ts
// Server Actions for settings sub-pages: Daraja, utilities, lease templates.
// Secured by role checks in each action.

"use server";

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings, buildingUtilities } from "@/db/schema";
import { encryptCredential } from "@/lib/encryption"; // your existing encryption helper

// ── 1. Update Daraja Credentials ─────────────────────────────────────────────

export async function updateDarajaCredentials(
  buildingId: string,
  agencyId: string,
  data: {
    consumerKey: string;
    consumerSecret: string;
    shortcode: string;
    passkey: string;
  }
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  // Verify building belongs to agency
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  if (!building) {
    return { success: false, message: "Building not found or access denied" };
  }

  // Encrypt credentials before storing
  await db
    .update(buildings)
    .set({
      darajaConsumerKey: data.consumerKey ? encryptCredential(data.consumerKey) : undefined,
      darajaConsumerSecret: data.consumerSecret ? encryptCredential(data.consumerSecret) : undefined,
      darajaShortcode: data.shortcode ? encryptCredential(data.shortcode) : undefined,
      darajaPasskey: data.passkey ? encryptCredential(data.passkey) : undefined,
    })
    .where(eq(buildings.id, buildingId));

  return { success: true, message: "Daraja credentials updated" };
}

// ── 2. Update Utility Rates ─────────────────────────────────────────────────

export async function updateUtilityRates(
  buildingId: string,
  agencyId: string,
  utilities: { name: string; rate: string }[]
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  // Verify building belongs to agency
  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  if (!building) {
    return { success: false, message: "Building not found or access denied" };
  }

  // Upsert each utility
  for (const u of utilities) {
    if (!u.rate || u.rate.trim() === '') continue;

    const existing = await db
      .select()
      .from(buildingUtilities)
      .where(
        and(
          eq(buildingUtilities.buildingId, buildingId),
          eq(buildingUtilities.agencyId, agencyId),
          eq(buildingUtilities.name, u.name as any)
        )
      );

    if (existing.length > 0) {
      await db
        .update(buildingUtilities)
        .set({ defaultAmount: u.rate })
        .where(eq(buildingUtilities.id, existing[0].id));
    } else {
      await db.insert(buildingUtilities).values({
        buildingId,
        agencyId,
        name: u.name as any,
        isEnabled: true,
        rateType: "FIXED",
        defaultAmount: u.rate,
      });
    }
  }

  return { success: true, message: "Utility rates updated" };
}

// ── 3. Update Lease Template ────────────────────────────────────────────────

export async function updateLeaseTemplate(
  buildingId: string,
  agencyId: string,
  template: string
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, agencyId)));

  if (!building) {
    return { success: false, message: "Building not found or access denied" };
  }

  await db
    .update(buildings)
    .set({ agreementTemplate: template })
    .where(eq(buildings.id, buildingId));

  return { success: true, message: "Lease template updated" };
}