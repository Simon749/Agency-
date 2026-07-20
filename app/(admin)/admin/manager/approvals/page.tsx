// app/(admin)/admin/manager/approvals/page.tsx
// Phase D: Manager dashboard for approving/rejecting pending manual payments.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getPendingApprovals, approveManualPayment, rejectManualPayment } from "@/lib/ledger/manualPayments";
import { getDb } from "@/lib/db";
import { tenants, buildings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const pending = await getPendingApprovals(agencyId);
  const params = await searchParams;

  // Enrich with tenant/building names
  const db = getDb();
  const enriched = await Promise.all(
    pending.map(async (entry) => {
      const [tenant] = await db
        .select({ fullName: tenants.fullName, unitId: tenants.unitId })
        .from(tenants)
        .where(eq(tenants.id, entry.tenantId))
        .limit(1);

      const [building] = await db
        .select({ name: buildings.name })
        .from(buildings)
        .where(eq(buildings.id, entry.buildingId))
        .limit(1);

      return { ...entry, tenantName: tenant?.fullName ?? "Unknown", buildingName: building?.name ?? "Unknown" };
    })
  );

  return (
    <div style={{ maxWidth: "960px" }}>
      <h1 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, marginBottom: "8px" }}>
        Pending Approvals
      </h1>
      <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: "48px" }}>
        Review and approve manual payment entries submitted by field agents.
      </p>

      {params.success && (
        <div role="status" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", padding: "16px", marginBottom: "24px", color: "#4ade80" }}>
          ✅ {decodeURIComponent(params.success)}
        </div>
      )}
      {params.error && (
        <div role="alert" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", padding: "16px", marginBottom: "24px", color: "#f87171" }}>
          ⚠️ {decodeURIComponent(params.error)}
        </div>
      )}

      {enriched.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.55)", padding: "40px 0" }}>
          No pending approvals. All caught up.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {enriched.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                <span style={{ fontSize: "16px", fontWeight: 500 }}>
                  KES {Number(entry.amount).toLocaleString("en-KE")}
                </span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {entry.method} · {entry.billingMonth}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                <div>Tenant: <span style={{ color: "#fff" }}>{entry.tenantName}</span></div>
                <div>Building: <span style={{ color: "#fff" }}>{entry.buildingName}</span></div>
                <div>Submitted: <span style={{ color: "#fff" }}>{new Date(entry.createdAt).toLocaleString()}</span></div>
                <div>Reference: <span style={{ color: "#fff" }}>{entry.referenceCode ?? "—"}</span></div>
              </div>

              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginBottom: "16px", fontStyle: "italic" }}>
                {entry.description}
              </p>

              <div style={{ display: "flex", gap: "12px" }}>
                <form action={async () => {
                  "use server";
                  const result = await approveManualPayment(entry.id, userId, role!);
                  if (result.success) {
                    redirect(`/admin/manager/approvals?success=${encodeURIComponent("Payment approved successfully")}`);
                  } else {
                    redirect(`/admin/manager/approvals?error=${encodeURIComponent(result.error!)}`);
                  }
                }}>
                  <button
                    type="submit"
                    style={{
                      padding: "10px 20px",
                      background: "#4ade80",
                      color: "#0b0b0b",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                </form>

                <form action={async (formData: FormData) => {
                  "use server";
                  const reason = formData.get("reason") as string;
                  const result = await rejectManualPayment(entry.id, userId, role!, reason);
                  if (result.success) {
                    redirect(`/admin/manager/approvals?success=${encodeURIComponent("Payment rejected")}`);
                  } else {
                    redirect(`/admin/manager/approvals?error=${encodeURIComponent(result.error!)}`);
                  }
                }}>
                  <input type="hidden" name="reason" value="Rejected by manager" />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 20px",
                      background: "transparent",
                      color: "#f87171",
                      border: "1px solid rgba(248,113,113,0.4)",
                      fontSize: "12px",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}