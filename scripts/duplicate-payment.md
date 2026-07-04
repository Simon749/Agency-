# Runbook: Duplicate Payment Detected

## Trigger
- Ledger reconciliation cron finds duplicate `referenceCode`
- Tenant reports "I was charged twice for the same month"
- Two `CREDIT` entries with same M-Pesa receipt number
- `pending_transactions` has multiple COMPLETED rows for same `CheckoutRequestID`

## Impact
- Tenant overpaid → negative balance in ledger
- Agency revenue overstated
- Trust issue with tenant

## Immediate Response

### Step 1: Identify the Duplicate
```bash
# Run the investigation script
npx tsx scripts/runbooks/investigate-ledger.ts --tenant-id TENANT_UUID --reference RFI392KDM
```

Or query directly:
```sql
SELECT id, type, amount, reference_code, created_at, description
FROM tenant_ledger
WHERE reference_code = 'RFI392KDM'
ORDER BY created_at;
```

### Step 2: Determine Which Entry is Legitimate

| Check | Legitimate | Duplicate |
|-------|-----------|-----------|
| `created_at` | First (earlier) | Second (later) |
| `recordedBy` | `"system"` (webhook) | `"system"` or admin ID |
| `description` | `"M-Pesa STK Push — RFI392KDM"` | Same or different |
| `pending_transactions` link | Has matching `checkoutRequestId` | No matching pending tx |

### Step 3: Do NOT Delete the Duplicate Entry

**Ledger is immutable. Never delete rows.**

Instead, insert a correcting `DEBIT` entry:

```typescript
import { getDb } from "@/lib/db";
import { tenantLedger } from "@/db/schema";

const db = getDb();

await db.insert(tenantLedger).values({
  tenantId: "TENANT_UUID",
  buildingId: "BUILDING_UUID",
  agencyId: "AGENCY_UUID",
  type: "DEBIT",
  category: "RENT", // Same category as the duplicate
  amount: "15000.00", // Same amount as duplicate
  description: "Correction — duplicate payment RFI392KDM reversed",
  referenceCode: "REV-RFI392KDM-" + Date.now(),
  method: "SYSTEM",
  recordedBy: "ADMIN_CLERK_ID",
  billingMonth: "2026-07",
});
```

### Step 4: Document the Incident
Create a note in the tenant's record (or a separate `audit_log` table):
```typescript
// Log to monitoring
import { alert } from "@/lib/monitoring";

alert("DUPLICATE_PAYMENT_CORRECTED", 
  "Duplicate payment RFI392KDM corrected for tenant TENANT_UUID",
  {
    tenantId: "TENANT_UUID",
    agencyId: "AGENCY_UUID",
    metadata: {
      originalReference: "RFI392KDM",
      correctionAmount: "15000.00",
      correctedBy: "ADMIN_CLERK_ID",
      reason: "Duplicate webhook callback",
    },
  }
);
```

### Step 5: Refund the Tenant (if needed)
If the tenant wants a refund instead of a credit:
1. Process refund via M-Pesa (if within 24h, contact Safaricom)
2. Or apply the credit to next month's rent
3. Send SMS explaining the correction

## Root Cause Analysis

### Why did this happen?
1. **Webhook replay**: Safaricom sent the same callback twice (rare but possible)
2. **Race condition**: Two callbacks processed simultaneously before `SELECT FOR UPDATE` locked the row
3. **Manual entry + auto-webhook**: Admin manually entered payment while webhook also processed it
4. **Dedup cache miss**: In-memory `Map` was cleared on server restart (Vercel cold start)

### Prevention
- ✅ `unique constraint` on `tenantLedger.referenceCode` (already in schema)
- ✅ `SELECT FOR UPDATE` in webhook (already implemented)
- ✅ Idempotency check in `initiateStkPush` (already implemented)
- ⚠️ **Add Redis-backed dedup** for serverless environments (Vercel functions restart)

## Verification
After correction:
```sql
-- Verify balance is correct
SELECT
  SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) -
  SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as balance
FROM tenant_ledger
WHERE tenant_id = 'TENANT_UUID';
```

Balance should equal: (expected rent) - (legitimate payments only).
