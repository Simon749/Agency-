// app/(admin)/admin/settings/payments/page.tsx
// Payments settings hub: per-building Daraja credentials + payment mode,
// and agency-wide landlord commission default (Gap Closure Tracker Phase E).
// Design.md §12: Daraja credentials never exposed to client, AGENCY_OWNER only.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { agencies, buildings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";
import { encryptCredential } from "@/lib/encryption";

function maskValue(value: string | null): string {
  if (!value) return "Not configured";
  if (value.length <= 4) return "••••";
  return `•••• ${value.slice(-4)}`;
}

export default async function PaymentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  // Design.md §3: only AGENCY_OWNER can change Daraja credentials.
  if (role !== "AGENCY_OWNER") {
    redirect("/admin/dashboard");
  }
  if (!agencyId) redirect("/pending-setup");

  const params = await searchParams;
  const db = getDb();

  const [agency] = await db
    .select({ id: agencies.id, defaultCommissionRate: agencies.defaultCommissionRate })
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1);

  const agencyBuildings = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      location: buildings.location,
      paymentMode: buildings.paymentMode,
      darajaShortcode: buildings.darajaShortcode,
      darajaConsumerKey: buildings.darajaConsumerKey,
      darajaPasskey: buildings.darajaPasskey,
    })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  // ── Server Action: update a building's Daraja credentials + mode ──────
  async function updateBuildingPayment(formData: FormData) {
    "use server";

    const session = await getSessionMeta();
    if (session.role !== "AGENCY_OWNER" || !session.agencyId) {
      throw new Error("Not authorized");
    }

    const buildingId = String(formData.get("buildingId"));
    const paymentMode = String(formData.get("paymentMode"));
    const consumerKey = String(formData.get("consumerKey") ?? "").trim();
    const consumerSecret = String(formData.get("consumerSecret") ?? "").trim();
    const shortcode = String(formData.get("shortcode") ?? "").trim();
    const passkey = String(formData.get("passkey") ?? "").trim();

    const db = getDb();

    // Confirm building belongs to this agency before touching it (IDOR guard)
    const [existing] = await db
      .select({ id: buildings.id, agencyId: buildings.agencyId })
      .from(buildings)
      .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, session.agencyId)))
      .limit(1);

    if (!existing) {
      throw new Error("Building not found for this agency");
    }

    const updates: Record<string, unknown> = { paymentMode };

    // Only overwrite a credential field if the owner actually typed something —
    // masked inputs mean we never round-trip the real secret back to the client.
    if (consumerKey) updates.darajaConsumerKey = encryptCredential(consumerKey);
    if (consumerSecret) updates.darajaConsumerSecret = encryptCredential(consumerSecret);
    if (shortcode) updates.darajaShortcode = shortcode; // shortcode isn't secret, store plain
    if (passkey) updates.darajaPasskey = encryptCredential(passkey);

    await db
      .update(buildings)
      .set(updates)
      .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, session.agencyId)));

    // Gap Closure Tracker Phase B: Daraja credential updates are audit-logged.
    await logAuditEvent({
      actorClerkId: session.userId,
      actorRole: session.role,
      agencyId: session.agencyId,
      action: "DARAJA_CREDENTIALS_UPDATED",
      targetTable: "buildings",
      targetId: buildingId,
      beforeValue: { paymentMode: existing },
      afterValue: { paymentMode },
    });

    revalidatePath("/admin/settings/payments");
    redirect(
      `/admin/settings/payments?success=${encodeURIComponent("Payment settings updated")}`
    );
  }

  // ── Server Action: update agency-wide default commission rate ─────────
  async function updateCommissionRate(formData: FormData) {
    "use server";

    const session = await getSessionMeta();
    if (session.role !== "AGENCY_OWNER" || !session.agencyId) {
      throw new Error("Not authorized");
    }

    const rate = String(formData.get("commissionRate") ?? "0");
    const parsed = Number(rate);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      throw new Error("Commission rate must be between 0 and 100");
    }

    const db = getDb();
    await db
      .update(agencies)
      .set({ defaultCommissionRate: rate })
      .where(eq(agencies.id, session.agencyId));

    await logAuditEvent({
      actorClerkId: session.userId,
      actorRole: session.role,
      agencyId: session.agencyId,
      action: "COMMISSION_RATE_UPDATED",
      targetTable: "agencies",
      targetId: session.agencyId,
      beforeValue: {},
      afterValue: { defaultCommissionRate: rate },
    });

    revalidatePath("/admin/settings/payments");
    redirect(
      `/admin/settings/payments?success=${encodeURIComponent("Commission rate updated")}`
    );
  }

  return (
    <div className="max-w-4xl">
      <p className="text-xs tracking-widest text-white/40 uppercase mb-3">
        Settings
      </p>
      <h1 className="text-3xl font-light tracking-tight text-white mb-2">
        Payments
      </h1>
      <p className="text-sm text-white/50 mb-8">
        Configure how each building collects M-Pesa payments, and your default
        landlord commission rate.
      </p>

      {params.success && (
        <div className="bg-green-400/10 border border-green-400/30 p-4 mb-6 text-green-400 text-sm">
          ✅ {decodeURIComponent(params.success)}
        </div>
      )}

      {/* Commission rate */}
      <section className="bg-white/[0.03] border border-white/[0.07] p-6 mb-8">
        <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
          Default Landlord Commission
        </p>
        <p className="text-xs text-white/40 mb-4">
          Applied against total collected per building per month, unless overridden
          per building. See Gap Closure Tracker Phase E.
        </p>
        <form action={updateCommissionRate} className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">Rate (%)</label>
            <input
              type="number"
              name="commissionRate"
              step="0.01"
              min={0}
              max={100}
              defaultValue={agency?.defaultCommissionRate ?? "0.00"}
              className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-32"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs uppercase tracking-widest bg-white/10 border border-white/20 text-white hover:bg-white/15"
          >
            Save
          </button>
        </form>
      </section>

      {/* Per-building payment configuration */}
      <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
        Building Payment Configuration
      </p>

      {agencyBuildings.length === 0 ? (
        <p className="text-sm text-white/40">No buildings yet.</p>
      ) : (
        <div className="space-y-4">
          {agencyBuildings.map((b) => (
            <div
              key={b.id}
              className="bg-white/[0.03] border border-white/[0.07] p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-white font-medium">{b.name}</p>
                  <p className="text-xs text-white/40">{b.location}</p>
                </div>
                <span className="text-xs uppercase tracking-widest text-white/50 border border-white/15 px-2 py-1">
                  {b.paymentMode === "AGGREGATOR" ? "Shared Paybill" : "Own Shortcode"}
                </span>
              </div>

              <form action={updateBuildingPayment} className="space-y-3">
                <input type="hidden" name="buildingId" value={b.id} />

                <div>
                  <label className="block text-xs text-white/40 mb-1">Payment Mode</label>
                  <select
                    name="paymentMode"
                    defaultValue={b.paymentMode}
                    className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full md:w-64"
                  >
                    <option value="OWN_SHORTCODE">Own Daraja Shortcode</option>
                    <option value="AGGREGATOR">Shared Aggregator Paybill</option>
                  </select>
                  <p className="text-xs text-white/30 mt-1">
                    Shared paybill routes through the platform aggregator — no
                    per-building Daraja credentials needed, but confirm your
                    account-number mapping first (Gap Closure Tracker Phase H).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">
                      Shortcode <span className="text-white/20">({maskValue(b.darajaShortcode)})</span>
                    </label>
                    <input
                      type="text"
                      name="shortcode"
                      placeholder="Leave blank to keep current"
                      className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">
                      Consumer Key <span className="text-white/20">({maskValue(b.darajaConsumerKey)})</span>
                    </label>
                    <input
                      type="password"
                      name="consumerKey"
                      placeholder="Leave blank to keep current"
                      className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Consumer Secret</label>
                    <input
                      type="password"
                      name="consumerSecret"
                      placeholder="Leave blank to keep current"
                      className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">
                      Passkey <span className="text-white/20">({maskValue(b.darajaPasskey)})</span>
                    </label>
                    <input
                      type="password"
                      name="passkey"
                      placeholder="Leave blank to keep current"
                      className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-white w-full"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs uppercase tracking-widest bg-white/10 border border-white/20 text-white hover:bg-white/15"
                >
                  Save Building
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}