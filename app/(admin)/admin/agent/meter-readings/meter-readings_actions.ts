"use server";

import { getSessionMeta } from "@/lib/auth/getRole";
import { submitMeterReading } from "@/lib/ledger/utilityBilling";

export async function submitReading(formData: FormData) {
  const session = await getSessionMeta();
  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const buildingId = formData.get("buildingId") as string;
  const unitId = formData.get("unitId") as string;
  const utilityType = formData.get("utilityType") as "WATER" | "ELECTRICITY";
  const previousReading = parseFloat(formData.get("previousReading") as string);
  const currentReading = parseFloat(formData.get("currentReading") as string);
  const ratePerUnit = parseFloat(formData.get("ratePerUnit") as string);
  const billingMonth = formData.get("billingMonth") as string;
  const agentClerkId = formData.get("agentClerkId") as string;

  if (!buildingId || !unitId || !utilityType || !billingMonth || !agentClerkId) {
    throw new Error("Missing required fields");
  }

  if (currentReading < previousReading) {
    throw new Error("Current reading cannot be less than previous reading");
  }

  const result = await submitMeterReading({
    unitId,
    buildingId,
    agencyId: session.agencyId!,
    agentClerkId,
    utilityType,
    previousReading,
    currentReading,
    ratePerUnit,
    billingMonth,
  });

  console.log("[Meter Reading] Submitted:", result);
}