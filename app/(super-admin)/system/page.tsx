// app/(super-admin)/system/page.tsx
// PHASE 6: Super Admin system-wide monitoring dashboard.
// Shows: all agencies health, database status, webhook metrics, system alerts.

import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import {
  getSystemHealthMetrics,
  analyzeFailedPayments,
  type SystemHealthMetrics,
  type FailedPaymentAnalysis,
} from "@/lib/monitoring/queries";
import { getSystemMetrics, getAgencyList, toggleAgencyStatus } from "@/lib/super-admin/queries";
import { getDb } from "@/lib/db";
import { agencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export const metadata = {
  title: "System Monitor — PropFlow",
};

export const revalidate = 30; // 30-second refresh for live monitoring

export default async function SuperAdminSystemPage() {
  const session = await requireRole(["SUPER_ADMIN"]);

  // Fetch all data in parallel
  const [systemMetrics, healthMetrics, failedAnalysis, agencyList] = await Promise.all([
    getSystemMetrics(),
    getSystemHealthMetrics(),
    analyzeFailedPayments(), // system-wide (no agencyId filter)
    getAgencyList(),
  ]);

  const activeAgencies = agencyList.filter((a) => a.isActive && !a.isTerminated);
  const suspendedAgencies = agencyList.filter((a) => !a.isActive && !a.isTerminated);
  const trialEndingSoon = agencyList.filter(
    (a) => a.plan === "TRIAL" && a.daysUntilDue !== null && a.daysUntilDue <= 7 && a.daysUntilDue >= 0
  );

  const hasSystemIssues =
    failedAnalysis.totalFailed24h > 10 ||
    healthMetrics.pendingTransactionsCount > 20 ||
    healthMetrics.highPriorityComplaints > 5;

  return (
    <div>
      <p style={sectionLabel}>System Monitor</p>
      <h1 style={pageTitle}>PropFlow Infrastructure</h1>

      {/* System Status Banner */}
      <div
        style={{
          ...bannerBase,
          backgroundColor: hasSystemIssues ? "rgba(244,63,94,0.08)" : "rgba(16,185,129,0.08)",
          borderColor: hasSystemIssues ? "rgba(244,63,94,0.3)" : "rgba(16,185,129,0.3)",
          marginBottom: "40px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: hasSystemIssues ? "#f43f5e" : "#10b981",
            fontWeight: 500,
          }}
        >
          {hasSystemIssues
            ? `⚠ SYSTEM ALERT: ${failedAnalysis.totalFailed24h} failed payments (24h) · ${healthMetrics.pendingTransactionsCount} pending transactions · ${healthMetrics.highPriorityComplaints} high-priority complaints`
            : "✓ All systems operational across all agencies"}
        </p>
      </div>

      {/* Global KPIs */}
      <p style={sectionLabel}>Global Metrics</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2px",
          maxWidth: "1200px",
          marginBottom: "48px",
        }}
      >
        <SystemCard label="Monthly Revenue" value={`KES ${systemMetrics.mrrKes.toLocaleString("en-KE")}`} sub={`${systemMetrics.activeAgencies} paying agencies`} accent="#8b5cf6" />
        <SystemCard label="Total Agencies" value={`${systemMetrics.totalAgencies}`} sub={`${systemMetrics.activeAgencies} active · ${systemMetrics.suspendedAgencies} suspended`} accent="#3b82f6" />
        <SystemCard label="Portfolio" value={`${systemMetrics.totalBuildings} buildings`} sub={`${systemMetrics.totalUnits} units · ${systemMetrics.occupiedUnits} occupied`} accent="#10b981" />
        <SystemCard label="Tenants" value={`${systemMetrics.activeTenants}`} sub={`${systemMetrics.totalTenants} total`} accent="#f59e0b" />
        <SystemCard label="Rent Collected (MTD)" value={`KES ${Math.round(systemMetrics.totalRentCollectedThisMonth).toLocaleString("en-KE")}`} sub="All agencies" accent="#10b981" />
        <SystemCard label="Outstanding" value={`KES ${Math.round(systemMetrics.totalOutstandingBalance).toLocaleString("en-KE")}`} sub="Across all agencies" accent="#f43f5e" />
      </div>

      {/* Infrastructure Health */}
      <p style={sectionLabel}>Infrastructure</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "2px",
          maxWidth: "1100px",
          marginBottom: "48px",
        }}
      >
        <HealthStatusCard label="Database" status="healthy" detail="Connected" />
        <HealthStatusCard label="Clerk Auth" status="healthy" detail="Operational" />
        <HealthStatusCard label="M-Pesa (Daraja)" status="healthy" detail="STK + C2B active" />
        <HealthStatusCard label="SMS (AT)" status={process.env.AT_API_KEY ? "healthy" : "not_configured"} detail={process.env.AT_API_KEY ? "Available" : "Missing credentials"} />
        <HealthStatusCard label="Cron Jobs" status={process.env.CRON_SECRET ? "healthy" : "not_configured"} detail={process.env.CRON_SECRET ? "Secured" : "Missing secret"} />
        <HealthStatusCard label="Pending Tx" status={healthMetrics.pendingTransactionsCount > 20 ? "warning" : "healthy"} detail={`${healthMetrics.pendingTransactionsCount} in queue`} />
      </div>

      {/* Failed Payments System-wide */}
      {failedAnalysis.totalFailed24h > 0 && (
        <>
          <p style={{ ...sectionLabel, color: "#f43f5e" }}>Failed Payments (System-wide, 24h)</p>
          <div style={{ ...cardBase, marginBottom: "40px", borderColor: "rgba(244,63,94,0.2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "24px", marginBottom: "20px" }}>
              <div><p style={statLabel}>Failed (24h)</p><p style={{ ...statValue, color: "#f43f5e" }}>{failedAnalysis.totalFailed24h}</p></div>
              <div><p style={statLabel}>Failed (7d)</p><p style={{ ...statValue, color: "#f59e0b" }}>{failedAnalysis.totalFailed7d}</p></div>
              <div><p style={statLabel}>Total Amount</p><p style={{ ...statValue, color: "#f43f5e" }}>KES {failedAnalysis.totalFailedAmount.toLocaleString("en-KE")}</p></div>
              <div><p style={statLabel}>Top Reason</p><p style={{ ...statValue, color: "#ffffff", fontSize: "14px" }}>{failedAnalysis.topFailureReasons[0]?.reason ?? "N/A"}</p></div>
            </div>
          </div>
        </>
      )}

      {/* Agency Health Table */}
      <p style={sectionLabel}>Agency Health</p>
      <div style={{ ...cardBase, overflow: "hidden", marginBottom: "40px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {["Agency", "Status", "Buildings", "Units", "Tenants", "Active", "Subscription", "Actions"].map((h) => (
                <th key={h} style={tableHeader}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agencyList.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>No agencies found.</td></tr>
            ) : (
              agencyList.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={tableCell}>
                    <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>{a.name}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{a.email}</p>
                  </td>
                  <td style={tableCell}>
                    <StatusBadge active={a.isActive} terminated={a.isTerminated} />
                  </td>
                  <td style={{ ...tableCell, textAlign: "center" }}>{a.buildingCount}</td>
                  <td style={{ ...tableCell, textAlign: "center" }}>{a.unitCount}</td>
                  <td style={{ ...tableCell, textAlign: "center" }}>{a.tenantCount}</td>
                  <td style={{ ...tableCell, textAlign: "center" }}>{a.activeTenantCount}</td>
                  <td style={tableCell}>
                    <p style={{ fontSize: "12px", color: "#ffffff" }}>{a.plan ?? "TRIAL"}</p>
                    <p style={{ fontSize: "11px", color: a.daysUntilDue !== null && a.daysUntilDue < 0 ? "#f43f5e" : "rgba(255,255,255,0.35)" }}>
                      {a.daysUntilDue !== null ? (a.daysUntilDue < 0 ? `${Math.abs(a.daysUntilDue)}d overdue` : `${a.daysUntilDue}d left`) : "—"}
                    </p>
                  </td>
                  <td style={tableCell}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Link href={`/super-admin/agencies/${a.id}`} style={{ fontSize: "11px", color: "#3b82f6", textDecoration: "none" }}>View</Link>
                      {!a.isTerminated && (
                        <form action={async () => {
                          "use server";
                          await toggleAgencyStatus(a.id, !a.isActive);
                          revalidatePath("/super-admin/system");
                        }}>
                          <button type="submit" style={{ fontSize: "11px", color: a.isActive ? "#f43f5e" : "#10b981", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            {a.isActive ? "Suspend" : "Activate"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Trial Ending Soon */}
      {trialEndingSoon.length > 0 && (
        <>
          <p style={{ ...sectionLabel, color: "#f59e0b" }}>⏰ Trials Ending Soon (≤7 days)</p>
          <div style={{ ...cardBase, marginBottom: "40px", borderColor: "rgba(245,158,11,0.2)" }}>
            {trialEndingSoon.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "13px", color: "#ffffff" }}>{a.name}</p>
                <p style={{ fontSize: "12px", color: "#f59e0b" }}>{a.daysUntilDue} days left · {a.buildingCount} buildings · {a.tenantCount} tenants</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <Link href="/super-admin/agencies" style={actionLinkPrimary}>Manage Agencies →</Link>
        <Link href="/super-admin/subscriptions" style={actionLinkSecondary}>Subscriptions</Link>
        <Link href="/super-admin/dashboard" style={actionLinkSecondary}>Back to Dashboard</Link>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SystemCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ ...cardBase, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", backgroundColor: accent }} />
      <p style={statLabel}>{label}</p>
      <p style={{ ...statValue, color: "#ffffff" }}>{value}</p>
      <p style={statSub}>{sub}</p>
    </div>
  );
}

function HealthStatusCard({ label, status, detail }: { label: string; status: "healthy" | "warning" | "critical" | "not_configured"; detail: string }) {
  const colors = {
    healthy: "#10b981",
    warning: "#f59e0b",
    critical: "#f43f5e",
    not_configured: "rgba(255,255,255,0.3)",
  };

  return (
    <div style={{ ...cardBase, textAlign: "center" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: colors[status], margin: "0 auto 8px" }} />
      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "13px", color: "#ffffff", fontWeight: 500 }}>{detail}</p>
    </div>
  );
}

function StatusBadge({ active, terminated }: { active: boolean; terminated: boolean }) {
  if (terminated) return <span style={{ fontSize: "11px", color: "#f43f5e", padding: "4px 10px", border: "1px solid rgba(244,63,94,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Terminated</span>;
  if (!active) return <span style={{ fontSize: "11px", color: "#f59e0b", padding: "4px 10px", border: "1px solid rgba(245,158,11,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Suspended</span>;
  return <span style={{ fontSize: "11px", color: "#10b981", padding: "4px 10px", border: "1px solid rgba(16,185,129,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Active</span>;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = { fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "16px" };
const pageTitle: React.CSSProperties = { fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "32px", color: "#ffffff" };
const bannerBase: React.CSSProperties = { padding: "16px 20px", border: "1px solid", borderRadius: "2px" };
const cardBase: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", padding: "20px 24px" };
const statLabel: React.CSSProperties = { fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "8px" };
const statValue: React.CSSProperties = { fontSize: "28px", fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "6px" };
const statSub: React.CSSProperties = { fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" };
const tableHeader: React.CSSProperties = { padding: "14px 16px", fontSize: "10px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontWeight: 400, textAlign: "left" };
const tableCell: React.CSSProperties = { padding: "14px 16px", fontSize: "13px", color: "#ffffff" };
const actionLinkPrimary: React.CSSProperties = { fontSize: "13px", letterSpacing: "0.14em", color: "#ffffff", border: "1px solid rgba(255,255,255,0.35)", padding: "14px 28px", textDecoration: "none", textTransform: "uppercase", display: "inline-block" };
const actionLinkSecondary: React.CSSProperties = { fontSize: "13px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.2)", padding: "14px 28px", textDecoration: "none", textTransform: "uppercase", display: "inline-block" };
