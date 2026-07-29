// app/api/mfa/setup/route.ts

import { getDb } from "@/lib/db";
import { usersMfa } from "@/db/schema"; // adjust path to your schema
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { base32Encode, generateBackupCodes, getOtpAuthUrl } from "@/lib/totp";
import { randomBytes } from "crypto";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate 160-bit secret (standard for TOTP)
    const secret = base32Encode(randomBytes(20));
    const backupCodes = generateBackupCodes(10);

    const db = getDb();

    await db
      .insert(usersMfa)
      .values({
        clerkUserId: userId,
        secret,
        backupCodes,
        status: "PENDING",
      })
      .onConflictDoUpdate({
        target: usersMfa.clerkUserId,
        set: {
          secret,
          backupCodes,
          status: "PENDING",
          verifiedAt: null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      secret,
      backupCodes,
      otpauthUrl: getOtpAuthUrl(userId, secret), // feed this to a QR code library
      message: "Scan the QR code with your authenticator app, then verify.",
    });
  } catch (error) {
    console.error("[MFA SETUP] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to setup MFA",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}