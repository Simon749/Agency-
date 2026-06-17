// lib/cron/__tests__/monthlyBilling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runMonthlyBilling } from "../monthlyBilling";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockInsert = vi.fn();
const mockLimit = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: mockSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          innerJoin: mockInnerJoin.mockReturnValue({
            where: mockWhere,
          }),
          limit: mockLimit,
        }),
      }),
    }),
    insert: mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "ledger-1" }]) }),
    }),
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: any, b: any) => ({ a, b }),
  and: (...conds: any[]) => ({ and: conds }),
  gte: (a: any, b: any) => ({ gte: [a, b] }),
  lte: (a: any, b: any) => ({ lte: [a, b] }),
}));

vi.mock("@/db/schema", () => ({
  tenants: { id: "id", status: "status", fullName: "full_name", agencyId: "agency_id", buildingId: "building_id", unitId: "unit_id" },
  leases: { tenantId: "tenant_id", status: "status", rentAmount: "rent_amount", depositAmount: "deposit_amount", depositPaid: "deposit_paid" },
  tenantLedger: { tenantId: "tenant_id", billingMonth: "billing_month", type: "type", category: "category", amount: "amount" },
  buildingUtilities: { buildingId: "building_id", agencyId: "agency_id", isEnabled: "is_enabled", rateType: "rate_type", name: "name", defaultAmount: "default_amount" },
}));

describe("runMonthlyBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty summary when no active tenants", async () => {
    mockWhere.mockResolvedValueOnce([]); // no tenants

    const result = await runMonthlyBilling("2026-06");

    expect(result.totalTenants).toBe(0);
    expect(result.totalEntriesInserted).toBe(0);
    expect(result.totalAmountBilled).toBe(0);
  });

  it("skips tenant already billed for the month (idempotency)", async () => {
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Alice", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "25000", depositAmount: "25000", depositPaid: true }])
      .mockResolvedValueOnce([{ id: "existing-debit" }]); // idempotency hit

    const result = await runMonthlyBilling("2026-06");

    expect(result.skipped).toBe(1);
    expect(result.totalEntriesInserted).toBe(0);
  });

  it("bills rent + fixed utilities for active tenant", async () => {
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Alice", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "25000", depositAmount: "25000", depositPaid: true }])
      .mockResolvedValueOnce([]) // no existing debits
      .mockResolvedValueOnce([]) // no previous balance
      .mockResolvedValueOnce([
        { name: "GARBAGE", defaultAmount: "500", isEnabled: true, rateType: "FIXED" },
        { name: "WIFI", defaultAmount: "1000", isEnabled: true, rateType: "FIXED" },
      ]) // fixed utilities
      .mockResolvedValueOnce([{ id: "existing-deposit" }]); // deposit already billed

    const result = await runMonthlyBilling("2026-06");

    expect(result.totalTenants).toBe(1);
    expect(result.totalEntriesInserted).toBe(3); // rent + garbage + wifi
    expect(result.totalAmountBilled).toBe(26500);
    expect(result.errors).toBe(0);
  });

  it("bills deposit when not yet paid", async () => {
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Bob", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "20000", depositAmount: "20000", depositPaid: false }])
      .mockResolvedValueOnce([]) // no existing debits
      .mockResolvedValueOnce([]) // no previous balance
      .mockResolvedValueOnce([]) // no utilities
      .mockResolvedValueOnce([]); // no existing deposit

    const result = await runMonthlyBilling("2026-06");

    expect(result.totalEntriesInserted).toBe(2); // rent + deposit
    expect(result.totalAmountBilled).toBe(40000);
  });

  it("carries forward previous balance when tenant has arrears", async () => {
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Charlie", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "30000", depositAmount: "30000", depositPaid: true }])
      .mockResolvedValueOnce([]) // no existing debits for this month
      .mockResolvedValueOnce([
        { type: "DEBIT", amount: "30000" },
        { type: "DEBIT", amount: "1500" },
        { type: "CREDIT", amount: "10000" },
      ]) // previous month ledger: owes 21,500
      .mockResolvedValueOnce([]) // no utilities
      .mockResolvedValueOnce([{ id: "existing-deposit" }]); // deposit already billed

    const result = await runMonthlyBilling("2026-06");

    expect(result.totalEntriesInserted).toBe(2); // previous_balance + rent
    expect(result.totalAmountBilled).toBe(51500); // 21,500 arrears + 30,000 rent
  });

  it("does not double-bill on second run (idempotency)", async () => {
    // First run
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Alice", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "25000", depositAmount: "25000", depositPaid: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "existing-deposit" }]);

    await runMonthlyBilling("2026-06");

    // Second run — same month, should skip
    mockWhere
      .mockResolvedValueOnce([{ tenantId: "t1", tenantName: "Alice", agencyId: "a1", buildingId: "b1", unitId: "u1", rentAmount: "25000", depositAmount: "25000", depositPaid: true }])
      .mockResolvedValueOnce([{ id: "existing-debit" }]);

    const result = await runMonthlyBilling("2026-06");

    expect(result.skipped).toBe(1);
    expect(result.totalEntriesInserted).toBe(0);
  });
});