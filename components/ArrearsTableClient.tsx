"use client";

// components/admin/ArrearsTableClient.tsx
// PHASE 7: Added scope attributes to table headers, aria-live for SMS send status

import { useState } from "react";
import { sendSmsReminder } from "@/lib/sms/actions";

interface TenantArrear {
  tenantId: string;
  fullName: string;
  unitNumber: string;
  phone: string;
  balance: number;
  monthsOverdue: number;
}

interface Props {
  arrears: TenantArrear[];
}

export function ArrearsTableClient({ arrears }: Props) {
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});

  async function handleSendReminder(tenant: TenantArrear) {
    setSendStatus((prev) => ({ ...prev, [tenant.tenantId]: "Sending..." }));
    try {
      const result = await sendSmsReminder({
        phone: tenant.phone,
        message: `Dear ${tenant.fullName}, your outstanding balance is KES ${tenant.balance.toLocaleString("en-KE")}. Please settle at your earliest convenience.`,
      });
      setSendStatus((prev) => ({
        ...prev,
        [tenant.tenantId]: result.success ? "Sent ✓" : "Failed ✗",
      }));
    } catch {
      setSendStatus((prev) => ({ ...prev, [tenant.tenantId]: "Failed ✗" }));
    }
  }

  if (arrears.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.07] p-8 text-center">
        <p className="text-white/55">No tenants in arrears. 🎉</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <caption className="sr-only">Tenants in arrears</caption>
        <thead>
          <tr className="border-b border-white/10">
            <th scope="col" className="text-left text-xs tracking-widest text-white/55 uppercase px-4 py-3">
              Tenant
            </th>
            <th scope="col" className="text-left text-xs tracking-widest text-white/55 uppercase px-4 py-3">
              Unit
            </th>
            <th scope="col" className="text-right text-xs tracking-widest text-white/55 uppercase px-4 py-3">
              Balance
            </th>
            <th scope="col" className="text-right text-xs tracking-widest text-white/55 uppercase px-4 py-3">
              Months
            </th>
            <th scope="col" className="text-right text-xs tracking-widest text-white/55 uppercase px-4 py-3">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {arrears.map((tenant) => (
            <tr
              key={tenant.tenantId}
              className="border-b border-white/5 hover:bg-white/[0.02] transition"
            >
              <td className="px-4 py-4">
                <p className="text-sm text-white">{tenant.fullName}</p>
                <p className="text-xs text-white/55">{tenant.phone}</p>
              </td>
              <td className="px-4 py-4 text-sm text-white/55">{tenant.unitNumber}</td>
              <td className="px-4 py-4 text-right">
                <span className="text-sm font-medium text-red-400">
                  KES {tenant.balance.toLocaleString("en-KE")}
                </span>
              </td>
              <td className="px-4 py-4 text-right text-sm text-white/55">
                {tenant.monthsOverdue}
              </td>
              <td className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSendReminder(tenant)}
                  disabled={sendStatus[tenant.tenantId] === "Sending..."}
                  className="text-xs tracking-widest uppercase px-3 py-1.5 border border-white/25 text-white/55 hover:text-white hover:border-white/50 transition disabled:opacity-50"
                >
                  {sendStatus[tenant.tenantId] ?? "Remind"}
                </button>
                {/* aria-live for screen reader announcement */}
                <span role="status" aria-live="polite" className="sr-only">
                  {sendStatus[tenant.tenantId] === "Sent ✓" && `SMS reminder sent to ${tenant.fullName}`}
                  {sendStatus[tenant.tenantId] === "Failed ✗" && `SMS reminder failed for ${tenant.fullName}`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}