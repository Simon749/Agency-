# PROPFLOW PRODUCTION READINESS TRACKER
## "Bulletproof Before Billions" — Week 17-18 Extended Roadmap

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| 🔴 | Blocker — must complete before next phase |
| 🟡 | Important — do soon |
| 🟢 | Nice to have — can defer |

---

## PHASE 0: IMMEDIATE FIXES (Today — Before Anything Else)

### Missing Pages (404 Fixes)

These pages are referenced in your middleware but don't exist. This is blocking your admin flow.

- [ ] **Create `app/pending-setup/page.tsx`**
  - Simple page: "Your agency setup is pending. Contact your Super Admin."
  - Auto-redirect SUPER_ADMIN to `/super-admin/agencies`
  - Include support email/phone
  - Clean, on-brand design (PropFlow colors)

- [ ] **Create `app/suspended/page.tsx`**
  - "This agency has been suspended by the Super Admin."
  - "Contact support for assistance."
  - Include PropFlow logo, support contact

- [ ] **Create `app/deactivated/page.tsx`**
  - "Your tenant account has been deactivated."
  - "If you believe this is an error, contact your property manager."
  - Include building/agency contact info (if available)

- [ ] **Verify `app/sign-in` route**
  - Ensure using Clerk **hosted** sign-in pages (not embedded components)
  - Confirm no sub-routes like `/sign-in/factor-two` causing 404s
  - Test sign-in flow for each role

**🔴 Phase 0 Exit Criteria:** All 404 routes resolve correctly. Admin can log in without hitting dead pages.

---

## PHASE 1: FOUNDATION AUDIT (Days 1-2)

