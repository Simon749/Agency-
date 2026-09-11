import { billingRuns } from "@/db/schema";
import { qstash, qstashReceiver } from "@/lib/qstash/client";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// app/api/jobs/retry-failed/route.ts
//
// SECURITY FIX (Phase 0 audit): this route had no verification at all —
// any POST with a billingRunId would queue real billing retry jobs for
// that agency. We read the body once ourselves and verify it directly
// against qstashReceiver (rather than calling client.ts's
// verifyQStashSignature helper, which reads req.text() internally and
// would leave nothing for req.json() to parse afterward).
export async function POST(req: NextRequest) {
    const signature = req.headers.get("upstash-signature") || "";
    const bodyText = await req.text();

    try {
        await qstashReceiver.verify({
            signature,
            body: bodyText,
            url: `${process.env.NEXT_PUBLIC_APP_URL}${req.nextUrl.pathname}`,
        });
    } catch {
        return NextResponse.json({ error: "Invalid or missing QStash signature" }, { status: 401 });
    }

    const db = getDb();
    const { billingRunId } = JSON.parse(bodyText);

    const [run] = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.id, billingRunId))
        .limit(1);

    if (!run) {
        return NextResponse.json({ error: "Billing run not found" }, { status: 404 });
    }

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