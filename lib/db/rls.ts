import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, NeonDatabase } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import { auth } from "@clerk/nextjs/server";
import * as schema from "@/db/schema";

neonConfig.webSocketConstructor = ws;

const fullSchema = schema;
const SUPER_ADMIN_SENTINEL = "00000000-0000-0000-0000-000000000000";

interface RlsContext {
  agencyId: string | null;
  role: string | null;
  userId: string | null;
}

async function getRlsContext(): Promise<RlsContext> {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId || !sessionClaims) {
      return { agencyId: null, role: null, userId: null };
    }
    const meta = (sessionClaims.publicMetadata ?? {}) as Record<string, string>;
    return { userId, role: meta.role ?? null, agencyId: meta.agencyId ?? null };
  } catch {
    return { agencyId: null, role: null, userId: null };
  }
}



/**
 * Core RLS wrapper.
 * 
 * Uses a dedicated single-connection pool (max: 1) to ensure
 * the SET app.current_agency_id persists for all queries in the callback.
 * 
 * With Neon serverless, pooled connections may switch between statements
 * in a transaction, causing SET LOCAL to be lost. A dedicated pool pins
 * the connection for the entire callback lifecycle.
 */
export async function withAgencyContext<T>(
  callback: (db: NeonDatabase<typeof fullSchema>) => Promise<T>
): Promise<T> {
  const ctx = await getRlsContext();
  if (!ctx.userId) throw new Error("[RLS] No authenticated user");

  let rlsAgencyId: string;
  if (ctx.role === "SUPER_ADMIN") rlsAgencyId = SUPER_ADMIN_SENTINEL;
  else if (ctx.agencyId) rlsAgencyId = ctx.agencyId;
  else throw new Error(`[RLS] User ${ctx.userId} has no agencyId`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("[RLS] DATABASE_URL not set");

  const pool = new Pool({ 
    connectionString: databaseUrl, 
    connectionTimeoutMillis: 10000, 
    max: 1 
  });
  const db = drizzle(pool, { schema: fullSchema });

  try {
    await db.execute(sql.raw(`SET app.current_agency_id = '${rlsAgencyId}'`));
    return await callback(db);
  } finally {
    await pool.end();
  }
}

/**
 * READ-OPTIMIZED variant: Uses the global pool.
 * 
 * ⚠️  WARNING: This uses SET LOCAL within a transaction, which may not
 * persist across connection switches in Neon's pooler. Only use for
 * non-critical reads. For financial operations, use withAgencyContext().
 */
export async function withAgencyContextRead<T>(
  callback: (db: NeonDatabase<typeof fullSchema>) => Promise<T>
): Promise<T> {
  const ctx = await getRlsContext();
  if (!ctx.userId) throw new Error("[RLS] No authenticated user");

  let rlsAgencyId: string;
  if (ctx.role === "SUPER_ADMIN") rlsAgencyId = SUPER_ADMIN_SENTINEL;
  else if (ctx.agencyId) rlsAgencyId = ctx.agencyId;
  else throw new Error(`[RLS] User ${ctx.userId} has no agencyId`);

  const { getDb } = await import("./index");
  const db = getDb();
  
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.current_agency_id = '${rlsAgencyId}'`));
    return callback(tx as unknown as NeonDatabase<typeof fullSchema>);
  });
}

export interface SuperAdminAuditMeta {
  action: string; targetTable: string; targetId?: string; reason: string;
}

export async function withSuperAdminContext<T>(
  callback: (db: NeonDatabase<typeof fullSchema>) => Promise<T>,
  auditMeta: SuperAdminAuditMeta
): Promise<T> {
  const ctx = await getRlsContext();
  if (ctx.role !== "SUPER_ADMIN") throw new Error(`[RLS] Super Admin access denied`);

  const { getDb } = await import("./index");
  const db = getDb();
  // schema.auditLog may be typed as a function in generated types; cast to any to satisfy Drizzle's insert signature
  await db.insert(schema.auditLog as unknown as any).values({
    actorClerkId: ctx.userId!, actorRole: "SUPER_ADMIN", agencyId: null,
    action: auditMeta.action, targetTable: auditMeta.targetTable,
    targetId: auditMeta.targetId ?? null, beforeValue: null,
    afterValue: { reason: auditMeta.reason, timestamp: new Date().toISOString() },
    ipAddress: null, userAgent: null,
  });
  return withAgencyContext(callback);
}