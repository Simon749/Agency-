// app/(admin)/admin/agent/meter-readings/MeterReadingForm.tsx
// PHASE 7: Enhanced with offline queue support.

"use client";

import { useFormStatus } from "react-dom";
import { useState, useCallback } from "react";
import { submitReading } from "./actions";
import { queueMeterReading } from "@/lib/offline/queue";
import { OfflineBanner } from "@/components/OfflineBanner";

interface Props {
  buildingId: string;
  unitId: string;
  utility: "WATER" | "ELECTRICITY";
  tenantName: string | null;
  unitNumber: string | null;
  previousReading: { currentReading: number; ratePerUnit: number } | null;
  currentMonth: string;
  agentClerkId: string | undefined;
}

export function MeterReadingForm({
  buildingId,
  unitId,
  utility,
  tenantName,
  unitNumber,
  previousReading,
  currentMonth,
  agentClerkId,
}: Props) {
  const [clientError, setClientError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const validate = useCallback(
    (formData: FormData) => {
      const prev = parseFloat(formData.get("previousReading") as string);
      const curr = parseFloat(formData.get("currentReading") as string);
      if (curr < prev) {
        setClientError("Current reading cannot be less than previous reading");
        return false;
      }
      setClientError(null);
      return true;
    },
    []
  );

  async function handleSubmit(formData: FormData) {
    if (!validate(formData)) return;

    if (!navigator.onLine) {
      // Queue for later sync
      await queueMeterReading({
        type: "meter-reading",
        buildingId,
        unitId,
        utility,
        previousReading: parseFloat(formData.get("previousReading") as string),
        currentReading: parseFloat(formData.get("currentReading") as string),
        ratePerUnit: parseFloat(formData.get("ratePerUnit") as string),
        billingMonth: currentMonth,
        agentClerkId: agentClerkId ?? "",
      });
      setQueued(true);
      return;
    }

    // Online: submit normally
    await submitReading(formData);
  }

  if (!tenantName) {
    return (
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "28px",
        }}
      >
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", textAlign: "center", padding: "20px" }}>
          This unit is vacant. No tenant to bill.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "28px",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 4px 0" }}>
            {tenantName} · Unit {unitNumber}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>
            {utility} · {formatMonthLabel(currentMonth)}
          </p>
        </div>

        {/* Queued success message */}
        {queued && (
          <div
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: "rgba(74, 222, 128, 0.1)",
              border: "1px solid rgba(74, 222, 128, 0.3)",
              padding: "16px 20px",
              marginBottom: "24px",
              color: "#4ade80",
              fontSize: "14px",
            }}
          >
            ✅ Reading saved offline. It will sync automatically when you're back online.
          </div>
        )}

        <form action={handleSubmit}>
          <input type="hidden" name="buildingId" value={buildingId} />
          <input type="hidden" name="unitId" value={unitId} />
          <input type="hidden" name="utilityType" value={utility} />
          <input type="hidden" name="billingMonth" value={currentMonth} />
          <input type="hidden" name="agentClerkId" value={agentClerkId ?? ""} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            <div>
              <label
                htmlFor="previousReading"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Previous Reading
              </label>
              <input
                id="previousReading"
                type="number"
                name="previousReading"
                defaultValue={previousReading?.currentReading ?? ""}
                step="0.01"
                required
                placeholder={previousReading ? String(previousReading.currentReading) : "Enter previous reading"}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontFamily: "inherit",
                }}
              />
              {previousReading && (
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "6px" }}>
                  Auto-filled from last reading
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="currentReading"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Current Reading
              </label>
              <input
                id="currentReading"
                type="number"
                name="currentReading"
                step="0.01"
                required
                placeholder="Enter current reading"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="ratePerUnit"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Rate per Unit (KES)
              </label>
              <input
                id="ratePerUnit"
                type="number"
                name="ratePerUnit"
                defaultValue={previousReading?.ratePerUnit ?? ""}
                step="0.01"
                required
                placeholder="e.g. 50.00"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontFamily: "inherit",
                }}
              />
              {previousReading && (
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "6px" }}>
                  Auto-filled from last rate
                </p>
              )}
            </div>
          </div>

          {clientError && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                backgroundColor: "rgba(248, 113, 113, 0.1)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                padding: "12px 16px",
                marginBottom: "24px",
                color: "#f87171",
                fontSize: "13px",
              }}
            >
              {clientError}
            </div>
          )}

          {/* Sticky Submit Button */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              backgroundColor: "inherit",
              padding: "16px 0",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              marginTop: "8px",
            }}
          >
            <SubmitButton isQueued={queued} />
          </div>
        </form>
      </div>

      <OfflineBanner />
    </>
  );
}

function SubmitButton({ isQueued }: { isQueued: boolean }) {
  const { pending } = useFormStatus();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <button
      type="submit"
      disabled={pending || isQueued}
      style={{
        width: "100%",
        padding: "16px 24px",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.16em",
        color: "#0b0b0b",
        backgroundColor: "#ffffff",
        border: "1px solid #ffffff",
        cursor: pending || isQueued ? "not-allowed" : "pointer",
        textTransform: "uppercase",
        fontFamily: '"Helvetica Neue", sans-serif',
        opacity: pending || isQueued ? 0.6 : 1,
      }}
    >
      {pending ? "Submitting Reading…" : isQueued ? "Saved Offline ✓" : isOffline ? "Save Offline" : "Submit Reading & Bill Tenant"}
    </button>
  );
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}