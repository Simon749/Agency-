import { NextRequest, NextResponse } from "next/server";
import { processQueueBatch } from "@/lib/queue/stk-push-queue";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  
  if (authHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await processQueueBatch(30); // Process up to 30 per invocation
  
  return NextResponse.json({
    status: "ok",
    ...result,
  });
}