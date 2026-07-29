// app/super-admin/billing/page.tsx
import { getDb } from "@/lib/db";
import { billingRuns, agencies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FailedTenantEntry = { tenantId: string; error: string };
// Inline server action — no separate file needed
async function triggerBilling() {
  "use server";

  const { qstash } = await import("@/lib/qstash/client");

  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/monthly-billing`,
    method: "GET",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

export default async function BillingPage() {
  const db = getDb();
  const runs = await db
    .select({
      id: billingRuns.id,
      billingMonth: billingRuns.billingMonth,
      status: billingRuns.status,
      totalTenants: billingRuns.totalTenants,
      processedTenants: billingRuns.processedTenants,
      failedTenants: billingRuns.failedTenants,
      startedAt: billingRuns.startedAt,
      completedAt: billingRuns.completedAt,
      agencyName: agencies.name,
    })
    .from(billingRuns)
    .leftJoin(agencies, eq(billingRuns.agencyId, agencies.id))
    .orderBy(desc(billingRuns.startedAt));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Runs</h1>
          <p className="text-muted-foreground">
            Monthly billing execution history.
          </p>
        </div>
        <form action={triggerBilling}>
          <Button type="submit">Trigger Monthly Billing</Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs.filter((r) => r.status === "RUNNING").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {runs.filter((r) => r.status === "FAILED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {runs.filter((r) => r.status === "COMPLETE").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Month</th>
              <th className="text-left p-3 font-medium">Agency</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Tenants</th>
              <th className="text-right p-3 font-medium">Processed</th>
              <th className="text-right p-3 font-medium">Failed</th>
              <th className="text-left p-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No billing runs yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="border-t">
                  <td className="p-3 font-medium">{run.billingMonth}</td>
                  <td className="p-3">{run.agencyName ?? "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${run.status === "COMPLETE" ? "bg-green-100 text-green-800" :
                        run.status === "RUNNING" ? "bg-blue-100 text-blue-800" :
                          run.status === "FAILED" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                      }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">{run.totalTenants ?? 0}</td>
                  <td className="p-3 text-right">{run.processedTenants ?? 0}</td>
                  <td className="p-3 text-right">
                    {(run.failedTenants as FailedTenantEntry[] | null)?.length ?? 0}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}