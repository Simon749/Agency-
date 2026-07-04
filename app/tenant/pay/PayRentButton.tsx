// app/(tenant)/pay/PayRentButton.tsx
// PHASE 7 FIXES: Progressive payment states, polling, user-friendly errors, aria-live

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
        // Silently fail polling — don't disturb user
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
      const result = await initiatePayment({ tenantId, buildingId, phone, amount, unitNumber });
      if (result.success) {
        setStatus("prompted");
        setMessage(result.message ?? "Check your phone for the M-Pesa prompt.");
        // Start polling for completion
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
    <div className="space-y-4">
      {/* Status announcement for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "initiating" && "Connecting to M-Pesa"}
        {status === "prompted" && "Check your phone for the M-Pesa prompt"}
        {status === "processing" && "Waiting for payment confirmation"}
        {status === "completed" && `Payment completed. Reference ${mpesaCode}`}
        {status === "failed" && `Payment failed. ${message}`}
      </div>

      {/* Pay Button */}
      {status === "idle" || status === "failed" ? (
        <button
          onClick={handlePay}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition select-none"
          style={{ touchAction: "manipulation" }}
        >
          {status === "idle" || status === "failed" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting to M-Pesa...
            </span>
          ) : (
            `Pay KES ${amount.toLocaleString("en-KE")} via M-Pesa`
          )}
        </button>
      ) : null}

      {/* Initiating state */}
      {status === "initiating" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center animate-pulse">
          <p className="text-blue-800 font-medium">⏳ Connecting to M-Pesa...</p>
          <p className="text-blue-700 text-sm mt-1">Please wait while we initiate your payment.</p>
        </div>
      )}

      {/* Prompted state */}
      {status === "prompted" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center animate-pulse">
          <p className="text-blue-800 font-medium">📱 Check Your Phone</p>
          <p className="text-blue-700 text-sm mt-1">{message}</p>
          <p className="text-blue-600 text-xs mt-2">Enter your M-Pesa PIN to complete the payment.</p>
        </div>
      )}

      {/* Processing state */}
      {status === "processing" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800 font-medium">⏳ Processing Payment...</p>
          <p className="text-yellow-700 text-sm mt-1">Waiting for M-Pesa confirmation. This may take a moment.</p>
          <div className="mt-3 flex justify-center">
            <svg className="animate-spin h-5 w-5 text-yellow-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      )}

      {/* Completed state */}
      {status === "completed" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-medium">✅ Payment Received!</p>
          <p className="text-green-700 text-sm mt-1">{message}</p>
          {mpesaCode && (
            <p className="text-green-600 text-xs mt-2">M-Pesa Ref: {mpesaCode}</p>
          )}
          <button
            onClick={reset}
            className="mt-3 text-green-700 text-sm underline hover:text-green-900"
          >
            Make another payment
          </button>
        </div>
      )}

      {/* Failed state */}
      {status === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800 font-medium">❌ Payment Failed</p>
          <p className="text-red-700 text-sm mt-1">{message}</p>
          <button
            onClick={reset}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}