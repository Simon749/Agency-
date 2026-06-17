# PROGRESS_TRACKER.md — PropFlow Kenya
### Full Development Roadmap: Week 1 → Production on Vercel

---

## Legend

| Symbol | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| 🔴 | Blocker — must complete before next phase |
| 🟡 | Important — do soon |
| 🟢 | Nice to have — can defer |

---

## Phase Overview

```
Week 1-2   → Foundation (DB, Auth, Schema)
Week 3-4   → Agency & Building Management
Week 5-6   → M-Pesa Integration
Week 7-8   → Tenant Portal + Ledger Display
Week 9-10  → Utilities, Meter Readings, Manual Receipts
Week 11-12 → Lease Engine + Digital Signing
Week 13-14 → Complaints System + SMS Notifications
Week 15-16 → Super Admin Dashboard + Cron Automation
Week 17    → QA, Edge Cases, Seed Data Testing
Week 18    → Staging → Production Deploy on Vercel
```

---

---

## ✅ WEEK 1 — Project Foundation

**Goal:** Working repo, environment variables set, Clerk auth running, DB connected.

### Setup
- [ ] Initialise Next.js 14 project with App Router (`npx create-next-app@latest`)
- [ ] Install and configure Tailwind CSS + shadcn/ui (`npx shadcn-ui@latest init`)
- [ ] Set up Git repo and push to GitHub

### Clerk Auth
- [ ] Create Clerk application (set to "Email + Phone" sign-in)
- [ ] Disable public sign-up — set to **Invite Only** in Clerk dashboard
- [ ] Install `@clerk/nextjs`, add `ClerkProvider` to root layout
- [ ] Create `middleware.ts` — protect all routes except `/sign-in`
- [ ] Define custom `publicMetadata` shape: `{ role, agencyId, buildingId, unitId }`
- [ ] Seed the first Super Admin account manually via Clerk dashboard
- [ ] Test: Super Admin can sign in, middleware redirects correctly

### Database
- [ ] Create Neon project — two branches: `main` (prod) and `dev`
- [ ] Install Drizzle ORM + `drizzle-kit`, configure `drizzle.config.ts`
- [ ] Write all schema files (see DESIGN.md Section 4.2)
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
- [ ] Run `drizzle-kit push` against Neon dev branch — confirm tables created
- [ ] Write `lib/db/index.ts` — export typed `db` instance

### Environment Variables
- [ ] `.env.local` configured with:
  - `DATABASE_URL` (Neon dev branch)
  - `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_WEBHOOK_SECRET`
- [ ] Add all to Vercel project environment variables (under preview/production)

**🔴 Week 1 Exit Criteria:** Sign in works. Database tables exist. `db.select().from(agencies)` returns empty array without error.

---

## ✅ WEEK 2 — Role Middleware + Agency Bootstrapping

**Goal:** Clerk roles enforce route access. First agency can be created by Super Admin.

### Role-Based Middleware
- [ ] Extend `middleware.ts` to read `publicMetadata.role`
- [ ] Redirect rules:
  - `SUPER_ADMIN` → `/super-admin/dashboard`
  - `AGENCY_OWNER` → `/admin/dashboard`
  - `MANAGER` → `/admin/dashboard`
  - `FIELD_AGENT` → `/admin/agent/meter-readings`
  - `TENANT` → `/tenant/dashboard`
- [ ] Build `lib/auth/getRole.ts` — server-side helper to extract role from Clerk session
- [ ] Protect all `/admin/*` routes — block if no `agencyId` in metadata

### Clerk Webhook (User Sync)
- [ ] Install `svix` for webhook signature verification
- [ ] Create `/api/webhooks/clerk/route.ts`
  - On `user.created`: check if a matching `tenants` row exists (by email/phone) → link `clerkUserId`, update `inviteStatus = "ACCEPTED"`
- [ ] Test with Clerk webhook local tunnel (ngrok or Vercel dev)

### Super Admin — Agency Management
- [ ] Build `/super-admin/agencies` page — list all agencies from DB
- [ ] Build "Create Agency" form (name, email, phone)
- [ ] On submit: INSERT into `agencies` table
- [ ] Toggle `isActive` — the kill switch

**🔴 Week 2 Exit Criteria:** Super Admin can create an Agency record. Roles route correctly. Clerk webhook links tenant accounts on sign-in.

