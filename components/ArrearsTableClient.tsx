// app/(admin)/admin/arrears/_components/ArrearsTableClient.tsx
// Client Component: sortable table + "Send Reminder" SMS button.
// Uses inline styles to match the dark theme. No shadcn/ui dependencies.

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArrearsTenant } from "@/lib/analytics/queries";

interface Props {
  arrears: ArrearsTenant[];
  currentSortBy: "amount" | "days";
  currentSortOrder: "asc" | "desc";
}

export function ArrearsTableClient({ arrears, currentSortBy, currentSortOrder }: Props) {
  const router = useRouter();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const toggleSort = (field: "amount" | "days") => {
    const newOrder = currentSortBy === field && currentSortOrder === "desc" ? "asc" : "desc";
    const params = new URLSearchParams();
    params.set("sortBy", field);
    params.set("sortOrder", newOrder);
    startTransition(() => {
      router.push(`/admin/arrears?${params.toString()}`);
    });
  };

  const sendReminder = async (tenantId: string) => {
    setSendingId(tenantId);
    setSendStatus((prev) => ({ ...prev, [tenantId]: "" }));

    try {
      const res = await fetch("/api/admin/analytics/arrears/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendStatus((prev) => ({ ...prev, [tenantId]: data.error ?? "Failed" }));
      } else {
        setSendStatus((prev) => ({ ...prev, [tenantId]: "Sent ✓" }));
        setTimeout(() => {
          setSendStatus((prev) => {
            const next = { ...prev };
            delete next[tenantId];
            return next;
          });
        }, 3000);
      }
    } catch {
      setSendStatus((prev) => ({ ...prev, [tenantId]: "Network error" }));
    } finally {
      setSendingId(null);
    }
  };

  const SortArrow = ({ field }: { field: "amount" | "days" }) => {
    if (currentSortBy !== field) return <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>⇅</span>;
    return (
      <span style={{ color: "#ffffff", fontSize: "10px" }}>
        {currentSortOrder === "desc" ? "↓" : "↑"}
      </span>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {[
              { label: "Tenant", sort: null as null },
              { label: "Building / Unit", sort: null as null },
              { label: "Phone", sort: null as null },
              { label: "Balance", sort: "amount" as const },
              { label: "Days Overdue", sort: "days" as const },
              { label: "Last Payment", sort: null as null },
              { label: "Actions", sort: null as null },
            ].map((h) => (
              <th
                key={h.label}
                onClick={() => h.sort && toggleSort(h.sort)}
                style={{
                  padding: "14px 16px",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  fontWeight: 400,
                  textAlign: h.label === "Tenant" || h.label === "Building / Unit" || h.label === "Phone" || h.label === "Actions" ? "left" : "right",
                  cursor: h.sort ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {h.label}
                  {h.sort && <SortArrow field={h.sort} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {arrears.length === 0 ? (
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
                No tenants in arrears. Great job!
              </td>
            </tr>
          ) : (
            arrears.map((tenant) => (
              <tr
                key={tenant.tenantId}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(255,255,255,0.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent";
                }}
              >
                <td style={{ padding: "14px 16px" }}>
                  <Link
                    href={`/admin/tenants/${tenant.tenantId}/ledger`}
                    style={{
                      fontSize: "13px",
                      color: "#ffffff",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = "rgba(255,255,255,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = "rgba(255,255,255,0.15)";
                    }}
                  >
                    {tenant.fullName}
                  </Link>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: "13px", color: "#ffffff", marginBottom: "2px" }}>
                    {tenant.buildingName}
                  </p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                    Unit {tenant.unitNumber}
                  </p>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                  {tenant.phone}
                </td>
                <td
                  style={{
                    padding: "14px 16px",
                    textAlign: "right",
                    fontSize: "13px",
                    color: "#f43f5e",
                    fontWeight: 500,
                  }}
                >
                  KES {tenant.balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                </td>
                <td
                  style={{
                    padding: "14px 16px",
                    textAlign: "right",
                    fontSize: "13px",
                    color: tenant.daysOverdue > 30 ? "#f43f5e" : "#f59e0b",
                    fontWeight: 500,
                  }}
                >
                  {tenant.daysOverdue} days
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>
                  {tenant.lastPaymentDate ? (
                    <div>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                        {new Date(tenant.lastPaymentDate).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {tenant.lastPaymentAmount && (
                        <p style={{ fontSize: "11px", color: "#10b981", marginTop: "2px" }}>
                          KES {tenant.lastPaymentAmount.toLocaleString("en-KE")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                      Never paid
                    </p>
                  )}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button
                    onClick={() => sendReminder(tenant.tenantId)}
                    disabled={sendingId === tenant.tenantId}
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "8px 14px",
                      border: sendStatus[tenant.tenantId] === "Sent ✓"
                        ? "1px solid #10b981"
                        : "1px solid rgba(255,255,255,0.25)",
                      backgroundColor: "transparent",
                      color: sendStatus[tenant.tenantId] === "Sent ✓" ? "#10b981" : "rgba(255,255,255,0.7)",
                      cursor: sendingId === tenant.tenantId ? "wait" : "pointer",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                      opacity: sendingId === tenant.tenantId ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!sendStatus[tenant.tenantId] && sendingId !== tenant.tenantId) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.5)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!sendStatus[tenant.tenantId]) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                      }
                    }}
                  >
                    {sendingId === tenant.tenantId
                      ? "Sending..."
                      : sendStatus[tenant.tenantId] ?? "Remind"}
                  </button>
                  {sendStatus[tenant.tenantId] && sendStatus[tenant.tenantId] !== "Sent ✓" && (
                    <p style={{ fontSize: "10px", color: "#f43f5e", marginTop: "4px" }}>
                      {sendStatus[tenant.tenantId]}
                    </p>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}