// lib/daraja/settlement.ts
// Fetch Safaricom Daraja transaction/settlement reports per shortcode.
// Used by the nightly reconciliation cron to match against tenant_ledger CREDITs.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { buildings } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import { getAccessToken } from "./client";

const DARAJA_BASE_URL =
  process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

export interface DarajaTransaction {
  TransactionType: string;
  TransID: string;           // M-Pesa Transaction ID (matches tenant_ledger.referenceCode)
  TransTime: string;         // "20260720123045" (YYYYMMDDHHMMSS)
  TransAmount: string;       // "25000.00"
  BusinessShortCode: string; // Paybill/Till number
  BillRefNumber: string;     // Account reference (tenantId for PropFlow)
  InvoiceNumber: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;            // Customer phone number
  FirstName: string;
  MiddleName: string;
  LastName: string;
}

export interface SettlementReport {
  buildingId: string;
  shortcode: string;
  transactions: DarajaTransaction[];
  fetchedAt: Date;
  reportDate: string; // "2026-07-20"
}

/**
 * Fetch the C2B (Paybill) transaction list for a building's shortcode.
 * 
 * NOTE: Daraja does not expose a direct "settlement report" API in sandbox.
 * In production, Safaricom provides:
 *   1. M-Pesa Portal (manual download)
 *   2. C2B API with transaction query endpoints
 *   3. Settlement files via SFTP (for high-volume merchants)
 * 
 * This implementation uses the Transaction Status Query API as a proxy.
 * For production scale, you'll likely need to integrate Safaricom's SFTP
 * settlement files or use the M-Pesa Portal API.
 */
export async function fetchBuildingTransactions(
  buildingId: string,
  options?: {
    startDate?: string;  // "20260720"
    endDate?: string;    // "20260720"
  }
): Promise<SettlementReport> {
  const db = getDb();

  const [building] = await db
    .select({
      shortcode: buildings.darajaShortcode,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building?.shortcode) {
    throw new Error(`No Daraja shortcode configured for building ${buildingId}`);
  }

  const shortcode = decrypt(building.shortcode);
  const accessToken = await getAccessToken(buildingId);

  // Default to yesterday if no date range provided
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const startDate = options?.startDate ?? formatDate(yesterday);
  const endDate = options?.endDate ?? formatDate(yesterday);

  // Transaction Status Query — checks status of transactions for a shortcode
  // In production, replace this with actual settlement report integration
  const body = {
    Initiator: "testapi", // Replace with your initiator name
    SecurityCredential: "YOUR_SECURITY_CREDENTIAL", // Encrypt per-building like other creds
    CommandID: "TransactionStatusQuery",
    TransactionID: "", // Empty = query all for date range (if supported)
    PartyA: shortcode,
    IdentifierType: "4", // 4 = Organization shortcode
    ResultURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/transaction-status/${shortcode}`,
    QueueTimeOutURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/timeout/${shortcode}`,
    Remarks: "Settlement reconciliation query",
    Occasion: "Reconciliation",
    StartDate: startDate,
    EndDate: endDate,
  };

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/transactionstatus/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Settlement query failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  // Parse response — structure varies by Daraja version
  // This is a simplified parser; adjust based on actual Safaricom response format
  const transactions: DarajaTransaction[] = parseSettlementResponse(data);

  return {
    buildingId,
    shortcode,
    transactions,
    fetchedAt: new Date(),
    reportDate: `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`,
  };
}

/**
 * Parse the Daraja settlement/transaction response into a standard format.
 * Adjust this based on the actual response structure from Safaricom.
 */
function parseSettlementResponse(data: any): DarajaTransaction[] {
  // If Safaricom returns a list directly
  if (Array.isArray(data)) {
    return data.map((t) => ({
      TransactionType: t.TransactionType ?? "Pay Bill",
      TransID: t.TransID ?? t.transactionId ?? "",
      TransTime: t.TransTime ?? t.transactionTime ?? "",
      TransAmount: String(t.TransAmount ?? t.amount ?? "0"),
      BusinessShortCode: String(t.BusinessShortCode ?? t.shortcode ?? ""),
      BillRefNumber: t.BillRefNumber ?? t.billRefNumber ?? t.accountReference ?? "",
      InvoiceNumber: t.InvoiceNumber ?? "",
      OrgAccountBalance: String(t.OrgAccountBalance ?? "0"),
      ThirdPartyTransID: t.ThirdPartyTransID ?? "",
      MSISDN: t.MSISDN ?? t.phoneNumber ?? "",
      FirstName: t.FirstName ?? "",
      MiddleName: t.MiddleName ?? "",
      LastName: t.LastName ?? "",
    }));
  }

  // If wrapped in a ResultParameter array (common in Daraja callbacks)
  if (data.ResultParameters?.ResultParameter) {
    const params = data.ResultParameters.ResultParameter;
    const getParam = (key: string) =>
      params.find((p: any) => p.Key === key)?.Value ?? "";

    return [
      {
        TransactionType: getParam("TransactionType"),
        TransID: getParam("TransactionReceipt") || getParam("TransID"),
        TransTime: getParam("TransactionCompletedDateTime") || getParam("TransTime"),
        TransAmount: String(getParam("Amount") || "0"),
        BusinessShortCode: String(getParam("ReceiverPartyPublicName") || ""),
        BillRefNumber: getParam("BillRefNumber") || getParam("AccountReference"),
        InvoiceNumber: getParam("InvoiceNumber"),
        OrgAccountBalance: String(getParam("OrgAccountBalance") || "0"),
        ThirdPartyTransID: getParam("ThirdPartyTransID"),
        MSISDN: getParam("DebitPartyCharges") || getParam("PhoneNumber"),
        FirstName: getParam("FirstName"),
        MiddleName: getParam("MiddleName"),
        LastName: getParam("LastName"),
      },
    ];
  }

  // Fallback: empty array if unexpected format
  console.warn("[Settlement] Unexpected response format:", JSON.stringify(data).slice(0, 500));
  return [];
}

/**
 * Fetch settlement reports for ALL buildings in an agency.
 */
export async function fetchAgencySettlementReports(
  agencyId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<SettlementReport[]> {
  const db = getDb();

  const buildingList = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const reports: SettlementReport[] = [];

  for (const b of buildingList) {
    try {
      const report = await fetchBuildingTransactions(b.id, options);
      reports.push(report);
    } catch (err) {
      console.error(`[Settlement] Failed to fetch for building ${b.id}:`, err);
      // Continue with other buildings — don't let one failure block the rest
    }
  }

  return reports;
}