---

## ✅ WEEK 3 — Buildings + Units CRUD

**Goal:** Agency Owner can set up their full property portfolio.

### Buildings
- [ ] `/admin/buildings` — list all buildings for `agencyId`
- [ ] "Add Building" form:
  - Name, location/locale, landlord name, landlord phone
  - Daraja credentials section (Consumer Key, Consumer Secret, Shortcode, Passkey) — **masked input, stored encrypted**
- [ ] Edit and delete (soft-delete) building
- [ ] 🔴 All queries filter by `agencyId` — add Drizzle `.where(eq(buildings.agencyId, agencyId))` to every query

### Building Utilities Configuration
- [ ] Per-building utility toggle UI:
  - Checkboxes: Rent (always on), Water, Electricity, Garbage, WiFi, Service Charge, Security
  - For each enabled utility: set `rateType` (FIXED / PER_UNIT) and `defaultAmount`
- [ ] Save to `building_utilities` table
- [ ] Display configured utilities on building detail page

### Units
- [ ] `/admin/buildings/[id]/units` — list all units in a building
- [ ] "Add Unit" form: unit number, floor, type (1BR/2BR/Bedsitter/Studio), rent amount, deposit amount
- [ ] Bulk add units (optional for MVP — add unit numbers as comma-separated list)
- [ ] Show occupancy status per unit (occupied / vacant)

**🔴 Week 3 Exit Criteria:** Can create a building with utilities and add 10 units. All data is scoped to the correct agency.

---

## ✅ WEEK 4 — Tenant Onboarding (Invite Flow)

**Goal:** Agents can add tenants and send invite links. Tenants cannot self-register.

### Invite Wizard
- [ ] `/admin/tenants/new` — "Add Tenant" form:
  - Full name, phone number, email, national ID
  - Select building → select unit (only vacant units shown)
  - Set lease start date, duration (1 year / 2 years), rent amount, deposit amount
- [ ] On submit:
  1. INSERT into `tenants` table (`inviteStatus = "PENDING"`)
  2. INSERT into `leases` table
  3. Set `units.isOccupied = true`
  4. Call Clerk API to create user + send invite email/SMS
- [ ] Display invite status on tenant list (Pending / Accepted)

### Tenant List
- [ ] `/admin/tenants` — filterable table: by building, by status (ACTIVE / VACATED / PENDING)
- [ ] Tenant detail page: unit info, lease summary, ledger summary (placeholder for now)
- [ ] "Resend Invite" button for PENDING tenants

### Staff Invites
- [ ] Agency Owner can invite Managers and Field Agents
- [ ] Invite form: name, email, role selector (MANAGER / FIELD_AGENT)
- [ ] On submit: Clerk `createInvitation` with `publicMetadata` pre-set

**🔴 Week 4 Exit Criteria:** Full invite flow works end-to-end. New tenant receives email, signs in, and is linked to their unit.

---

## ✅ WEEK 5 — Daraja M-Pesa Integration (STK Push)

**Goal:** Tenant can initiate rent payment from the app via STK Push.

### Daraja Setup
- [ ] Create `lib/daraja/client.ts`:
  - `getAccessToken(buildingId)` — fetches token using building's credentials
  - `initiateStkPush(params)` — triggers STK Push
- [ ] Handle per-building credentials (retrieve from `buildings` table, decrypt)
- [ ] Test with Daraja Sandbox credentials

### STK Push Flow
- [ ] Tenant portal "Pay Rent" button → Server Action:
  1. Fetch tenant's phone + current balance
  2. Call `initiateStkPush`
  3. INSERT into `pending_transactions` (status: PENDING, checkoutRequestId)
  4. Return success/error to UI
- [ ] Show "Check your phone for M-Pesa prompt" message

### Webhook Handler
- [ ] Create `/api/webhooks/mpesa/[shortcode]/route.ts`
  - Parse Daraja callback JSON
  - Match `CheckoutRequestID` to `pending_transactions`
  - On SUCCESS: update `pending_transactions`, INSERT CREDIT into `tenant_ledger`
  - On FAILURE: update status, log failure reason
- [ ] Local testing with ngrok + Daraja sandbox callbacks

### Validation URL (Manual Paybill safety net)
- [ ] Create `/api/webhooks/mpesa/validate/[shortcode]/route.ts`
  - Extract `BillRefNumber` (= tenantId)
  - Verify tenant belongs to this shortcode's building
  - Return ACCEPT or REJECT response
