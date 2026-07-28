import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { getDb } from "@/lib/db"; // was: import { db } from "@/lib/db";
import { usersMfa } from "@/db/schema/users-mfa";

export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: "PropFlow Kenya",
      label: userId,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    const backupCodes = Array.from({ length: 10 }, () =>
      Array.from({ length: 8 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")
    );

    await db.insert(usersMfa)
      .values({
        clerkUserId: userId,
        secret,
        backupCodes: JSON.stringify(backupCodes),
        status: "PENDING",
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: usersMfa.clerkUserId,
        set: {
          secret,
          backupCodes: JSON.stringify(backupCodes),
          status: "PENDING",
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ qrCode: qrCodeDataUrl, secret, backupCodes });
  } catch (err) {
    console.error("[MFA SETUP] Error:", err);
    return NextResponse.json({ error: "Failed to generate MFA setup" }, { status: 500 });
  }
}