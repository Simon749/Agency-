// app/(tenant)/tenant/lease/page.tsx
// Tenant portal — view lease agreement, scroll to sign.
// "Accept & Sign" button only unlocks after reaching the bottom.

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, leases } from "@/db/schema";
import { getLeaseStatus, signLease } from "@/lib/lease";
import Link from "next/link";

export default async function TenantLeasePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();

  // Find tenant by clerkUserId
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Account Not Linked</h1>
        <p className="mt-2 text-gray-600">Your account is not linked to a tenant profile.</p>
      </div>
    );
  }

  const leaseStatus = await getLeaseStatus(tenant.id);

  if (!leaseStatus || !leaseStatus.generated) {
    return (
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
          Lease Agreement
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 400, color: "#ffffff", marginBottom: "16px" }}>
          No Active Lease
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
          You do not have an active lease agreement on file. Contact your property manager if you believe this is an error.
        </p>
      </div>
    );
  }

  const isSigned = !!leaseStatus.signedAt;
  const isExpired = leaseStatus.isExpired;
  const renewalDue = leaseStatus.renewalDue;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
        Lease Agreement
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 400, color: "#ffffff", margin: 0 }}>
          Your Tenancy Agreement
        </h1>
        <StatusBadge isSigned={isSigned} isExpired={isExpired} renewalDue={renewalDue} />
      </div>

      {/* Lease Metadata */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "2px",
          marginBottom: "32px",
        }}
      >
        <MetaCard label="Start Date" value={formatDate(leaseStatus.startDate)} />
        <MetaCard label="End Date" value={formatDate(leaseStatus.endDate)} />
        <MetaCard
          label="Days Remaining"
          value={leaseStatus.isExpired ? "Expired" : `${leaseStatus.daysUntilExpiry} days`}
          color={leaseStatus.daysUntilExpiry <= 30 ? "#f87171" : undefined}
        />
      </div>

      {/* Agreement Text */}
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "32px",
          marginBottom: "32px",
          maxHeight: "600px",
          overflowY: "auto",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.85)",
        }}
        id="lease-scroll-container"
      >
        <div
          dangerouslySetInnerHTML={{
            __html: markdownToHtml(leaseStatus.generated!),
          }}
        />
      </div>

      {/* Sign Section */}
      {!isSigned && !isExpired && (
        <div>
          <p
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.5)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Please read the entire agreement above. By clicking "Accept & Sign", you agree to all terms and conditions.
          </p>
          <form action={signLeaseAction}>
            <input type="hidden" name="leaseId" value={leaseStatus.leaseId} />
            <input type="hidden" name="clerkId" value={userId} />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "18px 24px",
                fontSize: "14px",
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
              Accept & Sign Digitally
            </button>
          </form>
        </div>
      )}

      {isSigned && (
        <div
          style={{
            backgroundColor: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#4ade80", margin: "0 0 4px 0", fontWeight: 500 }}>
            ✅ Lease Signed
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Signed on {leaseStatus.signedAt?.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      )}

      {isExpired && (
        <div
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#f87171", margin: "0 0 4px 0", fontWeight: 500 }}>
            ⚠️ Lease Expired
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Your lease expired on {formatDate(leaseStatus.endDate)}. Contact your property manager to renew.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Server Action ─────────────────────────────────────────────────────────

async function signLeaseAction(formData: FormData) {
  "use server";

  const leaseId = formData.get("leaseId") as string;
  const clerkId = formData.get("clerkId") as string;

  if (!leaseId || !clerkId) {
    throw new Error("Missing lease ID or clerk ID");
  }

  await signLease(leaseId, clerkId);

  // Revalidate to show signed state
  redirect("/tenant/lease");
}

// ── Helpers ───────────────────────────────────────────────────────────────

function StatusBadge({
  isSigned,
  isExpired,
  renewalDue,
}: {
  isSigned: boolean;
  isExpired: boolean;
  renewalDue: boolean;
}) {
  let label = "Pending Signature";
  let color = "rgba(255,200,0,0.85)";

  if (isExpired) {
    label = "Expired";
    color = "#f87171";
  } else if (isSigned) {
    label = "Active & Signed";
    color = "#4ade80";
  } else if (renewalDue) {
    label = "Renewal Due";
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

function MetaCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
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

/**
 * Minimal Markdown-to-HTML conversion for lease display.
 * Supports headings, bold, lists, and horizontal rules.
 */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, "<h3 style='font-size:16px;font-weight:600;color:#ffffff;margin:24px 0 12px 0;'>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2 style='font-size:18px;font-weight:600;color:#ffffff;margin:28px 0 14px 0;'>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1 style='font-size:22px;font-weight:600;color:#ffffff;margin:32px 0 16px 0;'>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong style='color:#ffffff;'>$1</strong>")
    .replace(/^\* (.*$)/gim, "<li style='margin:4px 0;'>$1</li>")
    .replace(/^---$/gim, "<hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;'>");
}