- [ ] Create `/api/webhooks/mpesa/confirm/[shortcode]/route.ts`
  - On confirmed manual payment, INSERT CREDIT into `tenant_ledger`

**🔴 Week 5 Exit Criteria:** STK Push triggers on button click. Successful sandbox callback inserts a CREDIT row in the ledger.

---

## ✅ WEEK 6 — Ledger Engine + Tenant Statement

**Goal:** Accurate, real-time balance display. Tenant sees exactly what they owe.

### Balance Calculation
- [ ] Create `lib/ledger/getBalance.ts`:
  - Sum all DEBITs, sum all CREDITs → return `{ totalCharged, totalPaid, balance }`
- [ ] Create `lib/ledger/getStatement.ts`:
  - Return grouped ledger rows per billing month with running balance
- [ ] Write unit tests for ledger math (partial payments, arrears, overpayments)

### Admin Ledger View
- [ ] `/admin/tenants/[id]/ledger` — full transaction history table
- [ ] Columns: date, description, debit, credit, running balance
- [ ] Highlight rows with outstanding balance in red
- [ ] Export to PDF (🟢 can defer to later)

### Tenant Statement (Portal)
- [ ] `/tenant/dashboard` — show:
  - Outstanding balance (prominent, red if > 0)
  - Breakdown: Arrears + Current Month Rent + Utilities
  - "Pay via M-Pesa" button
  - Recent payments list

**🔴 Week 6 Exit Criteria:** Balance is correctly calculated. Partial payments update balance in real-time after callback.

---

## ✅ WEEK 7 — Monthly Billing Cron Job

**Goal:** On the 1st of each month, the system auto-generates charges for all active tenants.

### Cron Job
- [ ] Create `/api/cron/monthly-billing/route.ts`:
  1. Fetch all `ACTIVE` tenants
  2. For each tenant:
     - Calculate previous month's closing balance
     - If balance > 0: INSERT DEBIT (`category=PREVIOUS_BALANCE`)
     - INSERT DEBIT for current month's RENT
     - For each FIXED utility enabled for the building: INSERT DEBIT
  3. Return summary (X tenants billed, Y errors)
- [ ] Configure `vercel.json` cron: `"0 6 1 * *"` (6am on 1st)
- [ ] Add `CRON_SECRET` env variable to Vercel, verify in route handler
- [ ] Test manually by calling the route from Super Admin dashboard

**🟡 Week 7 Exit Criteria:** Cron runs, inserts DEBIT rows for all tenants. Can trigger manually for testing.

---

## ✅ WEEK 8 — Field Agent: Meter Readings

**Goal:** Field agents can log water/electricity readings on mobile. System calculates charge and bills tenant.

### Mobile-Optimised Meter Reading UI
- [ ] `/admin/agent/meter-readings` — list of buildings agent is assigned to
- [ ] Select building → select unit → utility type (WATER / ELECTRICITY)
- [ ] Form: previous reading (pre-filled from last reading), current reading input
- [ ] Auto-calculate: units consumed × rate = total charge (shown before submit)
- [ ] On submit:
  1. INSERT into `utility_readings`
  2. INSERT DEBIT into `tenant_ledger` (`category=WATER` or `ELECTRICITY`)
  3. Link `utility_readings.ledgerEntryId` back to the new ledger row
- [ ] Show history of readings per unit

### Previous Reading Auto-fill
- [ ] Query last `utility_readings` row for this unit + utility type → pre-fill `previousReading`
- [ ] If no previous reading: field agent enters both old and new manually

**🔴 Week 8 Exit Criteria:** Agent logs a water reading. DEBIT appears in tenant's ledger. Tenant sees updated balance.

---

## ✅ WEEK 9 — Manual Receipt & Bank Payment Entry

**Goal:** Agents can log cash or bank payments for tenants who don't use M-Pesa.

### Manual Payment Form
- [ ] `/admin/agent/receipts` — "Log Manual Payment" form:
  - Select building → select tenant
  - Payment method: CASH | BANK_RECEIPT
  - Amount, reference number (Bank slip number), billing month
  - Optional: upload photo of receipt (Vercel Blob / Cloudinary)
