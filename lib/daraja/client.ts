// lib/daraja/client.ts
// Safaricom Daraja API client for STK Push and Access Tokens
// PHASE H: Added aggregator support. Rate limiting + circuit breaker are checked BEFORE calling this.

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings, pendingTransactions } from "@/db/schema";
import { decryptCredential } from "@/lib/encryption"; // was: decrypt
import {
  generatePassword,
  generateTimestamp,
  formatPhoneForDaraja,
} from "./utils";
import type {
  DarajaAccessTokenResponse,
  StkPushRequest,
  StkPushResponse,
} from "./types";
import { getPaybillStrategy, type PaybillStrategy } from "@/lib/payments/paybill-strategy";

const DARAJA_BASE_URL =
  process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

/**
 * Get OAuth access token for a specific building's Daraja credentials.
 */
export async function getAccessToken(buildingId: string): Promise<string> {
  const db = getDb();
  const [building] = await db
    .select({
      consumerKey: buildings.darajaConsumerKey,
      consumerSecret: buildings.darajaConsumerSecret,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building?.consumerKey || !building?.consumerSecret) {
    throw new Error(`Daraja credentials not configured for building ${buildingId}`);
  }

  return getAccessTokenFromCredentials(building.consumerKey, building.consumerSecret);
}

/**
 * Get access token from raw (encrypted) credentials.
 */
export async function getAccessTokenFromCredentials(
  encryptedConsumerKey: string,
  encryptedConsumerSecret: string
): Promise<string> {
  const key = decryptCredential(encryptedConsumerKey);
  const secret = decryptCredential(encryptedConsumerSecret);

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja token error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as DarajaAccessTokenResponse;
  return data.access_token;
}

/**
 * Get aggregator master credentials from environment.
 */
export function getAggregatorCredentials(): {
  shortcode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
} {
  const shortcode = process.env.AGGREGATOR_SHORTCODE;
  const passkey = process.env.AGGREGATOR_PASSKEY;
  const consumerKey = process.env.AGGREGATOR_CONSUMER_KEY;
  const consumerSecret = process.env.AGGREGATOR_CONSUMER_SECRET;

  if (!shortcode || !passkey || !consumerKey || !consumerSecret) {
    throw new Error("Aggregator Daraja credentials not configured in environment variables");
  }

  return { shortcode, passkey, consumerKey, consumerSecret };
}

export interface InitiateStkPushParams {
  buildingId: string;
  tenantId: string;
  phone: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl: string;
  /** Optional: override paybill strategy (for aggregator or testing) */
  strategy?: PaybillStrategy;
}

/**
 * Initiate an STK Push to the tenant's phone.
 *
 * PHASE H: Supports both building-owned paybill and shared aggregator paybill.
 * Callers should check rate limits + circuit breaker BEFORE invoking this.
 */
export async function initiateStkPush(
  params: InitiateStkPushParams
): Promise<StkPushResponse> {
  const { buildingId, tenantId, phone, amount, accountReference, transactionDesc, callbackUrl, strategy } =
    params;

  const db = getDb();

  // ── IDEMPOTENCY GUARD ──
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [recentPending] = await db
    .select({
      checkoutRequestId: pendingTransactions.checkoutRequestId,
      initiatedAt: pendingTransactions.initiatedAt,
      amount: pendingTransactions.amount,
    })
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.tenantId, tenantId),
        eq(pendingTransactions.status, "PENDING"),
        eq(pendingTransactions.buildingId, buildingId)
      )
    )
    .orderBy(pendingTransactions.initiatedAt)
    .limit(1);

  if (recentPending && new Date(recentPending.initiatedAt) > fiveMinutesAgo) {
    throw new Error(
      `An STK Push is already pending for this tenant (started ${recentPending.checkoutRequestId}). ` +
      `Please wait for the M-Pesa prompt to complete or expire before trying again.`
    );
  }

  // Resolve paybill strategy if not provided
  const paybill = strategy ?? await getPaybillStrategy(buildingId, tenantId);

  let shortcode: string;
  let passkey: string;
  let accessToken: string;
  let finalAccountReference: string;

  if (paybill.type === "OWN") {
    shortcode = decryptCredential(paybill.shortcode);
    passkey = decryptCredential(paybill.passkey);
    accessToken = await getAccessTokenFromCredentials(paybill.consumerKey, paybill.consumerSecret);
    finalAccountReference = accountReference ?? tenantId;
  } else {
    // AGGREGATOR
    const agg = getAggregatorCredentials();
    shortcode = agg.shortcode;
    passkey = agg.passkey;
    accessToken = await getAccessTokenFromCredentials(agg.consumerKey, agg.consumerSecret);
    finalAccountReference = accountReference ?? paybill.accountReference;
  }

  const timestamp = generateTimestamp();
  const password = generatePassword(shortcode, passkey, timestamp);
  const formattedPhone = formatPhoneForDaraja(phone);

  const body: StkPushRequest = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: finalAccountReference,
    TransactionDesc: transactionDesc ?? "Rent Payment",
  };

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STK Push failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as StkPushResponse;

  if (data.ResponseCode !== "0") {
    throw new Error(`STK Push rejected: ${data.ResponseDescription}`);
  }

  return data;
}