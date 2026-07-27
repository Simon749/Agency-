# Daraja Rate Limits & Queuing Strategy

## Safaricom Daraja Documented Limits

| Endpoint | Production | Sandbox | Notes |
|----------|-----------|---------|-------|
| STK Push | ~500 req/min per shortcode | ~100 req/min | Hard limit; exceeding returns 429 |
| C2B Validation | High throughput | High throughput | Synchronous — must respond &lt; 8s |
| C2B Confirmation | High throughput | High throughput | Idempotent handling required |
| OAuth Token | 1-hour TTL | 1-hour TTL | Cache aggressively; don't request per-transaction |

## PropFlow Queuing Architecture

### Problem: 1st-of-Month Spike
If 1,000 tenants all initiate payment at 8:00 AM:
- At 500 req/min: takes 2 minutes to clear
- At 100 req/min (sandbox): takes 10 minutes
- Without queuing: requests fail with 429, tenants retry, amplifying the spike

### Solution: DB-Backed Queue + Rate-Limited Draining

1. **Tenant clicks "Pay"** → INSERT into `stk_push_queue` (status: PENDING)
2. **Vercel Cron** (every minute) → `processQueueBatch(N)`
3. **Rate limiter** enforces max 5 req/sec per shortcode
4. **Circuit breaker** pauses a shortcode if Daraja returns 5xx or 429
5. **Webhook callback** marks queue item COMPLETED and updates ledger

### Queue Table: `stk_push_queue`
- `status`: PENDING → PROCESSING → COMPLETED/FAILED
- `scheduledAt`: controls when item is eligible for processing
- `attemptCount`: max 3 retries with exponential backoff

### Fallback for Agencies Without Shortcode
- Use shared aggregator paybill (single master shortcode)
- Account reference format: `PF&lt;shortcode&gt;` per tenant
- Same queue + rate limiter applies to aggregator shortcode

### Scaling Path

| Tenants | Strategy |
|---------|----------|
| 0-500 | In-memory rate limiter, 1-min cron |
| 500-5,000 | DB queue + QStash for distributed workers |
| 5,000+ | Shard by shortcode, multiple cron invocations |