// lib/sms/actions.ts
"use server";

import { getSessionMeta } from "@/lib/auth/getRole";

interface SendSmsInput {
  phone: string;
  message: string;
}

export async function sendSmsReminder(input: SendSmsInput) {
  const session = await getSessionMeta();

  // Only agency staff can send SMS reminders
  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
    return { success: false, error: "Unauthorized" };
  }

  // TODO: Integrate with Africa's Talking API
  // For now, log and return success (implement when AT credentials are ready)
  console.log("[SMS] Would send to", input.phone, ":", input.message);

  return { success: true };
}