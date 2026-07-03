// lib/ledger/getStatement.ts
import { eq, sql } from "drizzle-orm";
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

/**
 * Get tenant statement with running balance computed via SQL window function.
 */
export async function getTenantStatement(
  tenantId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedLedgerResult> {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, 100));
  const offset = (safePage - 1) * safePageSize;

  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        created_at,
        description,
        category,
        type,
        amount::numeric,
        reference_code,
        method,
        billing_month,
        SUM(CASE 
          WHEN type = 'DEBIT' THEN amount::numeric 
          ELSE -amount::numeric 
        END) OVER (
          ORDER BY created_at ASC, id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_balance
      FROM tenant_ledger
      WHERE tenant_id = ${tenantId}
    )
    SELECT
      id,
      created_at as date,
      description,
      category,
      type,
      amount,
      running_balance,
      reference_code,
      method,
      billing_month
    FROM ranked
    ORDER BY created_at DESC, id DESC
    LIMIT ${safePageSize} OFFSET ${offset}
  `);

  // FIX: db.execute() returns { rows: [...] } — extract the array
  const rawRows = Array.isArray(result) ? result : (result as any).rows ?? [];
  
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId));

  const totalCount = Number(count);

  const formattedRows: StatementRow[] = rawRows.map((r: any) => ({
    id: r.id,
    date: new Date(r.date),
    description: r.description,
    category: r.category,
    type: r.type as "DEBIT" | "CREDIT",
    amount: Number(r.amount),
    runningBalance: Number(r.running_balance),
    referenceCode: r.reference_code,
    method: r.method,
    billingMonth: r.billing_month,
  }));

  return {
    rows: formattedRows,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
  };
}

/**
 * Get recent ledger entries (last N rows) — used for dashboard widgets.
 */
export async function getRecentLedgerEntries(
  tenantId: string,
  limit: number = 5
): Promise<StatementRow[]> {
  const db = getDb();
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        created_at,
        description,
        category,
        type,
        amount::numeric,
        reference_code,
        method,
        billing_month,
        SUM(CASE 
          WHEN type = 'DEBIT' THEN amount::numeric 
          ELSE -amount::numeric 
        END) OVER (
          ORDER BY created_at ASC, id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_balance
      FROM tenant_ledger
      WHERE tenant_id = ${tenantId}
    )
    SELECT
      id,
      created_at as date,
      description,
      category,
      type,
      amount,
      running_balance,
      reference_code,
      method,
      billing_month
    FROM ranked
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `);

  // FIX: same extraction pattern
  const rawRows = Array.isArray(result) ? result : (result as any).rows ?? [];

  return rawRows.map((r: any) => ({
    id: r.id,
    date: new Date(r.date),
    description: r.description,
    category: r.category,
    type: r.type as "DEBIT" | "CREDIT",
    amount: Number(r.amount),
    runningBalance: Number(r.running_balance),
    referenceCode: r.reference_code,
    method: r.method,
    billingMonth: r.billing_month,
  }));
}

/**
 * Get monthly summary groups — also SQL-aggregated for performance.
 */
export async function getMonthlySummary(tenantId: string) {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      billing_month,
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE 0 END), 0) as month_debits,
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount::numeric ELSE 0 END), 0) as month_credits,
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount::numeric ELSE -amount::numeric END), 0) as month_net
    FROM tenant_ledger
    WHERE tenant_id = ${tenantId} AND billing_month IS NOT NULL
    GROUP BY billing_month
    ORDER BY billing_month ASC
  `);

  // FIX: same extraction pattern
  const rawRows = Array.isArray(result) ? result : (result as any).rows ?? [];

  return rawRows.map((r: any) => ({
    billingMonth: r.billing_month as string,
    monthDebits: Number(r.month_debits),
    monthCredits: Number(r.month_credits),
    monthNet: Number(r.month_net),
  }));
}