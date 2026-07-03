// app/(tenant)/pay/PayRentButton.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { initiatePayment } from "./actions";

interface Props {
  tenantId: string; buildingId: string; phone: string;
  amount: number; unitNumber: string;
}

export function PayRentButton({ tenantId, buildingId, phone, amount, unitNumber }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "prompted" | "error">("idle");
  const [message, setMessage] = useState("");
  const isSubmitting = useRef(false);

  const handlePay = useCallback(async () => {
    if (isSubmitting.current || loading) {
      console.log("[PayRentButton] Double-click blocked by ref guard");
      return;
    }
    isSubmitting.current = true;
    setLoading(true);
    setStatus("idle");

    try {
      const result = await initiatePayment({ tenantId, buildingId, phone, amount, unitNumber });
      if (result.success) {
        setStatus("prompted");
        setMessage(result.message ?? "Check your phone for the M-Pesa prompt.");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Payment initiation failed.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setTimeout(() => { isSubmitting.current = false; }, 2000);
    }
  }, [tenantId, buildingId, phone, amount, unitNumber, loading]);

  return (
    <div className="space-y-4">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition select-none"
        style={{ touchAction: "manipulation" }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay KES ${amount.toLocaleString("en-KE")} via M-Pesa`
        )}
      </button>

      {status === "prompted" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center animate-pulse">
          <p className="text-blue-800 font-medium">✅ STK Push Sent!</p>
          <p className="text-blue-700 text-sm mt-1">{message}</p>
          <p className="text-blue-600 text-xs mt-2">Check your phone for the M-Pesa prompt and enter your PIN.</p>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800 font-medium">❌ Payment Failed</p>
          <p className="text-red-700 text-sm mt-1">{message}</p>
        </div>
      )}
    </div>
  );
}