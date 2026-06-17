// app/(super-admin)/admin/cron/page.tsx
// Manual trigger for monthly billing — Super Admin only.
// Useful for testing and back-filling missed billing runs.

import { redirect } from "next/navigation";
import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { runMonthlyBilling, type MonthlyBillingSummary } from "@/lib/cron/monthlyBilling";
import { revalidatePath } from "next/cache";

export default async function CronDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; triggered?: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);

  const params = await searchParams;
  const month = params.month;
  const wasTriggered = params.triggered === "1";

  let result: MonthlyBillingSummary | null = null;
  if (wasTriggered && month) {
    result = await runMonthlyBilling(month);
    revalidatePath("/super-admin/cron");
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div style={{ maxWidth: "960px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        System Automation
      </p>
      <h1
        style={{
          fontSize: "clamp(28px, 3.5vw, 44px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          marginBottom: "8px",
          color: "#ffffff",
        }}
      >
        Monthly Billing Cron
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "48px" }}>
        Trigger monthly billing manually or review the last run. The cron runs automatically at 6:00 AM EAT on the 1st of every month.
      </p>

      {/* Trigger Form */}
      <section
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "32px",
          marginBottom: "48px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            marginBottom: "24px",
            paddingBottom: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Manual Trigger
        </p>

        <form action={triggerBilling} style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1", minWidth: "200px" }}>
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
              }}
            >
              Billing Month
            </span>
            <input
              type="month"
              name="month"
              defaultValue={currentMonth}
              required
              style={{
                padding: "12px",
                fontSize: "14px",
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.15)",
                fontFamily: '"Helvetica Neue", sans-serif',
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              padding: "13px 28px",
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
            Run Billing Now
          </button>
        </form>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "16px" }}>
          ⚠️ This is idempotent — running twice for the same month will skip already-billed tenants.
        </p>
      </section>

      {/* Results */}
      {result && (
        <section
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "32px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              marginBottom: "24px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Billing Result — {formatMonthLabel(result.billingMonth)}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "2px",
              marginBottom: "32px",
            }}
          >
            <StatCard label="Active Tenants" value={result.totalTenants} />
            <StatCard label="Entries Inserted" value={result.totalEntriesInserted} />
            <StatCard label="Amount Billed" value={`KES ${result.totalAmountBilled.toLocaleString("en-KE")}`} />
            <StatCard label="Skipped (Already Billed)" value={result.skipped} />
            <StatCard label="Errors" value={result.errors} color={result.errors > 0 ? "#f87171" : undefined} />
          </div>

          {/* Per-tenant breakdown */}
          {result.details.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Tenant Breakdown
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {result.details.map((detail) => (
                  <div
                    key={detail.tenantId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 80px",
                      gap: "16px",
                      padding: "12px 16px",
                      backgroundColor: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#ffffff" }}>{detail.tenantName}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                      {detail.entries.length} entries
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        textAlign: "right",
                        color: detail.errors && detail.errors.length > 0 ? "#f87171" : "#4ade80",
                      }}
                    >
                      {detail.errors && detail.errors.length > 0 ? "Error" : "OK"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Server Action ───────────────────────────────────────────────────────

async function triggerBilling(formData: FormData) {
  "use server";

  await requireRole(["SUPER_ADMIN"]);

  const month = formData.get("month") as string;
  if (!month) return;

  // Redirect back to the same page with query params to show results
  // The page component will detect ?triggered=1 and run the billing
  redirect(`/super-admin/cron?month=${month}&triggered=1`);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ padding: "20px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          marginBottom: "8px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "24px", fontWeight: 400, color: color ?? "#ffffff" }}>{value}</p>
    </div>
  );
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}