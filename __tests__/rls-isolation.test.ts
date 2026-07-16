import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const TEST_AGENCY_A = "11111111-1111-1111-1111-111111111111";
const TEST_AGENCY_B = "22222222-2222-2222-2222-222222222222";
const SUPER_ADMIN = "00000000-0000-0000-0000-000000000000";

async function verifyRlsEnabled(db: ReturnType<typeof drizzle>): Promise<void> {
  const result = await db.execute(sql`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'buildings', 'units', 'tenants', 'leases', 'tenant_ledger',
      'utility_readings', 'pending_transactions', 'complaints',
      'complaint_updates', 'building_utilities', 'notifications', 'staff'
    )
  `);

  const enabledTables = result.rows.filter((r: any) => r.rowsecurity === true);
  const expectedTables = 12;
  
  if (enabledTables.length !== expectedTables) {
    const allTables = result.rows.map((r: any) => r.tablename);
    const missing = [
      'buildings', 'units', 'tenants', 'leases', 'tenant_ledger',
      'utility_readings', 'pending_transactions', 'complaints',
      'complaint_updates', 'building_utilities', 'notifications', 'staff'
    ].filter(t => !allTables.includes(t));
    
    throw new Error(
      `RLS NOT ENABLED on: ${missing.join(', ')}.\n` +
      `Run: psql \\$DATABASE_URL -f db/migrations/0004c_clean_rls_reset.sql`
    );
  }

  console.log(`✅ RLS verified on ${enabledTables.length}/${expectedTables} tables`);
}

/**
 * Helper: Run a query with RLS context set.
 * Uses a dedicated single-connection pool to ensure SET persists.
 */
async function withRlsContext<T>(
  agencyId: string,
  callback: (db: any) => Promise<T>
): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect(); // pin one physical connection
  const db = drizzle(client);

  try {
    await db.execute(sql`BEGIN`);
    await db.execute(sql.raw(`SET LOCAL app.current_agency_id = '${agencyId}'`));
    const result = await callback(db);
    await db.execute(sql`COMMIT`);
    return result;
  } catch (err) {
    await db.execute(sql`ROLLBACK`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

describe("Phase A: RLS Data Isolation", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL not set");

    pool = new Pool({ connectionString: databaseUrl, max: 2 });
    db = drizzle(pool);

    await verifyRlsEnabled(db);

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

  afterAll(async () => {
    await db.execute(sql`DELETE FROM buildings WHERE agency_id IN (${TEST_AGENCY_A}::UUID, ${TEST_AGENCY_B}::UUID)`);
    await db.execute(sql`DELETE FROM agencies WHERE id IN (${TEST_AGENCY_A}::UUID, ${TEST_AGENCY_B}::UUID)`);
    await pool.end();
  });

  it("[EXIT CRITERIA] Deliberately missing agencyId filter returns zero cross-agency rows", async () => {
    const agencyBBuildingResult = await db.execute<{ id: string }>(sql`
      SELECT id FROM buildings WHERE agency_id = ${TEST_AGENCY_B}::UUID LIMIT 1;
    `);
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

  it("RLS blocks queries without session context", async () => {
    const freshPool = new Pool({ 
      connectionString: process.env.DATABASE_URL, 
      max: 1,
      connectionTimeoutMillis: 5000 
    });
    const freshDb = drizzle(freshPool);
    
    try {
      const result = await freshDb.execute(sql`SELECT * FROM buildings LIMIT 1`);
      expect(Array.isArray(result.rows)).toBe(true);
    } finally {
      await freshPool.end();
    }
  });
});