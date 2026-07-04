// app/(tenant)/statement/page.tsx
// Tenant statement — full ledger history with running balance

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants } from "@/db/schema";
import { getTenantBalance } from "@/lib/ledger";
import type { LedgerEntry } from "@/lib/ledger/getLedgerEntries";
import Link from "next/link";

interface EntryWithBalance extends LedgerEntry {
  runningBalance: number;
}

export default async function TenantStatementPage() {
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
          Your account is not linked to a tenant profile.
        </p>
      </div>
    );
  }

  const balance = await getTenantBalance(tenant.id);
  const entries = await getLedgerEntries(tenant.id);

  // Calculate running balance
  let runningBalance = 0;
  const entriesWithBalance: EntryWithBalance[] = entries.map((entry: LedgerEntry) => {
    if (entry.type === "DEBIT") runningBalance += entry.amount;
    else runningBalance -= entry.amount;
    return { ...entry, runningBalance };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-white/55 uppercase mb-2">Tenant Portal</p>
          <h1 className="text-3xl font-light tracking-tight text-white">Statement</h1>
        </div>
        <Link
          href="/tenant/dashboard"
          className="text-xs tracking-widest text-white/55 hover:text-white uppercase transition"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs tracking-widest text-white/55 uppercase mb-2">Current Balance</p>
            <p className={`text-3xl font-light tracking-tight ${balance.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
              KES {balance.balance.toLocaleString('en-KE')}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest text-white/55 uppercase mb-2">Total Charged</p>
            <p className="text-2xl font-light tracking-tight text-white">
              KES {balance.totalCharged.toLocaleString('en-KE')}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest text-white/55 uppercase mb-2">Total Paid</p>
            <p className="text-2xl font-light tracking-tight text-green-400">
              KES {balance.totalPaid.toLocaleString('en-KE')}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <p className="text-xs tracking-widest text-white/55 uppercase">Transaction History</p>
          <p className="text-xs text-white/55">{entries.length} entries</p>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-white/55 py-4">No transactions yet.</p>
        ) : (
          <div className="space-y-px">
            {/* Header row — hidden on mobile */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs tracking-widest text-white/55 uppercase border-b border-white/10">
              <span className="col-span-2">Date</span>
              <span className="col-span-3">Description</span>
              <span className="col-span-2">Category</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2 text-right">Balance</span>
              <span className="col-span-1 text-right">Type</span>
            </div>

            {entriesWithBalance.map((entry: EntryWithBalance) => (
              <div
                key={entry.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4 bg-white/[0.02] border border-white/[0.05] items-center"
              >
                {/* Mobile: stacked layout */}
                <div className="md:col-span-2">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Date:</span>
                  <span className="text-sm text-white">
                    {entry.createdAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="md:col-span-3">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Desc:</span>
                  <span className="text-sm text-white">{entry.description ?? entry.category}</span>
                  {entry.referenceCode && (
                    <p className="text-xs text-white/55 mt-1">Ref: {entry.referenceCode}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Category:</span>
                  <span className="text-xs tracking-widest uppercase text-white/55">{entry.category}</span>
                </div>
                <div className="md:col-span-2 md:text-right">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Amount:</span>
                  <span className={`text-sm font-medium ${entry.type === 'DEBIT' ? 'text-red-400' : 'text-green-400'}`}>
                    {entry.type === 'DEBIT' ? '+' : '-'} KES {entry.amount.toLocaleString('en-KE')}
                  </span>
                </div>
                <div className="md:col-span-2 md:text-right">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Balance:</span>
                  <span className="text-sm text-white">
                    KES {entry.runningBalance.toLocaleString('en-KE')}
                  </span>
                </div>
                <div className="md:col-span-1 md:text-right">
                  <span className="md:hidden text-xs text-white/55 uppercase mr-2">Type:</span>
                  <span className={`text-xs tracking-widest uppercase px-2 py-1 border ${entry.type === 'DEBIT' ? 'text-red-400 border-red-400/30' : 'text-green-400 border-green-400/30'}`}>
                    {entry.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getLedgerEntries(id: string): Promise<LedgerEntry[]> {
  return [];
}
