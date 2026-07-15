# GAP_CLOSURE_TRACKER.md — PropFlow Kenya
### From "Feature-Complete MVP" to "System I'd Trust With Real Rent Money"

This tracker doesn't replace your existing PROGRESS_TRACKER files — it sits alongside them and closes the structural gaps a senior review surfaced: things that won't show up in a demo, but will show up as a 2am incident, a landlord dispute, or a data leak once you have real users.

**Ordering principle:** foundation before features. Phases A and B make every later phase trustworthy. Don't skip ahead because a later phase looks more exciting — a landlord portal built on an unenforced data-isolation model is a landlord portal that will eventually leak another agency's data.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| 🔴 | Blocker — do not proceed past this phase without it |
| 🟡 | Important — do soon |
| 🟢 | Strengthens the system, not launch-blocking |
| ⚖️ | Not an engineering task — legal/advisory, do in parallel |

---

## PHASE A — Enforce Data Isolation at the Database Layer

**Why first:** Right now, `agencyId` in every WHERE clause is the *only* thing preventing cross-agency data leaks, and it depends on every developer remembering it, forever. One missed clause in one PR is a real incident, not a hypothetical one.

- [ ] Enable Postgres Row-Level Security (RLS) on every multi-tenant table (`buildings`, `units`, `tenants`, `leases`, `tenant_ledger`, `utility_readings`, `pending_transactions`, `complaints`, `complaint_updates`)
- [ ] Set a session variable (e.g. `app.current_agency_id`) at the start of every DB connection/request, derived from the authenticated Clerk session — never from client input
- [ ] Write RLS policies: `USING (agency_id = current_setting('app.current_agency_id')::uuid)`
- [ ] Add a `SUPER_ADMIN` bypass policy scoped explicitly (not a blanket bypass — log every super-admin cross-agency read)
- [ ] Write a test suite that *removes* the `agencyId` filter from a query on purpose and confirms RLS still blocks the leak — this is your proof it works, not just that it's configured
- [ ] Re-run the IDOR test from your existing pentest matrix against RLS-protected tables

**🔴 Phase A Exit Criteria:** A deliberately broken query (missing agencyId filter) returns zero rows instead of another agency's data, in a real test, not a code review assumption.

---

## PHASE B — Build the Audit Log (Separate From the Ledger)

**Why now:** The ledger records money movement. It does not record *who changed what, when, from where*. You need both, and you need them before you have real users, because you can't retroactively audit actions you never logged.

- [ ] Create `audit_log` table: `id, actorClerkId, actorRole, agencyId, action, targetTable, targetId, beforeValue (jsonb), afterValue (jsonb), ipAddress, userAgent, createdAt`
- [ ] Log on every: role change, Daraja credential update, rent/deposit amount edit, kill-switch toggle, national ID field access, tenant/staff removal, manual ledger entry
- [ ] Make `audit_log` append-only at the DB level (no UPDATE/DELETE grants for the app role — enforce with Postgres permissions, not just app logic)
- [ ] Ship a daily export of `audit_log` to cold storage (S3/R2) — if the primary DB is ever compromised, history should still be provable elsewhere
- [ ] Build a minimal Super Admin view: "show me every action on Agency X in the last 30 days"

**🔴 Phase B Exit Criteria:** You can answer "who changed this tenant's rent amount and when" for any record, without querying application logs by hand.

---

## PHASE C — Financial Correctness: Allocation, Reversals, Checkpoints

**Why now:** These are silent-until-they're-not bugs. They work fine with 15 seed tenants and fail the first time a partial payment or a refund happens for real.

### Payment allocation
- [ ] Define allocation priority explicitly (recommend: oldest arrears first, then current month rent, then current month utilities — but *decide* and document it)
- [ ] Implement `allocatePayment(tenantId, amount)` that walks open DEBIT rows in priority order and marks how much of the CREDIT applied to each
- [ ] Add `appliedToLedgerEntryId` linkage so a statement can show "this payment cleared these specific charges"

### Reversals & refunds
- [ ] Add `REVERSAL` to `entryTypeEnum` (or a `isReversal` flag + `reversesEntryId` FK) — never delete or edit a ledger row, always offset it
- [ ] Build the refund-to-M-Pesa flow (Daraja B2C) for the "tenant was overcharged" case
- [ ] Document the actual runbook: duplicate payment detected → investigate → issue reversal entry → trigger B2C refund → SMS confirmation

### Balance performance
- [ ] Add `balance_snapshots` table: `tenantId, asOfDate, balance` written monthly (e.g., during the billing cron)
- [ ] Change `getTenantBalance()` to read the latest snapshot + sum only rows since that snapshot — not the entire history every time
- [ ] Backfill snapshots for existing seed/test data and verify snapshot-based balance matches full-history balance exactly

**🔴 Phase C Exit Criteria:** A partial payment correctly shows which specific charges it cleared. A reversal produces a correct new balance without editing history. Balance calculation time doesn't grow with tenant tenure.

---

## PHASE D — Reconciliation & Fraud Controls

**Why now:** This is where Kenya-specific reality lives — agent-side cash skimming and silent webhook failures are the actual failure modes you'll see in production, not theoretical attacks.

- [ ] Build nightly job: pull Daraja transaction/settlement report per shortcode, diff against `tenant_ledger` CREDIT rows, alert on any mismatch
- [ ] Add a `reconciliation_discrepancies` table logging any unmatched transaction (either side) for manual review
- [ ] Add maker-checker on manual entries: Field Agent logs a cash/bank receipt → status `PENDING_APPROVAL` → Manager approves before it posts to the ledger and affects balance
- [ ] Add a simple anomaly flag: utility reading more than N% above the tenant's trailing 3-month average → auto-flag for manager review before billing
- [ ] Add a daily per-agent report: total cash entries logged, for the agency owner to spot patterns

