# Runbook: Database is Slow

## Trigger
- `/api/health` shows DB latency > 500ms
- Admin dashboard loads > 5 seconds
- Vercel logs show `Query timeout` errors
- Neon dashboard shows high CPU or connection count

## Impact
- Page loads timeout → user frustration
- STK Push initiation may fail (tenant sees error)
- Webhook processing may timeout → duplicate callbacks

## Diagnosis Steps

### 1. Check Current DB Health
```bash
curl -s https://YOUR_APP_URL/api/health | jq '.checks.database'
```

### 2. Identify Slow Queries (Neon)
1. Log into Neon Console → your project → "Operations" tab
2. Look for queries with > 500ms duration
3. Common culprits:
   - `tenantLedger` aggregations without date filters
   - Missing `agencyId` in WHERE clause
   - Full table scans on `tenantLedger`

### 3. Run Investigation Script
```bash
# Run the built-in slow query identifier
npx tsx scripts/runbooks/identify-slow-queries.ts
```

This script outputs:
- Top 10 slowest queries by total time
- Missing index recommendations
- Table bloat estimates

## Immediate Fixes

### Fix 1: Add Missing Index
```sql
-- If tenantLedger.tenant_id is missing an index:
CREATE INDEX IF NOT EXISTS idx_tenant_ledger_tenant_id ON tenant_ledger(tenant_id);

-- If tenantLedger.created_at is missing an index:
CREATE INDEX IF NOT EXISTS idx_tenant_ledger_created_at ON tenant_ledger(created_at);

-- Composite index for agency-scoped ledger queries:
CREATE INDEX IF NOT EXISTS idx_tenant_ledger_agency_created ON tenant_ledger(agency_id, created_at DESC);
```

### Fix 2: Kill Runaway Queries
```sql
-- Find long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '30 seconds';

-- Cancel a runaway query (replace PID)
SELECT pg_cancel_backend(PID);
```

### Fix 3: Connection Pool Tuning
In `lib/db/index.ts`, adjust:
```typescript
max: parseInt(process.env.DB_POOL_MAX ?? "10", 10), // Increase from 5
idleTimeoutMillis: 5_000, // Close idle faster
connectionTimeoutMillis: 5_000, // Faster fail on cold start
```

## Long-Term Fixes

### 1. Materialized Views for Dashboards
```sql
-- Create a materialized view for monthly summary (refresh nightly)
CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
  agency_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as revenue
FROM tenant_ledger
GROUP BY agency_id, DATE_TRUNC('month', created_at);

-- Refresh via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
```

### 2. Query Result Caching
Use Next.js `unstable_cache` for dashboard data (already implemented in `lib/analytics/queries.ts`).

### 3. Read Replicas (Neon Pro)
For agencies > 5,000 tenants, enable Neon read replicas:
```
Neon Console → Branch → Add Read Replica
```
Route dashboard queries to replica, writes to primary.

## Verification
After fixes, verify:
```bash
curl -s https://YOUR_APP_URL/api/health | jq '.checks.database.latencyMs'
# Should be < 100ms
```

Run load test:
```bash
k6 run --vus 100 --duration 30s scripts/load-test.js
```

## Escalation
If DB is still slow after index fixes:
1. Check Neon status page: https://neonstatus.com/
2. Consider upgrading Neon plan (more CPU/RAM)
3. Contact Neon support with slow query logs
