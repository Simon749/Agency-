// app/api/webhooks/mpesa/confirm/[shortcode]/route.ts
// PHASE 4 HARDENED: Confirms manual Paybill payments with IP allowlist + callback key + dedup.

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings, tenantLedger } from "@/db/schema";
import { insertPaymentCredit } from "@/lib/ledger";
import type { C2BConfirmationRequest, DarajaCallbackResponse } from "@/lib/daraja/types";

// Safaricom Daraja IP ranges
const SAFARICOM_IP_RANGES = ["197.248.", "41.215."];

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_IP_RANGES.some((range) => ip.startsWith(range));
}

// Dedup cache for C2B (same pattern as STK callback)
let c2bDedupCache: Map<string, number> | null = null;
let redisClient: any = null;

try {
  const { Redis } = require("@upstash/redis");
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn("[C2B] Redis not available, using in-memory dedup cache (dev only)");
}

function getC2bDedupCache(): Map<string, number> {
  if (!c2bDedupCache) c2bDedupCache = new Map();
  return c2bDedupCache;
}

const C2B_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const C2B_DEDUP_TTL_SEC = 24 * 60 * 60;

async function isDuplicateC2b(transId: string): Promise<boolean> {
  if (redisClient) {
    const exists = await redisClient.get(`mpesa:c2b:${transId}`);
    if (exists) return true;
    await redisClient.setex(`mpesa:c2b:${transId}`, C2B_DEDUP_TTL_SEC, "1");
    return false;
  }
  const cache = getC2bDedupCache();
  const lastSeen = cache.get(transId);
  if (lastSeen && Date.now() - lastSeen < C2B_DEDUP_TTL_MS) return true;
  cache.set(transId, Date.now());
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
  const { shortcode } = await params;

  // ── IP Allowlist ──
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "unknown";

  if (!isSafaricomIp(clientIp)) {
    console.warn(`[C2B] Rejected from non-Safaricom IP: ${clientIp} for shortcode ${shortcode}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Rejected — Unauthorized IP",
    };
    return NextResponse.json(response, { status: 403 });
  }

  // ── X-Callback-Key verification ──
  const callbackKey = req.headers.get("x-callback-key");
  const expectedKey = process.env.DARAJA_CALLBACK_KEY;
  if (expectedKey && callbackKey !== expectedKey) {
    console.warn(`[C2B] Invalid callback key from ${clientIp}`);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Rejected — Invalid callback key",
    };
    return NextResponse.json(response, { status: 403 });
  }

  try {
    const body = (await req.json()) as C2BConfirmationRequest;
    const { BillRefNumber, TransID, TransAmount, TransTime, MSISDN } = body;

    // ── FIX: Dedup check ──
    if (await isDuplicateC2b(TransID)) {
      const response: DarajaCallbackResponse = {
        ResultCode: "0",
        ResultDesc: "Already processed",
      };
      return NextResponse.json(response);
    }

    const db = getDb();

    // Find building
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.darajaShortcode, shortcode))
      .limit(1);

    if (!building) {
      const response: DarajaCallbackResponse = {
        ResultCode: "1",
        ResultDesc: "Rejected — Building not found",
      };
      return NextResponse.json(response);
    }

    // Find tenant (must be ACTIVE)
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.id, BillRefNumber),
          eq(tenants.buildingId, building.id),
          eq(tenants.status, "ACTIVE")
        )
      )
      .limit(1);

    if (!tenant) {
      const response: DarajaCallbackResponse = {
        ResultCode: "1",
        ResultDesc: "Rejected — Tenant not found or inactive",
      };
      return NextResponse.json(response);
    }

    // ── FIX: Check for duplicate TransID in ledger ──
    const [existingLedger] = await db
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.referenceCode, TransID),
          eq(tenantLedger.agencyId, tenant.agencyId)
        )
      )
      .limit(1);

    if (existingLedger) {
      const response: DarajaCallbackResponse = {
        ResultCode: "0",
        ResultDesc: "Already processed",
      };
      return NextResponse.json(response);
    }

    // Derive billing month from transaction time (format: YYYYMMDDHHmmss)
    const billingMonth = TransTime.slice(0, 4) + "-" + TransTime.slice(4, 6);

    // ── FIX: Use insertPaymentCredit with recordedBy ──
    const ledgerResult = await insertPaymentCredit(
      {
        tenantId: tenant.id,
        buildingId: tenant.buildingId,
        agencyId: tenant.agencyId,
        category: "RENT",
        amount: TransAmount,
        billingMonth,
        description: `M-Pesa Paybill — ${TransID}`,
        referenceCode: TransID,
        method: "MPESA_STK",
      },
      "DARAJA_C2B" // recordedBy — audit trail
    );

    const response: DarajaCallbackResponse = {
      ResultCode: "0",
      ResultDesc: ledgerResult.alreadyExists ? "Already processed" : "Accepted",
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(`[C2B] Confirmation error for shortcode ${shortcode}:`, err);
    const response: DarajaCallbackResponse = {
      ResultCode: "1",
      ResultDesc: "Internal server error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}