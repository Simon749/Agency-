// app/api/webhooks/mpesa/confirm/[shortcode]/route.ts
// Confirms manual Paybill payments and inserts into ledger

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings } from "@/db/schema";
import { insertPaymentCredit } from "@/lib/ledger";
import type { C2BConfirmationRequest, DarajaCallbackResponse } from "@/lib/daraja/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

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