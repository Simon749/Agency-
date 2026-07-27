import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/schema";
import { buildings, agencies } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { sendSms } from "@/lib/sms/sendSms";
import { keyRotationReminderSms, keyRotationOverdueSms } from "@/lib/sms/templates-key-rotation";

const ROTATION_DAYS = 90;
const WARNING_7_DAYS = 7;
const WARNING_1_DAY = 1;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "").trim();
  if (token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { checked: 0, alerted7Days: 0, alerted1Day: 0, alertedOverdue: 0, errors: 0, details: [] as any[] };

  try {
    const buildingsWithCredentials = await db
      .select({ building: buildings, agency: agencies })
      .from(buildings)
      .innerJoin(agencies, eq(buildings.agencyId, agencies.id))
      .where(and(isNotNull(buildings.darajaConsumerKey), isNotNull(buildings.darajaShortcode)));

    results.checked = buildingsWithCredentials.length;

    for (const { building, agency } of buildingsWithCredentials) {
      try {
        const baseDate = building.darajaCredentialsUpdatedAt ?? building.createdAt;
        const daysSinceRotation = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilExpiry = ROTATION_DAYS - daysSinceRotation;

        let alertType: string | null = null;
        let message: string | null = null;

        if (daysUntilExpiry < 0) {
          alertType = "OVERDUE";
          message = keyRotationOverdueSms({ buildingName: building.name, daysOverdue: Math.abs(daysUntilExpiry), rotationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings/daraja?building=${building.id}`, supportEmail: "support@propflow.co.ke" });
          results.alertedOverdue++;
        } else if (daysUntilExpiry <= WARNING_1_DAY) {
          alertType = "1_DAY";
          message = keyRotationReminderSms({ buildingName: building.name, daysUntilExpiry, rotationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings/daraja?building=${building.id}`, urgency: "URGENT" });
          results.alerted1Day++;
        } else if (daysUntilExpiry <= WARNING_7_DAYS) {
          alertType = "7_DAYS";
          message = keyRotationReminderSms({ buildingName: building.name, daysUntilExpiry, rotationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings/daraja?building=${building.id}`, urgency: "REMINDER" });
          results.alerted7Days++;
        }

        let smsSent = false;
        if (alertType && message && agency.phone) {
          try {
            await sendSms(agency.phone, message, process.env.AT_SENDER_ID);
            smsSent = true;
          } catch (smsErr) {
            console.error(`SMS failed for ${building.name}:`, smsErr);
          }
        }

        if (alertType) {
          results.details.push({ buildingId: building.id, buildingName: building.name, agencyName: agency.name, daysUntilExpiry, alertType, smsSent });
        }
      } catch (err) {
        results.errors++;
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString(), summary: { checked: results.checked, alerted7Days: results.alerted7Days, alerted1Day: results.alerted1Day, alertedOverdue: results.alertedOverdue, errors: results.errors }, details: results.details });
  } catch (err) {
    return NextResponse.json({ error: "Key rotation alert job failed", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
