// scripts/check-user-metadata.ts
// Run with: npx tsx scripts/check-user-metadata.ts
//
// This script checks all users in your Clerk instance for missing
// agencyId, buildingId, or unitId in their publicMetadata.
// It also provides a helper to fix missing metadata.

import { clerkClient } from "@clerk/nextjs/server";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error("❌ CLERK_SECRET_KEY is not set in environment");
  process.exit(1);
}

async function checkAllUsers() {
  console.log("🔍 Fetching all users from Clerk...\n");

  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 100 });

  console.log(`Found ${users.data.length} users\n`);
  console.log("═".repeat(80));

  const issues: Array<{
    id: string;
    email: string;
    role: string | null;
    agencyId: string | null;
    buildingId: string | null;
    unitId: string | null;
    missing: string[];
  }> = [];

  for (const user of users.data) {
    const meta = user.publicMetadata as Record<string, unknown>;
    const role = (meta.role as string) || null;
    const agencyId = (meta.agencyId as string) || null;
    const buildingId = (meta.buildingId as string) || null;
    const unitId = (meta.unitId as string) || null;

    const missing: string[] = [];
    if (!role) missing.push("role");
    if (role && role !== "SUPER_ADMIN" && !agencyId) missing.push("agencyId");
    if (role === "TENANT" && !buildingId) missing.push("buildingId");
    if (role === "TENANT" && !unitId) missing.push("unitId");

    const email = user.emailAddresses[0]?.emailAddress || "no-email";

    if (missing.length > 0) {
      issues.push({ id: user.id, email, role, agencyId, buildingId, unitId, missing });
    }

    // Print summary for every user
    const status = missing.length > 0 ? "⚠️  ISSUES" : "✅ OK";
    console.log(`\n${status} | ${email}`);
    console.log(`  ID:        ${user.id}`);
    console.log(`  Role:      ${role ?? "NOT SET"}`);
    console.log(`  AgencyID:  ${agencyId ?? "NOT SET"}`);
    console.log(`  BuildingID: ${buildingId ?? "NOT SET"}`);
    console.log(`  UnitID:    ${unitId ?? "NOT SET"}`);
    if (missing.length > 0) {
      console.log(`  ❌ Missing: ${missing.join(", ")}`);
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log(`\n📊 SUMMARY: ${issues.length} users with missing metadata`);

  if (issues.length > 0) {
    console.log("\n🔧 To fix a user, run:");
    console.log(`   npx tsx scripts/check-user-metadata.ts fix <userId> <agencyId>`);
    console.log("\n   Example:");
    console.log(`   npx tsx scripts/check-user-metadata.ts fix user_xxx agency_yyy`);
  }

  return issues;
}

async function fixUserMetadata(userId: string, agencyId: string) {
  console.log(`\n🔧 Fixing metadata for user: ${userId}`);
  console.log(`   Setting agencyId to: ${agencyId}\n`);

  const client = await clerkClient();

  try {
    const user = await client.users.getUser(userId);
    const currentMeta = user.publicMetadata as Record<string, unknown>;

    const newMeta = {
      ...currentMeta,
      agencyId,
    };

    await client.users.updateUser(userId, {
      publicMetadata: newMeta,
    });

    console.log("✅ Metadata updated successfully!");
    console.log("   New publicMetadata:", JSON.stringify(newMeta, null, 2));
    console.log("\n⚠️  IMPORTANT: The user must sign out and sign back in for");
    console.log("   the new metadata to appear in their session token.");
  } catch (err) {
    console.error("❌ Failed to update metadata:", err);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "fix" && args[1] && args[2]) {
    await fixUserMetadata(args[1], args[2]);
  } else {
    await checkAllUsers();
  }
}

main().catch(console.error);