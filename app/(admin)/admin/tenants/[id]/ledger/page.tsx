// app/(admin)/admin/tenants/[id]/ledger/page.tsx
// Admin view of tenant ledger — full transaction history with running balance

import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionMeta } from "@/lib/auth/getRole";
import {
  getTenantStatement,
  getTenantBalance,
  type MonthlyGroup,
  type StatementRow,
} from "@/lib/ledger";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminTenantLedgerPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect("/pending-setup");

  const db = getDb();

  // Load tenant scoped to agency
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, params.id), eq(tenants.agencyId, agencyId)));

  if (!tenant) notFound();

  const [building] = await db
    .select({ name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId))
    .limit(1);

  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, tenant.unitId))
    .limit(1);

  const { rows, monthlyGroups, finalBalance } = await getTenantStatement(tenant.id);
  const balance = await getTenantBalance(tenant.id);

  return (
    <div>
      <p className="text-xs tracking-widest text-white/40 uppercase mb-3">
        Ledger & Transactions
      </p>

      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <Link
          href={`/admin/tenants/${params.id}`}
          className="text-sm text-white/40 hover:text-white transition"
        >
          ← Back to Tenant
        </Link>
        <h1 className="text-3xl font-light tracking-tight text-white">
          {tenant.fullName} — Ledger
        </h1>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.07] p-5">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-2">Current Balance</p>
          <p className={`text-2xl font-light ${finalBalance > 0 ? "text-red-400" : "text-green-400"}`}>
            KES {finalBalance.toLocaleString("en-KE")}
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] p-5">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-2">Total Charged</p>
          <p className="text-2xl font-light text-white">KES {balance.totalCharged.toLocaleString("en-KE")}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] p-5">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-2">Total Paid</p>
          <p className="text-2xl font-light text-green-400">KES {balance.totalPaid.toLocaleString("en-KE")}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] p-5">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-2">Building / Unit</p>
          <p className="text-lg font-light text-white">{building?.name} / {unit?.unitNumber}</p>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="mb-4 pb-3 border-b border-white/10 flex items-center justify-between">
        <p className="text-xs tracking-widest text-white/40 uppercase">
          {rows.length} {rows.length === 1 ? "Transaction" : "Transactions"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-white/40 py-8">No ledger entries yet.</p>
      ) : (
        <div className="space-y-px">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_120px] gap-4 px-4 py-2 text-xs tracking-widest text-white/30 uppercase">
            <span>Type</span>
            <span>Description</span>
            <span className="text-right">Date</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span className="text-right">Balance</span>
          </div>

          {rows.map((row: StatementRow) => (
            <div
              key={row.id}
              className={`grid grid-cols-1 md:grid-cols-[100px_1fr_120px_120px_120px_120px] gap-4 px-4 py-4 items-center bg-white/[0.02] border border-white/[0.05] ${
                row.runningBalance > 0 ? "border-l-2 border-l-red-500/50" : ""
              }`}
            >
              <span
                className={`text-xs tracking-widest uppercase px-2 py-1 border w-fit ${
                  row.type === "DEBIT"
                    ? "text-red-400 border-red-400/30"
                    : "text-green-400 border-green-400/30"
                }`}
              >
                {row.type}
              </span>

              <div>
                <p className="text-sm text-white">{row.description ?? row.category}</p>
                <p className="text-xs text-white/40">
                  {row.category}
                  {row.referenceCode && ` • ${row.referenceCode}`}
                  {row.method && ` • ${row.method}`}
                </p>
              </div>

              <p className="text-xs text-white/50 md:text-right">
                {row.date.toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>

              <p className="text-sm text-red-400 md:text-right">
                {row.type === "DEBIT" ? `KES ${row.amount.toLocaleString("en-KE")}` : "—"}
              </p>

              <p className="text-sm text-green-400 md:text-right">
                {row.type === "CREDIT" ? `KES ${row.amount.toLocaleString("en-KE")}` : "—"}
              </p>

              <p
                className={`text-sm font-medium md:text-right ${
                  row.runningBalance > 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {row.runningBalance > 0 ? "+" : ""} KES {row.runningBalance.toLocaleString("en-KE")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Monthly Breakdown */}
      {monthlyGroups.length > 0 && (
        <div className="mt-8">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-4 pb-2 border-b border-white/10">
            Monthly Summary
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {monthlyGroups.map((group: MonthlyGroup) => (
              <div
                key={group.billingMonth}
                className="bg-white/[0.03] border border-white/[0.07] p-4"
              >
                <p className="text-xs tracking-widest text-white/40 uppercase mb-3">
                  {formatMonth(group.billingMonth)}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Charged</span>
                    <span className="text-red-400">KES {group.monthDebits.toLocaleString("en-KE")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Paid</span>
                    <span className="text-green-400">KES {group.monthCredits.toLocaleString("en-KE")}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-white/60">Net</span>
                    <span className={group.monthNet > 0 ? "text-red-400" : "text-green-400"}>
                      {group.monthNet > 0 ? "+" : ""} KES {group.monthNet.toLocaleString("en-KE")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}