- [ ] On submit: INSERT CREDIT into `tenant_ledger` with `recordedBy = agentClerkId`
- [ ] Show a confirmation summary before final submit (prevent double-entry)

### Duplicate Prevention
- [ ] Unique constraint on `referenceCode` in `tenant_ledger` — DB-level protection
- [ ] Before insert: check if `referenceCode` already exists → show warning

**🟡 Week 9 Exit Criteria:** Cash and bank payments are logged. Balance updates correctly. `referenceCode` uniqueness prevents duplicate entries.

---

## ✅ WEEK 10 — Lease Engine + Digital Signing

**Goal:** Lease agreements are auto-generated from templates and tenants can sign digitally.

### Lease Template Editor
- [ ] Install `@uiw/react-md-editor` or `react-quill` for admin template editing
- [ ] `/admin/settings/lease-template` — per-building Markdown template editor
- [ ] Show available `{{placeholders}}` as a reference list in the UI
- [ ] Save template to `buildings` table (or a separate `lease_templates` table)

### Lease Generation
- [ ] Create `lib/lease/generateLease.ts` — regex replace all `{{placeholders}}`
- [ ] On tenant invite completion: auto-generate lease, save to `leases.agreementGenerated`
- [ ] Admin can preview generated lease before sending

### Tenant Digital Signing
- [ ] `/tenant/lease` — read-only rendered Markdown view of their agreement
- [ ] Scrollable — "Accept & Sign" button only unlocks after reaching the bottom
- [ ] On click: UPDATE `leases.signedAt = NOW()`, `leases.signedByTenantId`
- [ ] Signed status shown in admin tenant view

### Renewal Flow
- [ ] 60 days before `leases.endDate`: cron sends renewal SMS + in-app notification
- [ ] Admin can create a new lease (with updated rent) linked to the same tenant/unit
- [ ] Tenant reviews new terms and signs digitally
- [ ] Old lease status → TERMINATED, new lease → ACTIVE

**🟡 Week 10 Exit Criteria:** Tenant can view and sign their lease. Admin can see signed status. Renewal prompt fires correctly.

---

## ✅ WEEK 11 — Complaints Ticketing System

**Goal:** Tenants file complaints with photos. Managers track and resolve them.

### Tenant Complaint Form
- [ ] `/tenant/complaints/new`:
  - Title, description, priority selector
  - Upload up to 3 photos (Vercel Blob)
- [ ] On submit: INSERT into `complaints` (status=OPEN)

### Manager Complaint Dashboard
- [ ] `/admin/complaints` — Kanban or table view:
  - Columns: OPEN, IN_PROGRESS, RESOLVED
  - Filter by building, priority, date
- [ ] Complaint detail page:
  - View photos, tenant info, unit
  - Add update (INSERT into `complaint_updates`)
  - Change status, assign to agent
  - Resolve button → set `resolvedAt`

### Priority Auto-assignment (🟢 optional)
- [ ] Keyword detection: "water leak", "electrical" → HIGH; "painting", "cleaning" → LOW

**🟡 Week 11 Exit Criteria:** Full complaint lifecycle works. Manager can open, update, and resolve tickets.

---

## ✅ WEEK 12 — SMS Notification Engine

**Goal:** All critical events trigger SMS via Africa's Talking.

### Africa's Talking Setup
- [ ] Create AT account, get API key (sandbox first)
- [ ] Create `lib/sms/sendSms.ts` — wrapper around AT SDK
- [ ] Add `AT_API_KEY`, `AT_USERNAME` to env variables

### SMS Triggers
- [ ] Payment received (from Daraja callback handler)
- [ ] Rent due in 7 days (cron job — runs daily)
- [ ] Rent overdue by 3 days (cron job)
- [ ] Lease renewal reminder — 60 days out (monthly cron)
- [ ] New complaint filed (notify manager)
- [ ] Complaint resolved (notify tenant)
- [ ] Tenant invite link sent (on invite creation)

### In-App Notifications (🟢 optional for MVP)
- [ ] Simple `notifications` table: `userId`, `message`, `isRead`, `createdAt`
- [ ] Bell icon in nav with unread count

**🟡 Week 12 Exit Criteria:** Payment SMS confirmed in sandbox. Rent reminder cron fires and AT delivers SMS.

---

## ✅ WEEK 13 — Agency Owner Analytics Dashboard

**Goal:** Agency Owner has a clear financial overview across all buildings.

