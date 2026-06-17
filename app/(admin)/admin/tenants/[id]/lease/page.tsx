// app/(admin)/admin/tenants/[id]/lease/page.tsx
// Admin view — generate lease, preview, see sign status, trigger renewal.

import { redirect, notFound } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { tenants, leases, buildings, units } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getLeaseStatus, generateLeaseForTenant, createRenewalLease } from "@/lib/lease";
import Link from "next/link";

export default async function AdminTenantLeasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const { id: tenantId } = await params;
  const db = getDb();

  // Fetch tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.agencyId, agencyId)))
    .limit(1);

  if (!tenant) notFound();

  // Fetch active lease
  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.tenantId, tenantId), eq(leases.status, "ACTIVE")))
    .orderBy(desc(leases.createdAt))
    .limit(1);

  if (!lease) {
    return (
      <div>
        <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
          Lease Management
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 400, color: "#ffffff", marginBottom: "16px" }}>
          {tenant.fullName}
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
          No active lease found for this tenant.
        </p>
      </div>
    );
  }

  // Generate lease if not already generated
  let generatedText = lease.agreementGenerated;
  if (!generatedText) {
    const result = await generateLeaseForTenant(tenantId, lease.id);
    generatedText = result.generatedText;
  }

  const leaseStatus = await getLeaseStatus(tenantId);

  return (
    <div>
      <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
        Lease Management
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
        <Link
          href={`/admin/tenants/${tenantId}`}
          style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
        >
          ← Back to Tenant
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: 400, color: "#ffffff", margin: 0 }}>
          {tenant.fullName} — Lease
        </h1>
        <StatusBadge status={lease.status} signedAt={lease.signedAt} />
      </div>

      {/* Lease Metadata */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "2px",
          marginBottom: "32px",
        }}
      >
        <MetaCard label="Start Date" value={formatDate(lease.startDate)} />
        <MetaCard label="End Date" value={formatDate(lease.endDate)} />
        <MetaCard label="Rent" value={`KES ${Number(lease.rentAmount).toLocaleString("en-KE")}`} />
        <MetaCard label="Deposit" value={`KES ${Number(lease.depositAmount).toLocaleString("en-KE")}`} />
        <MetaCard
          label="Status"
          value={lease.signedAt ? "Signed" : "Pending Signature"}
          color={lease.signedAt ? "#4ade80" : "rgba(255,200,0,0.85)"}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
        {!generatedText && (
          <form action={regenerateLease}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="leaseId" value={lease.id} />
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.16em",
                color: "#0b0b0b",
                backgroundColor: "#ffffff",
                border: "1px solid #ffffff",
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: '"Helvetica Neue", sans-serif',
              }}
            >
              Generate Lease
            </button>
          </form>
        )}

        {leaseStatus?.renewalDue && (
          <form action={triggerRenewal}>
            <input type="hidden" name="leaseId" value={lease.id} />
            <input type="hidden" name="currentRent" value={lease.rentAmount} />
            <input type="hidden" name="escalationType" value={lease.escalationType ?? "FIXED"} />
            <input type="hidden" name="escalationValue" value={lease.escalationValue ?? "0"} />
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.16em",
                color: "#f87171",
                backgroundColor: "transparent",
                border: "1px solid #f87171",
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: '"Helvetica Neue", sans-serif',
              }}
            >
              Create Renewal
            </button>
          </form>
        )}
      </div>

      {/* Generated Lease Preview */}
      {generatedText && (
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "32px",
            maxHeight: "700px",
            overflowY: "auto",
            fontSize: "14px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(generatedText) }} />
        </div>
      )}
    </div>
  );
}

// ── Server Actions ──────────────────────────────────────────────────────────

async function regenerateLease(formData: FormData) {
  "use server";

  const session = await getSessionMeta();
  if (!["AGENCY_OWNER", "MANAGER"].includes(session.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const tenantId = formData.get("tenantId") as string;
  const leaseId = formData.get("leaseId") as string;

  await generateLeaseForTenant(tenantId, leaseId);
  redirect(`/admin/tenants/${tenantId}/lease`);
}

async function triggerRenewal(formData: FormData) {
  "use server";

  const session = await getSessionMeta();
  if (!["AGENCY_OWNER", "MANAGER"].includes(session.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const leaseId = formData.get("leaseId") as string;
  const currentRent = Number(formData.get("currentRent"));
  const escalationType = formData.get("escalationType") as string;
  const escalationValue = Number(formData.get("escalationValue") ?? 0);

  // Calculate new rent
  const newRent =
    escalationType === "PERCENTAGE"
      ? currentRent * (1 + escalationValue / 100)
      : currentRent + escalationValue;

  // Calculate new end date (1 year from current end date)
  const [lease] = await getDb()
    .select({ endDate: leases.endDate })
    .from(leases)
    .where(eq(leases.id, leaseId))
    .limit(1);

  const oldEnd = new Date(lease.endDate);
  const newEndDate = new Date(oldEnd);
  newEndDate.setFullYear(newEndDate.getFullYear() + 1);

  const result = await createRenewalLease(leaseId, newRent, newEndDate.toISOString().split("T")[0]);

  redirect(`/admin/tenants/${(await getDb().select({ tenantId: leases.tenantId }).from(leases).where(eq(leases.id, result.newLeaseId)).limit(1))[0].tenantId}/lease`);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function StatusBadge({ status, signedAt }: { status: string; signedAt: Date | null }) {
  let label = status;
  let color = "rgba(255,255,255,0.5)";

  if (signedAt) {
    label = "Signed";
    color = "#4ade80";
  } else if (status === "PENDING_RENEWAL") {
    label = "Pending Renewal";
    color = "rgba(255,200,0,0.85)";
  } else if (status === "ACTIVE") {
    label = "Active — Unsigned";
    color = "#f87171";
  }

  return (
    <span
      style={{
        fontSize: "11px",
        letterSpacing: "0.12em",
        color,
        textTransform: "uppercase",
        border: `1px solid ${color}`,
        padding: "4px 12px",
      }}
    >
      {label}
    </span>
  );
}

function MetaCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: "16px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "6px" }}>
        {label}
      </p>
      <p style={{ fontSize: "16px", fontWeight: 400, color: color ?? "#ffffff", margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, "<h3 style='font-size:16px;font-weight:600;color:#ffffff;margin:24px 0 12px 0;'>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2 style='font-size:18px;font-weight:600;color:#ffffff;margin:28px 0 14px 0;'>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1 style='font-size:22px;font-weight:600;color:#ffffff;margin:32px 0 16px 0;'>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong style='color:#ffffff;'>$1</strong>")
    .replace(/^\* (.*$)/gim, "<li style='margin:4px 0;'>$1</li>")
    .replace(/^---$/gim, "<hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;'>");
}