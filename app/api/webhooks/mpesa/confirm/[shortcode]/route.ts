// app/api/webhooks/mpesa/confirm/[shortcode]/route.ts
// PHASE 4 HARDENED: Confirms manual Paybill payments with IP allowlist + callback key.

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings } from "@/db/schema";
import { insertPaymentCredit } from "@/lib/ledger";
import type { C2BConfirmationRequest, DarajaCallbackResponse } from "@/lib/daraja/types";

// Safaricom Daraja IP ranges
const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  // ── PHASE 4 FIX: IP Allowlist ──
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[CONFIRM] Rejected from non-Safaricom IP: ${clientIp} for shortcode ${shortcode}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Rejected — Unauthorized IP",
    };
    return NextResponse.json(response, { status: 403 });
  }

  // ── PHASE 4 FIX: X-Callback-Key verification ──
  const callbackKey = req.headers.get("x-callback-key");
  const expectedKey = process.env.DARAJA_CALLBACK_KEY;
  if (expectedKey && callbackKey !== expectedKey) {
    console.warn(`[CONFIRM] Invalid callback key from ${clientIp}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Rejected — Invalid callback key",
    };
    return NextResponse.json(response, { status: 403 });
  }

  try {
    const body = (await req.json()) as C2BConfirmationRequest;
    const { BillRefNumber, TransID, TransAmount, TransTime, MSISDN } = body;

    const db = getDb();

    // Find building
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.darajaShortcode, shortcode))
      .limit(1);

    if (!building) {
      const response: DarajaCallbackResponse = {
        ResultCode: "1",
        ResultDesc: "Rejected — Building not found",
      };
      return NextResponse.json(response);
    }

    // Find tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.id, BillRefNumber),
          eq(tenants.buildingId, building.id)
        )
      )
      .limit(1);

    if (!tenant) {
      const response: DarajaCallbackResponse = {
        ResultCode: "1",
        ResultDesc: "Rejected — Tenant not found",
      };
      return NextResponse.json(response);
    }

    // Derive billing month from transaction time (format: YYYYMMDDHHmmss)
    const billingMonth = TransTime.slice(0, 4) + "-" + TransTime.slice(4, 6);

    // Insert CREDIT into ledger
    const ledgerResult = await insertPaymentCredit({
      tenantId: tenant.id,
      buildingId: tenant.buildingId,
      agencyId: tenant.agencyId,
      category: "RENT",
      amount: TransAmount,
      billingMonth,
      description: `M-Pesa Paybill — ${TransID}`,
      referenceCode: TransID,
      method: "MPESA_STK",
      recordedBy: "system",
    });

    const response: DarajaCallbackResponse = {
      ResultCode: "0",
      ResultDesc: ledgerResult.alreadyExists ? "Already processed" : "Accepted",
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(`Confirmation error for shortcode ${shortcode}:`, err);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Internal server error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}