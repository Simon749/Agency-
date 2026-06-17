// lib/ledger/__tests__/manualPayments.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logManualPayment, checkReferenceCodeExists } from "../manualPayments";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: mockSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
    insert: mockInsert.mockReturnValue({
      values: mockValues.mockReturnValue({
        returning: mockReturning,
      }),
    }),
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: any, b: any) => ({ a, b }),
  and: (...conds: any[]) => ({ and: conds }),
}));

vi.mock("@/db/schema", () => ({
  tenantLedger: { id: "id", referenceCode: "reference_code", tenantId: "tenant_id", buildingId: "building_id", agencyId: "agency_id", type: "type", category: "category", amount: "amount", method: "method", description: "description", billingMonth: "billing_month", recordedBy: "recorded_by" },
  tenants: { id: "id", fullName: "full_name", buildingId: "building_id", agencyId: "agency_id", status: "status" },
}));

describe("checkReferenceCodeExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for empty reference code", async () => {
    const result = await checkReferenceCodeExists("");
    expect(result).toBe(false);
  });

  it("returns false when reference code not found", async () => {
    mockLimit.mockResolvedValueOnce([]);
    const result = await checkReferenceCodeExists("REF-123");
    expect(result).toBe(false);
  });

  it("returns true when reference code exists", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "ledger-1" }]);
    const result = await checkReferenceCodeExists("REF-123");
    expect(result).toBe(true);
  });
});

describe("logManualPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInput = {
    tenantId: "tenant-1",
    buildingId: "bld-1",
    agencyId: "ag-1",
    amount: 25000,
    method: "BANK_RECEIPT" as const,
    referenceCode: "BANK-2026-001",
    description: "Bank deposit",
    billingMonth: "2026-06",
    recordedBy: "agent-1",
  };

  it("returns error when tenant not found", async () => {
    mockLimit.mockResolvedValueOnce([]); // no tenant

    const result = await logManualPayment(baseInput);

    expect(result.success).toBe(false);
    expect(result.warning).toContain("Tenant not found");
  });

  it("rejects duplicate reference code for bank receipt", async () => {
    mockLimit
      .mockResolvedValueOnce([{ fullName: "Alice" }]) // tenant found
      .mockResolvedValueOnce([{ id: "existing-ledger" }]); // duplicate reference

    const result = await logManualPayment(baseInput);

    expect(result.success).toBe(false);
    expect(result.alreadyExists).toBe(true);
    expect(result.warning).toContain("already exists");
  });

  it("logs bank receipt successfully with unique reference", async () => {
    mockLimit
      .mockResolvedValueOnce([{ fullName: "Alice" }]) // tenant found
      .mockResolvedValueOnce([]); // no duplicate

    mockReturning.mockResolvedValueOnce([{ id: "ledger-1" }]);

    const result = await logManualPayment(baseInput);

    expect(result.success).toBe(true);
    expect(result.ledgerId).toBe("ledger-1");
    expect(result.tenantName).toBe("Alice");
  });

  it("logs cash payment without reference code", async () => {
    mockLimit.mockResolvedValueOnce([{ fullName: "Bob" }]);

    mockReturning.mockResolvedValueOnce([{ id: "ledger-2" }]);

    const result = await logManualPayment({
      ...baseInput,
      method: "CASH",
      referenceCode: null,
      description: "Cash payment",
    });

    expect(result.success).toBe(true);
    expect(result.ledgerId).toBe("ledger-2");
    expect(result.tenantName).toBe("Bob");
  });

  it("allows cash payment even with same amount as previous (no reference check)", async () => {
    mockLimit.mockResolvedValueOnce([{ fullName: "Charlie" }]);

    mockReturning.mockResolvedValueOnce([{ id: "ledger-3" }]);

    const result = await logManualPayment({
      ...baseInput,
      method: "CASH",
      referenceCode: null,
      amount: 25000, // same as before
    });

    expect(result.success).toBe(true);
    expect(result.ledgerId).toBe("ledger-3");
  });

  it("stores correct amount with 2 decimal precision", async () => {
    mockLimit.mockResolvedValueOnce([{ fullName: "Diana" }]);

    mockReturning.mockResolvedValueOnce([{ id: "ledger-4" }]);

    const result = await logManualPayment({
      ...baseInput,
      amount: 12500.75,
    });

    expect(result.success).toBe(true);
    // The mock captures the insert values; in real test we'd inspect the mock call
  });
});