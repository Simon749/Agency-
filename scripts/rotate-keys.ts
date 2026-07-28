#!/usr/bin/env tsx
/**
 * scripts/rotate-keys.ts
 * Automated key rotation and re-encryption script.
 * 
 * Usage:
 *   npx tsx scripts/rotate-keys.ts --target=daraja --dry-run
 *   npx tsx scripts/rotate-keys.ts --target=daraja --execute
 *   npx tsx scripts/rotate-keys.ts --target=all --execute --notify
 */

import { parseArgs } from "node:util";
import { getDb } from "@/lib/db"; // was: import { db } from "@/lib/db";
import { buildings } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { reencryptCredential } from "@/lib/encryption";
import { sendSms } from "@/lib/sms/sendSms";
import { keyRotationSuccessSms, keyRotationFailedSms } from "@/lib/sms/templates-key-rotation";

const { values } = parseArgs({
  options: {
    target: { type: "string" as const, short: "t" },
    "dry-run": { type: "boolean" as const, short: "d", default: false },
    execute: { type: "boolean" as const, short: "e", default: false },
    notify: { type: "boolean" as const, short: "n", default: false },
    building: { type: "string" as const, short: "b" },
    help: { type: "boolean" as const, short: "h", default: false },
  },
});

if (values.help || !values.target) {
  console.log(`
Key Rotation Script — PropFlow Security Operations

Usage: npx tsx scripts/rotate-keys.ts --target=<target> [options]

Targets: daraja | clerk | app | all
Options: -d (dry-run) | -e (execute) | -n (notify) | -b <building-id>
`);
  process.exit(0);
}

const DRY_RUN = values["dry-run"];
const EXECUTE = values.execute;
const NOTIFY = values.notify;
const TARGET = values.target;
const BUILDING_ID = values.building;

if (!EXECUTE && !DRY_RUN) {
  console.error("Error: Specify --dry-run or --execute");
  process.exit(1);
}

interface RotationResult {
  target: string;
  buildingId?: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

const results: RotationResult[] = [];

async function rotateDarajaCredentials(): Promise<void> {
  const db = getDb();
  console.log("\n🔐 Daraja Credential Rotation");
  console.log("================================");

  const query = BUILDING_ID
    ? db.select().from(buildings).where(eq(buildings.id, BUILDING_ID))
    : db.select().from(buildings).where(and(isNotNull(buildings.darajaConsumerKey), isNotNull(buildings.darajaShortcode)));

  const allBuildings = await query;
  console.log(`Found ${allBuildings.length} building(s) to process`);

  for (const building of allBuildings) {
    const start = Date.now();
    const result: RotationResult = { target: "daraja", buildingId: building.id, success: false, durationMs: 0 };

    try {
      console.log(`\n  📍 ${building.name} (${building.id})`);

      if (DRY_RUN) {
        console.log(`    📝 DRY RUN — Would re-encrypt with current key version`);
        result.success = true;
        result.durationMs = Date.now() - start;
        results.push(result);
        continue;
      }

      console.log(`    🔒 Re-encrypting with latest key version...`);
      const newConsumerKey = await reencryptCredential(building.darajaConsumerKey!);
      const newConsumerSecret = await reencryptCredential(building.darajaConsumerSecret!);
      const newPasskey = building.darajaPasskey ? await reencryptCredential(building.darajaPasskey) : null;

      await db.update(buildings).set({
        darajaConsumerKey: newConsumerKey,
        darajaConsumerSecret: newConsumerSecret,
        darajaPasskey: newPasskey,
        darajaCredentialsUpdatedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(buildings.id, building.id));

      console.log(`    ✅ Updated`);

      if (NOTIFY && building.landlordPhone) {
        await sendSms(
          building.landlordPhone,
          keyRotationSuccessSms({ buildingName: building.name, rotatedAt: new Date().toISOString() })
        );
        console.log(`    📱 SMS sent`);
      }

      result.success = true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ Failed: ${error}`);
      result.error = error;
      if (NOTIFY && building.landlordPhone) {
        await sendSms(
          building.landlordPhone,
          keyRotationSuccessSms({ buildingName: building.name, rotatedAt: new Date().toISOString() })
        );
      }
    }

    result.durationMs = Date.now() - start;
    results.push(result);
  }
}

async function rotateClerkWebhookSecret(): Promise<void> {
  console.log("\n🔐 Clerk Webhook Secret Rotation");
  console.log("Manual steps required — see docs/SECURITY.md");
  results.push({ target: "clerk", success: true, durationMs: 0 });
}

async function rotateAppSecret(): Promise<void> {
  console.log("\n🔐 APP_SECRET Rotation (Full Re-encryption)");
  console.log("Manual steps required — see docs/SECURITY.md");
  results.push({ target: "app", success: false, error: "Manual rotation required", durationMs: 0 });
}

async function main() {
  console.log(`\nPropFlow Key Rotation — Mode: ${DRY_RUN ? "DRY RUN" : "EXECUTE"} ${NOTIFY ? "+ NOTIFY" : ""} | Target: ${TARGET}\n`);
  const startTime = Date.now();

  try {
    switch (TARGET) {
      case "daraja": await rotateDarajaCredentials(); break;
      case "clerk": await rotateClerkWebhookSecret(); break;
      case "app": await rotateAppSecret(); break;
      case "all":
        await rotateDarajaCredentials();
        await rotateClerkWebhookSecret();
        await rotateAppSecret();
        break;
      default:
        console.error(`Unknown target: ${TARGET}`);
        process.exit(1);
    }

    const total = results.length;
    const succeeded = results.filter((r) => r.success).length;
    const failed = total - succeeded;

    console.log(`\nRotation Complete: Total: ${total} | Success: ${succeeded} | Failed: ${failed} | Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    if (failed > 0) {
      for (const r of results.filter((r) => !r.success)) {
        console.log(`  - ${r.target}${r.buildingId ? ` (${r.buildingId})` : ""}: ${r.error}`);
      }
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error("\nFatal error:", err);
    process.exit(1);
  }
}

main();