### Dashboard Widgets
- [ ] Total rent collected this month (across all buildings)
- [ ] Total outstanding balance (all tenants with balance > 0)
- [ ] Occupancy rate (occupied units / total units)
- [ ] Recent payments feed
- [ ] Buildings breakdown table: building name, units, collected, outstanding
- [ ] Filter by building, locale, date range

### Arrears Report
- [ ] List of all tenants with outstanding balance > 0
- [ ] Sortable by amount, days overdue
- [ ] "Send Reminder" button → triggers SMS immediately

**🟢 Week 13 Exit Criteria:** Dashboard shows real-time aggregate data. Arrears list is accurate.

---

## ✅ WEEK 14 — Super Admin Dashboard

**Goal:** You (Super Admin) can monitor all agencies and use the kill switch.

### Super Admin UI
- [ ] `/super-admin/dashboard` — system-wide metrics:
  - Total agencies registered
  - Total buildings, units, tenants across all agencies
  - Active vs Suspended agencies
- [ ] `/super-admin/agencies` — agency list with:
  - Last active date
  - Active tenant count
  - `isActive` toggle (kill switch)
- [ ] Clicking kill switch: sets `agencies.isActive = false`
- [ ] Middleware checks `agencies.isActive` on every admin request → redirect to `/suspended` page if false

**🟢 Week 14 Exit Criteria:** Super Admin can suspend an agency. Agency staff are immediately blocked.

---

## ✅ WEEK 15 — Staff Management + Permissions Polish

**Goal:** Agency Owner can manage their full team. Permissions are watertight.

### Staff Management
- [ ] `/admin/settings/staff` — list of all staff (Manager, Field Agent) with roles
- [ ] Invite new staff (Manager / Field Agent) — Clerk invitation flow
- [ ] Remove staff — deactivate Clerk account, remove `agencyId` from metadata

### Permission Audit
- [ ] Field Agent: can only access meter readings + manual receipts (confirm no access to financials)
- [ ] Manager: can see financials, cannot change Daraja credentials
- [ ] Agency Owner: full access
- [ ] Test each role by signing in as each user type

### Settings Pages
- [ ] `/admin/settings/daraja` — update/rotate Daraja credentials per building
- [ ] `/admin/settings/utilities` — update building utility rates
- [ ] `/admin/settings/lease-template` — manage lease agreement templates

**🟢 Week 15 Exit Criteria:** Role boundaries are tested and confirmed. No role can access data above their permission level.

---

## ✅ WEEK 16 — Error Handling, Loading States & Edge Cases

**Goal:** The app handles failure gracefully. No blank screens or silent errors.

### UI Polish
- [ ] Add loading skeletons to all data-fetching pages (shadcn Skeleton)
- [ ] Add error boundaries to all major page sections
- [ ] Empty states: "No tenants yet", "No complaints", "No payments this month"
- [ ] Toast notifications (shadcn Sonner) for all mutations: success + error

### Edge Cases to Handle
- [ ] Daraja callback arrives twice for same `checkoutRequestId` → idempotency check
- [ ] Cron job runs twice (double billing) → check if DEBIT already exists for `billingMonth`
- [ ] Tenant tries to pay when balance is KES 0 → disable pay button
- [ ] Agent submits meter reading with `currentReading < previousReading` → form validation
- [ ] Agency Owner invites a user who already has a Clerk account → handle gracefully
- [ ] Tenant marked VACATED still tries to access portal → redirect to "Account deactivated" page

### Security Audit
- [ ] Every server action: verify `auth()` is not null
- [ ] Every DB query: verify `agencyId` filter is present
- [ ] Daraja webhook: verify request IP is from Safaricom's IP range
- [ ] Clerk webhook: verify `svix` signature

**🔴 Week 16 Exit Criteria:** App handles all edge cases. No unhandled promise rejections. Security review passed.

---

## ✅ WEEK 17 — End-to-End Testing & Seed Data

**Goal:** Full system walkthrough with realistic data. All flows tested.

### Seed Data Script
- [ ] Create `scripts/seed.ts`:
  - 1 agency
  - 2 buildings (different locales, different utilities)
  - 10 units per building
  - 15 active tenants across both buildings
  - 3 months of ledger history (rent + utility charges + payments)
  - 5 open complaints
