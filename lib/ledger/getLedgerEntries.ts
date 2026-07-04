// lib/ledger/getRecentLedgerEntries.ts
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

export interface LedgerEntry {
  id: string;
  type: "DEBIT" | "CREDIT";
  category: string;
  description: string | null;
  amount: number;
  referenceCode: string | null;
  createdAt: Date;
}

export async function getLedgerEntries(tenantId: string): Promise<LedgerEntry[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId))
    .orderBy(desc(tenantLedger.createdAt));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    referenceCode: row.referenceCode,
    createdAt: row.createdAt,
  }));
}