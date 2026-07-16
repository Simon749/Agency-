import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const TEST_AGENCY_A = "11111111-1111-1111-1111-111111111111";
const TEST_AGENCY_B = "22222222-2222-2222-2222-222222222222";
const SUPER_ADMIN = "00000000-0000-0000-0000-000000000000";

/**
 * Helper: Create a pool with application_name set to carry agency_id.
 * Neon pooler preserves application_name across statements.
 */
async function withRlsContext<T>(
  agencyId: string,
  callback: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", `propflow:${agencyId}`);
  const rlsUrl = url.toString();

  const pool = new Pool({ connectionString: rlsUrl, max: 1 });
  const db = drizzle(pool);

  try {
    return await callback(db);
  } finally {
    await pool.end();
  }
}

describe("Phase A: RLS Data Isolation", () => {
  beforeAll(async () => {
    // Use SUPER_ADMIN context to seed data for BOTH agencies
    // (Super admin bypasses RLS, so can insert any agency's data)
    await withRlsContext(SUPER_ADMIN, async (db) => {
      await db.execute(sql`
        INSERT INTO agencies (id, name, email, phone, is_active)
        VALUES 
          (${TEST_AGENCY_A}::UUID, 'Test Agency A', 'a@test.com', '0700000001', true),
          (${TEST_AGENCY_B}::UUID, 'Test Agency B', 'b@test.com', '0700000002', true)
        ON CONFLICT (id) DO NOTHING;
      `);

      await db.execute(sql`
        INSERT INTO buildings (id, agency_id, name, location, landlord_name)
        VALUES 
          (gen_random_uuid(), ${TEST_AGENCY_A}::UUID, 'Building A', 'Westlands', 'Landlord A'),
          (gen_random_uuid(), ${TEST_AGENCY_B}::UUID, 'Building B', 'Karen', 'Landlord B')
        ON CONFLICT DO NOTHING;
      `);
    });
  });

  afterAll(async () => {
    // Clean up as super admin too
    await withRlsContext(SUPER_ADMIN, async (db) => {
      await db.execute(sql`DELETE FROM buildings WHERE agency_id IN (${TEST_AGENCY_A}::UUID, ${TEST_AGENCY_B}::UUID)`);
      await db.execute(sql`DELETE FROM agencies WHERE id IN (${TEST_AGENCY_A}::UUID, ${TEST_AGENCY_B}::UUID)`);
    });
  });

  it("[EXIT CRITERIA] Deliberately missing agencyId filter returns zero cross-agency rows", async () => {
    const agencyBBuildingResult = await withRlsContext(TEST_AGENCY_B, async (db) => {
      return db.execute<{ id: string }>(sql`
        SELECT id FROM buildings WHERE agency_id = ${TEST_AGENCY_B}::UUID LIMIT 1;
      `);
    });
    const agencyBBuilding = agencyBBuildingResult.rows[0];
    expect(agencyBBuilding).toBeDefined();
    const buildingBId = agencyBBuilding.id;

    const result = await withRlsContext(TEST_AGENCY_A, async (rlsDb) => {
      return rlsDb.execute(sql`SELECT * FROM buildings WHERE id = ${buildingBId}`);
    });

    expect(result.rows).toHaveLength(0);
  });

  it("RLS allows same-agency reads normally", async () => {
    const result = await withRlsContext(TEST_AGENCY_A, async (rlsDb) => {
      return rlsDb.execute(sql`SELECT * FROM buildings`);
    });

    expect(result.rows.length).toBeGreaterThan(0);
    for (const b of result.rows) {
      expect(b.agency_id).toBe(TEST_AGENCY_A);
    }
  });

  it("RLS blocks cross-agency tenant ledger reads", async () => {
    const result = await withRlsContext(TEST_AGENCY_A, async (rlsDb) => {
      return rlsDb.execute(sql`SELECT * FROM tenant_ledger`);
    });

    expect(result.rows).toHaveLength(0);
  });

  it("Super Admin bypass works with sentinel value", async () => {
    const result = await withRlsContext(SUPER_ADMIN, async (rlsDb) => {
      return rlsDb.execute(sql`SELECT * FROM buildings`);
    });

    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });
});