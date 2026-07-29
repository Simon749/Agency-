import { billingRuns } from "@/db/schema";
import { qstash } from "@/lib/qstash";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// app/api/jobs/retry-failed/route.ts
export async function POST(req: NextRequest) {
    const db = getDb();
    const { billingRunId } = await req.json();

    const [run] = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.id, billingRunId))
        .limit(1);

    const failed = (run.errorLog as Array<{ tenantId: string; error: string }>) || [];

    for (const { tenantId } of failed) {
        await qstash.publishJSON({
            url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/bill-batch`,
            body: {
                billingRunId,
                agencyId: run.agencyId,
                billingMonth: run.billingMonth,
                tenantIds: [tenantId],
                batchIndex: 999, // retry marker
            },
            retries: 5,
        });
    }

    return NextResponse.json({ retried: failed.length });
}