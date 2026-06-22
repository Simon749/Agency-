// app/(super-admin)/dashboard/page.tsx
// Super Admin system overview with subscription health, MRR, and alerts.

import { getSystemMetrics, getAgencyList } from "@/lib/super-admin/queries";
import Link from "next/link";

export const metadata = {
  title: "Super Admin Dashboard — PropFlow",
};

export default async function SuperAdminDashboard() {
  const metrics = await getSystemMetrics();
  const agencies = await getAgencyList();

  const overdueAgencies = agencies.filter((a) => a.daysUntilDue !== null && a.daysUntilDue < 0 && !a.isTerminated);
  const trialAgencies = agencies.filter((a) => a.plan === "TRIAL" && !a.isTerminated);
  const terminatedAgencies = agencies.filter((a) => a.isTerminated);

  return (
    <div>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        System Overview
      </p>
      <h1
        style={{
          fontSize: "clamp(28px, 3.5vw, 44px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          marginBottom: "48px",
          color: "#ffffff",
        }}
      >
        PropFlow Super Admin
      </h1>

      {/* ── KPI Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2px",
          maxWidth: "1200px",
          marginBottom: "56px",
        }}
      >
        <StatCard
          label="Monthly Recurring Revenue"
          value={`KES ${metrics.mrrKes.toLocaleString("en-KE")}`}
          sub={`${metrics.activeAgencies} paying agencies`}
          accent="#8b5cf6"
        />
        <StatCard
          label="Total Agencies"
          value={`${metrics.totalAgencies}`}
          sub={`${metrics.activeAgencies} active · ${metrics.suspendedAgencies} suspended`}
          accent="#3b82f6"
        />
        <StatCard
          label="Portfolio"
          value={`${metrics.totalBuildings} buildings`}
          sub={`${metrics.totalUnits} units · ${metrics.occupiedUnits} occupied`}
          accent="#10b981"
        />
        <StatCard
          label="Tenants"
          value={`${metrics.activeTenants}`}
          sub={`${metrics.totalTenants} total · ${metrics.totalOutstandingBalance > 0 ? `KES ${Math.round(metrics.totalOutstandingBalance).toLocaleString("en-KE")} owed` : "all current"}`}
          accent={metrics.totalOutstandingBalance > 0 ? "#f59e0b" : "#10b981"}
        />
      </div>

      {/* ── Subscription Health ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2px",
          maxWidth: "1200px",
          marginBottom: "56px",
        }}
      >
        {/* Overdue Agencies */}
        <div
          style={{
            backgroundColor: "rgba(244,63,94,0.06)",
            border: "1px solid rgba(244,63,94,0.2)",
            padding: "28px 24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
              Overdue Subscriptions
            </p>
            <p style={{ fontSize: "20px", color: "#f43f5e", fontWeight: 500 }}>
              {overdueAgencies.length}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {overdueAgencies.length === 0 ? (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                All agencies are current. Great job!
              </p>
            ) : (
              overdueAgencies.slice(0, 5).map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>{a.name}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {a.plan} · KES {a.amountKes?.toLocaleString("en-KE")}
                    </p>
                  </div>
                  <p style={{ fontSize: "12px", color: "#f43f5e" }}>
                    {Math.abs(a.daysUntilDue || 0)}d overdue
                  </p>
                </div>
              ))
            )}
          </div>

          <Link
            href="/super-admin/agencies"
            style={{
              display: "block",
              marginTop: "16px",
              fontSize: "11px",
              letterSpacing: "0.14em",
              color: "#f43f5e",
              textDecoration: "none",
              textTransform: "uppercase",
              textAlign: "center",
              padding: "10px",
              border: "1px solid rgba(244,63,94,0.3)",
            }}
          >
            View All Agencies →
          </Link>
        </div>

        {/* Trial Ending Soon */}
        <div
          style={{
            backgroundColor: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.2)",
            padding: "28px 24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
              Trials & Conversions
            </p>
            <p style={{ fontSize: "20px", color: "#3b82f6", fontWeight: 500 }}>
              {trialAgencies.length}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {trialAgencies.length === 0 ? (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                No agencies in trial period.
              </p>
            ) : (
              trialAgencies.slice(0, 5).map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>{a.name}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {a.buildingCount} buildings · {a.tenantCount} tenants
                    </p>
                  </div>
                  <p style={{ fontSize: "12px", color: a.daysUntilDue !== null && a.daysUntilDue <= 3 ? "#f43f5e" : "#3b82f6" }}>
                    {a.daysUntilDue !== null && a.daysUntilDue <= 0
                      ? "Trial ended"
                      : `${a.daysUntilDue}d left`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "48px" }}>
        <Link
          href="/super-admin/agencies"
          style={{
            fontSize: "13px",
            letterSpacing: "0.14em",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.35)",
            padding: "14px 28px",
            textDecoration: "none",
            textTransform: "uppercase",
            display: "inline-block",
          }}
        >
          Manage Agencies →
        </Link>
        <Link
          href="/super-admin/subscriptions"
          style={{
            fontSize: "13px",
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "14px 28px",
            textDecoration: "none",
            textTransform: "uppercase",
            display: "inline-block",
          }}
        >
          Subscription Payments
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "3px",
          height: "100%",
          backgroundColor: accent,
        }}
      />
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "32px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          color: "#ffffff",
          lineHeight: 1,
          marginBottom: "8px",
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.06em",
        }}
      >
        {sub}
      </p>
    </div>
  );
}