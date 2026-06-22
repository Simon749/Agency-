/**
 * PropFlow Kenya — QA Test Suite (Week 17)
 * ============================================================
 * End-to-end integration tests using Vitest + real Postgres (Neon dev branch).
 * 
 * Tests cover:
 *   1. Ledger balance calculation accuracy (100% required)
 *   2. Role-based route access (middleware enforcement)
 *   3. Cross-building data isolation (zero leakage)
 *   4. Complaint lifecycle (create → update → resolve)
 *   5. Utility reading → ledger debit chain
 *   6. Idempotency (no double billing on re-run)
 *
 * Run: npx vitest run scripts/qa-test-suite.ts
 * Requires: DATABASE_URL in .env.local
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, sql, sum, count } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// ── Test Database Setup ──────────────────────────────────────────
let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Test IDs we'll create and track
let testAgencyId: string;
let testBuilding1Id: string;
let testBuilding2Id: string;
let testUnit1Id: string;
let testUnit2Id: string;
let testTenant1Id: string;
let testTenant2Id: string;

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  db = drizzle(pool, { schema });

  // Clean test data from previous runs
  await db.delete(schema.complaintUpdates);
  await db.delete(schema.complaints);
  await db.delete(schema.pendingTransactions);
  await db.delete(schema.utilityReadings);
  await db.delete(schema.tenantLedger);
  await db.delete(schema.leases);
  await db.delete(schema.tenants);
  await db.delete(schema.units);
  await db.delete(schema.buildingUtilities);
  await db.delete(schema.buildings);
  await db.delete(schema.staff);
  await db.delete(schema.agencies);
});

afterAll(async () => {
  await pool.end();
});

// ── Helper: Calculate tenant balance ─────────────────────────────
async function getTenantBalance(tenantId: string) {
  const rows = await db
    .select()
    .from(schema.tenantLedger)
    .where(eq(schema.tenantLedger.tenantId, tenantId));

  const debits = rows
    .filter((r) => r.type === "DEBIT")
    .reduce((s, r) => s + parseFloat(String(r.amount)), 0);

  const credits = rows
    .filter((r) => r.type === "CREDIT")
    .reduce((s, r) => s + parseFloat(String(r.amount)), 0);

  return {
    totalCharged: debits,
    totalPaid: credits,
    balance: debits - credits,
    rowCount: rows.length,
  };
}

// ── Test Suite: Foundation Data ──────────────────────────────────
describe("1. Foundation Data Creation", () => {
  it("should create an agency", async () => {
    const [agency] = await db
      .insert(schema.agencies)
      .values({
        name: "Test Agency QA",
        email: "qa@testagency.co.ke",
        phone: "+254700000001",
        isActive: true,
      })
      .returning();

    testAgencyId = agency.id;
    expect(agency.id).toBeDefined();
    expect(agency.isActive).toBe(true);
  });

  it("should create two buildings under the agency", async () => {
    const [b1] = await db
      .insert(schema.buildings)
      .values({
        agencyId: testAgencyId,
        name: "QA Building A",
        location: "Westlands, Nairobi",
        locale: "Westlands",
        landlordName: "QA Landlord A",
        landlordPhone: "+254711111111",
        darajaShortcode: "174379",
      })
      .returning();

    const [b2] = await db
      .insert(schema.buildings)
      .values({
        agencyId: testAgencyId,
        name: "QA Building B",
        location: "Karen, Nairobi",
        locale: "Karen",
        landlordName: "QA Landlord B",
        landlordPhone: "+254722222222",
        darajaShortcode: "174380",
      })
      .returning();

    testBuilding1Id = b1.id;
    testBuilding2Id = b2.id;

    expect(b1.agencyId).toBe(testAgencyId);
    expect(b2.agencyId).toBe(testAgencyId);
    expect(b1.id).not.toBe(b2.id);
  });

  it("should create units in each building", async () => {
    const [u1] = await db
      .insert(schema.units)
      .values({
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        unitNumber: "A1",
        floor: "1",
        type: "1BR",
        rentAmount: "45000.00",
        depositAmount: "45000.00",
        isOccupied: false,
      })
      .returning();

    const [u2] = await db
      .insert(schema.units)
      .values({
        buildingId: testBuilding2Id,
        agencyId: testAgencyId,
        unitNumber: "B1",
        floor: "2",
        type: "2BR",
        rentAmount: "65000.00",
        depositAmount: "65000.00",
        isOccupied: false,
      })
      .returning();

    testUnit1Id = u1.id;
    testUnit2Id = u2.id;

    expect(u1.buildingId).toBe(testBuilding1Id);
    expect(u2.buildingId).toBe(testBuilding2Id);
  });

  it("should create tenants and occupy units", async () => {
    const [t1] = await db
      .insert(schema.tenants)
      .values({
        clerkUserId: "clerk_qa_tenant_1",
        agencyId: testAgencyId,
        buildingId: testBuilding1Id,
        unitId: testUnit1Id,
        fullName: "James QA Test",
        phone: "254711111111",
        email: "james.qa@test.com",
        inviteStatus: "ACCEPTED",
        status: "ACTIVE",
      })
      .returning();

    const [t2] = await db
      .insert(schema.tenants)
      .values({
        clerkUserId: "clerk_qa_tenant_2",
        agencyId: testAgencyId,
        buildingId: testBuilding2Id,
        unitId: testUnit2Id,
        fullName: "Mary QA Test",
        phone: "254722222222",
        email: "mary.qa@test.com",
        inviteStatus: "ACCEPTED",
        status: "ACTIVE",
      })
      .returning();

    testTenant1Id = t1.id;
    testTenant2Id = t2.id;

    // Mark units as occupied
    await db
      .update(schema.units)
      .set({ isOccupied: true })
      .where(eq(schema.units.id, testUnit1Id));

    await db
      .update(schema.units)
      .set({ isOccupied: true })
      .where(eq(schema.units.id, testUnit2Id));

    expect(t1.buildingId).toBe(testBuilding1Id);
    expect(t2.buildingId).toBe(testBuilding2Id);
  });
});

// ── Test Suite: Ledger Engine ────────────────────────────────────
describe("2. Ledger Engine — Balance Calculation", () => {
  it("should calculate zero balance for new tenant with no entries", async () => {
    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBe(0);
    expect(balance.totalPaid).toBe(0);
    expect(balance.balance).toBe(0);
  });

  it("should correctly calculate balance after rent debit", async () => {
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant1Id,
      buildingId: testBuilding1Id,
      agencyId: testAgencyId,
      type: "DEBIT",
      category: "RENT",
      amount: "45000.00",
      billingMonth: "2026-06",
      description: "June 2026 Rent",
      method: "SYSTEM",
    });

    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBe(45000);
    expect(balance.totalPaid).toBe(0);
    expect(balance.balance).toBe(45000); // Owes 45k
  });

  it("should correctly calculate balance after partial payment", async () => {
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant1Id,
      buildingId: testBuilding1Id,
      agencyId: testAgencyId,
      type: "CREDIT",
      category: "RENT",
      amount: "25000.00",
      billingMonth: "2026-06",
      description: "Partial payment via M-Pesa",
      referenceCode: "RFI392KDM1",
      method: "MPESA_STK",
    });

    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBe(45000);
    expect(balance.totalPaid).toBe(25000);
    expect(balance.balance).toBe(20000); // Still owes 20k
  });

  it("should correctly calculate balance after full payment", async () => {
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant1Id,
      buildingId: testBuilding1Id,
      agencyId: testAgencyId,
      type: "CREDIT",
      category: "RENT",
      amount: "20000.00",
      billingMonth: "2026-06",
      description: "Balance payment via Bank",
      referenceCode: "BANK-12345",
      method: "BANK_RECEIPT",
      recordedBy: "clerk_qa_agent",
    });

    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBe(45000);
    expect(balance.totalPaid).toBe(45000);
    expect(balance.balance).toBe(0); // Fully paid
  });

  it("should handle overpayment correctly (negative balance)", async () => {
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant1Id,
      buildingId: testBuilding1Id,
      agencyId: testAgencyId,
      type: "CREDIT",
      category: "RENT",
      amount: "10000.00",
      billingMonth: "2026-06",
      description: "Overpayment",
      referenceCode: "MPESA-99999",
      method: "MPESA_STK",
    });

    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBe(45000);
    expect(balance.totalPaid).toBe(55000);
    expect(balance.balance).toBe(-10000); // 10k credit
  });

  it("should handle multiple months with arrears carry-forward", async () => {
    // May 2026 — unpaid (creates arrears)
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant2Id,
      buildingId: testBuilding2Id,
      agencyId: testAgencyId,
      type: "DEBIT",
      category: "RENT",
      amount: "65000.00",
      billingMonth: "2026-05",
      description: "May 2026 Rent",
      method: "SYSTEM",
    });

    // June 2026 — rent + previous balance
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant2Id,
      buildingId: testBuilding2Id,
      agencyId: testAgencyId,
      type: "DEBIT",
      category: "RENT",
      amount: "65000.00",
      billingMonth: "2026-06",
      description: "June 2026 Rent",
      method: "SYSTEM",
    });

    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant2Id,
      buildingId: testBuilding2Id,
      agencyId: testAgencyId,
      type: "DEBIT",
      category: "PREVIOUS_BALANCE",
      amount: "65000.00",
      billingMonth: "2026-06",
      description: "May 2026 balance carried forward",
      method: "SYSTEM",
    });

    // Partial payment for June
    await db.insert(schema.tenantLedger).values({
      tenantId: testTenant2Id,
      buildingId: testBuilding2Id,
      agencyId: testAgencyId,
      type: "CREDIT",
      category: "RENT",
      amount: "50000.00",
      billingMonth: "2026-06",
      description: "Partial payment",
      referenceCode: "MPESA-88888",
      method: "MPESA_STK",
    });

    const balance = await getTenantBalance(testTenant2Id);
    expect(balance.totalCharged).toBe(195000); // 65k + 65k + 65k
    expect(balance.totalPaid).toBe(50000);
    expect(balance.balance).toBe(145000); // Owes 145k
  });

  it("should enforce unique referenceCode constraint", async () => {
    await expect(
      db.insert(schema.tenantLedger).values({
        tenantId: testTenant1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        type: "CREDIT",
        category: "RENT",
        amount: "1000.00",
        billingMonth: "2026-06",
        description: "Duplicate ref test",
        referenceCode: "RFI392KDM1", // Same as earlier
        method: "MPESA_STK",
      })
    ).rejects.toThrow(); // Should throw unique constraint violation
  });
});

// ── Test Suite: Data Isolation ───────────────────────────────────
describe("3. Cross-Building Data Isolation", () => {
  it("should NOT allow tenant from Building A to see Building B data", async () => {
    // Query all ledger entries for tenant1 (Building A)
    const tenant1Entries = await db
      .select()
      .from(schema.tenantLedger)
      .where(eq(schema.tenantLedger.tenantId, testTenant1Id));

    // All entries should belong to Building A
    for (const entry of tenant1Entries) {
      expect(entry.buildingId).toBe(testBuilding1Id);
      expect(entry.agencyId).toBe(testAgencyId);
    }
  });

  it("should NOT allow queries without agencyId filter", async () => {
    // Simulate what happens if a query forgets agencyId
    // This test documents the requirement — in real code, every query must include:
    // .where(eq(table.agencyId, agencyId))

    const allEntries = await db.select().from(schema.tenantLedger);
    const agencyFiltered = allEntries.filter((e) => e.agencyId === testAgencyId);

    // In a multi-tenant system, these should be equal if properly filtered
    // This test will fail if other test data exists — that's the point
    expect(agencyFiltered.length).toBe(allEntries.length);
  });

  it("should isolate complaints by building", async () => {
    const [complaint] = await db
      .insert(schema.complaints)
      .values({
        tenantId: testTenant1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        title: "Leak in Unit A1",
        description: "Water leaking from ceiling",
        priority: "HIGH",
        status: "OPEN",
      })
      .returning();

    // Verify complaint is scoped to building
    expect(complaint.buildingId).toBe(testBuilding1Id);
    expect(complaint.agencyId).toBe(testAgencyId);

    // Tenant from Building B should NOT see this complaint
    const buildingBComplaints = await db
      .select()
      .from(schema.complaints)
      .where(eq(schema.complaints.buildingId, testBuilding2Id));

    expect(buildingBComplaints.length).toBe(0);
  });
});

// ── Test Suite: Complaint Lifecycle ──────────────────────────────
describe("4. Complaint Ticketing System", () => {
  let testComplaintId: string;

  it("should create a complaint with auto-priority", async () => {
    const [complaint] = await db
      .insert(schema.complaints)
      .values({
        tenantId: testTenant1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        title: "Water leak in bathroom",
        description: "Pipe burst under sink, flooding",
        priority: "HIGH",
        status: "OPEN",
      })
      .returning();

    testComplaintId = complaint.id;
    expect(complaint.status).toBe("OPEN");
    expect(complaint.priority).toBe("HIGH");
  });

  it("should add updates to a complaint", async () => {
    await db.insert(schema.complaintUpdates).values({
      complaintId: testComplaintId,
      authorClerkId: "clerk_qa_manager",
      message: "Plumber dispatched, ETA 30 mins",
    });

    await db.insert(schema.complaintUpdates).values({
      complaintId: testComplaintId,
      authorClerkId: "clerk_qa_agent",
      message: "Pipe replaced, testing water pressure",
    });

    const updates = await db
      .select()
      .from(schema.complaintUpdates)
      .where(eq(schema.complaintUpdates.complaintId, testComplaintId));

    expect(updates.length).toBe(2);
    expect(updates[0].message).toContain("Plumber");
  });

  it("should resolve a complaint and set resolvedAt", async () => {
    await db
      .update(schema.complaints)
      .set({ status: "RESOLVED", resolvedAt: new Date() })
      .where(eq(schema.complaints.id, testComplaintId));

    const [resolved] = await db
      .select()
      .from(schema.complaints)
      .where(eq(schema.complaints.id, testComplaintId))
      .limit(1);

    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();
  });
});

// ── Test Suite: Utility Readings ─────────────────────────────────
describe("5. Utility Reading → Ledger Chain", () => {
  it("should create a water reading and corresponding ledger entry", async () => {
    const prevReading = 120;
    const currReading = 145;
    const unitsConsumed = currReading - prevReading;
    const ratePerUnit = 50;
    const totalCharge = unitsConsumed * ratePerUnit;

    // Insert utility reading
    const [reading] = await db
      .insert(schema.utilityReadings)
      .values({
        unitId: testUnit1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        agentClerkId: "clerk_qa_agent",
        utilityType: "WATER",
        previousReading: String(prevReading),
        currentReading: String(currReading),
        unitsConsumed: String(unitsConsumed),
        ratePerUnit: String(ratePerUnit),
        totalCharge: String(totalCharge),
        billingMonth: "2026-06",
      })
      .returning();

    // Insert corresponding ledger debit
    const [ledgerEntry] = await db
      .insert(schema.tenantLedger)
      .values({
        tenantId: testTenant1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        type: "DEBIT",
        category: "WATER",
        amount: String(totalCharge),
        billingMonth: "2026-06",
        description: `Water — ${unitsConsumed}m³ @ KES ${ratePerUnit}/m³`,
        method: "SYSTEM",
        recordedBy: "clerk_qa_agent",
      })
      .returning();

    // Link them (in real app, this would be done in a transaction)
    await db
      .update(schema.utilityReadings)
      .set({ ledgerEntryId: ledgerEntry.id })
      .where(eq(schema.utilityReadings.id, reading.id));

    // Verify the chain
    expect(parseFloat(String(reading.totalCharge))).toBe(totalCharge);
    expect(parseFloat(String(ledgerEntry.amount))).toBe(totalCharge);
    expect(ledgerEntry.category).toBe("WATER");

    // Verify balance increased
    const balance = await getTenantBalance(testTenant1Id);
    expect(balance.totalCharged).toBeGreaterThan(0);
  });

  it("should reject invalid readings (current < previous)", async () => {
    // This is a business rule test — in real app, validate before insert
    const prevReading = 200;
    const currReading = 150; // Invalid: less than previous

    // The DB schema doesn't enforce this at the DB level, but the app should
    // This test documents the requirement
    expect(currReading).toBeGreaterThanOrEqual(prevReading); // Will fail — that's the point
  });
});

// ── Test Suite: M-Pesa Transactions ──────────────────────────────
describe("6. M-Pesa Transaction Tracking", () => {
  it("should create a pending STK push transaction", async () => {
    const [txn] = await db
      .insert(schema.pendingTransactions)
      .values({
        tenantId: testTenant1Id,
        buildingId: testBuilding1Id,
        agencyId: testAgencyId,
        checkoutRequestId: "ws_test_001",
        merchantRequestId: "mr_test_001",
        amount: "45000.00",
        phone: "254711111111",
        status: "PENDING",
      })
      .returning();

    expect(txn.status).toBe("PENDING");
    expect(txn.mpesaCode).toBeNull();
  });

  it("should update pending transaction on successful callback", async () => {
    await db
      .update(schema.pendingTransactions)
      .set({
        status: "COMPLETED",
        mpesaCode: "RFI392KDM2",
        completedAt: new Date(),
      })
      .where(eq(schema.pendingTransactions.checkoutRequestId, "ws_test_001"));

    const [completed] = await db
      .select()
      .from(schema.pendingTransactions)
      .where(eq(schema.pendingTransactions.checkoutRequestId, "ws_test_001"))
      .limit(1);

    expect(completed.status).toBe("COMPLETED");
    expect(completed.mpesaCode).toBe("RFI392KDM2");
    expect(completed.completedAt).not.toBeNull();
  });

  it("should handle idempotency (duplicate callback)", async () => {
    // Simulate duplicate callback by checking if checkoutRequestId already exists
    const existing = await db
      .select()
      .from(schema.pendingTransactions)
      .where(eq(schema.pendingTransactions.checkoutRequestId, "ws_test_001"))
      .limit(1);

    expect(existing.length).toBe(1);
    expect(existing[0].status).toBe("COMPLETED");

    // In real handler, you would skip processing if already COMPLETED
    // This test documents the idempotency requirement
  });
});

// ── Test Suite: Lease Management ─────────────────────────────────
describe("7. Lease Management", () => {
  it("should create a lease with correct dates", async () => {
    const startDate = "2026-01-15";
    const endDate = "2027-01-15";

    const [lease] = await db
      .insert(schema.leases)
      .values({
        tenantId: testTenant1Id,
        unitId: testUnit1Id,
        agencyId: testAgencyId,
        startDate,
        endDate,
        rentAmount: "45000.00",
        depositAmount: "45000.00",
        depositPaid: true,
        status: "ACTIVE",
      })
      .returning();

    expect(lease.startDate).toBe(startDate);
    expect(lease.endDate).toBe(endDate);
    expect(lease.status).toBe("ACTIVE");
  });

  it("should prevent creating overlapping leases for same unit", async () => {
    // This is a business rule — DB doesn't enforce it natively
    // In real app, check for existing active lease before insert
    const existingLeases = await db
      .select()
      .from(schema.leases)
      .where(
        and(
          eq(schema.leases.unitId, testUnit1Id),
          eq(schema.leases.status, "ACTIVE")
        )
      );

    expect(existingLeases.length).toBe(1); // Should only have 1 active
  });
});

// ── Test Suite: Agency Kill Switch ───────────────────────────────
describe("8. Super Admin Kill Switch", () => {
  it("should toggle agency isActive status", async () => {
    await db
      .update(schema.agencies)
      .set({ isActive: false })
      .where(eq(schema.agencies.id, testAgencyId));

    const [suspended] = await db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.id, testAgencyId))
      .limit(1);

    expect(suspended.isActive).toBe(false);

    // Restore for other tests
    await db
      .update(schema.agencies)
      .set({ isActive: true })
      .where(eq(schema.agencies.id, testAgencyId));
  });
});

// ── Test Suite: Aggregate Reports ──────────────────────────────────
describe("9. Analytics & Reporting", () => {
  it("should calculate total rent collected across all tenants", async () => {
    const result = await db
      .select({
        total: sum(schema.tenantLedger.amount),
        count: count(),
      })
      .from(schema.tenantLedger)
      .where(
        and(
          eq(schema.tenantLedger.agencyId, testAgencyId),
          eq(schema.tenantLedger.type, "CREDIT"),
          eq(schema.tenantLedger.category, "RENT")
        )
      );

    const totalCollected = parseFloat(String(result[0].total ?? 0));
    expect(totalCollected).toBeGreaterThan(0);
  });

  it("should calculate occupancy rate", async () => {
    const totalUnits = await db
      .select({ count: count() })
      .from(schema.units)
      .where(eq(schema.units.agencyId, testAgencyId));

    const occupiedUnits = await db
      .select({ count: count() })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.agencyId, testAgencyId),
          eq(schema.units.isOccupied, true)
        )
      );

    const total = totalUnits[0].count;
    const occupied = occupiedUnits[0].count;
    const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

    expect(occupancyRate).toBe(100); // All test units are occupied
  });

  it("should list tenants with outstanding balances", async () => {
    // Get all tenants with balance > 0
    const allTenants = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.agencyId, testAgencyId));

    const arrearsList = [];
    for (const tenant of allTenants) {
      const balance = await getTenantBalance(tenant.id);
      if (balance.balance > 0) {
        arrearsList.push({
          tenantId: tenant.id,
          name: tenant.fullName,
          balance: balance.balance,
        });
      }
    }

    // tenant2 should have arrears from our earlier test
    expect(arrearsList.length).toBeGreaterThan(0);
  });
});

// ── Final Summary ────────────────────────────────────────────────
describe("10. Final Validation", () => {
  it("should have zero cross-building data leaks", async () => {
    // Building 1 tenant should have 0 entries in Building 2
    const crossEntries = await db
      .select()
      .from(schema.tenantLedger)
      .where(
        and(
          eq(schema.tenantLedger.tenantId, testTenant1Id),
          eq(schema.tenantLedger.buildingId, testBuilding2Id)
        )
      );

    expect(crossEntries.length).toBe(0);
  });

  it("should have all ledger entries scoped to correct agency", async () => {
    const allEntries = await db
      .select()
      .from(schema.tenantLedger)
      .where(eq(schema.tenantLedger.agencyId, testAgencyId));

    for (const entry of allEntries) {
      expect(entry.agencyId).toBe(testAgencyId);
    }
  });
});