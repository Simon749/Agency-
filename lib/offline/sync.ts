// lib/offline/sync.ts
// PHASE 7: Sync engine — submits queued items via API routes when online.
// Called from useOnlineStatus hook and manual retry button.

import {
  getUnsyncedItems,
  markSynced,
  markError,
  type QueuedMeterReading,
  type QueuedReceipt,
} from "./queue";

interface SyncResult {
  success: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

export async function syncQueue(): Promise<SyncResult> {
  const items = await getUnsyncedItems();
  const result: SyncResult = { success: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      if (item.type === "meter-reading") {
        await syncMeterReading(item as QueuedMeterReading);
      } else if (item.type === "receipt") {
        await syncReceipt(item as QueuedReceipt);
      }
      await markSynced(item.id!);
      result.success++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Sync failed";
      await markError(item.id!, errorMsg);
      result.failed++;
      result.errors.push({ id: item.id!, error: errorMsg });
    }
  }

  return result;
}

async function syncMeterReading(item: QueuedMeterReading): Promise<void> {
  const res = await fetch("/api/agent/sync/meter-reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buildingId: item.buildingId,
      unitId: item.unitId,
      utilityType: item.utility,
      previousReading: item.previousReading,
      currentReading: item.currentReading,
      ratePerUnit: item.ratePerUnit,
      billingMonth: item.billingMonth,
      agentClerkId: item.agentClerkId,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}

async function syncReceipt(item: QueuedReceipt): Promise<void> {
  const body: Record<string, unknown> = {
    buildingId: item.buildingId,
    tenantId: item.tenantId,
    amount: item.amount,
    method: item.method,
    referenceCode: item.referenceCode,
    billingMonth: item.billingMonth,
    description: item.description,
    recordedBy: item.agentClerkId,
  };

  // If there's a base64 photo, include it
  if (item.receiptPhotoBase64) {
    body.receiptPhotoBase64 = item.receiptPhotoBase64;
  }

  const res = await fetch("/api/agent/sync/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}