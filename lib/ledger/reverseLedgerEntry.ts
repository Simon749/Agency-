// lib/ledger/reverseLedgerEntry.ts
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

export interface ReversalResult {
  reversalEntryId: string;
  originalEntryId: string;
  amount: number;
}

export async function reverseLedgerEntry(
  originalEntryId: string,
  reason: string,
  actorClerkId: string
): Promise<ReversalResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(tenantLedger)
      .where(eq(tenantLedger.id, originalEntryId))
      .for("update");

    if (!original) {
      throw new Error(`Ledger entry ${originalEntryId} not found`);
    }

    const alreadyReversed = await tx
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(eq(tenantLedger.reversesEntryId, originalEntryId))
      .limit(1);

    if (alreadyReversed.length > 0) {
      throw new Error(`Ledger entry ${originalEntryId} has already been reversed`);
    }

    const offsetType: "DEBIT" | "CREDIT" = original.type === "DEBIT" ? "CREDIT" : "DEBIT";

    const [reversal] = await tx
      .insert(tenantLedger)
      .values({
        tenantId: original.tenantId,
        buildingId: original.buildingId,
        agencyId: original.agencyId,
        type: offsetType,
        category: original.category,
        amount: original.amount,
        billingMonth: original.billingMonth,
        description: `Reversal of ${originalEntryId} — ${reason}`,
        referenceCode: `REV-${originalEntryId}`,
        method: "SYSTEM",
        recordedBy: actorClerkId,
        isReversal: true,
        reversesEntryId: originalEntryId,
      })
      .returning({ id: tenantLedger.id });

    return {
      reversalEntryId: reversal.id,
      originalEntryId,
      amount: Number(original.amount),
    };
  });
}