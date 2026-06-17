// lib/ledger/__tests__/utilityBilling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLastReading, submitMeterReading } from "../utilityBilling";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: mockSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          orderBy: mockOrderBy.mockReturnValue({
            limit: mockLimit,
          }),
          limit: mockLimit,
        }),
      }),
    }),
    insert: mockInsert.mockReturnValue({
      values: mockValues.mockReturnValue({
        returning: mockReturning,
      }),
    }),
    update: mockUpdate.mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhere,
      }),
    }),
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: any, b: any) => ({ a, b }),
  and: (...conds: any[]) => ({ and: conds }),
  desc: (col: any) => ({ desc: col }),
  lte: (a: any, b: any) => ({ lte: [a, b] }),
}));

vi.mock("@/db/schema", () => ({
  utilityReadings: { id: "id", unitId: "unit_id", utilityType: "utility_type", billingMonth: "billing_month", currentReading: "current_reading", ratePerUnit: "rate_per_unit", ledgerEntryId: "ledger_entry_id", previousReading: "previous_reading", unitsConsumed: "units_consumed", totalCharge: "total_charge", agentClerkId: "agent_clerk_id", buildingId: "building_id", agencyId: "agency_id", createdAt: "created_at" },
  tenantLedger: { id: "id", tenantId: "tenant_id", buildingId: "building_id", agencyId: "agency_id", type: "type", category: "category", amount: "amount", description: "description", billingMonth: "billing_month", method: "method", recordedBy: "recorded_by" },
  units: { id: "id", unitNumber: "unit_number" },
  tenants: { id: "id", fullName: "full_name", unitId: "unit_id", buildingId: "building_id", agencyId: "agency_id", status: "status" },
  buildings: { id: "id" },
}));

describe("getLastReading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no previous reading exists", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await getLastReading("unit-1", "WATER");
    expect(result).toBeNull();
  });

  it("returns the most recent reading", async () => {
    mockLimit.mockResolvedValueOnce([{ currentReading: "1250.50", ratePerUnit: "45.00" }]);

    const result = await getLastReading("unit-1", "WATER");
    expect(result).toEqual({ currentReading: 1250.5, ratePerUnit: 45 });
  });
});

describe("submitMeterReading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when current reading is less than previous", async () => {
    await expect(
      submitMeterReading({
        unitId: "unit-1",
        buildingId: "bld-1",
        agencyId: "ag-1",
        agentClerkId: "agent-1",
        utilityType: "WATER",
        previousReading: 1000,
        currentReading: 900,
        ratePerUnit: 50,
        billingMonth: "2026-06",
      })
    ).rejects.toThrow("Current reading (900) cannot be less than previous reading (1000)");
  });

  it("throws when no active tenant in unit", async () => {
    mockLimit
      .mockResolvedValueOnce([]) // no tenant
      .mockResolvedValueOnce([{ unitNumber: "A1" }]);

    await expect(
      submitMeterReading({
        unitId: "unit-1",
        buildingId: "bld-1",
        agencyId: "ag-1",
        agentClerkId: "agent-1",
        utilityType: "WATER",
        previousReading: 1000,
        currentReading: 1100,
        ratePerUnit: 50,
        billingMonth: "2026-06",
      })
    ).rejects.toThrow("No active tenant found in this unit");
  });

  it("calculates charge and creates reading + ledger entry for new tenant", async () => {
    // tenant lookup
    mockLimit
      .mockResolvedValueOnce([{ id: "tenant-1", fullName: "Alice", unitId: "unit-1" }])
      .mockResolvedValueOnce([{ unitNumber: "A1" }])
      .mockResolvedValueOnce([]) // no existing reading
      .mockResolvedValueOnce([]); // no existing deposit (not relevant here)

    mockReturning
      .mockResolvedValueOnce([{ id: "reading-1" }]) // utility_readings insert
      .mockResolvedValueOnce([{ id: "ledger-1" }]); // tenant_ledger insert

    const result = await submitMeterReading({
      unitId: "unit-1",
      buildingId: "bld-1",
      agencyId: "ag-1",
      agentClerkId: "agent-1",
      utilityType: "WATER",
      previousReading: 1000,
      currentReading: 1125,
      ratePerUnit: 50,
      billingMonth: "2026-06",
    });

    expect(result.unitsConsumed).toBe(125);
    expect(result.totalCharge).toBe(6250);
    expect(result.tenantName).toBe("Alice");
    expect(result.unitNumber).toBe("A1");
    expect(result.readingId).toBe("reading-1");
    expect(result.ledgerEntryId).toBe("ledger-1");
  });

  it("updates existing reading when one exists for the month (idempotency)", async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: "tenant-1", fullName: "Alice", unitId: "unit-1" }])
      .mockResolvedValueOnce([{ unitNumber: "A1" }])
      .mockResolvedValueOnce([{ id: "existing-reading", ledgerEntryId: "existing-ledger" }]); // existing reading

    mockReturning.mockResolvedValueOnce([{ id: "updated-ledger" }]);

    const result = await submitMeterReading({
      unitId: "unit-1",
      buildingId: "bld-1",
      agencyId: "ag-1",
      agentClerkId: "agent-1",
      utilityType: "ELECTRICITY",
      previousReading: 500,
      currentReading: 750,
      ratePerUnit: 25,
      billingMonth: "2026-06",
    });

    expect(result.unitsConsumed).toBe(250);
    expect(result.totalCharge).toBe(6250);
    expect(result.readingId).toBe("existing-reading");
  });
});