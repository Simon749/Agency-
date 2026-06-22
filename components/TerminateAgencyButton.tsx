"use client";

// components/TerminateAgencyButton.tsx
// Opens a confirmation modal before terminating an agency contract.
// Soft delete — data is preserved but agency staff are locked out.

import { useState } from "react";
import { terminateAgencyAction } from "@/lib/super-admin/actions";

interface Props {
  agencyId: string;
  agencyName: string;
}

export function TerminateAgencyButton({ agencyId, agencyName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<"CONTRACT_ENDED" | "NON_PAYMENT" | "BREACH_OF_TERMS" | "REQUESTED_BY_AGENCY" | "OTHER">("CONTRACT_ENDED");
  const [isLoading, setIsLoading] = useState(false);

  async function handleTerminate() {
    setIsLoading(true);
    try {
      const result = await terminateAgencyAction(agencyId, reason);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || "Failed to terminate agency");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          fontSize: "11px",
          letterSpacing: "0.12em",
          color: "#f43f5e",
          border: "1px solid rgba(244,63,94,0.4)",
          background: "transparent",
          padding: "6px 14px",
          cursor: "pointer",
          textTransform: "uppercase",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "rgba(244,63,94,0.1)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
        }}
      >
        Terminate
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "32px",
              maxWidth: "480px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "0.22em",
                color: "#f43f5e",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              ⚠️ Terminate Agency Contract
            </p>

            <h2
              style={{
                fontSize: "20px",
                fontWeight: 400,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              {agencyName}
            </h2>

            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.5)",
                marginBottom: "24px",
                lineHeight: 1.6,
              }}
            >
              This will permanently lock out all staff and tenants from this agency.
              Financial records will be preserved for audit. The agency data will be
              archived and can be exported before deletion.
            </p>

            <label
              style={{
                display: "block",
                fontSize: "11px",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Reason for termination
            </label>

            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              style={{
                width: "100%",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#ffffff",
                padding: "12px 16px",
                fontSize: "13px",
                marginBottom: "24px",
                outline: "none",
              }}
            >
              <option value="CONTRACT_ENDED">Contract ended by mutual agreement</option>
              <option value="NON_PAYMENT">Non-payment of subscription</option>
              <option value="BREACH_OF_TERMS">Breach of terms of service</option>
              <option value="REQUESTED_BY_AGENCY">Requested by agency</option>
              <option value="OTHER">Other</option>
            </select>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                  border: "none",
                  backgroundColor: "#f43f5e",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? "Terminating…" : "Confirm Termination"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}