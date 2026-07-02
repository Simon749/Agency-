// lib/ledger/getStatement.ts
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

export interface StatementRow {
  id: string;
  date: Date;
  description: string;
  category: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  runningBalance: number;
  referenceCode: string | null;
  method: string | null;
  billingMonth: string | null;
}

export interface MonthlyGroup {
  billingMonth: string;
  monthDebits: number;
  monthCredits: number;
  monthNet: number;
}

export interface StatementResult {
  rows: StatementRow[];
  monthlyGroups: MonthlyGroup[];
  finalBalance: number;
}

export interface PaginatedLedgerResult {
  rows: StatementRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getTenantStatement(tenantId: string): Promise<StatementResult> {
  const db = getDb();

  const entries = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId))
    .orderBy(asc(tenantLedger.createdAt));

  let runningBalance = 0;
  const rows: StatementRow[] = [];
  const monthMap = new Map<string, { debits: number; credits: number }>();

  for (const entry of entries) {
    const amount = Number(entry.amount);
    const isDebit = entry.type === "DEBIT";

    if (isDebit) {
      runningBalance += amount;
    } else {
      runningBalance -= amount;
    }

    // Track monthly totals
    const month = entry.billingMonth ?? "uncategorized";
    const existing = monthMap.get(month) ?? { debits: 0, credits: 0 };
    if (isDebit) {
      existing.debits += amount;
    } else {
      existing.credits += amount;
    }
    monthMap.set(month, existing);

    rows.push({
      id: entry.id,
      date: entry.createdAt,
      description: entry.description,
      category: entry.category,
      type: entry.type,
      amount,
      runningBalance,
      referenceCode: entry.referenceCode,
      method: entry.method,
      billingMonth: entry.billingMonth,
    });
  }

  const monthlyGroups: MonthlyGroup[] = Array.from(monthMap.entries())
    .map(([billingMonth, vals]) => ({
      billingMonth,
      monthDebits: vals.debits,
      monthCredits: vals.credits,
      monthNet: vals.debits - vals.credits,
    }))
    .sort((a, b) => a.billingMonth.localeCompare(b.billingMonth));

  return {
    rows,
    monthlyGroups,
    finalBalance: runningBalance,
  };
}

export async function getLedgerEntriesPaginated(
  tenantId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedLedgerResult> {
  const db = getDb();

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, 100));
  const offset = (safePage - 1) * safePageSize;

  const entries = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId))
    .orderBy(asc(tenantLedger.createdAt));

  const totalCount = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  let runningBalance = 0;
  const rows: StatementRow[] = [];

  for (const [index, entry] of entries.entries()) {
    const amount = Number(entry.amount);
    runningBalance += entry.type === "DEBIT" ? amount : -amount;

    if (index >= offset && index < offset + safePageSize) {
      rows.push({
        id: entry.id,
        date: entry.createdAt,
        description: entry.description,
        category: entry.category,
        type: entry.type,
        amount,
        runningBalance,
        referenceCode: entry.referenceCode,
        method: entry.method,
        billingMonth: entry.billingMonth,
      });
    }
  }

  return {
    rows,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function getRecentLedgerEntries(
  tenantId: string,
  limit: number = 5
): Promise<StatementRow[]> {
  const db = getDb();

  const entries = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId))
    .orderBy(asc(tenantLedger.createdAt));

  let runningBalance = 0;
  const rows: StatementRow[] = [];

  for (const entry of entries) {
    const amount = Number(entry.amount);
    runningBalance += entry.type === "DEBIT" ? amount : -amount;

    rows.push({
      id: entry.id,
      date: entry.createdAt,
      description: entry.description,
      category: entry.category,
      type: entry.type,
      amount,
      runningBalance,
      referenceCode: entry.referenceCode,
      method: entry.method,
      billingMonth: entry.billingMonth,
    });
  }

  // Return last N entries, most recent first
  return rows.slice(-limit).reverse();
}