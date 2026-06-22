"use client";

// components/RecordPaymentForm.tsx
// Modal form for Super Admin to record subscription payments manually.

import { useState } from "react";
import { recordSubscriptionPayment } from "@/lib/super-admin/actions";

interface Props {
  agencyId: string;
  agencyName: string;
  expectedAmount: number;
}

export function RecordPaymentForm({ agencyId, agencyName, expectedAmount }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(expectedAmount > 0 ? String(expectedAmount) : "");
  const [method, setMethod] = useState("MPESA_PAYBILL");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData();
    formData.append("amount", amount);
    formData.append("method", method);
    formData.append("reference", reference);
    formData.append("notes", notes);
    formData.append("periodStart", periodStart);
    formData.append("periodEnd", periodEnd);

    try {
      const result = await recordSubscriptionPayment(agencyId, formData);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || "Failed to record payment");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          fontSize: "11px",
          letterSpacing: "0.12em",
          color: "#10b981",
          border: "1px solid rgba(16,185,129,0.4)",
          background: "transparent",
          padding: "6px 14px",
          cursor: "pointer",
          textTransform: "uppercase",
        }}
      >
        Record Payment
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
            <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "#10b981", textTransform: "uppercase", marginBottom: "16px" }}>
              Record Payment
            </p>
            <h2 style={{ fontSize: "18px", fontWeight: 400, color: "#ffffff", marginBottom: "4px" }}>
              {agencyName}
            </h2>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "24px" }}>
              Expected: KES {expectedAmount.toLocaleString("en-KE")}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Amount (KES)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: "12px 16px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: "12px 16px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="MPESA_PAYBILL">M-Pesa Paybill</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Reference Code
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="M-Pesa confirmation code or bank slip"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: "12px 16px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#ffffff",
                      padding: "12px 16px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                    Period End
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#ffffff",
                      padding: "12px 16px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="M-Pesa confirmation screenshot uploaded..."
                  rows={3}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    padding: "12px 16px",
                    fontSize: "13px",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  type="button"
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
                  type="submit"
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "12px",
                    fontSize: "12px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#ffffff",
                    border: "none",
                    backgroundColor: "#10b981",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Recording…" : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}