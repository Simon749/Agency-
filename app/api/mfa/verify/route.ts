import { getDb } from "@/lib/db";
import { usersMfa } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyTOTP } from "@/lib/totp";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    const db = getDb();
    const [mfa] = await db
      .select()
      .from(usersMfa)
      .where(eq(usersMfa.clerkUserId, userId))
      .limit(1);

    if (!mfa) {
      return NextResponse.json(
        { error: "MFA not set up. Call /api/mfa/setup first." },
        { status: 400 }
      );
    }

    const isValid = verifyTOTP(mfa.secret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid code. Try again." },
        { status: 400 }
      );
    }

    await db
      .update(usersMfa)
      .set({
        status: "ENABLED",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersMfa.clerkUserId, userId));

    return NextResponse.json({
      message: "MFA enabled successfully.",
    });
  } catch (error) {
    console.error("[MFA VERIFY] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify MFA",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}