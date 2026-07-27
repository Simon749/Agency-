import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { verify } from "otplib";
import { db } from "@/lib/db";
import { usersMfa } from "@/db/schema/users-mfa";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }

    const [mfaRecord] = await db.select().from(usersMfa).where(eq(usersMfa.clerkUserId, userId)).limit(1);

    if (!mfaRecord || mfaRecord.status !== "PENDING") {
      return NextResponse.json(
        { error: "No pending MFA setup found. Start setup first." },
        { status: 400 }
      );
    }

    const result = await verify({ token: code, secret: mfaRecord.secret });
    if (!result.valid) {
      return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    await client.users.updateUser(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        mfaEnabled: true,
        mfaEnabledAt: new Date().toISOString(),
      },
    });

    await db.update(usersMfa).set({
      status: "ACTIVE",
      verifiedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(usersMfa.clerkUserId, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[MFA VERIFY] Error:", err);
    return NextResponse.json({ error: "Failed to verify MFA" }, { status: 500 });
  }
}