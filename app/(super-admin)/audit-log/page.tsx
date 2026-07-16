// app/super-admin/audit-log/page.tsx
// Phase B — Super Admin view: "Show me every action on Agency X in last 30 days"
//
// Route: /super-admin/audit-log
// Protected by middleware: SUPER_ADMIN only

import { requireRole } from "@/lib/auth/getRole";
import { getAgencyAuditTrail, getAuditSummaryByAgency } from "@/lib/audit/queries";
import { getDb } from "@/lib/db";
import { agencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyId?: string; days?: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);

  const params = await searchParams;
  const agencyId = params.agencyId;
  const days = Math.min(parseInt(params.days ?? "30", 10), 365);

  const db = getDb();
  const allAgencies = await db.select().from(agencies).orderBy(agencies.name);

  let auditEntries: Awaited<ReturnType<typeof getAgencyAuditTrail>> = [];
  let summary: Awaited<ReturnType<typeof getAuditSummaryByAgency>> = [];

  if (agencyId) {
    auditEntries = await getAgencyAuditTrail(agencyId, days);
  }
  summary = await getAuditSummaryByAgency(days);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="text-muted-foreground">
        Every action across all agencies. Append-only. Cannot be modified.
      </p>

      {/* ── Agency Selector ─────────────────────────────────────────────── */}
      <form className="flex gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Agency</label>
          <select
            name="agencyId"
            defaultValue={agencyId ?? ""}
            className="border rounded px-3 py-2 min-w-[240px]"
          >
            <option value="">— Select Agency —</option>
            {allAgencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isActive ? "" : "(SUSPENDED)"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Days</label>
          <select
            name="days"
            defaultValue={days.toString()}
            className="border rounded px-3 py-2"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
        >
          Filter
        </button>
      </form>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((s) => {
          const agency = allAgencies.find((a) => a.id === s.agencyId);
          return (
            <div key={s.agencyId ?? "global"} className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Agency</p>
              <p className="font-semibold">{agency?.name ?? "Cross-agency (Super Admin)"}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span>Actions: <strong>{s.actionCount}</strong></span>
                <span className="text-muted-foreground">
                  Last: {s.lastActionAt ? new Date(s.lastActionAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Audit Entries Table ───────────────────────────────────────── */}
      {agencyId ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Actor</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No audit entries for this agency in the selected period.
                  </td>
                </tr>
              )}
              {auditEntries.map((entry) => (
                <tr key={entry.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString("en-KE")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{entry.actorClerkId.slice(0, 12)}…</span>
                    <span className="ml-2 text-xs text-muted-foreground">({entry.actorRole})</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-muted-foreground">{entry.targetTable}.</span>
                    <span className="font-mono text-xs">{entry.targetId.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{entry.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Select an agency above to view its audit trail.
        </div>
      )}

      {/* ── Footer Note ─────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground">
        Audit log is append-only at the database level. Entries older than 90 days are
        exported to cold storage daily at 3:00 AM EAT.{" "}
        <Link href="/super-admin/audit-log/export" className="underline">
          View export history →
        </Link>
      </p>
    </div>
  );
}