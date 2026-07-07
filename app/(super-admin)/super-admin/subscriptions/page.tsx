// app/(super-admin)/subscriptions/page.tsx
// Super Admin subscription payment management.
// Manual entry for M-Pesa Paybill, bank transfer, and cash payments.

import { getAgencyList, getAgencySubscription } from "@/lib/super-admin/queries";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";

export const metadata = {
  title: "Subscription Payments — Super Admin",
};

export default async function SubscriptionsPage() {
  const agencies = await getAgencyList();
  const activeAgencies = agencies.filter((a) => !a.isTerminated);

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
        Revenue Management
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
        Subscription Payments
      </h1>

      <p
        style={{
          fontSize: "13px",
          color: "rgba(255,255,255,0.5)",
          marginBottom: "32px",
          maxWidth: "600px",
          lineHeight: 1.6,
        }}
      >
        Record payments received via M-Pesa Paybill, bank transfer, or cash.
        Agencies pay to your M-Pesa Paybill using their unique account number.
        The system will update their subscription period automatically.
      </p>

      {/* Payment Instructions Card */}
      <div
        style={{
          backgroundColor: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.2)",
          padding: "24px",
          marginBottom: "48px",
          maxWidth: "600px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: "#10b981",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Payment Instructions for Agencies
        </p>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
          <p><strong style={{ color: "#ffffff" }}>M-Pesa Paybill:</strong> {process.env.SUBSCRIPTION_PAYBILL_NUMBER || "522522"}</p>
          <p><strong style={{ color: "#ffffff" }}>Account Number:</strong> Your agency code (e.g., PF-A1B2C3D4)</p>
          <p><strong style={{ color: "#ffffff" }}>Bank:</strong> Equity Bank, Account: PropFlow Ltd, 1234567890</p>
          <p style={{ marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
            After paying, SMS the M-Pesa confirmation code to your account manager.
          </p>
        </div>
      </div>

      {/* Active Agencies Table */}
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "24px",
        }}
      >
        Record Payment
      </p>

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
            minWidth: "900px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {["Agency", "Plan", "Amount", "Paid Through", "Next Due", "Status", "Action"].map(
                (h) => (
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
                      textAlign: h === "Agency" || h === "Action" ? "left" : "right",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {activeAgencies.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  No active agencies found.
                </td>
              </tr>
            ) : (
              activeAgencies.map((a) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>
                      {a.name}
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {a.phone}
                    </p>
                  </td>

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

                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#ffffff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.amountKes ? `KES ${a.amountKes.toLocaleString("en-KE")}` : "Free"}
                  </td>

                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "right",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {a.paidThroughDate
                      ? new Date(a.paidThroughDate).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>

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
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "2px",
                        backgroundColor:
                          a.subscriptionStatus === "ACTIVE"
                            ? "rgba(16,185,129,0.15)"
                            : a.subscriptionStatus === "OVERDUE"
                            ? "rgba(245,158,11,0.15)"
                            : "rgba(244,63,94,0.15)",
                        color:
                          a.subscriptionStatus === "ACTIVE"
                            ? "#10b981"
                            : a.subscriptionStatus === "OVERDUE"
                            ? "#f59e0b"
                            : "#f43f5e",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {a.subscriptionStatus}
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <RecordPaymentForm
                      agencyId={a.id}
                      agencyName={a.name}
                      expectedAmount={a.amountKes || 0} plan={""}                    />
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