# Runbook: Daraja Webhook Down — Manual Payment Entry

## Trigger
- `/api/health` shows Daraja status as `error`
- Vercel logs show 403/500 errors on `/api/webhooks/mpesa/*`
- Tenant reports "paid but not reflected in balance"

## Impact
- STK Push callbacks may fail → payments stuck in PENDING
- C2B Paybill payments may not auto-confirm
- Tenants may be double-charged if they retry

## Immediate Response (First 5 Minutes)

### 1. Verify Daraja Status
```bash
curl -s https://YOUR_APP_URL/api/health | jq '.checks.daraja'
```
Expected: `{ "status": "available", "latencyMs": < 1000 }`

### 2. Check Vercel Logs
```bash
vercel logs --json | grep "mpesa"
```
Look for: `403 Unauthorized IP`, `500 Internal error`, timeout errors.

### 3. Check Safaricom Daraja Status
Visit: https://developer.safaricom.co.ke/Status
Or check their Twitter: @SafaricomPLC

## Manual Payment Entry (If Webhook is Down)

### Step 1: Collect Payment Details from Tenant
Required fields:
- M-Pesa Confirmation Code (e.g., `RFI392KDM`)
- Phone number used for payment
- Amount paid
- Date/time of payment
- Building shortcode

### Step 2: Verify Payment in M-Pesa
Use the Daraja Transaction Status API or M-Pesa app to confirm the transaction exists.

### Step 3: Insert Manual CREDIT Entry
Run the Server Action `insertPaymentCredit` via the admin panel or directly:

```typescript
import { insertPaymentCredit } from "@/lib/ledger";

await insertPaymentCredit({
  tenantId: "TENANT_UUID",
  buildingId: "BUILDING_UUID",
  agencyId: "AGENCY_UUID",
  category: "RENT",
  amount: "15000.00",
  billingMonth: "2026-07",
  description: "Manual entry — M-Pesa RFI392KDM (webhook down)",
  referenceCode: "RFI392KDM",
  method: "MPESA_STK", // or "BANK_RECEIPT" / "CASH"
  recordedBy: "ADMIN_CLERK_ID",
});
```

### Step 4: Send Confirmation SMS
```typescript
import { sendPaymentReceivedSms } from "@/lib/sms/triggers";

await sendPaymentReceivedSms(
  "TENANT_UUID",
  "15000",
  "RFI392KDM",
  "2026-07"
);
```

### Step 5: Update Pending Transaction (if exists)
If there was a stuck PENDING transaction:
```typescript
import { updatePendingTransaction } from "@/lib/ledger";

await updatePendingTransaction("CHECKOUT_REQUEST_ID", {
  status: "COMPLETED",
  resultCode: "0",
  resultDesc: "Manually resolved during webhook outage",
  mpesaReceiptNumber: "RFI392KDM",
});
```

## Recovery Checklist

- [ ] Webhook endpoint responding 200 on test callback
- [ ] IP allowlist still valid (Safaricom may change ranges)
- [ ] `DARAJA_CALLBACK_KEY` env var matches Daraja dashboard
- [ ] Callback URL in Daraja portal matches production domain
- [ ] Test KES 1 STK Push end-to-end
- [ ] All manual entries documented with reference codes

## Prevention
- Set up Pingdom/UptimeRobot on `/api/health`
- Configure Vercel Alert on 5xx errors > 1%
- Log every webhook payload to Vercel Blob for 30 days

## Escalation
If Safaricom Daraja is down > 2 hours:
1. Post status on your status page
2. Email affected tenants with manual payment instructions
3. Contact Safaricom Daraja support: daraja@safaricom.co.ke
