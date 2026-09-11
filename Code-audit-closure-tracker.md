# CODE_AUDIT_CLOSURE_TRACKER.md — PropFlow Kenya
### Closing the gaps found in the live repo (Simon749/Agency-), not the gaps found on paper

This tracker is narrower than Gapclosuretracker.md on purpose. That doc maps *what the system should eventually do*. This one maps *what's actually wrong in the code right now* — verified by cloning the repo and reading it, not by re-reading the design docs. Every item below is something that exists today, in production-bound code, and will bite you specifically because it's already built and half-working, which is more dangerous than not-built-at-all.

**Ordering principle:** fix the things that silently fail before the things that are merely unbuilt. A missing feature is visible. A kill switch that doesn't switch, or a rate limiter that stops limiting on every cold start, looks fine in every demo and fails exactly when you need it — usually with real money involved.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| 🔴 | Blocker — this is a live hole, fix before marketing or scaling |
| 🟡 | Important — do soon, but not an active leak |
| 🟢 | Hardening — strengthens the system |

---

## PHASE 0 — Access Control That Doesn't Actually Control Access

**Why first:** These two bugs mean the security model you designed on paper isn't the security model currently enforced by the code. Everything else assumes this layer works.

- [ ] 🔴 **Enforce the kill switch.** `agencies.isActive` is toggled by Super Admin and `/suspended` exists as a page, but nothing reads `isActive` before letting staff into `/admin/*`. Add the check inside `getSessionMeta()` or `requireRole()` in `lib/auth/getRole.ts` — fetch the agency's `isActive` flag (cache it, don't hit the DB on every request — see Phase 2) and `redirect('/suspended')` if false. This must run for every role except `SUPER_ADMIN`.
- [ ] 🔴 Write a test: suspend an agency, confirm an `AGENCY_OWNER` session hitting `/admin/dashboard` gets redirected, not a 200.
- [ ] 🔴 Confirm the same check runs for **API routes**, not just page layouts — a suspended agency's staff shouldn't be able to call `/api/payments/stk-push` even if they never load a page.
- [ ] 🟡 **Decide on middleware vs. per-layout enforcement, deliberately.** Right now there's no `middleware.ts` at all — every route relies on its own layout calling `requireRole()`. That's a valid pattern, but it means a forgotten check on one new route is a silent open door with no framework-level safety net. Either (a) add a `middleware.ts` that does a coarse-grained auth+kill-switch check on every non-public route as a backstop, or (b) write a lint rule / CI check that fails if a new file under `app/(admin)/` or `app/api/` doesn't import `requireRole`/`withAgencyContext`. Pick one — don't leave it implicit.
- [ ] 🟡 Audit every route under `app/api/` by hand once and confirm each one calls an auth check. Do this as a checklist, not a spot check — this is the list of things an attacker will try first.

**🔴 Phase 0 Exit Criteria:** A suspended agency is provably blocked — pages and API routes both — in a test, not by inspection. Every API route has a documented auth check.

---

## PHASE 1 — Financial Write Path Performance

**Why now:** This is the one most likely to cause a real outage, because it's invisible until concurrent load hits it — and rent collection is inherently bursty (everyone pays around the 1st of the month).

- [ ] 🔴 **Stop opening a new Postgres connection per financial write.** `lib/db/rls.ts`'s `withAgencyContext()` currently does `new Pool({ max: 1 })` → run query → `pool.end()` on every call. Every STK Push, every ledger write, every manual receipt pays a full connection handshake cost, and under concurrent load these compete with your main pool for Neon's connection ceiling independently.
  - [ ] Replace the per-call pool with a **transaction-scoped `SET LOCAL`** against the existing shared pool (`getDb()`), the same pattern already used in `withAgencyContextRead()` — but make it safe for writes, not just reads. The comment in the code explicitly says the read variant "may not persist across connection switches" and to use the dedicated pool "for financial operations" — that's the part to fix, not work around.
  - [ ] If Neon's pooler genuinely can't guarantee `SET LOCAL` survives across a transaction reliably (confirm this against current Neon docs — this may have changed), the correct fix is a small **dedicated connection pool that's created once at module load and reused**, not recreated per request. `max: 1` reused across requests still serializes writes, which may itself be a bottleneck under real concurrency — size it deliberately.
  - [ ] Load-test the fix: fire 200 concurrent simulated STK Push callbacks at a staging environment and confirm no connection-limit errors and no latency cliff.
- [ ] 🟡 Add a metric/log line that records connection acquisition time separately from query time, so a future regression here is visible in monitoring instead of discovered during a traffic spike.

**🔴 Phase 1 Exit Criteria:** A load test of 200+ concurrent ledger-writing requests completes with no connection exhaustion and no per-request handshake overhead in the p95 latency.

---

## PHASE 2 — Silent-Failure Dependencies

**Why now:** Both of these "work" in every manual test and dev session, then quietly stop protecting you in production the moment `UPSTASH_REDIS_REST_URL` isn't set correctly on a given deploy — no error, no alert, just a duplicate charge or an unthrottled endpoint.

