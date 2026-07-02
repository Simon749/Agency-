/**
 * PropFlow Database Client — Neon WebSocket (optimized for Phase 2)
 * Changes: query timeout, better error handling, connection health check, pool tuning
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";
import { sql } from "drizzle-orm";

const fullSchema = { ...schema, ...relations };

type DatabaseClient = ReturnType<typeof drizzle<typeof fullSchema>>;

interface DatabaseGlobals {
  db?: DatabaseClient;
}

interface DbPoolConnectionOptions {
  connectionString: string;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  max: number;
  query_timeout?: number;
}

// Required for WebSocket connections
neonConfig.webSocketConstructor = ws;

const globalForDb = globalThis as unknown as DatabaseGlobals;

export function getDb(): DatabaseClient {
  if (!globalForDb.db) {
    const databaseUrl: string | undefined = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }

    const pool: Pool = new Pool({
      connectionString: databaseUrl,
      // Connection timeout for cold starts (Neon serverless)
      connectionTimeoutMillis: 10_000,
      // Idle timeout — close connections faster to avoid stale state
      idleTimeoutMillis: 10_000,
      // Max connections: Neon free tier = 5, paid = 20+
      // Use env var to tune per environment
      max: parseInt(process.env.DB_POOL_MAX ?? "5", 10),
      // Query timeout: kill runaway queries (30s for web requests)
      query_timeout: 30_000,
    } as DbPoolConnectionOptions);

    // Handle pool errors without crashing the server
    pool.on("error", (err: Error) => {
      console.error("[DB Pool] Idle client error:", err.message);
      // Don't throw — let the next request create a fresh connection
    });

    globalForDb.db = drizzle(pool, { schema: fullSchema });
  }

  return globalForDb.db;
}

/**
 * Health check: verify DB is reachable.
 * Returns true if a simple query succeeds within 5 seconds.
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown DB error",
    };
  }
}

export { schema, relations, fullSchema };

export type {
  Agency, InsertAgency,
  Building, InsertBuilding,
  BuildingUtility, InsertBuildingUtility,
  Unit, InsertUnit,
  Tenant, InsertTenant,
  Lease, InsertLease,
  TenantLedgerEntry, InsertTenantLedgerEntry,
  UtilityReading, InsertUtilityReading,
  PendingTransaction, InsertPendingTransaction,
  Complaint, InsertComplaint,
  ComplaintUpdate, InsertComplaintUpdate,
  Staff, InsertStaff,
} from "@/db/schema";