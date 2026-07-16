// db/seed.ts
// PropFlow Kenya — Seed Script (raw SQL, bypasses all type issues)
// Run: npx tsx db/seed.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Helper: insert and return ID ──────────────────────────────────────
async function insertOne(table: string, cols: Record<string, unknown>) {
  const keys = Object.keys(cols);
  const values = Object.values(cols);

  const columnsSql = sql.raw(keys.map((k) => `"${k}"`).join(", "));
  const valuesSql = sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  );

  const query = sql`INSERT INTO ${sql.raw(`"${table}"`)} (${columnsSql}) VALUES (${valuesSql}) RETURNING *`;

  const result = await db.execute(query);
  return result.rows[0];
}

async function clearTable(table: string) {
  await db.execute(sql.raw(`DELETE FROM "${table}"`));
}
async function seed() {
  console.log("🧹 Clearing existing data...");
  await clearTable("complaint_updates");
  await clearTable("complaints");
  await clearTable("notifications");
  await clearTable("pending_transactions");
  await clearTable("utility_readings");
  await clearTable("tenant_ledger");
  await clearTable("leases");
  await clearTable("tenants");
  await clearTable("units");
  await clearTable("building_utilities");
  await clearTable("buildings");
  await clearTable("staff");
  await clearTable("agencies");
  console.log("✅ Cleared.\n");

  // ── Agency ──────────────────────────────────────────────────────────
  console.log("🏢 Creating agency...");
  const agency = await insertOne("agencies", {
    name: "PropFlow Demo Agency",
    email: "admin@propflow.co.ke",
    phone: "+254712345678",
    invite_status: "ACCEPTED",
    is_active: true,
    subscription_status: "TRIAL",
  });

  // ── Staff ───────────────────────────────────────────────────────────
  console.log("👔 Creating staff...");
  const manager = await insertOne("staff", {
    clerk_user_id: "clerk_manager_001",
    agency_id: agency.id,
    full_name: "Grace Muthoni",
    email: "grace@propflow.co.ke",
    phone: "+254722000001",
    role: "MANAGER",
    status: "ACTIVE",
  });

  const fieldAgent = await insertOne("staff", {
    clerk_user_id: "clerk_agent_001",
    agency_id: agency.id,
    full_name: "Peter Kipchirchir",
    email: "peter@propflow.co.ke",
    phone: "+254722000002",
    role: "FIELD_AGENT",
    status: "ACTIVE",
    assigned_building_ids: JSON.stringify([]),
  });

  // ── Buildings ───────────────────────────────────────────────────────
  console.log("🏗️ Creating buildings...");
  const b1 = await insertOne("buildings", {
    agency_id: agency.id,
    name: "Westlands Heights",
    location: "Westlands, Nairobi",
    locale: "Westlands",
    landlord_name: "James Mwangi",
    landlord_phone: "+254723456789",
    daraja_consumer_key: "test_ck_1",
    daraja_consumer_secret: "test_cs_1",
    daraja_shortcode: "174379",
    daraja_passkey: "test_pk_1",
  });

  const b2 = await insertOne("buildings", {
    agency_id: agency.id,
    name: "Karen Gardens",
    location: "Karen, Nairobi",
    locale: "Karen",
    landlord_name: "Sarah Wambui",
    landlord_phone: "+254723456790",
    daraja_consumer_key: "test_ck_2",
    daraja_consumer_secret: "test_cs_2",
    daraja_shortcode: "174380",
    daraja_passkey: "test_pk_2",
  });

  // ── Building Utilities ──────────────────────────────────────────────
  console.log("⚡ Creating utilities...");
  const utilities = [
    { building_id: b1.id, agency_id: agency.id, name: "WATER", is_enabled: true, rate_type: "PER_UNIT", default_amount: "100.00", unit: "m³" },
    { building_id: b1.id, agency_id: agency.id, name: "ELECTRICITY", is_enabled: true, rate_type: "PER_UNIT", default_amount: "25.00", unit: "kWh" },
    { building_id: b1.id, agency_id: agency.id, name: "GARBAGE", is_enabled: true, rate_type: "FIXED", default_amount: "500.00" },
    { building_id: b1.id, agency_id: agency.id, name: "WIFI", is_enabled: true, rate_type: "FIXED", default_amount: "1000.00" },
    { building_id: b1.id, agency_id: agency.id, name: "SECURITY", is_enabled: true, rate_type: "FIXED", default_amount: "800.00" },
    { building_id: b2.id, agency_id: agency.id, name: "WATER", is_enabled: true, rate_type: "PER_UNIT", default_amount: "120.00", unit: "m³" },
    { building_id: b2.id, agency_id: agency.id, name: "ELECTRICITY", is_enabled: true, rate_type: "PER_UNIT", default_amount: "28.00", unit: "kWh" },
    { building_id: b2.id, agency_id: agency.id, name: "GARBAGE", is_enabled: true, rate_type: "FIXED", default_amount: "600.00" },
  ];
  for (const u of utilities) {
    await insertOne("building_utilities", u);
  }

  // ── Units ───────────────────────────────────────────────────────────
  console.log("🏠 Creating units...");
  const unitData = [
    { building_id: b1.id, agency_id: agency.id, unit_number: "A1", floor: "1", type: "1BR", rent_amount: "25000.00", deposit_amount: "50000.00", is_occupied: true },
    { building_id: b1.id, agency_id: agency.id, unit_number: "A2", floor: "1", type: "2BR", rent_amount: "35000.00", deposit_amount: "70000.00", is_occupied: true },
    { building_id: b1.id, agency_id: agency.id, unit_number: "B1", floor: "G", type: "STUDIO", rent_amount: "18000.00", deposit_amount: "36000.00", is_occupied: false },
    { building_id: b2.id, agency_id: agency.id, unit_number: "A1", floor: "1", type: "2BR", rent_amount: "40000.00", deposit_amount: "80000.00", is_occupied: true },
    { building_id: b2.id, agency_id: agency.id, unit_number: "A2", floor: "2", type: "1BR", rent_amount: "28000.00", deposit_amount: "56000.00", is_occupied: true },
    { building_id: b2.id, agency_id: agency.id, unit_number: "B1", floor: "G", type: "BEDSITTER", rent_amount: "15000.00", deposit_amount: "30000.00", is_occupied: false },
  ];
  const seededUnits: any[] = [];
  for (const u of unitData) {
    seededUnits.push(await insertOne("units", u));
  }
  const [u1_b1, u2_b1, u3_b1, u1_b2, u2_b2, u3_b2] = seededUnits;

  // ── Tenants ─────────────────────────────────────────────────────────
  console.log("👥 Creating tenants...");
  const john = await insertOne("tenants", {
    clerk_user_id: "user_john_kamau_001",
    agency_id: agency.id,
    building_id: b1.id,
    unit_id: u1_b1.id,
    full_name: "John Kamau",
    phone: "+254712345001",
    email: "john@email.com",
    national_id: "12345678",
    agency_name: agency.name,
    invite_status: "ACCEPTED",
    status: "ACTIVE",
  });

  const grace = await insertOne("tenants", {
    clerk_user_id: "user_grace_wanjiku_002",
    agency_id: agency.id,
    building_id: b1.id,
    unit_id: u2_b1.id,
    full_name: "Grace Wanjiku",
    phone: "+254712345002",
    email: "grace@email.com",
    national_id: "23456789",
    agency_name: agency.name,
    invite_status: "ACCEPTED",
    status: "ACTIVE",
  });

  const peter = await insertOne("tenants", {
    clerk_user_id: "user_peter_ochieng_003",
    agency_id: agency.id,
    building_id: b2.id,
    unit_id: u1_b2.id,
    full_name: "Peter Ochieng",
    phone: "+254712345003",
    email: "peter@email.com",
    national_id: "34567890",
    agency_name: agency.name,
    invite_status: "ACCEPTED",
    status: "ACTIVE",
  });

  // ── Leases ──────────────────────────────────────────────────────────
  console.log("📄 Creating leases...");
  for (const { tenant, unit } of [
    { tenant: john, unit: u1_b1 },
    { tenant: grace, unit: u2_b1 },
    { tenant: peter, unit: u1_b2 },
  ]) {
    await insertOne("leases", {
      tenant_id: tenant.id,
      unit_id: unit.id,
      agency_id: agency.id,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      rent_amount: unit.rent_amount,
      deposit_amount: unit.deposit_amount,
      deposit_paid: true,
      escalation_type: "FIXED",
      status: "ACTIVE",
    });
  }

  // ── Ledger ──────────────────────────────────────────────────────────
  console.log("💰 Creating ledger entries...");

  // John: paid Jan-Apr (partial Feb), arrears May-Jun
  const johnRent = 25000;
  const johnPayments = [
    { month: "2026-01", paid: 25000, method: "MPESA_STK", ref: "MPESA-JOHN-001" },
    { month: "2026-02", paid: 15000, method: "MPESA_STK", ref: "MPESA-JOHN-002" },
    { month: "2026-03", paid: 25000, method: "CASH", ref: "CASH-JOHN-001" },
    { month: "2026-04", paid: 25000, method: "BANK_RECEIPT", ref: "BANK-JOHN-001" },
    { month: "2026-05", paid: 0, method: "SYSTEM", ref: null },
    { month: "2026-06", paid: 0, method: "SYSTEM", ref: null },
  ];
  for (const m of johnPayments) {
    await insertOne("tenant_ledger", {
      tenant_id: john.id,
      building_id: b1.id,
      agency_id: agency.id,
      type: "DEBIT",
      category: "RENT",
      amount: String(johnRent),
      billing_month: m.month,
      description: `Rent for ${m.month}`,
      method: "SYSTEM",
      recorded_by: "SYSTEM",
    });
    if (m.paid > 0) {
      await insertOne("tenant_ledger", {
        tenant_id: john.id,
        building_id: b1.id,
        agency_id: agency.id,
        type: "CREDIT",
        category: "RENT",
        amount: String(m.paid),
        billing_month: m.month,
        description: `Payment via ${m.method}`,
        reference_code: m.ref,
        method: m.method,
        recorded_by: "SYSTEM",
      });
    }
  }

  // Grace: paid Jan-Feb, partial Mar, arrears Apr-Jun
  const graceRent = 35000;
  const gracePayments = [
    { month: "2026-01", paid: 35000, method: "MPESA_STK", ref: "MPESA-GRACE-001" },
    { month: "2026-02", paid: 35000, method: "MPESA_STK", ref: "MPESA-GRACE-002" },
    { month: "2026-03", paid: 20000, method: "MPESA_STK", ref: "MPESA-GRACE-003" },
    { month: "2026-04", paid: 0, method: "SYSTEM", ref: null },
    { month: "2026-05", paid: 0, method: "SYSTEM", ref: null },
    { month: "2026-06", paid: 0, method: "SYSTEM", ref: null },
  ];
  for (const m of gracePayments) {
    await insertOne("tenant_ledger", {
      tenant_id: grace.id,
      building_id: b1.id,
      agency_id: agency.id,
      type: "DEBIT",
      category: "RENT",
      amount: String(graceRent),
      billing_month: m.month,
      description: `Rent for ${m.month}`,
      method: "SYSTEM",
      recorded_by: "SYSTEM",
    });
    if (m.paid > 0) {
      await insertOne("tenant_ledger", {
        tenant_id: grace.id,
        building_id: b1.id,
        agency_id: agency.id,
        type: "CREDIT",
        category: "RENT",
        amount: String(m.paid),
        billing_month: m.month,
        description: `Payment via ${m.method}`,
        reference_code: m.ref,
        method: m.method,
        recorded_by: "SYSTEM",
      });
    }
  }

  // Peter: fully paid all months
  const peterRent = 40000;
  const peterMonths = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  let peterRef = 100;
  for (const month of peterMonths) {
    await insertOne("tenant_ledger", {
      tenant_id: peter.id,
      building_id: b2.id,
      agency_id: agency.id,
      type: "DEBIT",
      category: "RENT",
      amount: String(peterRent),
      billing_month: month,
      description: `Rent for ${month}`,
      method: "SYSTEM",
      recorded_by: "SYSTEM",
    });
    await insertOne("tenant_ledger", {
      tenant_id: peter.id,
      building_id: b2.id,
      agency_id: agency.id,
      type: "CREDIT",
      category: "RENT",
      amount: String(peterRent),
      billing_month: month,
      description: `Payment via MPESA`,
      reference_code: `MPESA-PETER-${peterRef}`,
      method: "MPESA_STK",
      recorded_by: "SYSTEM",
    });
    peterRef++;
  }

  // Deposits
  for (const { tenant, amount } of [
    { tenant: john, amount: u1_b1.deposit_amount },
    { tenant: grace, amount: u2_b1.deposit_amount },
    { tenant: peter, amount: u1_b2.deposit_amount },
  ]) {
    await insertOne("tenant_ledger", {
      tenant_id: tenant.id,
      building_id: tenant.building_id,
      agency_id: agency.id,
      type: "DEBIT",
      category: "DEPOSIT",
      amount,
      billing_month: "2026-01",
      description: "Security deposit",
      method: "SYSTEM",
      recorded_by: "SYSTEM",
    });
  }

  // ── Utility Readings ────────────────────────────────────────────────
  console.log("💧 Creating utility readings...");
  await insertOne("utility_readings", {
    unit_id: u1_b1.id,
    agency_id: agency.id,
    building_id: b1.id,
    utility_type: "WATER",
    previous_reading: "120.00",
    current_reading: "145.00",
    units_consumed: "25.00",
    rate_per_unit: "100.00",
    total_charge: "2500.00",
    billing_month: "2026-06",
    recorded_by: fieldAgent.clerk_user_id,
  });
  await insertOne("utility_readings", {
    unit_id: u2_b1.id,
    agency_id: agency.id,
    building_id: b1.id,
    utility_type: "ELECTRICITY",
    previous_reading: "500.00",
    current_reading: "650.00",
    units_consumed: "150.00",
    rate_per_unit: "25.00",
    total_charge: "3750.00",
    billing_month: "2026-06",
    recorded_by: fieldAgent.clerk_user_id,
  });

  // ── Complaints ──────────────────────────────────────────────────────
  console.log("🎫 Creating complaints...");
  const c1 = await insertOne("complaints", {
    tenant_id: john.id,
    agency_id: agency.id,
    building_id: b1.id,
    unit_id: u1_b1.id,
    title: "Water leak in bathroom",
    description: "Persistent water leak under the bathroom sink for 3 days.",
    category: "PLUMBING",
    status: "OPEN",
    priority: "HIGH",
    assigned_to: manager.clerk_user_id,
  });

  const c2 = await insertOne("complaints", {
    tenant_id: grace.id,
    agency_id: agency.id,
    building_id: b1.id,
    unit_id: u2_b1.id,
    title: "Noisy neighbor",
    description: "Loud music past midnight on weekdays.",
    category: "NOISE",
    status: "RESOLVED",
    priority: "MEDIUM",
    assigned_to: manager.clerk_user_id,
    resolved_at: new Date().toISOString(),
  });

  await insertOne("complaint_updates", {
    complaint_id: c1.id,
    agency_id: agency.id,
    author_clerk_id: manager.clerk_user_id,
    message: "Plumber scheduled for tomorrow.",
  });
  await insertOne("complaint_updates", {
    complaint_id: c2.id,
    agency_id: agency.id,
    author_clerk_id: manager.clerk_user_id,
    message: "Spoke with neighbor. Agreement reached.",
    status_change: "RESOLVED",
  });

  // ── Pending Transactions ────────────────────────────────────────────
  console.log("💳 Creating pending transactions...");
  await insertOne("pending_transactions", {
    tenant_id: john.id,
    building_id: b1.id,
    agency_id: agency.id,
    checkout_request_id: "ws_co_001",
    merchant_request_id: "ws_mr_001",
    amount: "25000",
    phone: john.phone,
    billing_month: "2026-07",
    status: "PENDING",
  });
  await insertOne("pending_transactions", {
    tenant_id: grace.id,
    building_id: b1.id,
    agency_id: agency.id,
    checkout_request_id: "ws_co_002",
    merchant_request_id: "ws_mr_002",
    amount: "35000",
    phone: grace.phone,
    billing_month: "2026-07",
    status: "FAILED",
    result_code: "400",
    result_desc: "Insufficient funds",
  });

  // ── Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED COMPLETE");
  console.log("=".repeat(60));
  console.log(`Agency:     ${agency.name}`);
  console.log(`Buildings:  2 (Westlands Heights, Karen Gardens)`);
  console.log(`Units:      6 (4 occupied, 2 vacant)`);
  console.log(`Tenants:    3`);
  console.log(`Leases:     3`);
  console.log(`Staff:      1 Manager, 1 Field Agent`);
  console.log("=".repeat(60));
  console.log("\nBalances:");
  console.log("  John Kamau    — KES 50,000 arrears (May-Jun unpaid)");
  console.log("  Grace Wanjiku — KES 125,000 arrears (partial Mar, Apr-Jun unpaid)");
  console.log("  Peter Ochieng — KES 0 (fully paid)");
  console.log("=".repeat(60));

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});