- [ ] 🔴 **Make Redis a hard requirement in production, not a soft fallback.** `lib/rate-limit.ts` and the M-Pesa webhook's dedup cache both fall back to an in-memory `Map` "for dev only" — but nothing stops this fallback from running in production if the env var is missing or misconfigured, and a `Map` on a serverless instance doesn't survive cold starts or share state across instances anyway.
  - [ ] Add a startup check (in `/api/health` and ideally a deploy-time check) that fails loudly if `UPSTASH_REDIS_REST_URL`/`TOKEN` are unset in a production environment, instead of silently degrading.
  - [ ] Add a log/alert (not just a `console.warn`) any time the in-memory fallback path is actually exercised, so you'd know within minutes if this regresses.
- [ ] 🟡 **Harden the RLS agency-id injection point.** `lib/db/rls.ts` builds `SET app.current_agency_id = '${rlsAgencyId}'` via raw string interpolation (`sql.raw`) rather than a parameterized call. It's not exploitable today because the value only ever comes from Clerk session metadata, not user input — but that's a fragile invariant to depend on forever. Switch to `set_config('app.current_agency_id', $1, false)` via a parameterized query, and add a regex/UUID-format assertion on `rlsAgencyId` before it ever reaches SQL as defense in depth.
- [ ] 🟢 Add a test that tries to pass a malformed/malicious string as `agencyId` through the RLS context setter and confirms it's rejected, not interpolated.

**🔴 Phase 2 Exit Criteria:** Missing Redis config causes a loud startup failure in production, not silent degradation. The RLS context setter uses parameterized SQL and validates its input.

---

## PHASE 3 — Repo Hygiene

**Why now:** Low effort, and it's the kind of thing a landlord's or investor's technical advisor will check in the first five minutes of due diligence.

- [ ] 🟡 Remove the six committed `backup_*.sql` files from the repo. They're currently empty, but committing DB backups to git at all is the wrong pattern — the moment one of these isn't empty, it's tenant PII and financial data sitting in a public GitHub repo, permanently, even if you later delete the file (git history keeps it).
- [ ] 🟡 Add `backup_*.sql` and any `*.sql` dump pattern to `.gitignore`.
- [ ] 🟡 If any backup file was ever committed with real content in the repo's history, treat it as a disclosed secret: rotate any credentials that could have been in it, and consider scrubbing git history (`git filter-repo` or BFG) before this repo is shown to anyone external.
- [ ] 🟢 Do a one-time `git log -p` scan (or a tool like `trufflehog`/`gitleaks`) across the full history, not just the current tree, to confirm nothing else was ever committed and later removed.

**🟡 Phase 3 Exit Criteria:** No database dumps in the repo or its history. A secret-scanning tool runs clean against full git history.

---

## PHASE 4 — The Landlord Layer (Your Actual Differentiator, Currently Thinnest)

**Why now:** Everything above is defensive. This is the part that makes an agency choose you over a spreadsheet, and a landlord trust the agency more because they use you — and it's the least-built part relative to the payment core. Don't let hardening work above become an excuse to keep deferring this.

- [ ] 🟡 `landlord_payouts` table + monthly computation of collected/commission/net-payable per building (this already exists as Phase E in Gapclosuretracker.md — pull it forward, it's not a "later" feature, it's the pitch)
- [ ] 🟡 A read-only landlord statement page, accessible via magic link (`landlordAccessToken`), no full auth system required
- [ ] 🟡 Make sure this statement pulls from the **same ledger** the tenant and agency see — a landlord noticing a mismatch between what they're shown and what an agency employee sees would undermine the entire trust pitch
- [ ] 🟢 SMS the landlord a link to their statement monthly, same delivery mechanism you already use for tenants

**🟡 Phase 4 Exit Criteria:** A landlord can open a link and see, without calling their agency, what was collected this month for their building — and that figure is provably the same number the agency's own dashboard shows.

---

## Suggested Working Rhythm

1. Phase 0 and Phase 1 are both 🔴 for a reason — one is a live access-control bug, the other is a live scaling cliff. Do both before any marketing push or pilot onboarding, in either order, but don't skip either.
2. Every fix in Phase 0–2 ships with the specific test described next to it. "I fixed it and it looks right" is not the bar — these are exactly the bugs that looked right before.
3. Re-run the RLS isolation test (`__tests__/rls-isolation.test.ts`) after Phase 1 and Phase 2 changes — both touch the same connection/session-context machinery it depends on.
4. Phase 3 is a single afternoon. Do it before you show this repo to any landlord, investor, or agency's technical due diligence.
5. Phase 4 is the one item here that's about winning customers, not preventing incidents. Don't let it permanently lose to the security backlog — timebox Phase 0–3 and then move to it.

---

*Companion to: Design.md, Progresstracker.md, PROGRESS_TRACKER_PRODUCTION.md, Gapclosuretracker.md*
*Purpose: Close the gaps that exist in the current code, verified by reading it — not the gaps that exist in the plan.*
*Source of findings: direct review of github.com/Simon749/Agency- as of this tracker's creation date.*
