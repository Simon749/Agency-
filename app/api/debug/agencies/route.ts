import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agencies } from "@/db/schema";

export async function GET() {
  const db = getDb();
  const all = await db.select().from(agencies);
  return NextResponse.json(all);
}