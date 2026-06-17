# DESIGN.md — PropFlow Kenya
### Real Estate Management System: Architecture, Schema & Design Decisions

---

## 1. Project Overview

**PropFlow** is an invite-only, agency-centric real estate management platform built for the Kenyan market. It handles lease management, M-Pesa rent collection, utility billing, tenant communication, and complaint tracking — all scoped strictly per agency.

**The mental model:**
> You (Super Admin) are the *landlord of the software*. Agencies are your tenants. Each agency is the landlord of their buildings. Each building has units. Each unit has a tenant.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) | File-based routing, Server Actions, RSC |
| Auth | Clerk | Invite-only flows, custom metadata for roles, webhooks |
| Database | Neon (PostgreSQL, serverless) | Branching for dev/prod, scales to zero |
| ORM | Drizzle ORM | Type-safe queries, migrations, no magic |
| Payments | Safaricom Daraja API | STK Push + Validation URL |
| SMS | Africa's Talking | Local delivery, affordable, reliable |
| UI | Tailwind CSS + shadcn/ui | Consistent, accessible component base |
| Deployment | Vercel | Edge functions for webhooks, CI/CD |
| Cron Jobs | Vercel Cron (or Upstash QStash) | Monthly billing automation |
| File Storage | Vercel Blob or Cloudinary | Complaint photos, bank receipt uploads |

---

## 3. Role Hierarchy

```
Super Admin (You)
  └── Agency Owner          [Org-level: sees all buildings, financials, revenue]
        └── Manager/Supervisor  [Operational: complaints, leases, utility logs]
              └── Field Agent     [Ground-level: meter readings, bank receipt entry]
                    └── Tenant    [Self-service: view balance, pay rent, file complaints]
```

### Clerk Custom Metadata (publicMetadata)
```json
{
  "role": "AGENCY_OWNER" | "MANAGER" | "FIELD_AGENT" | "TENANT" | "SUPER_ADMIN",
  "agencyId": "uuid",
  "buildingId": "uuid | null",
  "unitId": "uuid | null"
}
```

### Route Protection (Middleware)
```
/super-admin/*        → SUPER_ADMIN only
/admin/owner/*        → AGENCY_OWNER
/admin/manager/*      → AGENCY_OWNER | MANAGER
/admin/agent/*        → all agency staff roles
/tenant/*             → TENANT only
```

---

## 4. Data Architecture

### 4.1 Hierarchy of Tables

```
agencies
  └── buildings (agency_id FK)
        └── building_utilities (building_id FK) — toggleable per building
        └── units (building_id FK)
              └── tenants (unit_id + building_id FK)
                    └── leases (tenant_id FK)
                    └── tenant_ledger (tenant_id + building_id FK)
                    └── utility_readings (unit_id FK)
                    └── complaints (tenant_id FK)
```

Every table carries `agency_id` as a cascading foreign key. **No query is ever run without `agency_id` in the WHERE clause.** This is the primary data isolation guarantee.

---

### 4.2 Full Drizzle Schema

