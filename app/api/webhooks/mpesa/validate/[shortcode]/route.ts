// app/api/webhooks/mpesa/validate/[shortcode]/route.ts
// Validates manual Paybill payments before they are processed

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings } from "@/db/schema";
import type { C2BValidationRequest, DarajaCallbackResponse } from "@/lib/daraja/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  try {
    const body = (await req.json()) as C2BValidationRequest;
    const { BillRefNumber, BusinessShortCode } = body;

    // Verify shortcode matches URL param
    if (BusinessShortCode !== shortcode) {
      const response: DarajaCallbackResponse = {
        ResultCode: "C2B00012",
        ResultDesc: "Rejected — Shortcode mismatch",
      };
      return NextResponse.json(response);
    }

    const db = getDb();

    // Find building by shortcode
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

    // Verify tenant exists in this building
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

    // Accept
    const response: DarajaCallbackResponse = {
      ResultCode: "0",
      ResultDesc: "Accepted",
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error(`Validation error for shortcode ${shortcode}:`, err);
    const response: DarajaCallbackResponse = {
      ResultCode: "C2B00016",
      ResultDesc: "Internal server error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}