// lib/notifications/channel-router.ts
// Routes outbound notifications through the agency's preferred channel,
// respecting per-event toggles from notification_preferences.
// Backs the /admin/settings/notifications page and all webhook/cron callers.

import { eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { notificationPreferences } from "../../db/schema";
import { sendSms } from "../../lib/sms/sendSms";

export type NotificationType =
  | "PAYMENT"
  | "REMINDER"
  | "OVERDUE"
  | "LEASE"
  | "COMPLAINT_FILED"
  | "COMPLAINT_RESOLVED"
  | "INVITE";

export type NotificationChannel = "SMS" | "WHATSAPP";

export interface DispatchParams {
  userId: string; // Clerk user ID of the RECIPIENT (not a tenant DB uuid — see note below)
  agencyId: string;
  phone: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string | number>;
  type: NotificationType;
}

export interface DispatchResult {
  channel: NotificationChannel;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

// Maps each event type to the toggle column that gates it.
const TYPE_TO_PREFERENCE_KEY: Record<NotificationType, keyof typeof notificationPreferences.$inferSelect> = {
  PAYMENT: "notifyPaymentReceived",
  REMINDER: "notifyRentReminder",
  OVERDUE: "notifyOverdue",
  LEASE: "notifyLeaseRenewal",
  COMPLAINT_FILED: "notifyComplaintFiled",
  COMPLAINT_RESOLVED: "notifyComplaintResolved",
  INVITE: "notifyInviteSent",
};

/**
 * Dispatch a notification through the agency's configured channel.
 *
 * Looks up preferences by agencyId (agency-level settings — see schema note).
 * If no preference row exists yet, defaults to SMS with all events enabled,
 * matching the column defaults in notification_preferences.
 */
export async function dispatchNotification(
  params: DispatchParams
): Promise<DispatchResult> {
  const db = getDb();

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.agencyId, params.agencyId))
    .limit(1);

  // No row yet — fall back to the same defaults the DB columns would give,
  // so behavior is identical whether or not the agency has visited the
  // notifications settings page.
  const preferredChannel = prefs?.preferredChannel ?? "SMS";
  const fallbackToSms = prefs?.fallbackToSms ?? true;
  const eventEnabled =
    prefs === undefined ? true : Boolean(prefs[TYPE_TO_PREFERENCE_KEY[params.type]]);

  if (!eventEnabled) {
    return {
      channel: "SMS",
      success: true,
      skipped: true,
      reason: `Agency has disabled notifications for event type: ${params.type}`,
    };
  }

  // WhatsApp isn't live yet (Gap Closure Tracker Phase H). Route everything
  // to SMS today, but keep the branch so the swap-in later is a one-line change.
  if (preferredChannel === "WHATSAPP") {
    // TODO(Phase H): call the WhatsApp Business API here once integrated.
    // For now, always fall back to SMS regardless of fallbackToSms, since
    // there is no WhatsApp path to attempt yet.
    const smsResult = await sendSms(params.phone, params.message);
    return {
      channel: "SMS",
      success: smsResult.success,
      error: smsResult.error,
      reason: fallbackToSms ? "WhatsApp not yet integrated — used SMS fallback" : undefined,
    };
  }

  const smsResult = await sendSms(params.phone, params.message);
  return {
    channel: "SMS",
    success: smsResult.success,
    error: smsResult.error,
  };
}