// lib/daraja/client.ts
// Safaricom Daraja API client for STK Push and Access Tokens

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
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

  const key = decrypt(building.consumerKey);
  const secret = decrypt(building.consumerSecret);

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja token error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as DarajaAccessTokenResponse;
  return data.access_token;
}

export interface InitiateStkPushParams {
  buildingId: string;
  tenantId: string;
  phone: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl: string;
}

/**
 * Initiate an STK Push to the tenant's phone.
 */
export async function initiateStkPush(
  params: InitiateStkPushParams
): Promise<StkPushResponse> {
  const { buildingId, tenantId, phone, amount, accountReference, transactionDesc, callbackUrl } =
    params;

  const db = getDb();
  const [building] = await db
    .select({
      shortcode: buildings.darajaShortcode,
      passkey: buildings.darajaPasskey,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building?.shortcode || !building?.passkey) {
    throw new Error(`Daraja shortcode/passkey missing for building ${buildingId}`);
  }

  const shortcode = decrypt(building.shortcode);
  const passkey = decrypt(building.passkey);
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
    AccountReference: accountReference ?? tenantId,
    TransactionDesc: transactionDesc ?? "Rent Payment",
  };

  const accessToken = await getAccessToken(buildingId);

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