import { getDb } from "@/lib/db";
import { usersMfa } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const [mfa] = await db
      .select({
        status: usersMfa.status,
        verifiedAt: usersMfa.verifiedAt,
      })
      .from(usersMfa)
      .where(eq(usersMfa.clerkUserId, userId))
      .limit(1);

    return NextResponse.json({
      enabled: mfa?.status === "ENABLED",
      status: mfa?.status ?? "DISABLED",
      verifiedAt: mfa?.verifiedAt,
    });
  } catch (error) {
    console.error("[MFA STATUS] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch MFA status" },
      { status: 500 }
    );
  }
}