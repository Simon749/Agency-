// app/super-admin/billing/page.tsx (Server Action)
"use server";
import { qstash } from "@/lib/qstash/client";

export async function triggerManualBilling(billingMonth: string) {
  // Optional: verify caller is SUPER_ADMIN
  
  const { messageId } = await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/monthly-billing`,
    // QStash can call your own endpoints too
    method: "GET",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  
  return { messageId };
}