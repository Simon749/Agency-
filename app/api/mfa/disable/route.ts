import { getDb } from "@/lib/db";
import { usersMfa } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    await db
      .update(usersMfa)
      .set({ status: "DISABLED", updatedAt: new Date() })
      .where(eq(usersMfa.clerkUserId, userId));

    return NextResponse.json({ message: "MFA disabled." });
  } catch (error) {
    console.error("[MFA DISABLE] Error:", error);
    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 }
    );
  }
}