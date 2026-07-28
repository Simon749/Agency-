import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aggregatorAccounts, tenants, buildings } from "@/db/schema";

export interface AggregatorResolution {
  tenantId: string;
  buildingId: string;
  agencyId: string;
  isActive: boolean;
  clerkUserId: string | null; // <-- nullable because aggregatorAccounts may not store it
}

export async function resolveAggregatorPayment(
  accountReference: string,
  aggregatorShortcode: string
): Promise<AggregatorResolution | null> {
  const db = getDb();

  // 1. Exact match on short account reference (manual paybill)
  const [account] = await db
    .select()
    .from(aggregatorAccounts)
    .where(eq(aggregatorAccounts.accountReference, accountReference))
    .limit(1);

  if (account && account.aggregatorShortcode === aggregatorShortcode) {
    // Look up the tenant to get their clerkUserId
    const [tenant] = await db
      .select({ clerkUserId: tenants.clerkUserId })
      .from(tenants)
      .where(eq(tenants.id, account.tenantId))
      .limit(1);

    return {
      tenantId: account.tenantId,
      buildingId: account.buildingId,
      agencyId: account.agencyId,
      isActive: account.isActive,
      clerkUserId: tenant?.clerkUserId ?? null,
    };
  }

  // 2. Fallback: match by tenantId (STK Push where tenantId is used directly)
  const [tenant] = await db
    .select({
      id: tenants.id,
      buildingId: tenants.buildingId,
      agencyId: tenants.agencyId,
      status: tenants.status,
      clerkUserId: tenants.clerkUserId,
    })
    .from(tenants)
    .where(eq(tenants.id, accountReference))
    .limit(1);

  if (tenant) {
    // Verify the building does NOT have its own shortcode
    const [building] = await db
      .select({
        agencyId: buildings.agencyId,
        darajaShortcode: buildings.darajaShortcode,
      })
      .from(buildings)
      .where(eq(buildings.id, tenant.buildingId))
      .limit(1);

    // If building has its own shortcode, this payment should not hit aggregator
    if (building?.darajaShortcode) {
      return null;
    }

    return {
      tenantId: tenant.id,
      buildingId: tenant.buildingId,
      agencyId: tenant.agencyId,
      isActive: tenant.status !== "VACATED",
      clerkUserId: tenant.clerkUserId,
    };
  }

  return null;
}