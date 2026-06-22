/**
 * PropFlow Database Client
 *
 * FIX: Added proper connection pool settings.
 * Previously the pool had no limits, causing slow cold connections
 * and unbounded pool growth under load.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (!instance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set. Please configure it in your .env file.');
    }

    const pool = new Pool({
      connectionString: databaseUrl,

      // ── Pool tuning (FIX) ────────────────────────────────────────────────
      max: 10,                    // max open connections (default was unlimited)
      idleTimeoutMillis: 30_000,  // close idle connections after 30s
      connectionTimeoutMillis: 5_000, // fail fast if can't get a connection in 5s

      // ── SSL (FIX: use verify-full to silence the deprecation warning) ────
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }  // verify-full equivalent
        : undefined,
    });

    // Log pool errors so they don't silently swallow exceptions
    pool.on('error', (err) => {
      console.error('[DB Pool] Unexpected error on idle client:', err);
    });

    instance = drizzle(pool, { schema: fullSchema });
  }
  return instance;
}

// ── Convenience exports ────────────────────────────────────────────
export { schema, relations, fullSchema };

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
  Staff,
  InsertStaff,
} from '@/db/schema';