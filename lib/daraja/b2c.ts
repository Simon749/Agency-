// lib/daraja/b2c.ts
//
// Safaricom Daraja B2C (Business to Customer) client — refunds a tenant
// directly to their M-Pesa wallet (e.g. duplicate payment correction).
//
// B2C uses a different credential set than STK Push: an Initiator name and a
// "Security Credential" (the initiator password encrypted with Safaricom's
// public certificate), not the Consumer Key/Secret pair used for STK. Store
// these per-building, encrypted the same way as your other Daraja fields
// (see migrations/phase-c-migration.sql for the new columns).

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import { getAccessToken } from "./client";
import { formatPhoneForDaraja } from "./utils";

const DARAJA_BASE_URL =
  process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

export interface B2CRefundParams {
  buildingId: string;
  phone: string;
  amount: number;
  remarks: string;
  occasion?: string;
  resultUrl: string;
  timeoutUrl: string;
}

export interface B2CRefundResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

/**
 * Initiate a B2C refund to a tenant's phone. This function only moves money —
 * it does not touch the ledger. Wire it together with reverseLedgerEntry in
 * the refund runbook (see app/admin-refunds/actions.ts), reversal first, so
 * the ledger reflects intent even if the B2C call is slow or fails.
 */
export async function initiateB2CRefund(params: B2CRefundParams): Promise<B2CRefundResponse> {
  const { buildingId, phone, amount, remarks, occasion, resultUrl, timeoutUrl } = params;

  const db = getDb();
  const [building] = await db
    .select({
      shortcode: (buildings as any).darajaShortcode,
      initiatorName: (buildings as any).darajaInitiatorName,
      securityCredential: (buildings as any).darajaSecurityCredential,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building?.initiatorName || !building?.securityCredential) {
    throw new Error(
      `B2C initiator credentials not configured for building ${buildingId}. ` +
      `Set darajaInitiatorName / darajaSecurityCredential (see migrations/phase-c-migration.sql).`
    );
  }

  const securityCredential = decrypt(building.securityCredential);
  const accessToken = await getAccessToken(buildingId);
  const formattedPhone = formatPhoneForDaraja(phone);

  const body = {
    InitiatorName: building.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: "BusinessPayment",
    Amount: Math.round(amount),
    PartyA: building.shortcode,
    PartyB: formattedPhone,
    Remarks: remarks.slice(0, 100),
    QueueTimeOutURL: timeoutUrl,
    ResultURL: resultUrl,
    Occasion: (occasion ?? "Refund").slice(0, 100),
  };

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2C refund request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as B2CRefundResponse;

  if (data.ResponseCode !== "0") {
    throw new Error(`B2C refund rejected: ${data.ResponseDescription}`);
  }

  return data;
}