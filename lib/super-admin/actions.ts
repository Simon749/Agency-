"use server";

// lib/super-admin/actions.ts
// Server Actions for Super Admin operations.
// All actions are secured — only SUPER_ADMIN can execute.

import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { toggleAgencyStatus as toggleInDb, terminateAgency as terminateInDb } from "./queries";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { agencies, agencySubscriptions, subscriptionPayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { invalidateAgencyCache } from '@/proxy';


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

  // Invalidate agency status cache
  invalidateAgencyCache(agencyId);
  
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
  await requireRole(["SUPER_ADMIN"]);
  const session = await getSessionMeta();

  const agencyName  = (formData.get("agencyName") as string)?.trim();
  const agencyEmail = (formData.get("agencyEmail") as string)?.trim().toLowerCase();
  const agencyPhone = (formData.get("agencyPhone") as string)?.trim();
  const ownerEmail  = (formData.get("ownerEmail") as string)?.trim().toLowerCase();
  const plan        = (formData.get("plan") as string) || "TRIAL";

  if (!agencyName || !agencyEmail || !agencyPhone || !ownerEmail) {
    return { success: false, error: "All fields are required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(agencyEmail) || !emailRegex.test(ownerEmail)) {
    return { success: false, error: "Please enter valid email addresses." };
  }

  const db = getDb();

  // Check uniqueness
  const [existingByName] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.name, agencyName))
    .limit(1);

  if (existingByName) {
    return { success: false, error: `An agency named "${agencyName}" already exists.` };
  }

  const [existingByEmail] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.email, agencyEmail))
    .limit(1);

  if (existingByEmail) {
    return { success: false, error: `An agency with email "${agencyEmail}" already exists.` };
  }

  // Calculate pricing based on plan
  const planPricing: Record<string, { amount: number; cycle: string }> = {
    TRIAL:    { amount: 0,    cycle: "MONTHLY" },
    STARTER:  { amount: 3500, cycle: "MONTHLY" },
    GROWTH:   { amount: 8500, cycle: "MONTHLY" },
    ENTERPRISE: { amount: 25000, cycle: "MONTHLY" },
  };

  const pricing = planPricing[plan] || planPricing.TRIAL;

  let newAgencyId: string;

  try {
    const [inserted] = await db
      .insert(agencies)
      .values({
        name: agencyName,
        email: agencyEmail,
        phone: agencyPhone,
        isActive: true,
        subscriptionStatus: plan === "TRIAL" ? "TRIAL" : "ACTIVE",
      })
      .returning({ id: agencies.id });

    if (!inserted?.id) throw new Error("Insert returned no ID.");
    newAgencyId = inserted.id;
  } catch (err) {
    console.error("[createAgency] DB insert failed:", err);
    return { success: false, error: "Failed to create agency. Please try again." };
  }

  // Create subscription record
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 14);

  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  try {
    await db.insert(agencySubscriptions).values({
      agencyId: newAgencyId,
      plan: plan as any,
      amountKes: String(pricing.amount),
      billingCycle: pricing.cycle,
      status: plan === "TRIAL" ? "ACTIVE" : "ACTIVE",
      paidThroughDate: plan === "TRIAL" ? trialEnds.toISOString().slice(0, 10) : null,
      nextBillingDate: plan === "TRIAL" ? trialEnds.toISOString().slice(0, 10) : nextBilling.toISOString().slice(0, 10),
      trialEndsAt: plan === "TRIAL" ? trialEnds.toISOString().slice(0, 10) : null,
      paymentMethod: "MPESA_PAYBILL",
      mpesaPaybillNumber: process.env.SUBSCRIPTION_PAYBILL_NUMBER || "522522",
      mpesaAccountNumber: `PF-${newAgencyId.slice(0, 8).toUpperCase()}`,
      bankReferencePrefix: `PF-AGENCY-${newAgencyId.slice(0, 4).toUpperCase()}`,
    });
  } catch (err) {
    console.error("[createAgency] Subscription insert failed:", err);
    // Don't roll back — agency exists, subscription can be fixed manually
  }

  // Send Clerk invite
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
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`,
      ignoreExisting: false,
    });
  } catch (err) {
    console.error("[createAgency] Clerk invite failed — rolling back:", err);

    try {
      await db.delete(agencies).where(eq(agencies.id, newAgencyId));
      await db.delete(agencySubscriptions).where(eq(agencySubscriptions.agencyId, newAgencyId));
    } catch (rollbackErr) {
      console.error("[createAgency] Rollback failed:", rollbackErr);
    }

    const clerkError = err instanceof Error ? err.message : String(err);
    if (clerkError.includes("already")) {
      return {
        success: false,
        error: `The owner email "${ownerEmail}" already has a Clerk account.`,
      };
    }
    return { success: false, error: "Agency created but invite failed. Please try again." };
  }

  console.log(
    `[createAgency] Agency "${agencyName}" (${newAgencyId}) created. Plan: ${plan}. Invite sent to ${ownerEmail}.`
  );

  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin/dashboard");

  return { success: true, agencyId: newAgencyId };
}

// ── 3. Terminate Agency (Soft Delete) ────────────────────────────────────

export interface TerminateAgencyResult {
  success: boolean;
  agencyName?: string;
  error?: string;
}

export async function terminateAgencyAction(
  agencyId: string,
  reason: "CONTRACT_ENDED" | "NON_PAYMENT" | "BREACH_OF_TERMS" | "REQUESTED_BY_AGENCY" | "OTHER"
): Promise<TerminateAgencyResult> {
  await requireRole(["SUPER_ADMIN"]);
  const session = await getSessionMeta();

  try {
    const result = await terminateInDb(agencyId, reason, session.userId);

    revalidatePath("/super-admin/agencies");
    revalidatePath("/super-admin/dashboard");

    return { success: true, agencyName: result.agencyName };
  } catch (err) {
    console.error("[terminateAgency] Failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to terminate agency",
    };
  }
}

// ── 4. Record Subscription Payment (Manual Entry) ────────────────────────

export interface RecordPaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export async function recordSubscriptionPayment(
  agencyId: string,
  formData: FormData
): Promise<RecordPaymentResult> {
  await requireRole(["SUPER_ADMIN"]);
  const session = await getSessionMeta();

  const amount      = parseFloat(formData.get("amount") as string);
  const method      = (formData.get("method") as string) || "MPESA_PAYBILL";
  const reference   = (formData.get("reference") as string)?.trim();
  const notes       = (formData.get("notes") as string)?.trim();
  const periodStart = (formData.get("periodStart") as string)?.trim();
  const periodEnd   = (formData.get("periodEnd") as string)?.trim();

  if (!amount || amount <= 0) {
    return { success: false, error: "Valid amount is required." };
  }

  const db = getDb();

  // Get subscription
  const [sub] = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.agencyId, agencyId))
    .limit(1);

  if (!sub) {
    return { success: false, error: "No subscription found for this agency." };
  }

  try {
    // Insert payment record
    const [payment] = await db
      .insert(subscriptionPayments)
      .values({
        agencyId,
        subscriptionId: sub.id,
        amount: String(amount),
        method: method as any,
        status: "CONFIRMED",
        referenceCode: reference || null,
        recordedBy: session.userId,
        notes: notes || null,
        billingPeriodStart: periodStart || null,
        billingPeriodEnd: periodEnd || null,
        confirmedAt: new Date(),
        confirmedBy: session.userId,
      })
      .returning({ id: subscriptionPayments.id });

    // Update subscription paidThroughDate
    const currentPaidThrough = sub.paidThroughDate ? new Date(sub.paidThroughDate) : new Date();
    const newPaidThrough = new Date(currentPaidThrough);

    // Add one billing period
    if (sub.billingCycle === "MONTHLY") newPaidThrough.setMonth(newPaidThrough.getMonth() + 1);
    else if (sub.billingCycle === "QUARTERLY") newPaidThrough.setMonth(newPaidThrough.getMonth() + 3);
    else if (sub.billingCycle === "ANNUAL") newPaidThrough.setFullYear(newPaidThrough.getFullYear() + 1);

    const newNextBilling = new Date(newPaidThrough);

    await db
      .update(agencySubscriptions)
      .set({
        paidThroughDate: newPaidThrough.toISOString().slice(0, 10),
        nextBillingDate: newNextBilling.toISOString().slice(0, 10),
        status: "ACTIVE",
        overdueSince: null,
        updatedAt: new Date(),
      })
      .where(eq(agencySubscriptions.id, sub.id));

    // If agency was suspended for non-payment, reactivate
    await db
      .update(agencies)
      .set({ isActive: true })
      .where(eq(agencies.id, agencyId));

    console.log(`[PAYMENT] Subscription payment recorded for agency ${agencyId}: KES ${amount}`);

    revalidatePath("/super-admin/agencies");
    revalidatePath("/super-admin/subscriptions");

    return { success: true, paymentId: payment.id };
  } catch (err) {
    console.error("[recordPayment] Failed:", err);
    return { success: false, error: "Failed to record payment." };
  }
}

// ── 5. Update Agency Subscription Plan ───────────────────────────────────

export async function updateAgencyPlan(
  agencyId: string,
  plan: "TRIAL" | "STARTER" | "GROWTH" | "ENTERPRISE",
  amountKes: number
): Promise<{ success: boolean; error?: string }> {
  await requireRole(["SUPER_ADMIN"]);

  const db = getDb();

  try {
    await db
      .update(agencySubscriptions)
      .set({
        plan,
        amountKes: String(amountKes),
        updatedAt: new Date(),
      })
      .where(eq(agencySubscriptions.agencyId, agencyId));

    revalidatePath("/super-admin/agencies");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to update plan." };
  }
}