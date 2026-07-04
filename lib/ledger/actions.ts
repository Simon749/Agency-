// lib/ledger/actions.ts
"use server";

import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";
import { revalidatePath } from "next/cache";

interface RecordPaymentInput {
  tenantId: string;
  buildingId: string;
  amount: number;
  method: "CASH" | "BANK_RECEIPT" | "MPESA_STK";
  referenceCode?: string;
  description?: string;
}

export async function recordPayment(input: RecordPaymentInput) {
  const session = await getSessionMeta();

  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
    return { success: false, error: "Unauthorized" };
  }

  if (!session.agencyId) {
    return { success: false, error: "No agency associated" };
  }

  if (!input.amount || input.amount <= 0) {
    return { success: false, error: "Invalid amount" };
  }

  const db = getDb();

  await db.insert(tenantLedger).values({
    tenantId: input.tenantId,
    buildingId: input.buildingId,
    agencyId: session.agencyId,
    type: "CREDIT",
    category: "RENT",
    amount: input.amount.toFixed(2),
    method: input.method,
    referenceCode: input.referenceCode || null,
    description: input.description || `${input.method} payment`,
    recordedBy: session.userId,
  });

  revalidatePath("/admin/tenants");
  revalidatePath("/admin/arrears");

  return { success: true };
}