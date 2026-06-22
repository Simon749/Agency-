/**
 * Vitest Setup — PropFlow QA Tests
 * Runs before each test file. Ensures clean DB state.
 */

import { beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

let pool: Pool;

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set — cannot run tests");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool, { schema });

  // Clean slate for tests
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

  console.log("🧹 Test database cleaned");
});

afterAll(async () => {
  if (pool) await pool.end();
});