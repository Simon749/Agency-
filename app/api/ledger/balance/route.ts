// app/api/ledger/balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantBalance } from "@/lib/ledger";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    const balance = await getTenantBalance(tenantId,  sessionStorage.agencyId);
    return NextResponse.json(balance);
  } catch (err) {
    console.error("Balance API error:", err);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}