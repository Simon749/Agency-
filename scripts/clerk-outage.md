# Runbook: Clerk Authentication Outage

## Trigger
- `/api/health` shows Clerk status as `error`
- Users cannot sign in (Clerk hosted page returns 500)
- `auth()` throws in Server Components
- Middleware redirects all users to `/sign-in` even when signed in

## Impact
- All users locked out of the app
- Webhooks may fail if they require auth checks
- Tenants cannot pay rent
- Agents cannot log meter readings

## Immediate Response

### 1. Verify Clerk Status
Check Clerk status page: https://status.clerk.com/

Check their Twitter: @ClerkDev

### 2. Enable Maintenance Mode

Create a maintenance page that bypasses auth:

```typescript
// app/maintenance/page.tsx
export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-light mb-4">PropFlow Maintenance</h1>
        <p className="text-white/60 mb-6">
          We are experiencing technical difficulties with our authentication provider.
          Please try again in a few minutes.
        </p>
        <p className="text-white/40 text-sm">
          For urgent issues, contact your property manager directly.
        </p>
      </div>
    </div>
  );
}
```

Temporarily redirect all traffic to maintenance:
```typescript
// middleware.ts — add at the top of clerkMiddleware
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

if (MAINTENANCE_MODE && !req.nextUrl.pathname.startsWith("/maintenance")) {
  return NextResponse.redirect(new URL("/maintenance", req.url));
}
```

Set env var in Vercel:
```bash
vercel env add MAINTENANCE_MODE production
# Value: true
```

### 3. Manual Operations (Critical Only)

If rent collection is urgent and Clerk is down:

**Option A: Manual M-Pesa STK Push**
Use the Safaricom M-Pesa portal or a separate tool to initiate STK Push.
Then manually insert into ledger when Clerk is back.

**Option B: Bank Transfer / Cash**
Accept manual payments and record them in ledger when system is restored.

**Option C: WhatsApp Coordination**
Use your Kenya soft launch WhatsApp channel to coordinate with tenants.

### 4. Monitor Clerk Recovery
```bash
# Poll health endpoint every 30 seconds
while true; do
  STATUS=$(curl -s https://YOUR_APP_URL/api/health | jq -r '.checks.clerk.status')
  echo "$(date): Clerk status = $STATUS"
  if [ "$STATUS" = "available" ]; then
    echo "Clerk is back! Disabling maintenance mode..."
    # Update env var and redeploy
    break
  fi
  sleep 30
done
```

### 5. Disable Maintenance Mode
Once Clerk is confirmed operational:
1. Remove `MAINTENANCE_MODE` env var or set to `false`
2. Redeploy: `vercel --prod`
3. Test sign-in for each role
4. Verify webhooks still work

## Prevention
- Clerk has 99.99% uptime SLA on paid plans
- Consider Clerk Enterprise for dedicated support
- Keep a list of tenant phone numbers offline for WhatsApp fallback
- Document manual payment procedures for agents

## Post-Incident
- Document duration of outage
- Check if any payments were missed during downtime
- Reconcile ledger for the outage period
- Send apology SMS to affected tenants if needed
