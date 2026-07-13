// app/(tenant)/pay/PayRentButton.tsx
// PHASE 7 FIXES: Progressive payment states, polling, user-friendly errors, aria-live
// DARK THEME — inline styles matching PropFlow design system

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { initiatePayment } from "./actions";

type PaymentStatus =
  | "idle"
  | "initiating"
  | "prompted"
  | "processing"
  | "completed"
  | "failed";

interface Props {
  tenantId: string;
  buildingId: string;
  phone: string;
  amount: number;
  unitNumber: string;
}

function mapErrorToUserMessage(error: string): string {
  if (error.includes("already pending") || error.includes("wait"))
    return "A payment is already in progress. Please check your phone.";
  if (error.includes("insufficient"))
    return "Insufficient funds in your M-Pesa account.";
  if (error.includes("cancelled") || error.includes("declined") || error.includes("Canceled"))
    return "Payment was cancelled. You can try again.";
  if (error.includes("timeout") || error.includes("taking too long"))
    return "M-Pesa is taking too long. Please try again in a moment.";
  if (error.includes("network") || error.includes("fetch"))
    return "Network error. Check your connection and try again.";
  if (error.includes("Not authenticated") || error.includes("Unauthorized"))
    return "Please sign in again to make a payment.";
  if (error.includes("No outstanding balance"))
    return "You have no outstanding balance.";
  if (error.includes("Too many requests"))
    return "Too many payment attempts. Please wait a minute and try again.";
  if (error.includes("Daraja") || error.includes("shortcode") || error.includes("credentials"))
    return "M-Pesa is temporarily unavailable. Please try again later.";
  return "Payment failed. Please try again or contact your property manager.";
}

