// app/(admin)/admin/settings/notifications/page.tsx
// Agency-level notification preferences: preferred channel + per-event toggles.
// Backs lib/notifications/channel-router.ts's future preference lookup.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

const EVENT_TOGGLES = [
  { key: "notifyPaymentReceived", label: "Payment received" },
  { key: "notifyRentReminder", label: "Rent due reminder (7 days out)" },
  { key: "notifyOverdue", label: "Rent overdue notice" },
  { key: "notifyLeaseRenewal", label: "Lease renewal reminder" },
  { key: "notifyComplaintFiled", label: "New complaint filed (to manager)" },
  { key: "notifyComplaintResolved", label: "Complaint resolved (to tenant)" },
  { key: "notifyInviteSent", label: "Tenant/staff invite sent" },
] as const;

export default async function NotificationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }
  if (!agencyId) redirect("/pending-setup");

  const params = await searchParams;
  const db = getDb();

  let [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.agencyId, agencyId))
    .limit(1);

  // Create a default row on first visit so the form always has something to bind to.
  if (!prefs) {
    [prefs] = await db
      .insert(notificationPreferences)
      .values({ agencyId })
      .returning();
  }

  async function updatePreferences(formData: FormData) {
    "use server";

    const session = await getSessionMeta();
    if (!session.agencyId || !["AGENCY_OWNER", "MANAGER"].includes(session.role ?? "")) {
      throw new Error("Not authorized");
    }

    const db = getDb();
    const preferredChannel = String(formData.get("preferredChannel") ?? "SMS");

    const updates: Record<string, unknown> = { preferredChannel };
    for (const toggle of EVENT_TOGGLES) {
      updates[toggle.key] = formData.get(toggle.key) === "on";
    }

    await db
      .update(notificationPreferences)
      .set(updates)
      .where(eq(notificationPreferences.agencyId, session.agencyId));

    revalidatePath("/admin/settings/notifications");
    redirect(
      `/admin/settings/notifications?success=${encodeURIComponent("Notification preferences saved")}`
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs tracking-widest text-white/40 uppercase mb-3">
        Settings
      </p>
      <h1 className="text-3xl font-light tracking-tight text-white mb-2">
        Notifications
      </h1>
      <p className="text-sm text-white/50 mb-8">
        Choose how PropFlow reaches your tenants and staff, and which events
        trigger a message.
      </p>

      {params.success && (
        <div className="bg-green-400/10 border border-green-400/30 p-4 mb-6 text-green-400 text-sm">
          ✅ {decodeURIComponent(params.success)}
        </div>
      )}

      <form action={updatePreferences} className="space-y-6">
        <div className="bg-white/[0.03] border border-white/[0.07] p-6">
          <label className="block text-xs tracking-widest text-white/40 uppercase mb-3">
            Preferred Channel
          </label>
          <select
            name="preferredChannel"
            defaultValue={prefs.preferredChannel}
            className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full md:w-64"
          >
            <option value="SMS">SMS (Africa's Talking)</option>
            <option value="WHATSAPP" disabled>
              WhatsApp Business (coming soon)
            </option>
          </select>
          <p className="text-xs text-white/30 mt-2">
            SMS is the only live channel today. WhatsApp support is tracked in
            Gap Closure Tracker Phase H — this selector is wired up ahead of
            that rollout.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] p-6">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
            Events
          </p>
          <div className="space-y-3">
            {EVENT_TOGGLES.map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-sm text-white/80">{toggle.label}</span>
                <input
                  type="checkbox"
                  name={toggle.key}
                  defaultChecked={Boolean(prefs[toggle.key as keyof typeof prefs])}
                  className="h-4 w-4 accent-white"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 text-xs uppercase tracking-widest bg-white/10 border border-white/20 text-white hover:bg-white/15"
        >
          Save Preferences
        </button>
      </form>
    </div>
  );
}