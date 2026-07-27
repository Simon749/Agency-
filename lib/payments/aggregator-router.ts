import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aggregatorAccounts, tenants, buildings } from "@/db/schema";

export interface AggregatorResolution {
  tenantId: string;
  buildingId: string;
  agencyId: string;
  isActive: boolean;
}

export async function resolveAggregatorPayment(
  accountReference: string,
  aggregatorShortcode: string
): Promise<AggregatorResolution | null> {
  const db = getDb();
  
  // First try exact match on accountReference (short code for manual paybill)
  const [account] = await db
    .select()
    .from(aggregatorAccounts)
    .where(
      eq(aggregatorAccounts.accountReference, accountReference)
    )
    .limit(1);

  if (account && account.aggregatorShortcode === aggregatorShortcode) {
    return {
      tenantId: account.tenantId,
      buildingId: account.buildingId,
      agencyId: account.agencyId,
      isActive: account.isActive,
    };
  }

  // Fallback: try matching by tenantId (for STK Push where tenantId is used directly)
  // This handles cases where AccountReference = tenantId
  const [tenant] = await db
    .select({
      id: tenants.id,
      buildingId: tenants.buildingId,
      agencyId: tenants.agencyId,
      status: tenants.status,
    })
    .from(tenants)
    .where(eq(tenants.id, accountReference))
    .limit(1);

  if (tenant) {
    // Verify the building uses this aggregator shortcode
    const [building] = await db
      .select({
        agencyId: buildings.agencyId,
        darajaShortcode: buildings.darajaShortcode,
      })
      .from(buildings)
      .where(eq(buildings.id, tenant.buildingId))
      .limit(1);

    // If building has its own shortcode, this shouldn't hit aggregator
    if (building?.darajaShortcode) {
      return null;
    }

    return {
      tenantId: tenant.id,
      buildingId: tenant.buildingId,
      agencyId: tenant.agencyId,
      isActive: tenant.status !== "VACATED",
    };
  }

  return null;
}