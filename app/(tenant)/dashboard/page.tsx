// app/(tenant)/dashboard/page.tsx
// Tenant portal — statement, balance, recent activity

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { getTenantBalance, getRecentLedgerEntries } from "@/lib/ledger";
import Link from "next/link";

export default async function TenantDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Account Not Linked</h1>
        <p className="mt-2 text-gray-600">
          Your account is not linked to a tenant profile. Contact your property manager.
        </p>
      </div>
    );
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId))
    .limit(1);

  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, tenant.unitId))
    .limit(1);

  const balance = await getTenantBalance(tenant.id);
  const recentEntries = await getRecentLedgerEntries(tenant.id, 5);

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-widest text-white/40 uppercase mb-2">
          Tenant Portal
        </p>
        <h1 className="text-3xl font-light tracking-tight text-white">
          Welcome, {tenant.fullName}
        </h1>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Outstanding Balance */}
        <div className="bg-white/[0.03] border border-white/[0.07] p-6">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
            Outstanding Balance
          </p>
          <p
            className={`text-4xl font-light tracking-tight ${
              balance.balance > 0 ? "text-red-400" : "text-green-400"
            }`}
          >
            KES {balance.balance.toLocaleString("en-KE")}
          </p>
          {balance.balance > 0 && (
            <Link
              href="/tenant/pay"
              className="inline-block mt-4 text-xs tracking-widest uppercase bg-white text-black px-4 py-2 hover:bg-white/90 transition"
            >
              Pay Now
            </Link>
          )}
        </div>

        {/* Total Charged */}
        <div className="bg-white/[0.03] border border-white/[0.07] p-6">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
            Total Charged
          </p>
          <p className="text-4xl font-light tracking-tight text-white">
            KES {balance.totalCharged.toLocaleString("en-KE")}
          </p>
        </div>

        {/* Total Paid */}
        <div className="bg-white/[0.03] border border-white/[0.07] p-6">
          <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
            Total Paid
          </p>
          <p className="text-4xl font-light tracking-tight text-green-400">
            KES {balance.totalPaid.toLocaleString("en-KE")}
          </p>
        </div>
      </div>

      {/* Property Info */}
      <div className="bg-white/[0.03] border border-white/[0.07] p-6">
        <p className="text-xs tracking-widest text-white/40 uppercase mb-4">
          Property Details
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <InfoItem label="Building" value={building?.name ?? "—"} />
          <InfoItem label="Unit" value={unit?.unitNumber ?? "—"} />
          <InfoItem label="Type" value={unit?.type ?? "—"} />
          <InfoItem
            label="Monthly Rent"
            value={`KES ${Number(unit?.rentAmount ?? 0).toLocaleString("en-KE")}`}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <p className="text-xs tracking-widest text-white/40 uppercase">
            Recent Activity
          </p>
          <Link
            href="/tenant/statement"
            className="text-xs tracking-widest text-white/50 hover:text-white uppercase transition"
          >
            Full Statement →
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <p className="text-sm text-white/40 py-4">No transactions yet.</p>
        ) : (
          <div className="space-y-px">
            {recentEntries.map((entry: { id: string; type: "DEBIT" | "CREDIT"; description: string | null; category: string; date: Date; referenceCode: string | null; amount: number }) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-4 px-4 bg-white/[0.02] border border-white/[0.05]"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs tracking-widest uppercase px-2 py-1 border ${
                      entry.type === "DEBIT"
                        ? "text-red-400 border-red-400/30"
                        : "text-green-400 border-green-400/30"
                    }`}
                  >
                    {entry.type}
                  </span>
                  <div>
                    <p className="text-sm text-white">{entry.description ?? entry.category}</p>
                    <p className="text-xs text-white/40">
                      {entry.date.toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {entry.referenceCode && ` • Ref: ${entry.referenceCode}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    entry.type === "DEBIT" ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {entry.type === "DEBIT" ? "+" : "-"} KES{" "}
                  {entry.amount.toLocaleString("en-KE")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}