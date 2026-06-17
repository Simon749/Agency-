/**
 * PropFlow Database Client
 *
 * This module exports a typed Drizzle ORM instance for PostgreSQL.
 * Use this for all database queries in Server Actions and API routes.
 *
 * The `db` instance is lazy-initialized on first call to `getDb()`.
 * All PropFlow tables are registered in the schema for type-safe queries.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (!instance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Please configure it in your .env file.",
      );
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });

    instance = drizzle(pool, { schema: fullSchema });
  }
  return instance;
}

// ── Convenience exports ────────────────────────────────────────────

export { schema, relations, fullSchema };

// Re-export all table types for easy access
export type {
  Agency,
  InsertAgency,
  Building,
  InsertBuilding,
  BuildingUtility,
  InsertBuildingUtility,
  Unit,
  InsertUnit,
  Tenant,
  InsertTenant,
  Lease,
  InsertLease,
  TenantLedgerEntry,
  InsertTenantLedgerEntry,
  UtilityReading,
  InsertUtilityReading,
  PendingTransaction,
  InsertPendingTransaction,
  Complaint,
  InsertComplaint,
  ComplaintUpdate,
  InsertComplaintUpdate,
} from "@/db/schema";