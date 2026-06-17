// lib/ledger/__tests__/getBalance.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTenantBalance } from "../getBalance";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: mockSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    }),
  }),
}));

vi.mock("@/db/schema", () => ({
  tenantLedger: { type: "type", amount: "amount", tenantId: "tenant_id" },
}));

describe("getTenantBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero balance for empty ledger", async () => {
    mockWhere.mockResolvedValue([]);

    const result = await getTenantBalance("tenant-1");

    expect(result).toEqual({
      totalCharged: 0,
      totalPaid: 0,
      balance: 0,
    });
  });

  it("calculates balance correctly with rent debits only", async () => {
    mockWhere.mockResolvedValue([
      { type: "DEBIT", amount: "25000.00" },
      { type: "DEBIT", amount: "1500.00" }, // water
    ]);

    const result = await getTenantBalance("tenant-1");

    expect(result.totalCharged).toBe(26500);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(26500); // owes 26,500
  });

  it("calculates balance correctly with partial payment", async () => {
    mockWhere.mockResolvedValue([
      { type: "DEBIT", amount: "25000.00" }, // rent
      { type: "CREDIT", amount: "15000.00" }, // partial payment
    ]);

    const result = await getTenantBalance("tenant-1");

    expect(result.totalCharged).toBe(25000);
    expect(result.totalPaid).toBe(15000);
    expect(result.balance).toBe(10000); // still owes 10,000
  });

  it("handles overpayment (negative balance)", async () => {
    mockWhere.mockResolvedValue([
      { type: "DEBIT", amount: "25000.00" },
      { type: "CREDIT", amount: "30000.00" }, // overpaid
    ]);

    const result = await getTenantBalance("tenant-1");

    expect(result.totalCharged).toBe(25000);
    expect(result.totalPaid).toBe(30000);
    expect(result.balance).toBe(-5000); // 5,000 credit
  });

  it("handles multiple months of mixed entries", async () => {
    mockWhere.mockResolvedValue([
      { type: "DEBIT", amount: "25000.00" }, // June rent
      { type: "DEBIT", amount: "25000.00" }, // July rent
      { type: "DEBIT", amount: "1200.00" }, // July water
      { type: "CREDIT", amount: "25000.00" }, // June payment
      { type: "CREDIT", amount: "10000.00" }, // July partial
      { type: "DEBIT", amount: "500.00" }, // garbage
    ]);

    const result = await getTenantBalance("tenant-1");

    expect(result.totalCharged).toBe(51700); // 25000 + 25000 + 1200 + 500
    expect(result.totalPaid).toBe(35000); // 25000 + 10000
    expect(result.balance).toBe(16700); // owes 16,700
  });

  it("correctly parses numeric strings from DB", async () => {
    mockWhere.mockResolvedValue([
      { type: "DEBIT", amount: "10000.50" },
      { type: "CREDIT", amount: "5000.25" },
    ]);

    const result = await getTenantBalance("tenant-1");

    expect(result.balance).toBeCloseTo(5000.25, 2);
  });
});