### Clerk Configuration
- [ ] Switch from **development keys** to **production keys** in Clerk Dashboard
- [ ] Create separate Clerk application for production (don't reuse dev)
- [ ] Configure sign-in strategy: "Email + Phone" (as per DESIGN.md)
- [ ] Disable public sign-up — set to **Invite Only**
- [ ] Verify webhook endpoints registered in Clerk Dashboard:
  - `user.created` → `/api/webhooks/clerk`
  - `user.updated` → `/api/webhooks/clerk`
- [ ] Test `user.created` webhook with real email address
- [ ] Verify `publicMetadata` shape matches middleware expectations:
  ```json
  { "role": "AGENCY_OWNER", "agencyId": "uuid", "buildingId": "uuid", "unitId": "uuid" }
  ```
- [ ] Test metadata updates propagate within <5 seconds
- [ ] Seed first Super Admin account manually via Clerk dashboard
- [ ] Test: Super Admin can sign in, middleware redirects correctly

### Environment Variables Audit
- [ ] `.env.local` configured with all required vars:
  - `DATABASE_URL` (Neon dev branch for now)
  - `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_WEBHOOK_SECRET`
  - `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` (sandbox for now)
  - `AT_API_KEY`, `AT_USERNAME` (Africa's Talking sandbox)
  - `CRON_SECRET`
- [ ] Document all env vars in `.env.example` (no real values)
- [ ] Add all to Vercel project environment variables (preview + production)

### Database Health Check
- [ ] Run `drizzle-kit push` against Neon dev branch — confirm all tables exist
- [ ] Verify `lib/db/index.ts` exports typed `db` instance
- [ ] Test: `db.select().from(agencies)` returns empty array without error
- [ ] Check all schema files are present:
  - [ ] `enums.ts`
  - [ ] `agencies.ts`
  - [ ] `buildings.ts`
  - [ ] `building_utilities.ts`
  - [ ] `units.ts`
  - [ ] `tenants.ts`
  - [ ] `leases.ts`
  - [ ] `tenant_ledger.ts`
  - [ ] `utility_readings.ts`
  - [ ] `pending_transactions.ts`
  - [ ] `complaints.ts` + `complaint_updates.ts`
  - [ ] `notifications.ts`
  - [ ] `staff.ts`

**🔴 Phase 1 Exit Criteria:** Sign in works. Database tables exist. All env vars documented. No 404s on auth flow.

---

## PHASE 2: PERFORMANCE BENCHMARKING (Days 3-5)

### Core Web Vitals Baseline

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| LCP (Largest Contentful Paint) | < 2.0s | `___` | `[ ]` |
| INP (Interaction to Next Paint) | < 200ms | `___` | `[ ]` |
| CLS (Cumulative Layout Shift) | < 0.1 | `___` | `[ ]` |
| TTFB (Time to First Byte) | < 600ms | `___` | `[ ]` |
| DB Query p95 | < 100ms | `___` | `[ ]` |

- [ ] Run Lighthouse on all critical routes (record scores above)
- [ ] Run `next build --analyze` — document bundle size
- [ ] Target: First JS bundle < 200KB gzipped

### Page Load Speed Audit

Test these routes under **cold start** and **warm cache**:

- [ ] `/sign-in` (public) — Cold: `___`s | Warm: `___`s
- [ ] `/admin/dashboard` (data-heavy, auth required) — Cold: `___`s | Warm: `___`s
- [ ] `/admin/tenants` (table with 100+ rows) — Cold: `___`s | Warm: `___`s
- [ ] `/tenant/dashboard` (balance calculation) — Cold: `___`s | Warm: `___`s
- [ ] `/admin/agent/meter-readings` (mobile-critical) — Cold: `___`s | Warm: `___`s

Test under network conditions:
- [ ] Slow 3G throttling
- [ ] Fast 4G
- [ ] WiFi (baseline)

### Database Query Optimization

- [ ] Add `EXPLAIN ANALYZE` to all ledger queries — document slow ones
- [ ] Verify indexes exist (check each one):
  - [ ] `tenants.clerkUserId`
  - [ ] `tenants.agencyId`
  - [ ] `tenant_ledger.tenantId`
  - [ ] `tenant_ledger.createdAt`
  - [ ] `pending_transactions.checkoutRequestId`
  - [ ] `buildings.agencyId`
  - [ ] `units.buildingId`
  - [ ] `leases.tenantId`
- [ ] Check for **N+1 queries** in tenant list/dashboard
- [ ] Implement **batch insert** for monthly billing cron (not 10,000 individual INSERTs)
- [ ] Configure connection pooling (Neon PgBouncer)
- [ ] Add query timeout (30s max for web requests)

### Bundle Optimization
- [ ] Code-split heavy components (charts, PDF generation, lease editor)
- [ ] Tree-shake unused shadcn/ui components
- [ ] Lazy load `@uiw/react-md-editor` only on lease template page
- [ ] Document final bundle size: `___`KB

**🟡 Phase 2 Exit Criteria:** All pages load < 2.5s on WiFi. No N+1 queries. Bundle < 200KB.

---

## PHASE 3: CONCURRENCY & LOAD TESTING (Days 6-8)

### Load Testing Setup
- [ ] Install k6: `choco install k6` (Windows) or `brew install k6` (Mac)
- [ ] Write k6 script for STK Push storm scenario
- [ ] Write k6 script for Daraja webhook flood
- [ ] Write k6 script for mixed load scenario

### Concurrency Test Matrix

| Test | Concurrent Users | Duration | Error Rate | p95 Latency | Status |
|------|-----------------|----------|------------|-------------|--------|
| STK Push Initiation | 500 | 5 min | < 5% | < 3s | `[ ]` |
| Daraja Callback Processing | 1,000 | 10 min | 0% | < 2s | `[ ]` |
| Admin Dashboard Load | 200 | 5 min | < 1% | < 3s | `[ ]` |
| Tenant Portal Load | 1,000 | 5 min | < 1% | < 2s | `[ ]` |
| Mixed API Load | 2,000 | 15 min | < 1% | Stable | `[ ]` |

### Database Concurrency Safeguards

- [ ] **Idempotency Keys**: Every STK Push generates UUID, stored 24h. Duplicate = rejected.
- [ ] **Optimistic Locking**: Ledger balance updates use `SELECT FOR UPDATE` in transactions.
- [ ] **Connection Pooling**: Neon max 20 connections, use PgBouncer transaction mode.
- [ ] **Queue Pattern**: Process Daraja callbacks sequentially per tenant (Redis queue or in-memory queue).
- [ ] **Rate Limiting**: Per-tenant: 1 STK Push per 30s. Per-IP: 100 req/min on public routes.

### Double-Payment Prevention (Multi-Layer Defense)

| Layer | Mechanism | Implemented | Tested |
|-------|-----------|-------------|--------|
| DB Constraint | Unique index on `pending_transactions.checkoutRequestId` | `[ ]` | `[ ]` |
| DB Constraint | Unique index on `tenant_ledger.referenceCode` | `[ ]` | `[ ]` |
| Application | Idempotency check before STK Push | `[ ]` | `[ ]` |
| Application | Idempotency check in webhook | `[ ]` | `[ ]` |
| Application | Duplicate callback guard (Redis/cache 24h) | `[ ]` | `[ ]` |
| Business Logic | Disable pay button if balance = 0 | `[ ]` | `[ ]` |

**🔴 Phase 3 Exit Criteria:** 500 concurrent STK Push initiations with < 5% error. Zero duplicate ledger entries under 1,000 simultaneous callbacks.

---

## PHASE 4: DATA INTEGRITY & SECURITY AUDIT (Days 9-11)

### Ledger Immutability Audit
- [ ] Ledger rows should **NEVER** be deleted or updated (only INSERT new rows)
- [ ] Add `createdAt` timestamp (default `NOW()`) — never client-side
- [ ] Add `recordedBy` field to every CREDIT (audit trail)
- [ ] Implement **ledger reconciliation**: nightly job sums all DEBITs/CREDITs, alerts if discrepancy
- [ ] Backup strategy: Neon point-in-time recovery (test restore process)

### Security Penetration Tests

| Attack Vector | Test Method | Result | Status |
|--------------|-------------|--------|--------|
| SQL Injection | Try `' OR 1=1 --` in all form inputs | Pass/Fail | `[ ]` |
| IDOR | Access `/admin/tenants/123` with different agencyId | Pass/Fail | `[ ]` |
| Privilege Escalation | Change role in Clerk metadata to SUPER_ADMIN | Pass/Fail | `[ ]` |
| Replay Attack | Replay Daraja webhook payload | Pass/Fail | `[ ]` |
| Race Condition | Two callbacks for same payment simultaneously | Pass/Fail | `[ ]` |
| XSS | Inject `<script>` in tenant name/complaint | Pass/Fail | `[ ]` |
| Rate Limiting | 1000 requests/second from one IP | Pass/Fail | `[ ]` |

### Webhook Security Hardening
- [ ] Daraja webhook: Verify IP range (Safaricom: `197.248.0.0/16`, `41.215.0.0/16`)
- [ ] Daraja webhook: Verify `X-Callback-Key` header
- [ ] Clerk webhook: Verify `svix` signature
- [ ] Cron endpoint: Verify `CRON_SECRET` header
- [ ] All webhooks: Log full payload + response for 30 days

### Role Permission Audit
- [ ] **Field Agent**: Can only access meter readings + manual receipts (no financials)
- [ ] **Manager**: Can see financials, cannot change Daraja credentials
- [ ] **Agency Owner**: Full access
- [ ] **Tenant**: Can only see own data, pay rent, file complaints
- [ ] Test each role by signing in as each user type

**🔴 Phase 4 Exit Criteria:** All penetration tests pass. No role can access data above permission level. Ledger is immutable.

---

## PHASE 5: SCALABILITY ARCHITECTURE REVIEW (Days 12-13)

### Database Scaling Path

| Tenant Count | Strategy | Current Status |
|-------------|----------|----------------|
| 0-1,000 | Neon single branch | `[ ]` Active |
| 1,000-5,000 | Neon + read replicas | `[ ]` Planned |
| 5,000-10,000 | Neon + connection pooling + materialized views | `[ ]` Planned |
| 10,000+ | Neon + sharding by agency OR AWS RDS/Aurora | `[ ]` Planned |

### API Route Optimization
- [ ] Move heavy operations (monthly billing, bulk exports) to background jobs
- [ ] Use Vercel Edge Functions for auth middleware
- [ ] Implement caching layer:
  - [ ] Agency dashboard data: Redis cache, 5-min TTL
  - [ ] Tenant balance: Cache for 30 seconds
  - [ ] Building/unit lists: Cache for 1 hour
- [ ] Use `revalidatePath` for cache invalidation on mutations

### Frontend Optimization for Scale
- [ ] Virtualize tenant tables (react-window or @tanstack/react-virtual)
- [ ] Implement infinite scroll for ledger history
- [ ] Debounce search inputs (300ms)
- [ ] Optimistic UI updates for payments
- [ ] Service Worker for offline meter reading form

**🟡 Phase 5 Exit Criteria:** Architecture documented for 10K+ tenants. Caching layer implemented. No DOM rendering of 1,000+ rows.

---

## PHASE 6: DISASTER RECOVERY & MONITORING (Days 14-15)

### Monitoring Stack Setup

| Tool | Purpose | Alert Threshold | Configured |
|------|---------|-----------------|------------|
| Vercel Analytics | Core Web Vitals | LCP > 2.5s | `[ ]` |
| Vercel Logs | Error tracking | > 5% 5xx errors | `[ ]` |
| Neon Dashboard | DB performance | Query time > 500ms | `[ ]` |
| Clerk Dashboard | Auth failures | > 1% failed sign-ins | `[ ]` |
| Custom `/api/health` | System health | Any dependency down | `[ ]` |

### Health Check Endpoint
- [ ] Create `/api/health` route
- [ ] Returns: `status`, `database`, `clerk`, `timestamp`, `version`
- [ ] Test: Returns 200 with all green

### Runbooks (Documented)
- [ ] "Daraja webhook is down" — manual payment entry process
- [ ] "Database is slow" — identify slow queries, index addition procedure
- [ ] "Duplicate payment detected" — investigation and refund process
- [ ] "Agency kill switch triggered" — communication template, data export
- [ ] "Clerk outage" — fallback auth procedure (maintenance mode page)

### Backup & Recovery Test
- [ ] Test Neon point-in-time recovery (restore to 1 hour ago)
- [ ] Document RTO (Recovery Time Objective): `___` hours
- [ ] Document RPO (Recovery Point Objective): `___` minutes
- [ ] Export critical data daily to S3/R2

**🟡 Phase 6 Exit Criteria:** All monitoring alerts configured. Runbooks written. Backup restore tested successfully.

---

## PHASE 7: USER EXPERIENCE & ACCESSIBILITY (Days 16-17)

### Mobile-First Agent Experience
- [ ] Test meter reading form on 4-inch screen (iPhone SE)
- [ ] "Log Reading" button thumb-reachable (bottom of screen)
- [ ] Test with spotty 3G connection (Chrome DevTools throttling)
- [ ] Offline mode: Store readings in IndexedDB, sync when online
- [ ] Camera integration for receipt uploads (direct from camera)

### Tenant Payment Experience
- [ ] STK Push flow: < 3 taps from dashboard to payment initiation
- [ ] Loading states: "Connecting to M-Pesa..." → "Check your phone..." → "Payment received!"
- [ ] Failure handling: Specific errors ("M-Pesa timeout", "Insufficient funds", "Network error")
- [ ] Receipt: Auto-generated after payment

### Accessibility (WCAG 2.1 AA)
- [ ] All forms have proper labels
- [ ] Color contrast > 4.5:1 (especially red for outstanding balance)
- [ ] Keyboard navigation works for all flows
- [ ] Screen reader compatible (aria-labels on all interactive elements)

**🟢 Phase 7 Exit Criteria:** Mobile-optimized, WCAG AA compliant. Agent form works offline.

---

## PHASE 8: END-TO-END QA MATRIX (Days 18-20)

### Role-Based Test Matrix

| Role | Flow | Expected Result | Pass | Fail |
|------|------|-----------------|------|------|
| SUPER_ADMIN | Create agency → toggle kill switch → agency blocked | Staff see `/suspended` | `[ ]` | `[ ]` |
| SUPER_ADMIN | Create agency → invite owner | Owner receives email, can sign in | `[ ]` | `[ ]` |
| AGENCY_OWNER | Create building → add utilities → add 10 units | All data persisted, no 404s | `[ ]` | `[ ]` |
| AGENCY_OWNER | Configure Daraja credentials | Masked input, encrypted storage | `[ ]` | `[ ]` |
| MANAGER | Invite tenant → tenant signs in | Tenant linked to unit, ledger created | `[ ]` | `[ ]` |
| MANAGER | View complaints → assign → resolve | Tenant receives SMS notification | `[ ]` | `[ ]` |
| FIELD_AGENT | Log meter reading → view in ledger | DEBIT appears, balance updates | `[ ]` | `[ ]` |
| FIELD_AGENT | Log cash payment → duplicate prevention | Warning if referenceCode exists | `[ ]` | `[ ]` |
| TENANT | View balance → Pay → STK Push → callback | Ledger CREDIT, balance ↓, SMS sent | `[ ]` | `[ ]` |
| TENANT | Sign lease → digital signature | `leases.signedAt` populated | `[ ]` | `[ ]` |
| TENANT | File complaint with photos | Complaint visible in manager dashboard | `[ ]` | `[ ]` |
| SYSTEM | Monthly billing cron runs | All active tenants get DEBIT rows | `[ ]` | `[ ]` |
| SYSTEM | Rent reminder cron runs | Africa's Talking SMS delivered | `[ ]` | `[ ]` |

### Edge Case Test Matrix

| Scenario | Test | Expected Behavior | Pass | Fail |
|----------|------|-------------------|------|------|
| Double STK Push | Click Pay twice rapidly | Second request rejected | `[ ]` | `[ ]` |
| Double callback | Send same Daraja callback twice | Second callback ignored | `[ ]` | `[ ]` |
| Cron overlap | Billing cron + agent logging reading | Both succeed, no deadlock | `[ ]` | `[ ]` |
| Vacated tenant login | Sign in as VACATED | Redirect to `/deactivated` | `[ ]` | `[ ]` |
| Suspended agency | Staff tries to access admin | Redirect to `/suspended` | `[ ]` | `[ ]` |
| Invalid meter reading | currentReading < previousReading | Form validation error | `[ ]` | `[ ]` |
| Zero balance payment | Try to pay when balance = 0 | Button disabled | `[ ]` | `[ ]` |
| Large ledger | Tenant with 500+ rows | Virtualized table, < 2s load | `[ ]` | `[ ]` |
| Network failure | Agent logs reading offline | Stored locally, syncs when online | `[ ]` | `[ ]` |
| Clerk webhook failure | Webhook doesn't fire on user.created | Manual sync button in admin | `[ ]` | `[ ]` |

### Browser + Device Testing
- [ ] Chrome (desktop)
- [ ] Safari (desktop + iOS)
- [ ] Firefox (desktop)
- [ ] Chrome Mobile (Android emulator)
- [ ] Safari Mobile (iPhone)
- [ ] Samsung Internet (common in Kenya)

**🔴 Phase 8 Exit Criteria:** All role flows pass. All edge cases handled. No data leaks between buildings. Ledger math correct in all scenarios.

---

## PHASE 9: PRODUCTION DEPLOY (Day 21)

### Pre-Deploy Checklist
- [ ] All Phase 0-8 tests pass
- [ ] No critical or high-severity security issues
- [ ] Performance targets met (LCP < 2.5s, p95 DB < 100ms)
- [ ] Load test passed (500 concurrent STK Push, < 5% error)
- [ ] Backup tested, restore procedure documented
- [ ] Rollback plan documented (previous Vercel deployment ready)

### Deploy Steps
- [ ] Switch Neon `DATABASE_URL` to `main` branch (production)
- [ ] Run `drizzle-kit push` against Neon production branch
- [ ] Switch Clerk to production instance
- [ ] Update all env vars in Vercel dashboard (Production)
- [ ] Verify `CRON_SECRET` is set and cron endpoint rejects unsigned requests
- [ ] Deploy to Vercel with `vercel --prod`
- [ ] Update Daraja Callback URL to production domain
- [ ] Update Daraja Validation URL to production domain
- [ ] Update Daraja Confirmation URL to production domain
- [ ] Switch Africa's Talking to live credentials
- [ ] Test KES 1 live STK Push end-to-end

### Post-Deploy Verification (First 24 Hours)
- [ ] Sign in as Super Admin on production domain ✓
- [ ] Sign in as Agency Owner ✓
- [ ] Invite a real test tenant ✓
- [ ] Trigger KES 1 STK Push (live) ✓
- [ ] Confirm callback fires and ledger updates ✓
- [ ] Confirm SMS delivers via Africa's Talking live ✓
- [ ] Trigger monthly billing cron manually ✓
- [ ] Monitor Vercel logs for 5xx errors (hourly)
- [ ] Monitor Neon for slow queries (hourly)
- [ ] Check `/api/health` endpoint (hourly)
- [ ] Review Core Web Vitals in Vercel Analytics

**🔴 Phase 9 Exit Criteria:** Live app accessible at production URL. Real M-Pesa payment processed. Tenant receives SMS confirmation. You are live. 🚀

---

## PHASE 10: POST-LAUNCH STABILIZATION (Days 22-30)

### Daily Monitoring (First Week)
- [ ] Check Vercel Analytics dashboard
- [ ] Review error logs (target: < 0.1% error rate)
- [ ] Verify SMS delivery rate (target: > 95%)
- [ ] Check STK Push success rate (target: > 98%)
- [ ] Run ledger reconciliation script (target: 100% accuracy)
- [ ] Respond to user feedback within 2 hours

### Weekly Reviews
- [ ] Performance regression check (LCP, INP, CLS)
- [ ] Database query performance review (top 10 slowest queries)
- [ ] Security log review (unusual access patterns, failed auth attempts)
- [ ] Feature usage analytics (most/least used features)

### Metrics Dashboard (Track Daily)

| Metric | Target | Day 1 | Day 7 | Day 14 | Day 30 |
|--------|--------|-------|-------|--------|--------|
| Uptime | 99.9% | `___` | `___` | `___` | `___` |
| STK Push Success Rate | > 98% | `___` | `___` | `___` | `___` |
| Ledger Accuracy | 100% | `___` | `___` | `___` | `___` |
| Page Load (LCP) | < 2.5s | `___` | `___` | `___` | `___` |
| DB Query p95 | < 100ms | `___` | `___` | `___` | `___` |
| API Error Rate | < 0.1% | `___` | `___` | `___` | `___` |
| SMS Delivery Rate | > 95% | `___` | `___` | `___` | `___` |
| Support Tickets | < 5/day | `___` | `___` | `___` | `___` |
| Active Tenants | Growth | `___` | `___` | `___` | `___` |

---

## DEFERRED TO V2 (Post-Launch)

| Feature | Reason Deferred | Planned Quarter |
|---------|-----------------|-----------------|
| Multi-agency SaaS onboarding | V1 is single-agency; schema already supports it | Q2 2026 |
| Subscription billing (Stripe/Pesapal) | Agencies pay you — add after launch | Q2 2026 |
| PDF statement exports | Nice to have, not MVP | Q1 2026 |
| Landlord portal (read-only) | Landlord login to see building revenue | Q2 2026 |
| Mobile app (React Native) | Web is sufficient for MVP | Q3 2026 |
| Unit vacancy advertising | Out of current scope | Q3 2026 |
| In-app chat (real-time) | Africa's Talking SMS covers comms for now | Q3 2026 |
| Electricity prepaid token integration | Complex KPLC API — defer | Q4 2026 |

---

## KEY PRINCIPLES (Read Before Every Phase)

> **1. Zero Double-Charges:** Idempotency at every layer. A tenant clicking "Pay" 10 times should result in exactly 1 charge.
>
> **2. Zero Data Loss:** Ledger is immutable. Every shilling is accounted for. Backups are tested, not just configured.
>
> **3. Always Available:** 99.9% uptime. Graceful degradation when dependencies fail (Daraja down = manual entry mode).
>
> **4. Fast on Any Network:** 3G-optimized. Agent forms work offline. Tenant payment is 3 taps.
>
> **5. Transparent:** Real-time balance. Audit trail. SMS confirmation for every transaction.
>
> **6. Secure by Default:** Every query filtered by agencyId. Every webhook verified. Every role boundary tested.

---

## NOTES & DECISIONS LOG

| Date | Decision | Rationale | Decision Maker |
|------|----------|-----------|----------------|
| | | | |
| | | | |
| | | | |

---

*Last Updated: 2026-06-30*
*Version: 1.0 — Production Readiness*
*"Bulletproof Before Billions"*