**🟡 Phase D Exit Criteria:** Every shilling that hits your ledger can be traced to a matching Safaricom settlement record or an approved manual entry. No single field agent can post a ledger-affecting entry unilaterally.

---

## PHASE E — Landlord Value Layer (Pull Forward From "V2")

**Why now, not later:** This is your actual differentiator in the Kenyan market — landlords currently have no visibility into what agencies actually collect. Deferring it means launching without your strongest value proposition.

- [ ] Add `landlord_payouts` table: `buildingId, periodStart, periodEnd, totalCollected, agencyCommission, netPayable, paidAt, paymentReference`
- [ ] Compute agency commission (flat % or fixed fee, agency-configurable) against total collected per building per month
- [ ] Generate a monthly landlord statement (PDF or plain-text) — doesn't need a login portal in v1, an SMS with a link to a read-only statement page is enough
- [ ] Add a `landlordAccessToken` (magic-link style, no full auth system needed yet) so a landlord can view their own building's statement without a Clerk account
- [ ] Track: collected vs. remitted vs. outstanding, per building, visible to the landlord

**🟡 Phase E Exit Criteria:** A landlord can see, without calling their agency, exactly what was collected this month and what they should expect to receive.

---

## PHASE F — Billing Cron: From Loop to Queue

**Why now:** Your current design bills every active tenant in a single serverless function invocation. This works at 50 tenants. It will time out and partially fail at scale, with no clean resumability.

- [ ] Replace the single-loop cron with a fan-out pattern: cron enqueues one job per building (or per 500-tenant batch) into a real queue (Upstash QStash used as a queue, or SQS)
- [ ] Each batch job is idempotent per `(tenantId, billingMonth)` — re-running a batch that partially succeeded should not double-bill anyone
- [ ] Add a `billing_runs` table tracking status per batch (`PENDING`, `RUNNING`, `COMPLETE`, `FAILED`) so a failed batch can be identified and retried in isolation
- [ ] Load-test the batch approach against a seeded 50,000-tenant dataset before trusting it at real scale

**🟡 Phase F Exit Criteria:** Billing 100,000+ tenants completes without a single serverless timeout, and a failed batch can be safely re-run without double-charging anyone.

---

## PHASE G — Security Hardening Beyond the Existing Pentest Matrix

- [ ] Enforce MFA for `AGENCY_OWNER` and `SUPER_ADMIN` roles (Clerk supports this natively — turn it on, don't build it)
- [ ] Decide and document the encryption key management approach for Daraja credentials (pick one: Vercel KMS, or a dedicated secrets manager) — write down who can rotate it and how often
- [ ] Add per-agency rate limiting (not just per-IP) so one agency's traffic spike or abuse can't degrade the platform for others
- [ ] Add a scheduled key-rotation reminder for Daraja credentials and Clerk webhook secrets

**🟢 Phase G Exit Criteria:** Admin accounts require MFA. Encryption keys have a named owner and a rotation schedule, not "TBD."

---

## PHASE H — Kenya Market-Fit Adjustments

- [ ] Design a shared-aggregator-paybill fallback for agencies too small to get their own Safaricom shortcode (account-number-based routing instead of per-building shortcode) — validate this against your actual target customer size before assuming every agency can onboard with Daraja directly
- [ ] Evaluate WhatsApp Business API as a primary notification channel alongside/instead of SMS at scale (cost and delivery both favor it in Kenya)
- [ ] Model Daraja's real per-shortcode rate limits against your expected "1st-of-the-month payment spike" traffic pattern — this is a queuing problem regardless of how well your own app scales

**🟢 Phase H Exit Criteria:** You have a payment path for agencies without their own paybill, and a plan for the 1st-of-month STK Push spike that doesn't assume Safaricom scales with you.

---

## ⚖️ PHASE I — Legal & Compliance (Run in Parallel, Not Sequentially)

These aren't engineering tasks — don't let them block code, but don't let them sit unaddressed either.

- [ ] ⚖️ Get a legal opinion on whether PropFlow's money flow (does cash ever custody with PropFlow, or does it land directly in each agency's own account?) triggers Payment Service Provider obligations under Kenya's National Payment System Act
- [ ] ⚖️ Register with the Office of the Data Protection Commissioner (ODPC) under Kenya's Data Protection Act 2019 — this replaces the GDPR reference in your current DESIGN.md
- [ ] ⚖️ Confirm whether any of your billed categories (service charge, wifi, security) are VATable and require KRA eTIMS-compliant invoicing, separate from rent itself
- [ ] ⚖️ Draft a data breach notification procedure matching Kenyan DPA requirements (timelines differ from GDPR)

**🔴 Phase I Exit Criteria:** You have a written legal answer on money-custody classification before scaling past a handful of pilot agencies — this determines your actual architecture, not just your paperwork.

---

## Suggested Working Rhythm

1. One phase-item = one branch = one PR = one test. Don't bundle.
2. Every Phase C (financial logic) change ships with a reconciliation test *before* any UI work on top of it.
3. Run Phase A and B fully before starting Phase E or F — they're the foundation everything else stands on.
4. Phase I runs in parallel from day one — it's a phone call, not a sprint, but it can block launch if ignored.
5. Re-run your existing Phase 8 (End-to-End QA Matrix) from PROGRESS_TRACKER_PRODUCTION.md after each phase here — these changes touch core money-movement paths and deserve the same scrutiny as the original build.

---

*Companion to: DESIGN.md, PROGRESS_TRACKER.md, PROGRESS_TRACKER_PRODUCTION.md*
*Purpose: Close structural gaps before scale, not after an incident.*