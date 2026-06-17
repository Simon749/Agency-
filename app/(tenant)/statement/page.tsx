// app/(tenant)/statement/page.tsx
// Full tenant statement with monthly grouping and running balance

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants } from "@/db/schema";
import { getTenantStatement } from "@/lib/ledger";

export default async function TenantStatementPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) redirect("/tenant/dashboard");

  const { rows, monthlyGroups, finalBalance } = await getTenantStatement(tenant.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-widest text-white/40 uppercase mb-2">
          Financial Statement
        </p>
        <h1 className="text-3xl font-light tracking-tight text-white">
          Account Statement
        </h1>
      </div>

      {/* Summary */}
      <div className="bg-white/[0.03] border border-white/[0.07] p-6 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-white/40 uppercase mb-2">
            Current Balance
          </p>
          <p
            className={`text-3xl font-light tracking-tight ${
              finalBalance > 0 ? "text-red-400" : "text-green-400"
            }`}
          >
            KES {finalBalance.toLocaleString("en-KE")}
          </p>
        </div>
        <p className="text-xs text-white/40">
          {finalBalance > 0 ? "Amount due" : "You're all paid up"}
        </p>
      </div>

      {/* Monthly Groups */}
      <div className="space-y-6">
        {monthlyGroups.map((group) => (
          <div key={group.billingMonth}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <p className="text-xs tracking-widest text-white/40 uppercase">
                {formatMonth(group.billingMonth)}
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-red-400">Charged: KES {group.monthDebits.toLocaleString("en-KE")}</span>
                <span className="text-green-400">Paid: KES {group.monthCredits.toLocaleString("en-KE")}</span>
                <span
                  className={`font-medium ${
                    group.monthNet > 0 ? "text-red-400" : "text-green-400"
                  }`}
                >
                  Net: {group.monthNet > 0 ? "+" : ""} KES {group.monthNet.toLocaleString("en-KE")}
                </span>
              </div>
            </div>

            <div className="space-y-px">
              {group.rows
                .slice()
                .reverse()
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between py-3 px-4 bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs tracking-widest uppercase px-2 py-1 border ${
                          row.type === "DEBIT"
                            ? "text-red-400 border-red-400/30"
                            : "text-green-400 border-green-400/30"
                        }`}
                      >
                        {row.type}
                      </span>
                      <div>
                        <p className="text-sm text-white">
                          {row.description ?? row.category}
                        </p>
                        <p className="text-xs text-white/40">
                          {row.date.toLocaleDateString("en-KE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {row.referenceCode && ` • Ref: ${row.referenceCode}`}
                          {row.method && ` • ${row.method}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          row.type === "DEBIT" ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {row.type === "DEBIT" ? "+" : "-"} KES{" "}
                        {row.amount.toLocaleString("en-KE")}
                      </p>
                      <p className="text-xs text-white/30">
                        Bal: {row.runningBalance > 0 ? "+" : ""} KES{" "}
                        {row.runningBalance.toLocaleString("en-KE")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-white/40 text-center py-12">
          No transactions found. Your statement will appear here once billing begins.
        </p>
      )}
    </div>
  );
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}