export function PayRentButton({ tenantId, buildingId, phone, amount, unitNumber }: Props) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [mpesaCode, setMpesaCode] = useState<string | null>(null);
  const isSubmitting = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?tenantId=${tenantId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "COMPLETED") {
          setStatus("completed");
          setMessage(`KES ${amount.toLocaleString("en-KE")} received. Ref: ${data.mpesaCode}`);
          setMpesaCode(data.mpesaCode);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "FAILED") {
          setStatus("failed");
          setMessage(mapErrorToUserMessage(data.failureReason || ""));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Silently fail polling
      }
    }, 3000);

    // Auto-stop polling after 2 minutes
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        setStatus((prev) => (prev === "processing" ? "failed" : prev));
        setMessage((prev) =>
          prev.includes("received") ? prev : "Payment timed out. Please try again."
        );
      }
    }, 120000);
  }, [tenantId, amount]);

  const handlePay = useCallback(async () => {
    if (isSubmitting.current || status === "initiating" || status === "processing") {
      console.log("[PayRentButton] Double-click blocked");
      return;
    }
    isSubmitting.current = true;
    setStatus("initiating");
    setMessage("Connecting to M-Pesa...");
    setMpesaCode(null);

    try {
      const result = await initiatePayment({
        tenantId, buildingId, phone, amount, unitNumber,
        agencyId: ""
      });
      if (result.success) {
        setStatus("prompted");
        setMessage(result.message ?? "Check your phone for the M-Pesa prompt.");
        setTimeout(() => {
          setStatus("processing");
          setMessage("Waiting for M-Pesa confirmation...");
          startPolling();
        }, 2000);
      } else {
        setStatus("failed");
        setMessage(mapErrorToUserMessage(result.error || ""));
      }
    } catch (err) {
      setStatus("failed");
      setMessage(mapErrorToUserMessage(err instanceof Error ? err.message : ""));
    } finally {
      setTimeout(() => {
        isSubmitting.current = false;
      }, 2000);
    }
  }, [tenantId, buildingId, phone, amount, unitNumber, status, startPolling]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setMessage("");
    setMpesaCode(null);
    isSubmitting.current = false;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Status announcement for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "initiating" && "Connecting to M-Pesa"}
        {status === "prompted" && "Check your phone for the M-Pesa prompt"}
        {status === "processing" && "Waiting for payment confirmation"}
        {status === "completed" && `Payment completed. Reference ${mpesaCode}`}
        {status === "failed" && `Payment failed. ${message}`}
      </div>

      {/* Pay Button */}
      {(status === "idle" || status === "failed") && (
        <button
          onClick={handlePay}
          style={{
            width: "100%",
            padding: "14px 24px",
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: "#0b0b0b",
            backgroundColor: "#4ade80",
            border: "1px solid #4ade80",
            cursor: "pointer",
            textTransform: "uppercase",
            fontFamily: '"Helvetica Neue", sans-serif',
            minHeight: "52px",
            touchAction: "manipulation",
          }}
        >
          {status === "failed" ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Try Again
            </span>
          ) : (
            `Pay KES ${amount.toLocaleString("en-KE")} via M-Pesa`
          )}
        </button>
      )}

      {/* Initiating state */}
      {status === "initiating" && (
        <StatusBox
          icon="⏳"
          title="Connecting to M-Pesa..."
          subtitle="Please wait while we initiate your payment."
          borderColor="rgba(59,130,246,0.3)"
          bgColor="rgba(59,130,246,0.06)"
          titleColor="#60a5fa"
          subtitleColor="rgba(255,255,255,0.5)"
          pulse
        />
      )}

      {/* Prompted state */}
      {status === "prompted" && (
        <StatusBox
          icon="📱"
          title="Check Your Phone"
          subtitle={message}
          hint="Enter your M-Pesa PIN to complete the payment."
          borderColor="rgba(59,130,246,0.3)"
          bgColor="rgba(59,130,246,0.06)"
          titleColor="#60a5fa"
          subtitleColor="rgba(255,255,255,0.6)"
          hintColor="rgba(255,255,255,0.4)"
          pulse
        />
      )}

      {/* Processing state */}
      {status === "processing" && (
        <StatusBox
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
              <path fill="#fbbf24" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          }
          title="Processing Payment..."
          subtitle="Waiting for M-Pesa confirmation. This may take a moment."
          borderColor="rgba(251,191,36,0.3)"
          bgColor="rgba(251,191,36,0.06)"
          titleColor="#fbbf24"
          subtitleColor="rgba(255,255,255,0.5)"
        />
      )}

      {/* Completed state */}
      {status === "completed" && (
        <div
          style={{
            backgroundColor: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#4ade80", fontWeight: 500, marginBottom: "4px" }}>
            ✅ Payment Received!
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>
            {message}
          </p>
          {mpesaCode && (
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>
              M-Pesa Ref: {mpesaCode}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: "#4ade80",
              backgroundColor: "transparent",
              border: "1px solid rgba(34,197,94,0.3)",
              padding: "10px 20px",
              cursor: "pointer",
              textTransform: "uppercase",
              fontFamily: "inherit",
              minHeight: "40px",
            }}
          >
            Make Another Payment
          </button>
        </div>
      )}

      {/* Failed state */}
      {status === "failed" && (
        <div
          style={{
            backgroundColor: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.15)",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#f87171", fontWeight: 500, marginBottom: "4px" }}>
            ❌ Payment Failed
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginBottom: "16px" }}>
            {message}
          </p>
          <button
            onClick={reset}
            style={{
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: "#f87171",
              backgroundColor: "transparent",
              border: "1px solid rgba(248,113,113,0.3)",
              padding: "10px 20px",
              cursor: "pointer",
              textTransform: "uppercase",
              fontFamily: "inherit",
              minHeight: "40px",
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Add spin keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Status Box Helper ────────────────────────────────────────────────────

function StatusBox({
  icon,
  title,
  subtitle,
  hint,
  borderColor,
  bgColor,
  titleColor,
  subtitleColor,
  hintColor = "rgba(255,255,255,0.4)",
  pulse = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  hint?: string;
  borderColor: string;
  bgColor: string;
  titleColor: string;
  subtitleColor: string;
  hintColor?: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        padding: "20px 24px",
        textAlign: "center",
        animation: pulse ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : undefined,
      }}
    >
      <p style={{ fontSize: "18px", marginBottom: "8px" }}>{icon}</p>
      <p style={{ fontSize: "14px", color: titleColor, fontWeight: 500, marginBottom: "4px" }}>
        {title}
      </p>
      <p style={{ fontSize: "13px", color: subtitleColor }}>
        {subtitle}
      </p>
      {hint && (
        <p style={{ fontSize: "12px", color: hintColor, marginTop: "8px" }}>
          {hint}
        </p>
      )}
    </div>
  );
}