```typescript
// enums.ts
export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "AGENCY_OWNER", "MANAGER", "FIELD_AGENT", "TENANT"]);
export const leaseStatusEnum = pgEnum("lease_status", ["ACTIVE", "PENDING_RENEWAL", "VACATED", "TERMINATED"]);
export const entryTypeEnum = pgEnum("entry_type", ["DEBIT", "CREDIT"]);
export const categoryEnum = pgEnum("category", ["RENT", "WATER", "ELECTRICITY", "GARBAGE", "SERVICE_CHARGE", "WIFI", "SECURITY", "PREVIOUS_BALANCE", "DEPOSIT"]);
export const paymentMethodEnum = pgEnum("payment_method", ["MPESA_STK", "BANK_RECEIPT", "CASH", "SYSTEM"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const complaintPriorityEnum = pgEnum("complaint_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["PENDING", "COMPLETED", "FAILED", "REJECTED"]);

// agencies.ts
export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(), // Super Admin kill switch
  subscriptionStatus: text("subscription_status").default("TRIAL"), // future SaaS
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// buildings.ts
export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  locale: text("locale"),  // e.g., "Westlands", "Karen", "Mombasa"
  landlordName: text("landlord_name").notNull(),
  landlordPhone: text("landlord_phone"),
  darajaConsumerKey: text("daraja_consumer_key"),   // encrypted at rest
  darajaConsumerSecret: text("daraja_consumer_secret"), // encrypted at rest
  darajaShortcode: text("daraja_shortcode"),
  darajaPasskey: text("daraja_passkey"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// building_utilities.ts
export const buildingUtilities = pgTable("building_utilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").references(() => buildings.id, { onDelete: "cascade" }).notNull(),
  agencyId: uuid("agency_id").notNull(),
  name: categoryEnum("name").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  rateType: text("rate_type").notNull(),  // "FIXED" | "PER_UNIT"
  defaultAmount: numeric("default_amount", { precision: 10, scale: 2 }).default("0.00"),
  unit: text("unit"),  // e.g., "m³" for water, "kWh" for electricity
});

// units.ts
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").references(() => buildings.id, { onDelete: "cascade" }).notNull(),
  agencyId: uuid("agency_id").notNull(),
  unitNumber: text("unit_number").notNull(),  // e.g., "A1", "B3", "GF-01"
  floor: text("floor"),
  type: text("type"),  // "1BR", "2BR", "STUDIO", "BEDSITTER"
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  isOccupied: boolean("is_occupied").default(false).notNull(),
});

// tenants.ts
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(), // set after they accept invite
  agencyId: uuid("agency_id").notNull(),
  buildingId: uuid("building_id").references(() => buildings.id).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),  // Used for STK Push
  email: text("email"),
  nationalId: text("national_id"),
  inviteStatus: text("invite_status").default("PENDING"),  // "PENDING" | "ACCEPTED"
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  vacatedAt: timestamp("vacated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// leases.ts
export const leases = pgTable("leases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  agencyId: uuid("agency_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  depositPaid: boolean("deposit_paid").default(false),
  escalationType: text("escalation_type").default("FIXED"),  // "FIXED" | "PERCENTAGE"
  escalationValue: numeric("escalation_value", { precision: 5, scale: 2 }),
  agreementTemplate: text("agreement_template"), // Markdown with {{placeholders}}
  agreementGenerated: text("agreement_generated"), // Final rendered text
  signedAt: timestamp("signed_at"),
  signedByTenantId: text("signed_by_clerk_id"),
  status: leaseStatusEnum("status").default("ACTIVE").notNull(),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// tenant_ledger.ts  — THE CORE: never overwrite, always append
export const tenantLedger = pgTable("tenant_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  buildingId: uuid("building_id").references(() => buildings.id).notNull(),
  agencyId: uuid("agency_id").notNull(),
  type: entryTypeEnum("type").notNull(),
  category: categoryEnum("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").default("SYSTEM"),
  referenceCode: text("reference_code").unique(),   // M-Pesa code, Bank slip no.
  description: text("description").notNull(),        // "June 2026 Rent" / "M-Pesa RFI392KDM"
  billingMonth: text("billing_month"),               // "2026-06"
  recordedBy: text("recorded_by"),                   // Clerk ID of agent (manual entries)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// utility_readings.ts
export const utilityReadings = pgTable("utility_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  agentClerkId: text("agent_clerk_id").notNull(),
  utilityType: categoryEnum("utility_type").notNull(),
  previousReading: numeric("previous_reading", { precision: 10, scale: 2 }).notNull(),
  currentReading: numeric("current_reading", { precision: 10, scale: 2 }).notNull(),
  unitsConsumed: numeric("units_consumed", { precision: 10, scale: 2 }).notNull(),
  ratePerUnit: numeric("rate_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalCharge: numeric("total_charge", { precision: 10, scale: 2 }).notNull(),
  billingMonth: text("billing_month").notNull(),     // "2026-06"
  ledgerEntryId: uuid("ledger_entry_id"),            // FK back to tenant_ledger once billed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// pending_transactions.ts — STK Push tracking
export const pendingTransactions = pgTable("pending_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  checkoutRequestId: text("checkout_request_id").unique().notNull(),  // From Daraja
  merchantRequestId: text("merchant_request_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  phone: text("phone").notNull(),
  status: transactionStatusEnum("status").default("PENDING").notNull(),
  mpesaCode: text("mpesa_code").unique(),   // Populated on success callback
  failureReason: text("failure_reason"),
  initiatedAt: timestamp("initiated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// complaints.ts
export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  buildingId: uuid("building_id").notNull(),
  agencyId: uuid("agency_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: complaintPriorityEnum("priority").default("MEDIUM").notNull(),
  status: complaintStatusEnum("status").default("OPEN").notNull(),
  photoUrls: text("photo_urls").array(),
  assignedTo: text("assigned_to"),   // Clerk ID of manager/agent
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// complaint_updates.ts — ticket timeline
export const complaintUpdates = pgTable("complaint_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id").references(() => complaints.id).notNull(),
  authorClerkId: text("author_clerk_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## 5. M-Pesa Payment Architecture

### Primary Flow — STK Push (App-Initiated)

```
Tenant clicks "Pay Rent"
  └── Next.js Server Action
        ├── Inserts row into pending_transactions (status: PENDING)
        ├── Calls Daraja /stkpush with:
        │     BusinessShortCode, Passkey, Amount, PhoneNumber
        │     AccountReference: tenantId (UUID), TransactionDesc: "Rent June 2026"
        └── Stores CheckoutRequestID in pending_transactions

