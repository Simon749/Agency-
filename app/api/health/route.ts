// app/api/health/route.ts
// System health check endpoint for Phase 6 monitoring.
// Returns: status, database latency, clerk status, timestamp, version.

import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
const START_TIME = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();

  // Check database
  const dbHealth = await checkDbHealth();

  // Check Clerk (lightweight — just verify the auth module loads)
  let clerkOk = true;
  let clerkError: string | undefined;
  try {
    clerkOk = typeof auth === "function";
  } catch (err) {
    clerkOk = false;
    clerkError = err instanceof Error ? err.message : "Clerk init failed";
  }

  const uptimeMs = Date.now() - START_TIME;

  const status = dbHealth.ok && clerkOk ? "healthy" : "degraded";
  const httpStatus = dbHealth.ok && clerkOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: APP_VERSION,
      timestamp,
      uptime: `${Math.floor(uptimeMs / 1000)}s`,
      database: {
        status: dbHealth.ok ? "connected" : "error",
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      clerk: {
        status: clerkOk ? "available" : "error",
        error: clerkError,
      },
    },
    { status: httpStatus }
  );
}