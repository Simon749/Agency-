// app/(super-admin)/agencies/_components/KillSwitchButton.tsx
// Client Component: Kill switch toggle with confirmation dialog.
// Calls toggleAgencyStatus Server Action.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleAgencyStatus } from "@/lib/super-admin/actions";

interface Props {
  agencyId: string;
  agencyName: string;
  isActive: boolean;
}

export function KillSwitchButton({ agencyId, agencyName, isActive }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState(isActive);

  const handleToggle = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setPending(true);
    try {
      const result = await toggleAgencyStatus(agencyId, !status);
      if (result.success) {
        setStatus(!status);
        // Refresh the page data
        router.refresh();
      }
    } catch (err) {
      console.error("Kill switch failed:", err);
      alert(err instanceof Error ? err.message : "Failed to toggle agency status");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };

  const cancel = () => setConfirming(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        onClick={handleToggle}
        disabled={pending}
        style={{
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "8px 14px",
          border: status
            ? "1px solid rgba(244,63,94,0.4)"
            : "1px solid rgba(16,185,129,0.4)",
          backgroundColor: "transparent",
          color: status ? "#f43f5e" : "#10b981",
          cursor: pending ? "wait" : "pointer",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
          opacity: pending ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!pending) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = status
              ? "rgba(244,63,94,0.7)"
              : "rgba(16,185,129,0.7)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = status
            ? "rgba(244,63,94,0.4)"
            : "rgba(16,185,129,0.4)";
        }}
      >
        {pending ? "Working…" : confirming ? (status ? "Confirm Suspend" : "Confirm Activate") : (status ? "Suspend" : "Activate")}
      </button>

      {confirming && (
        <button
          onClick={cancel}
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "8px 14px",
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "transparent",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      )}

      {confirming && status && (
        <span style={{ fontSize: "10px", color: "#f43f5e", maxWidth: "120px" }}>
          All staff & tenants will be blocked immediately.
        </span>
      )}
    </div>
  );
}