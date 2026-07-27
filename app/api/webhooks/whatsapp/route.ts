import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, handleWebhook } from "@/lib/whatsapp/webhook-handler";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !token || !challenge) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  const result = verifyWebhook(mode, token, challenge);
  if (result === null) {
    return new NextResponse("Verification failed", { status: 403 });
  }

  return new NextResponse(result, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await handleWebhook(body);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}