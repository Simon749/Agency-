// app/(admin)/admin/health/page.tsx
// PHASE 6: Agency Owner health monitoring dashboard.
// Shows: system status, payment anomalies, ledger discrepancies, failed payments.
// Auto-refreshes every 60 seconds (revalidate on navigation).

import { getDb } from "@/lib/db";
import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import {
  detectPaymentAnomalies,
  findLedgerDiscrepancies,
  analyzeFailedPayments,
  getSystemHealthMetrics,
  type PaymentAnomaly,
  type LedgerDiscrepancy,
  type FailedPaymentAnalysis,
  type SystemHealthMetrics,
} from "@/lib/monitoring/queries";
import { eq } from "drizzle-orm";
import { agencies } from "@/db/schema";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "System Health — PropFlow",
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function AdminHealthPage() {
  const session = await requireRole(["AGENCY_OWNER", "MANAGER"]);
  const { agencyId } = session;

  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const [agency] = await db
    .select({ name: agencies.name })
    .from(agencies)
    .where(eq(agencies.id, agencyId));

  // Fetch all monitoring data in parallel
  const [metrics, anomalies, discrepancies, failedAnalysis] = await Promise.all([
    getSystemHealthMetrics(),
    detectPaymentAnomalies(agencyId, { minPendingCount: 1, maxAgeHours: 1 }),
    findLedgerDiscrepancies(agencyId),
    analyzeFailedPayments(agencyId),
  ]);

  const hasIssues =
    anomalies.length > 0 ||
    discrepancies.length > 0 ||
    failedAnalysis.totalFailed24h > 0 ||
    metrics.pendingTransactionsCount > 5;

  return (
    <div>
      <p style={sectionLabel}>System Health</p>
      <h1 style={pageTitle}>{agency?.name ?? "Agency"} — Health Monitor</h1>

      {/* Status Banner */}
      <div
        style={{
          ...bannerBase,
          backgroundColor: hasIssues ? "rgba(244,63,94,0.08)" : "rgba(16,185,129,0.08)",
          borderColor: hasIssues ? "rgba(244,63,94,0.3)" : "rgba(16,185,129,0.3)",
          marginBottom: "40px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: hasIssues ? "#f43f5e" : "#10b981",
            fontWeight: 500,
            letterSpacing: "0.06em",
          }}
        >
          {hasIssues
            ? `⚠ ${anomalies.length} payment anomalies · ${discrepancies.length} ledger discrepancies · ${failedAnalysis.totalFailed24h} failed payments (24h)`
            : "✓ All systems operational. No anomalies detected."}
        </p>
      </div>

      {/* Health Metrics Grid */}
      <p style={sectionLabel}>Key Metrics</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "2px",
          maxWidth: "1100px",
          marginBottom: "48px",
        }}
      >
        <HealthCard
          label="Occupancy Rate"
          value={`${metrics.occupancyRate}%`}
          sub={`${metrics.occupiedUnits} / ${metrics.totalUnits} units`}
          status={metrics.occupancyRate >= 80 ? "good" : "warning"}
        />
        <HealthCard
          label="Active Tenants"
          value={`${metrics.activeTenants}`}
          sub={`${metrics.vacatedTenants} vacated`}
          status="good"
        />
        <HealthCard
          label="Pending Payments"
          value={`${metrics.pendingTransactionsCount}`}
          sub="STK Push in progress"
          status={metrics.pendingTransactionsCount > 5 ? "critical" : metrics.pendingTransactionsCount > 0 ? "warning" : "good"}
        />
        <HealthCard
          label="Failed (24h)"
          value={`${metrics.failedTransactions24h}`}
          sub="M-Pesa failures"
          status={metrics.failedTransactions24h > 0 ? "critical" : "good"}
        />
        <HealthCard
          label="Open Complaints"
          value={`${metrics.openComplaints}`}
          sub={`${metrics.highPriorityComplaints} high priority`}
          status={metrics.highPriorityComplaints > 0 ? "critical" : metrics.openComplaints > 0 ? "warning" : "good"}
        />
        <HealthCard
          label="Ledger Entries"
          value={`${metrics.ledgerEntriesThisMonth}`}
          sub="This month"
          status="good"
        />
      </div>

      {/* Payment Anomalies */}
      {anomalies.length > 0 && (
        <>
          <p style={{ ...sectionLabel, color: "#f43f5e" }}>⚠ Payment Anomalies</p>
          <div style={{ ...cardBase, marginBottom: "40px", borderColor: "rgba(244,63,94,0.2)" }}>
            {anomalies.map((a) => (
              <AnomalyRow key={a.tenantId} anomaly={a} />
            ))}
          </div>
        </>
      )}

      {/* Ledger Discrepancies */}
      {discrepancies.length > 0 && (
        <>
          <p style={{ ...sectionLabel, color: "#f59e0b" }}>⚡ Ledger Review</p>
          <div style={{ ...cardBase, marginBottom: "40px", borderColor: "rgba(245,158,11,0.2)" }}>
            {discrepancies.map((d) => (
              <DiscrepancyRow key={d.tenantId} discrepancy={d} />
            ))}
          </div>
        </>
      )}

      {/* Failed Payments Analysis */}
      {failedAnalysis.totalFailed24h > 0 && (
        <>
          <p style={{ ...sectionLabel, color: "#f43f5e" }}>❌ Failed Payments (24h)</p>
          <div style={{ ...cardBase, marginBottom: "40px", borderColor: "rgba(244,63,94,0.2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginBottom: "20px" }}>
              <div>
                <p style={statLabel}>Total Failed</p>
                <p style={{ ...statValue, color: "#f43f5e" }}>{failedAnalysis.totalFailed24h}</p>
              </div>
              <div>
                <p style={statLabel}>Failed (7d)</p>
                <p style={{ ...statValue, color: "#f59e0b" }}>{failedAnalysis.totalFailed7d}</p>
              </div>
              <div>
                <p style={statLabel}>Total Amount</p>
                <p style={{ ...statValue, color: "#f43f5e" }}>
                  KES {failedAnalysis.totalFailedAmount.toLocaleString("en-KE")}
                </p>
              </div>
            </div>

            {failedAnalysis.topFailureReasons.length > 0 && (
              <>
                <p style={{ ...statLabel, marginBottom: "12px" }}>Top Failure Reasons</p>
                {failedAnalysis.topFailureReasons.map((r) => (
                  <div
                    key={r.reason}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p style={{ fontSize: "13px", color: "#ffffff" }}>{r.reason}</p>
                    <p style={{ fontSize: "13px", color: "#f43f5e", fontWeight: 500 }}>{r.count}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "24px" }}>
        <Link href="/admin/tenants" style={actionLinkPrimary}>
          View All Tenants →
        </Link>
        <Link href="/admin/arrears" style={actionLinkSecondary}>
          Arrears Report
        </Link>
        <Link href="/admin/dashboard" style={actionLinkSecondary}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: string;
  sub: string;
  status: "good" | "warning" | "critical";
}) {
  const colors = {
    good: "#10b981",
    warning: "#f59e0b",
    critical: "#f43f5e",
  };

  return (
    <div style={{ ...cardBase, position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "3px",
          height: "100%",
          backgroundColor: colors[status],
        }}
      />
      <p style={statLabel}>{label}</p>
      <p style={{ ...statValue, color: "#ffffff" }}>{value}</p>
      <p style={statSub}>{sub}</p>
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: PaymentAnomaly }) {
  const riskColors = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#f43f5e",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div>
        <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>
          {anomaly.fullName}
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
          {anomaly.buildingName} · Unit {anomaly.unitNumber} · {anomaly.pendingCount} pending
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "13px", color: "#f43f5e", fontWeight: 500 }}>
          KES {anomaly.totalAmount.toLocaleString("en-KE")}
        </p>
        <p style={{ fontSize: "10px", color: riskColors[anomaly.risk], letterSpacing: "0.06em" }}>
          {anomaly.risk.toUpperCase()} RISK
        </p>
      </div>
    </div>
  );
}

function DiscrepancyRow({ discrepancy }: { discrepancy: LedgerDiscrepancy }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div>
        <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>
          {discrepancy.fullName}
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
          {discrepancy.buildingName} · Unit {discrepancy.unitNumber}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 500 }}>
          {discrepancy.issue}
        </p>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
          Balance: KES {discrepancy.computedBalance.toLocaleString("en-KE")}
        </p>
      </div>
    </div>
  );
}

// ── Styles (inline, matching your dark theme) ──────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.22em",
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  marginBottom: "16px",
};

const pageTitle: React.CSSProperties = {
  fontSize: "clamp(28px, 3.5vw, 44px)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  marginBottom: "32px",
  color: "#ffffff",
};

const bannerBase: React.CSSProperties = {
  padding: "16px 20px",
  border: "1px solid",
  borderRadius: "2px",
};

const cardBase: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  padding: "20px 24px",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const statValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 400,
  letterSpacing: "-0.03em",
  lineHeight: 1,
  marginBottom: "6px",
};

const statSub: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.35)",
  letterSpacing: "0.06em",
};

const actionLinkPrimary: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.14em",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.35)",
  padding: "14px 28px",
  textDecoration: "none",
  textTransform: "uppercase",
  display: "inline-block",
};

const actionLinkSecondary: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.2)",
  padding: "14px 28px",
  textDecoration: "none",
  textTransform: "uppercase",
  display: "inline-block",
};
