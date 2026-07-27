import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings, aggregatorAccounts } from "@/db/schema";

export type PaybillStrategy = 
  | { type: "OWN"; buildingId: string; shortcode: string; passkey: string; consumerKey: string; consumerSecret: string }
  | { type: "AGGREGATOR"; aggregatorAccountId: string; accountReference: string; shortcode: string };

export async function getPaybillStrategy(
  buildingId: string,
  tenantId: string
): Promise<PaybillStrategy> {
  const db = getDb();
  
  const [building] = await db
    .select({
      id: buildings.id,
      agencyId: buildings.agencyId,
      darajaShortcode: buildings.darajaShortcode,
      darajaPasskey: buildings.darajaPasskey,
      darajaConsumerKey: buildings.darajaConsumerKey,
      darajaConsumerSecret: buildings.darajaConsumerSecret,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);

  if (!building) {
    throw new Error(`Building ${buildingId} not found`);
  }

  // If building has its own Daraja credentials, use them
  if (building.darajaShortcode && building.darajaPasskey && building.darajaConsumerKey && building.darajaConsumerSecret) {
    return {
      type: "OWN",
      buildingId: building.id,
      shortcode: building.darajaShortcode,
      passkey: building.darajaPasskey,
      consumerKey: building.darajaConsumerKey,
      consumerSecret: building.darajaConsumerSecret,
    };
  }

  // Otherwise, use the shared aggregator
  const [account] = await db
    .select()
    .from(aggregatorAccounts)
    .where(eq(aggregatorAccounts.tenantId, tenantId))
    .limit(1);

  if (!account) {
    throw new Error(`No aggregator account found for tenant ${tenantId}. Please contact support.`);
  }

  return {
    type: "AGGREGATOR",
    aggregatorAccountId: account.id,
    accountReference: account.accountReference,
    shortcode: account.aggregatorShortcode,
  };
}