Safaricom Callback → POST /api/webhooks/mpesa/[shortcode]
  ├── Match CheckoutRequestID to pending_transactions row
  ├── On SUCCESS:
  │     ├── Update pending_transactions: status=COMPLETED, mpesaCode=xxx
  │     ├── INSERT into tenant_ledger: type=CREDIT, category=RENT, amount, referenceCode
  │     └── Trigger SMS via Africa's Talking: "Confirmed. KES X received."
  └── On FAILURE:
        ├── Update pending_transactions: status=FAILED, failureReason
        └── Trigger SMS: "Payment failed. Please try again."
```

### Secondary Flow — Manual Paybill Entry (Validation URL)

```
Daraja Validation URL → POST /api/webhooks/mpesa/validate/[shortcode]
  ├── Extract BillRefNumber from payload
  ├── Query: SELECT id FROM tenants WHERE id = BillRefNumber AND building shortcode matches
  ├── IF NOT FOUND → respond { "ResultCode": "C2B00012", "ResultDesc": "Rejected" }
  └── IF FOUND     → respond { "ResultCode": "0", "ResultDesc": "Accepted" }

Daraja Confirmation URL → POST /api/webhooks/mpesa/confirm/[shortcode]
  └── Insert CREDIT into tenant_ledger with referenceCode = TransactionID
```

### Why `building_id` is on every payment row
Even if a tenant somehow submits the wrong reference, the Validation URL check ensures the `shortcode` maps back to a specific building, and the `BillRefNumber` must match a tenant in that building. Double-gated. No cross-building pollution is possible.

---

## 6. Balance Calculation Logic

**Never store a `current_balance` column.** Always calculate on read:

```typescript
// lib/ledger.ts
export async function getTenantBalance(tenantId: string, billingMonth: string) {
  const rows = await db
    .select()
    .from(tenantLedger)
    .where(eq(tenantLedger.tenantId, tenantId));

  const debits = rows.filter(r => r.type === "DEBIT").reduce((s, r) => s + parseFloat(r.amount), 0);
  const credits = rows.filter(r => r.type === "CREDIT").reduce((s, r) => s + parseFloat(r.amount), 0);

  return {
    totalCharged: debits,
    totalPaid: credits,
    balance: debits - credits,   // positive = owes money, negative = overpaid
  };
}
```

---

## 7. Monthly Cron Job (1st of Each Month)

**Trigger:** Vercel Cron or Upstash QStash at `0 6 1 * *` (6:00 AM EAT on the 1st)

**Actions:**
1. For every active tenant, fetch previous month's closing balance
2. Insert `DEBIT` row: `category=PREVIOUS_BALANCE` (if balance > 0)
3. Insert `DEBIT` row: `category=RENT` for the current month's rent
4. For each enabled building utility (FIXED type), insert `DEBIT` rows
5. Trigger SMS via Africa's Talking with itemized statement

**Variable utilities** (water/electricity) are billed separately when a field agent submits a meter reading — not on the 1st — since readings happen throughout the month.

---

## 8. Lease Agreement — Markdown Template Engine

Since lease agreements vary by landlord-agency relationship, the system uses a **Markdown template** approach:

### Template (stored in `leases.agreementTemplate`)
```markdown
# TENANCY AGREEMENT

This agreement is made between **{{AGENCY_NAME}}** (the Agent) acting on behalf of
**{{LANDLORD_NAME}}** (the Landlord) and **{{TENANT_NAME}}** (the Tenant).

