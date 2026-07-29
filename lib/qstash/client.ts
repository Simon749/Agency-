// lib/qstash/client.ts
import { Client, Receiver } from "@upstash/qstash";
import { NextRequest } from "next/server";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  // Optional: tighten this in production
});

export async function verifyQStashSignature(req: NextRequest): Promise<boolean> {
  const signature = req.headers.get("upstash-signature") || "";
  const body = await req.text();
  
  try {
    await qstashReceiver.verify({
      signature,
      body,
      url: `${process.env.NEXT_PUBLIC_APP_URL}${req.nextUrl.pathname}`,
    });
    return true;
  } catch {
    return false;
  }
}