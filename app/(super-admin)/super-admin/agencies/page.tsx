// app/(super-admin)/agencies/page.tsx
// Agency list with add-agency form, kill switch, subscription status, and termination.

import { getAgencyList } from "@/lib/super-admin/queries";
import { KillSwitchButton } from "@/components/KillSwitchButton";
import { AddAgencyForm } from "@/components/AddAgencyForm";
import { TerminateAgencyButton } from "@/components/TerminateAgencyButton";

export const metadata = {
  title: "Agencies — Super Admin",
};

export default async function AgenciesPage() {
  const agencies = await getAgencyList();

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
        System Management
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(28px, 3.5vw, 44px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#ffffff",
          }}
        >
          Agencies
        </h1>
      </div>

      <p
        style={{
          fontSize: "13px",
          color: "rgba(255,255,255,0.5)",
          marginBottom: "32px",
        }}
      >
        {agencies.length} {agencies.length === 1 ? "agency" : "agencies"} registered.
        Terminated agencies are archived and can be viewed in the terminated list.
      </p>

      <AddAgencyForm />

      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "1100px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {[
                "Agency",
                "Contact",
                "Status",
                "Plan",
                "Amount",
                "Due",
                "Buildings",
                "Units",
                "Tenants",
                "Active",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "14px 16px",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    fontWeight: 400,
                    whiteSpace: "nowrap",
                    textAlign:
                      h === "Agency" || h === "Contact" || h === "Actions"
                        ? "left"
                        : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {agencies.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  No agencies registered yet. Use the form above to add the first one.
                </td>
              </tr>
            ) : (
              agencies.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Agency */}
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>
                      {a.name}
    
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {a.id.slice(0, 8)}…
                    </p>
                  </td>

                  {/* Contact */}
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "2px" }}>
                      {a.email}
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {a.phone}
                    </p>
                  </td>

                  {/* Status */}
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {a.isActive ? (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "4px 10px",
                          borderRadius: "2px",
                          backgroundColor: "rgba(16,185,129,0.15)",
                          color: "#10b981",
                          letterSpacing: "0.06em",
                        }}
                      >
                        ACTIVE
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "4px 10px",
                          borderRadius: "2px",
                          backgroundColor: "rgba(244,63,94,0.15)",
                          color: "#f43f5e",
                          letterSpacing: "0.06em",
                        }}
                      >
                        SUSPENDED
                      </span>
                    )}
                  </td>

                  {/* Plan */}
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "2px",
                        backgroundColor:
                          a.plan === "TRIAL"
                            ? "rgba(59,130,246,0.15)"
                            : a.plan === "STARTER"
                            ? "rgba(16,185,129,0.15)"
                            : a.plan === "GROWTH"
                            ? "rgba(245,158,11,0.15)"
                            : "rgba(139,92,246,0.15)",
                        color:
                          a.plan === "TRIAL"
                            ? "#3b82f6"
                            : a.plan === "STARTER"
                            ? "#10b981"
                            : a.plan === "GROWTH"
                            ? "#f59e0b"
                            : "#8b5cf6",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {a.plan || "TRIAL"}
                    </span>
                  </td>

                  {/* Amount */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.amountKes ? `KES ${a.amountKes.toLocaleString("en-KE")}` : "—"}
                  </td>

                  {/* Due */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.daysUntilDue !== null ? (
                      <span
                        style={{
                          fontSize: "12px",
                          color:
                            a.daysUntilDue < 0
                              ? "#f43f5e"
                              : a.daysUntilDue <= 3
                              ? "#f59e0b"
                              : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {a.daysUntilDue < 0
                          ? `${Math.abs(a.daysUntilDue)}d overdue`
                          : a.daysUntilDue === 0
                          ? "Due today"
                          : `${a.daysUntilDue}d left`}
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Buildings */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                    }}
                  >
                    {a.buildingCount}
                  </td>

                  {/* Units */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                    }}
                  >
                    {a.unitCount}
                  </td>

                  {/* Tenants */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                    }}
                  >
                    {a.tenantCount}
                  </td>

                  {/* Active */}
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                    }}
                  >
                    {a.activeTenantCount}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {!a.isTerminated && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <KillSwitchButton
                          agencyId={a.id}
                          agencyName={a.name}
                          isActive={a.isActive}
                        />
                        <TerminateAgencyButton
                          agencyId={a.id}
                          agencyName={a.name}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}