**Property:** {{BUILDING_NAME}}, Unit {{UNIT_NUMBER}}, {{BUILDING_LOCATION}}

**Lease Term:** {{LEASE_START}} to {{LEASE_END}}

**Monthly Rent:** KES {{RENT_AMOUNT}}

**Rent Escalation:** Upon renewal, rent will increase by {{ESCALATION_VALUE}}{{ESCALATION_UNIT}}.

...custom clauses here...
```

### Generation (Next.js Server Action)
```typescript
// lib/lease.ts
export function generateLease(template: string, data: LeaseData): string {
  return template
    .replace(/{{TENANT_NAME}}/g, data.tenantName)
    .replace(/{{RENT_AMOUNT}}/g, data.rentAmount.toLocaleString("en-KE"))
    // ... etc
}
```

The generated text is stored in `leases.agreementGenerated`. When the tenant clicks "Accept & Sign", `leases.signedAt` is set to `NOW()` and `leases.signedByTenantId` is set to their Clerk ID.

---

## 9. Tenant Off-Boarding Flow

```
Agent triggers "Vacate Tenant"
  ├── Check: is tenant_ledger balance = 0? (no outstanding arrears)
  ├── If NOT zero → block vacating, show outstanding balance
  └── If zero:
        ├── Set tenants.status = "VACATED", tenants.vacatedAt = NOW()
        ├── Set leases.status = "TERMINATED"
        ├── Set units.isOccupied = false
        └── Call Clerk API: ban/delete user account
             └── Tenant loses portal access immediately
```

**Financial records are never deleted.** The tenant row remains with `status=VACATED` so historical ledger data is preserved for audits.

---

## 10. Notification Triggers (Africa's Talking SMS)

| Event | Recipient | Message |
|---|---|---|
| Payment received | Tenant | "Confirmed. KES {amount} received for {month} rent. Ref: {code}." |
| Rent due in 7 days | Tenant | "Your rent of KES {amount} for {building}, Unit {unit} is due on {date}." |
| Rent overdue | Tenant | "Your account has an outstanding balance of KES {amount}. Please pay immediately." |
| Lease renewal (60 days) | Tenant | "Your lease expires on {date}. Log in to review and renew your agreement." |
| New complaint filed | Manager | "New complaint filed by {tenant} in Unit {unit}: {title}. Priority: {level}." |
| Complaint resolved | Tenant | "Your complaint '{title}' has been resolved. Log in to view details." |
| Invite link | New tenant | "You have been invited to PropFlow by {agency}. Access your portal: {link}" |

---

## 11. Super Admin Dashboard (Your View)

This is scoped entirely above the agency level. You see:

- List of all registered agencies with their status (ACTIVE / SUSPENDED)
- Per-agency: number of buildings, units, active tenants
- Kill switch: toggle `agencies.isActive = false` → all agency users are blocked at middleware level
- Future: subscription billing status per agency

---

## 12. Security Considerations

- **Daraja credentials** (Consumer Key/Secret) stored encrypted using `@vercel/kms` or env-level encryption — never exposed to client
- **Every API route** checks `auth()` from Clerk and validates `agencyId` matches the authenticated user's metadata
- **Webhook endpoints** verify Daraja requests via IP allowlist + timestamp validation
- **Clerk webhooks** use `svix` signature verification
- **Sensitive DB columns** (national ID, phone) should be encrypted at the application layer for GDPR/data protection compliance

---

## 13. Folder Structure (Next.js App Router)

```
/app
  /(auth)
    /sign-in
  /(super-admin)
    /dashboard
    /agencies
  /(admin)
    /dashboard
    /buildings
    /units
    /tenants
      /[id]/invite
      /[id]/ledger
    /leases
    /complaints
    /settings
      /daraja
      /utilities
  /(agent)
    /meter-readings
    /receipts
  /(tenant)
    /dashboard
    /pay
    /complaints/new
    /lease

/lib
  /db
    /schema    — all Drizzle table definitions
    /queries   — typed query functions
  /daraja      — STK Push, validation, confirmation helpers
  /sms         — Africa's Talking wrapper
  /ledger      — balance calculation logic
  /lease       — template rendering engine
  /cron        — monthly billing job

/api
  /webhooks
    /mpesa/[shortcode]/route.ts      — confirmation webhook
    /mpesa/validate/[shortcode]/route.ts — validation webhook
    /clerk/route.ts                  — user.created sync
  /cron
    /monthly-billing/route.ts
```