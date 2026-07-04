# Runbook: Agency Kill Switch Triggered

## Trigger
- Super Admin clicks "Suspend" on an agency
- Agency subscription is 30+ days overdue (auto-suspend)
- `agencies.isActive` is set to `false`

## Impact
- All agency staff redirected to `/suspended`
- Tenants cannot log in or pay rent
- Webhooks for that agency's buildings are rejected
- SMS notifications stop for that agency

## Immediate Response

### 1. Verify the Kill Switch State
```bash
curl -s https://YOUR_APP_URL/api/health | jq '.checks'
```

Or query DB:
```sql
SELECT id, name, is_active, subscription_status, deleted_at
FROM agencies
WHERE id = 'AGENCY_UUID';
```

### 2. Understand Why It Was Triggered

| Reason | Action |
|--------|--------|
| Manual by Super Admin | Check with admin who triggered it |
| Subscription overdue | Check `agency_subscriptions` table |
| Breach of terms | Review incident report |
| Agency requested termination | Confirm with agency owner |

### 3. Communication Template

**Email to Agency Owner:**
```
Subject: PropFlow Account Suspended — Action Required

Dear [Agency Owner],

Your PropFlow account has been suspended due to [REASON].

Impact:
- Staff cannot access the admin portal
- Tenants cannot log in or pay rent via M-Pesa
- All automated SMS notifications are paused

To reactivate:
[INSTRUCTIONS BASED ON REASON]

If you believe this is an error, contact support@propflow.co.ke

— PropFlow Team
```

### 4. Reactivate (if approved)

```typescript
import { toggleAgencyStatus } from "@/lib/super-admin/queries";

await toggleAgencyStatus("AGENCY_UUID", true);
```

Or directly in DB:
```sql
UPDATE agencies
SET is_active = true, updated_at = NOW()
WHERE id = 'AGENCY_UUID';
```

**Invalidate the middleware cache:**
```typescript
import { invalidateAgencyCache } from "@/middleware";

invalidateAgencyCache("AGENCY_UUID");
```

### 5. Verify Reactivation
- Staff can log in and access `/admin/dashboard`
- Tenant can log in and see balance
- Test KES 1 STK Push
- Test SMS delivery

## Data Export (if agency is terminating)

Before termination, export all data:

```bash
# Export tenant ledger
pg_dump $DATABASE_URL --table=tenant_ledger --where="agency_id='AGENCY_UUID'" > agency_ledger.sql

# Export tenant list
pg_dump $DATABASE_URL --table=tenants --where="agency_id='AGENCY_UUID'" > agency_tenants.sql

# Export buildings & units
pg_dump $DATABASE_URL --table=buildings --where="agency_id='AGENCY_UUID'" > agency_buildings.sql
pg_dump $DATABASE_URL --table=units --where="agency_id='AGENCY_UUID'" > agency_units.sql
```

Or use the Super Admin export function (if built).

## Prevention
- Set up subscription dunning emails (7 days, 1 day, overdue)
- Auto-suspend only after 30 days + 3 email warnings
- Give agencies a 7-day grace period
- Log all kill switch triggers with reason

## Audit Trail
Every kill switch trigger should be logged:
```typescript
import { alert } from "@/lib/monitoring";

alert("AGENCY_KILL_SWITCH", "Agency suspended", {
  agencyId: "AGENCY_UUID",
  userId: "SUPER_ADMIN_CLERK_ID",
  metadata: {
    reason: "NON_PAYMENT",
    daysOverdue: 45,
    amountDue: 50000,
  },
});
```
