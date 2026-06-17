// app/(tenant)/pay/PayRentButton.tsx
"use client";

import { useState } from "react";
import { initiatePayment } from "./actions";

interface Props {
  tenantId: string;
  buildingId: string;
  phone: string;
  amount: number;
  unitNumber: string;
}

export function PayRentButton({ tenantId, buildingId, phone, amount, unitNumber }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "prompted" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handlePay() {
    setLoading(true);
    setStatus("idle");
    try {
      const result = await initiatePayment({
        tenantId,
        buildingId,
        phone,
        amount,
        unitNumber,
      });

      if (result.success) {
        setStatus("prompted");
        setMessage((result.error as string | undefined) ?? "Payment initiation failed.");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Payment initiation failed.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
      >
        {loading ? "Processing..." : `Pay KES ${amount.toLocaleString("en-KE")} via M-Pesa`}
      </button>

      {status === "prompted" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800 font-medium">✅ STK Push Sent!</p>
          <p className="text-blue-700 text-sm mt-1">{message}</p>
          <p className="text-blue-600 text-xs mt-2">
            Check your phone for the M-Pesa prompt and enter your PIN.
          </p>
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