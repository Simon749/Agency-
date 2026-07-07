// app/api/webhooks/mpesa/validate/[shortcode]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings } from "@/db/schema";
import type { C2BValidationRequest, DarajaCallbackResponse } from "@/lib/daraja/types";

const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  // ── IP Allowlist ──
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[VALIDATE] Rejected from non-Safaricom IP: ${clientIp}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "C2B00012",
      ResultDesc: "Rejected — Unauthorized IP",
    };
    return NextResponse.json(response, { status: 403 });
  }

  // ── X-Callback-Key verification ──
  const callbackKey = req.headers.get("x-callback-key");
  const expectedKey = process.env.DARAJA_CALLBACK_KEY;
  if (expectedKey && callbackKey !== expectedKey) {
    console.warn(`[VALIDATE] Invalid callback key from ${clientIp}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "C2B00012",
      ResultDesc: "Rejected — Invalid callback key",
    };
    return NextResponse.json(response, { status: 403 });
  }

  try {
    const body = (await req.json()) as C2BValidationRequest;
    const { BillRefNumber, BusinessShortCode } = body;

    if (BusinessShortCode !== shortcode) {
      const response: DarajaCallbackResponse = {
        ResultCode: "C2B00012",
        ResultDesc: "Rejected — Shortcode mismatch",
      };
      return NextResponse.json(response);
    }

    const db = getDb();

    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.darajaShortcode, shortcode))
      .limit(1);

    if (!building) {
      const response: DarajaCallbackResponse = {
        ResultCode: "C2B00012",
        ResultDesc: "Rejected — Building not found",
      };
      return NextResponse.json(response);
    }

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, BillRefNumber),
          eq(tenants.buildingId, building.id),
          eq(tenants.status, "ACTIVE")
        )
      )
      .limit(1);

    if (!tenant) {
      const response: DarajaCallbackResponse = {
        ResultCode: "C2B00012",
        ResultDesc: "Rejected — Invalid tenant reference",
      };
      return NextResponse.json(response);
    }

    const response: DarajaCallbackResponse = {
      ResultCode: "0",
      ResultDesc: "Accepted",
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error(`[VALIDATE] Error for shortcode ${shortcode}:`, err);
    const response: DarajaCallbackResponse = {
      ResultCode: "C2B00016",
      ResultDesc: "Internal server error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}