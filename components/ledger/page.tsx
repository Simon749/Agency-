// components/ledger/LedgerSummary.tsx
"use client";

import { useEffect, useState } from "react";

interface LedgerSummaryProps {
  tenantId: string;
}

interface BalanceData {
  totalCharged: number;
  totalPaid: number;
  balance: number;
}

export function LedgerSummary({ tenantId }: LedgerSummaryProps) {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch(`/api/ledger/balance?tenantId=${tenantId}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBalance();
  }, [tenantId]);

  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>Loading balance...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "16px 0" }}>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>Unable to load balance.</p>
      </div>
    );
  }

  const isOverpaid = data.balance < 0;
  const displayBalance = Math.abs(data.balance);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
          Outstanding
        </span>
        <span
          style={{
            fontSize: "20px",
            fontWeight: 400,
            color: data.balance > 0 ? "#f87171" : isOverpaid ? "#4ade80" : "rgba(255,255,255,0.5)",
          }}
        >
          KES {displayBalance.toLocaleString("en-KE")}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
          Total Charged
        </span>
        <span style={{ fontSize: "14px", color: "#ffffff" }}>
          KES {data.totalCharged.toLocaleString("en-KE")}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
          Total Paid
        </span>
        <span style={{ fontSize: "14px", color: "#4ade80" }}>
          KES {data.totalPaid.toLocaleString("en-KE")}
        </span>
      </div>

      {data.balance > 0 && (
        <p style={{ fontSize: "11px", color: "#f87171", marginTop: "4px" }}>
          Payment required
        </p>
      )}
      {isOverpaid && (
        <p style={{ fontSize: "11px", color: "#4ade80", marginTop: "4px" }}>
          Credit balance — overpaid by KES {displayBalance.toLocaleString("en-KE")}
        </p>
      )}
    </div>
  );
}