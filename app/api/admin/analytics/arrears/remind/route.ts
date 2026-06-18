// app/api/admin/analytics/arrears/remind/route.ts
// POST /api/admin/analytics/arrears/remind
// Body: { tenantId: string }
// Sends immediate overdue SMS via Africa's Talking. Secured by Clerk session.

import { NextRequest, NextResponse } from "next/server";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getArrearsReport } from "@/lib/analytics/queries";
import { sendSms } from "@/lib/sms/sendSms";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionMeta();

    if (!session.agencyId) {
      return NextResponse.json({ error: "No agency associated with user" }, { status: 403 });
    }

    const body = await req.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    // Verify tenant belongs to this agency and has arrears
    const arrears = await getArrearsReport(session.agencyId, { minBalance: 0.01 });
    const tenant = arrears.find((a) => a.tenantId === tenantId);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found or has no arrears" }, { status: 404 });
    }

    // Build and send SMS
    const message = `Hi ${tenant.fullName}, this is a reminder from PropFlow. Your account for ${tenant.buildingName}, Unit ${tenant.unitNumber} has an outstanding balance of KES ${tenant.balance.toFixed(2)}. Please pay immediately to avoid penalties. —PropFlow`;

    const result = await sendSms(tenant.phone, message);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send SMS", details: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reminder SMS sent",
      tenantId,
      balance: tenant.balance,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("[API] Send reminder error:", err);
    return NextResponse.json(
      { error: "Failed to send reminder", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}