- [ ] Run seed against Neon dev branch: `npx tsx scripts/seed.ts`

### Manual QA Walkthrough (test each role)
- [ ] **As Super Admin:** Create agency, toggle kill switch on/off
- [ ] **As Agency Owner:** Create building with utilities, add units, configure Daraja
- [ ] **As Manager:** Invite tenant, generate lease, view complaints, send SMS
- [ ] **As Field Agent:** Log meter reading, log bank receipt
- [ ] **As Tenant:** Sign in via invite, view balance, trigger STK Push (sandbox), sign lease, file complaint
- [ ] **M-Pesa:** Full STK Push → callback → ledger update → SMS flow (sandbox)
- [ ] **Cron:** Manually trigger monthly billing, verify DEBIT rows created correctly
- [ ] **Off-boarding:** Vacate a tenant with zero balance, confirm account deactivated

### Browser + Device Testing
- [ ] Chrome, Safari, Firefox
- [ ] Mobile (iPhone + Android emulator) — especially the agent meter-reading form and tenant payment button

**🔴 Week 17 Exit Criteria:** All flows pass QA. No data leaks between buildings. Ledger math is correct in all scenarios.

---

## ✅ WEEK 18 — Production Deploy on Vercel

**Goal:** Live, production-grade app on Vercel with a real domain.

### Pre-Deploy Checklist
- [ ] Switch Neon `DATABASE_URL` to `main` branch (production)
- [ ] Run `drizzle-kit push` against Neon production branch
- [ ] Switch Clerk to production instance (separate from dev)
- [ ] Switch Africa's Talking to live credentials (not sandbox)
- [ ] Switch Daraja to live credentials (test with KES 1 STK Push)
- [ ] All env variables set in Vercel dashboard under Production
- [ ] Verify `CRON_SECRET` is set and cron endpoint rejects unsigned requests

### Vercel Configuration
- [ ] `vercel.json` — add cron jobs:
  ```json
  {
    "crons": [
      { "path": "/api/cron/monthly-billing", "schedule": "0 6 1 * *" },
      { "path": "/api/cron/rent-reminders", "schedule": "0 8 * * *" }
    ]
  }
  ```
- [ ] Set production domain (custom domain or `.vercel.app`)
- [ ] Enable Vercel Analytics + Speed Insights
- [ ] Enable Vercel Log Draining (to catch webhook errors)

### Daraja Production Webhook URLs
- [ ] Update Daraja portal Callback URL to: `https://yourdomain.com/api/webhooks/mpesa/[shortcode]`
- [ ] Update Validation URL and Confirmation URL
- [ ] Test live STK Push end-to-end

### Post-Deploy Verification
- [ ] Sign in as Super Admin on production domain ✓
- [ ] Sign in as Agency Owner ✓
- [ ] Invite a real test tenant ✓
- [ ] Trigger a KES 1 STK Push (live) ✓
- [ ] Confirm callback fires and ledger updates ✓
- [ ] Confirm SMS delivers via Africa's Talking live ✓
- [ ] Trigger monthly billing cron manually ✓

**🔴 Week 18 Exit Criteria:** Live app accessible at production URL. Real M-Pesa payment processed. Tenant receives SMS confirmation. You are live. 🚀

---

## Deferred to V2 (Post-Launch)

These are explicitly out of scope for V1 but should be tracked:

| Feature | Reason Deferred |
|---|---|
| Multi-agency SaaS onboarding | V1 is single-agency; schema already supports it |
| Subscription billing (Stripe/Pesapal) | Agencies pay you — add after launch |
| PDF statement exports | Nice to have, not MVP |
| Landlord portal (read-only) | Landlord login to see their building revenue |
| Mobile app (React Native) | Web is sufficient for MVP |
| Unit vacancy advertising | Out of current scope |
| In-app chat (real-time) | Africa's Talking SMS covers comms for now |
| Electricity prepaid token integration | Complex KPLC API — defer |

---

## Key Numbers to Hit Before Launch

| Metric | Target |
|---|---|
| Page load (LCP) | < 2.5 seconds |
| STK Push → ledger update time | < 10 seconds end-to-end |
| SMS delivery time | < 5 seconds (AT Kenya) |
| Ledger balance accuracy | 100% (unit tested) |
| Cross-building data leak | 0 incidents in QA |
| Cron double-billing incidents | 0 (idempotency enforced) |