// app/api/health/route.ts
// PHASE 6: Comprehensive system health check — monitoring stack entry point.
// Returns: status, database, clerk, daraja, sms, cron, timestamp, version.
// Used by: Vercel monitoring, uptime checks, admin dashboards.

import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
const START_TIME = Date.now();

interface HealthCheckResult {
  status: string;
  latencyMs: number;
  error?: string;
}

async function checkSmsHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const hasCredentials = !!(process.env.AT_USERNAME && process.env.AT_API_KEY);
    if (!hasCredentials) {
      return { status: "not_configured", latencyMs: Date.now() - start };
    }
    // We don't actually send an SMS — just verify credentials are present
    // In production, you could send a test SMS to your own number monthly
    return { status: "available", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "SMS check failed",
    };
  }
}

async function checkDarajaHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const hasCredentials = !!(
      process.env.DARAJA_ENV &&
      process.env.APP_SECRET // needed for decrypt
    );
    if (!hasCredentials) {
      return { status: "not_configured", latencyMs: Date.now() - start };
    }
    return { status: "available", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Daraja check failed",
    };
  }
}

async function checkCronHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const hasSecret = !!process.env.CRON_SECRET;
    if (!hasSecret) {
      return { status: "not_configured", latencyMs: Date.now() - start };
    }
    return { status: "available", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Cron check failed",
    };
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptimeMs = Date.now() - START_TIME;

  // Run all checks in parallel
  const [dbHealth, clerkHealth, smsHealth, darajaHealth, cronHealth] = await Promise.all([
    checkDbHealth(),
    // Clerk check: verify auth module loads (lightweight)
    Promise.resolve().then(() => {
      const start = Date.now();
      try {
        const ok = typeof auth === "function";
        return { status: ok ? "available" : "error", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          status: "error",
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : "Clerk init failed",
        };
      }
    }),
    checkSmsHealth(),
    checkDarajaHealth(),
    checkCronHealth(),
  ]);

  const checks = {
    database: dbHealth,
    clerk: clerkHealth,
    sms: smsHealth,
    daraja: darajaHealth,
    cron: cronHealth,
  };

  const allOk = Object.values(checks).every((c) => c.status === "connected" || c.status === "available");
  const anyCriticalDown = dbHealth.status !== "connected" || clerkHealth.status !== "available";

  const status = anyCriticalDown ? "critical" : allOk ? "healthy" : "degraded";
  const httpStatus = anyCriticalDown ? 503 : allOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: APP_VERSION,
      timestamp,
      uptime: `${Math.floor(uptimeMs / 1000)}s`,
      environment: process.env.NODE_ENV ?? "unknown",
      checks,
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
