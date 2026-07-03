/**
 * PropFlow Kenya — Complete Seed Script (Week 17)
 * ============================================================
 * Generates realistic end-to-end test data for QA walkthroughs.
 * 
 * Run: npx tsx scripts/seed.ts
 * Requires: DATABASE_URL in .env.local (unpooled Neon URL recommended)
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.ts";
import { eq } from "drizzle-orm";

// ── Types from schema ────────────────────────────────────────────
type Agency = typeof schema.agencies.$inferSelect;
type Building = typeof schema.buildings.$inferSelect;
type Unit = typeof schema.units.$inferSelect;
type Tenant = typeof schema.tenants.$inferSelect;
type Staff = typeof schema.staff.$inferSelect;

// ── Kenyan Data Generators ───────────────────────────────────────
const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Daniel", "Nancy", "Matthew", "Lisa",
  "Anthony", "Betty", "Mark", "Helen", "Donald", "Sandra", "Paul", "Donna",
  "Steven", "Carol", "Kenneth", "Ruth", "Andrew", "Sharon", "George", "Michelle",
  "Kevin", "Emily", "Brian", "Amanda", "Edward", "Melissa", "Ronald", "Deborah",
  "Timothy", "Stephanie", "Jason", "Rebecca", "Jeffrey", "Laura", "Ryan", "Shirley",
  "Jacob", "Cynthia", "Gary", "Kathleen", "Nicholas", "Amy", "Eric", "Angela",
  "Jonathan", "Anna", "Stephen", "Brenda", "Larry", "Pamela", "Justin", "Emma",
  "Scott", "Nicole", "Brandon", "Samantha", "Benjamin", "Katherine", "Samuel", "Christine",
];

const LAST_NAMES = [
  "Wanjiru", "Kamau", "Ochieng", "Muthoni", "Njoroge", "Achieng", "Kipchirchir", "Chebet",
  "Omondi", "Wambui", "Kariuki", "Mutua", "Owuor", "Wangari", "Kiptoo", "Jepchirchir",
  "Mwangi", "Koech", "Langat", "Rono", "Korir", "Tanui", "Kiprotich", "Jepkoech",
  "Kipkoech", "Cherono", "Jepkorir", "Kipngetich", "Kemboi", "Kiplagat", "Kipchoge", "Kosgei",
  "Kipruto", "Kiptanui", "Kipkurui", "Kiprono", "Kipchirchir", "Kiprotich", "Kipngetich", "Kipkemoi",
  "Mutai", "Kigen", "Kipkemboi", "Kipkoech", "Kiplimo", "Kipchumba", "Kiprop", "Kiprono",
  "Kipkurui", "Kiptoo", "Kipchirchir", "Kiprotich", "Kipngetich", "Kipkemboi", "Kipkoech", "Kiplimo",
];

const BUILDING_NAMES = [
  ["Westview Apartments", "Westlands", "Westlands, Nairobi"],
  ["Karen Heights", "Karen", "Karen, Nairobi"],
];

const UNIT_TYPES = ["1BR", "2BR", "STUDIO", "BEDSITTER"] as const;
const UNIT_NUMBERS = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"];
const FLOORS = ["Ground", "1", "2", "3", "4"];

const RENT_RANGES: Record<string, [number, number]> = {
  "1BR": [35000, 50000],
  "2BR": [55000, 75000],
  "STUDIO": [25000, 35000],
  "BEDSITTER": [18000, 28000],
};

// ── Helpers ──────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randPhone(): string {
  const prefixes = ["25471", "25472", "25473", "25474", "25479", "25470", "25478"] as const;
  const prefix = randItem(prefixes);
  const suffix = String(randInt(100000, 999999));
  return prefix + suffix;
}

function randName(): string {
  return `${randItem(FIRST_NAMES)} ${randItem(LAST_NAMES)}`;
}

function randEmail(name: string): string {
  const clean = name.toLowerCase().replace(/\s+/g, ".");
  const domains = ["gmail.com", "yahoo.com", "outlook.co.ke", "hotmail.com"] as const;
  return `${clean}@${randItem(domains)}`;
}

function randNationalId(): string {
  return String(randInt(10000000, 99999999));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function addMonths(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + n);
  return nd;
}

function generateMpesaCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 10; i++) code += chars[randInt(0, chars.length - 1)];
  return code;
}

function generateCheckoutRequestId(): string {
  return `ws_${Date.now()}_${randInt(1000, 9999)}`;
}

// ── Main Seed ────────────────────────────────────────────────────
async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment variables.");
  }

  console.log("🔌 Connecting to database...");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool, { schema });

  console.log("🧹 Cleaning existing seed data...");
  await db.delete(schema.complaintUpdates);
  await db.delete(schema.complaints);
  await db.delete(schema.pendingTransactions);
  await db.delete(schema.utilityReadings);
  await db.delete(schema.tenantLedger);
  await db.delete(schema.leases);
  await db.delete(schema.tenants);
  await db.delete(schema.units);
  await db.delete(schema.buildingUtilities);
  await db.delete(schema.buildings);
  await db.delete(schema.staff);
  await db.delete(schema.agencies);

  console.log("🏢 Creating Agency...");
  const [agency] = await db
    .insert(schema.agencies)
    .values({
      name: "Nairobi Prime Properties",
      email: "info@nairobiprime.co.ke",
      phone: "+254712345678",
      logoUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200",
      isActive: true,
      subscriptionStatus: "TRIAL",
    })
    .returning();

  console.log(`   ✓ Agency: ${agency.name} (${agency.id})`);

  // ── Staff ──────────────────────────────────────────────────────
  console.log("👔 Creating Staff...");
  const staffData: typeof schema.staff.$inferInsert[] = [
    {
      clerkUserId: "clerk_manager_001",
      agencyId: agency.id,
      fullName: "Grace Muthoni",
      email: "grace.muthoni@nairobiprime.co.ke",
      phone: "+254722000001",
      role: "MANAGER",
      nationalId: "12345678",
      status: "ACTIVE",
      assignedBuildingIds: [],
    },
    {
      clerkUserId: "clerk_agent_001",
      agencyId: agency.id,
      fullName: "Peter Kipchirchir",
      email: "peter.kipchirchir@nairobiprime.co.ke",
      phone: "+254722000002",
      role: "FIELD_AGENT",
      nationalId: "87654321",
      status: "ACTIVE",
      assignedBuildingIds: [],
    },
  ];

  const [manager, fieldAgent] = await db
    .insert(schema.staff)
    .values(staffData)
    .returning();

  console.log(`   ✓ Manager: ${manager.fullName}`);
  console.log(`   ✓ Field Agent: ${fieldAgent.fullName}`);

  // ── Buildings ────────────────────────────────────────────────────
  console.log("🏗️ Creating Buildings...");
  const buildings: Building[] = [];

  for (let b = 0; b < BUILDING_NAMES.length; b++) {
    const [name, locale, location] = BUILDING_NAMES[b];
    const [building] = await db
      .insert(schema.buildings)
      .values({
        agencyId: agency.id,
        name,
        location,
        locale,
        landlordName: b === 0 ? "John Kamau" : "Sarah Wambui",
        landlordPhone: b === 0 ? "+254723456789" : "+254723456790",
        darajaConsumerKey: `consumer_key_${b + 1}`,
        darajaConsumerSecret: `consumer_secret_${b + 1}`,
        darajaShortcode: b === 0 ? "174379" : "174380",
        darajaPasskey: `passkey_${b + 1}`,
      })
      .returning();

    buildings.push(building);
    console.log(`   ✓ Building: ${building.name} (${building.id})`);
  }

  // ── Building Utilities ─────────────────────────────────────────
  console.log("⚡ Configuring Building Utilities...");
  const utilityConfigs: { buildingId: string; name: string; rateType: string; defaultAmount: string; unit?: string }[][] = [
    [
      { buildingId: buildings[0].id, name: "RENT", rateType: "FIXED", defaultAmount: "0.00" },
      { buildingId: buildings[0].id, name: "WATER", rateType: "PER_UNIT", defaultAmount: "50.00", unit: "m³" },
      { buildingId: buildings[0].id, name: "ELECTRICITY", rateType: "PER_UNIT", defaultAmount: "25.00", unit: "kWh" },
      { buildingId: buildings[0].id, name: "GARBAGE", rateType: "FIXED", defaultAmount: "500.00" },
      { buildingId: buildings[0].id, name: "SERVICE_CHARGE", rateType: "FIXED", defaultAmount: "1500.00" },
      { buildingId: buildings[0].id, name: "WIFI", rateType: "FIXED", defaultAmount: "1000.00" },
      { buildingId: buildings[0].id, name: "SECURITY", rateType: "FIXED", defaultAmount: "800.00" },
    ],
    [
      { buildingId: buildings[1].id, name: "RENT", rateType: "FIXED", defaultAmount: "0.00" },
      { buildingId: buildings[1].id, name: "WATER", rateType: "PER_UNIT", defaultAmount: "45.00", unit: "m³" },
      { buildingId: buildings[1].id, name: "ELECTRICITY", rateType: "PER_UNIT", defaultAmount: "22.00", unit: "kWh" },
      { buildingId: buildings[1].id, name: "GARBAGE", rateType: "FIXED", defaultAmount: "400.00" },
      { buildingId: buildings[1].id, name: "SECURITY", rateType: "FIXED", defaultAmount: "600.00" },
    ],
  ];

  for (const configs of utilityConfigs) {
    for (const cfg of configs) {
      await db.insert(schema.buildingUtilities).values({
        agencyId: agency.id,
        ...cfg,
      } as typeof schema.buildingUtilities.$inferInsert);
    }
  }
  console.log(`   ✓ ${utilityConfigs.flat().length} utility configurations created`);

  // ── Units ──────────────────────────────────────────────────────
  console.log("🏠 Creating Units (10 per building)...");
  const allUnits: Unit[] = [];

  for (let b = 0; b < buildings.length; b++) {
    for (let u = 0; u < 10; u++) {
      const unitType = randItem([...UNIT_TYPES]);
      const [minRent, maxRent] = RENT_RANGES[unitType];
      const rentAmount = randInt(minRent, maxRent);
      const depositAmount = rentAmount;

      const [unit] = await db
        .insert(schema.units)
        .values({
          buildingId: buildings[b].id,
          agencyId: agency.id,
          unitNumber: UNIT_NUMBERS[u],
          floor: randItem(FLOORS),
          type: unitType,
          rentAmount: String(rentAmount),
          depositAmount: String(depositAmount),
          isOccupied: false,
        })
        .returning();

      allUnits.push(unit);
    }
  }
  console.log(`   ✓ ${allUnits.length} units created`);

  // ── Tenants + Leases ───────────────────────────────────────────
  console.log("👥 Creating 15 Tenants with Leases...");
  const tenants: Tenant[] = [];
  const leases: (typeof schema.leases.$inferSelect)[] = [];

  const shuffledUnits = [...allUnits].sort(() => Math.random() - 0.5);
  const occupiedUnits = shuffledUnits.slice(0, 15);
  const leaseStartBase = monthsAgo(4);

  for (let i = 0; i < 15; i++) {
    const unit = occupiedUnits[i];
    const building = buildings.find((b) => b.id === unit.buildingId)!;
    const fullName = randName();
    const phone = randPhone();
    const email = randEmail(fullName);
    const nationalId = randNationalId();

    const inviteStatus = Math.random() > 0.2 ? "ACCEPTED" : "PENDING";
    const clerkUserId = inviteStatus === "ACCEPTED" ? `clerk_tenant_${i + 1}` : null;

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        clerkUserId: clerkUserId || undefined,
        agencyId: agency.id,
        buildingId: building.id,
        unitId: unit.id,
        fullName,
        phone,
        email,
        nationalId,
        inviteStatus,
        status: "ACTIVE",
      })
      .returning();

    tenants.push(tenant);

    await db
      .update(schema.units)
      .set({ isOccupied: true })
      .where(eq(schema.units.id, unit.id));

    const startDate = new Date(leaseStartBase);
    startDate.setDate(startDate.getDate() + randInt(1, 28));
    const endDate = addMonths(startDate, 12);

    const [lease] = await db
      .insert(schema.leases)
      .values({
        tenantId: tenant.id,
        unitId: unit.id,
        agencyId: agency.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        rentAmount: unit.rentAmount,
        depositAmount: unit.depositAmount,
        depositPaid: Math.random() > 0.1,
        escalationType: Math.random() > 0.5 ? "FIXED" : "PERCENTAGE",
        escalationValue: Math.random() > 0.5 ? "2000.00" : "5.00",
        agreementTemplate: `# TENANCY AGREEMENT\n\nThis agreement is made between **Nairobi Prime Properties** (the Agent) acting on behalf of **{{LANDLORD_NAME}}** (the Landlord) and **{{TENANT_NAME}}** (the Tenant).\n\n**Property:** {{BUILDING_NAME}}, Unit {{UNIT_NUMBER}}, {{BUILDING_LOCATION}}\n\n**Lease Term:** {{LEASE_START}} to {{LEASE_END}}\n\n**Monthly Rent:** KES {{RENT_AMOUNT}}\n\n**Deposit:** KES {{DEPOSIT_AMOUNT}}\n\nSigned: _________________`,
        agreementGenerated: null,
        signedAt: inviteStatus === "ACCEPTED" ? new Date(startDate.getTime() + 86400000 * 3) : null,
        signedByTenantId: inviteStatus === "ACCEPTED" ? clerkUserId : null,
        status: "ACTIVE",
      })
      .returning();

    leases.push(lease);
  }

  console.log(`   ✓ ${tenants.length} tenants created`);
  console.log(`   ✓ ${leases.length} leases created`);

  // ── 3 Months of Ledger History ─────────────────────────────────
  console.log("📚 Generating 3 months of ledger history...");

  const billingMonths = [
    formatMonth(monthsAgo(2)),
    formatMonth(monthsAgo(1)),
    formatMonth(new Date()),
  ];

  let ledgerCount = 0;

  // Payment methods that match schema.ts paymentMethodEnum exactly
  const PAYMENT_METHODS: Array<"MPESA_STK" | "BANK_RECEIPT" | "CASH" | "SYSTEM"> = [
    "MPESA_STK", "BANK_RECEIPT", "CASH", "SYSTEM"
  ];

  for (const tenant of tenants) {
    const unit = allUnits.find((u) => u.id === tenant.unitId)!;
    const building = buildings.find((b) => b.id === tenant.buildingId)!;
    const lease = leases.find((l) => l.tenantId === tenant.id)!;
    const rentAmount = parseFloat(String(unit.rentAmount));

    for (let m = 0; m < billingMonths.length; m++) {
      const month = billingMonths[m];
      const isCurrentMonth = m === 2;

      // 1. RENT DEBIT
      await db.insert(schema.tenantLedger).values({
        tenantId: tenant.id,
        buildingId: building.id,
        agencyId: agency.id,
        type: "DEBIT",
        category: "RENT",
        amount: String(rentAmount),
        billingMonth: month,
        description: `${month} Rent — ${unit.unitNumber}`,
        referenceCode: null,
        method: "SYSTEM",
        recordedBy: null,
      });
      ledgerCount++;

      // 2. FIXED UTILITIES
      const buildingUtils = utilityConfigs
        .flat()
        .filter((u) => u.buildingId === building.id && u.name !== "RENT" && u.rateType === "FIXED");

      for (const util of buildingUtils) {
        await db.insert(schema.tenantLedger).values({
          tenantId: tenant.id,
          buildingId: building.id,
          agencyId: agency.id,
          type: "DEBIT",
          category: util.name as "WATER" | "ELECTRICITY" | "GARBAGE" | "SERVICE_CHARGE" | "WIFI" | "SECURITY" | "PREVIOUS_BALANCE" | "DEPOSIT" | "RENT",
          amount: util.defaultAmount,
          billingMonth: month,
          description: `${month} ${util.name} — ${unit.unitNumber}`,
          referenceCode: null,
          method: "SYSTEM",
          recordedBy: null,
        });
        ledgerCount++;
      }

      // 3. VARIABLE UTILITIES
      if (Math.random() > 0.3) {
        const waterRate = 50;
        const prevWater = randInt(100, 500);
        const currWater = prevWater + randInt(5, 25);
        const waterUnits = currWater - prevWater;
        const waterCharge = waterUnits * waterRate;

        await db.insert(schema.tenantLedger).values({
          tenantId: tenant.id,
          buildingId: building.id,
          agencyId: agency.id,
          type: "DEBIT",
          category: "WATER",
          amount: String(waterCharge),
          billingMonth: month,
          description: `${month} Water — ${waterUnits}m³ @ KES ${waterRate}/m³`,
          referenceCode: null,
          method: "SYSTEM",
          recordedBy: fieldAgent.clerkUserId,
        });
        ledgerCount++;

        await db.insert(schema.utilityReadings).values({
          unitId: unit.id,
          buildingId: building.id,
          agencyId: agency.id,
          recordedBy: fieldAgent.clerkUserId,
          utilityType: "WATER",
          previousReading: String(prevWater),
          currentReading: String(currWater),
          unitsConsumed: String(waterUnits),
          ratePerUnit: String(waterRate),
          amountCharged: String(waterCharge),
          billingMonth: month,
        });
      }

      if (Math.random() > 0.3) {
        const elecRate = 25;
        const prevElec = randInt(200, 1000);
        const currElec = prevElec + randInt(50, 200);
        const elecUnits = currElec - prevElec;
        const elecCharge = elecUnits * elecRate;

        await db.insert(schema.tenantLedger).values({
          tenantId: tenant.id,
          buildingId: building.id,
          agencyId: agency.id,
          type: "DEBIT",
          category: "ELECTRICITY",
          amount: String(elecCharge),
          billingMonth: month,
          description: `${month} Electricity — ${elecUnits}kWh @ KES ${elecRate}/kWh`,
          referenceCode: null,
          method: "SYSTEM",
          recordedBy: fieldAgent.clerkUserId,
        });
        ledgerCount++;

        await db.insert(schema.utilityReadings).values({
          unitId: unit.id,
          buildingId: building.id,
          agencyId: agency.id,
          recordedBy: fieldAgent.clerkUserId,
          utilityType: "ELECTRICITY",
          previousReading: String(prevElec),
          currentReading: String(currElec),
          unitsConsumed: String(elecUnits),
          ratePerUnit: String(elecRate),
          amountCharged: String(elecCharge),
          billingMonth: month,
        });
      }

      // 4. PREVIOUS BALANCE
      if (m > 0 && Math.random() > 0.6) {
        const arrears = randInt(2000, 15000);
        await db.insert(schema.tenantLedger).values({
          tenantId: tenant.id,
          buildingId: building.id,
          agencyId: agency.id,
          type: "DEBIT",
          category: "PREVIOUS_BALANCE",
          amount: String(arrears),
          billingMonth: month,
          description: `${month} Previous month balance carried forward`,
          referenceCode: null,
          method: "SYSTEM",
          recordedBy: null,
        });
        ledgerCount++;
      }

      // 5. PAYMENTS (CREDIT)
      const totalDue = rentAmount + buildingUtils.reduce((s, u) => s + parseFloat(u.defaultAmount), 0);
      const paymentRoll = Math.random();
      let paymentAmount = 0;

      if (!isCurrentMonth) {
        paymentAmount = paymentRoll > 0.15 ? totalDue : Math.floor(totalDue * 0.6);
      } else {
        if (paymentRoll > 0.4) paymentAmount = totalDue;
        else if (paymentRoll > 0.1) paymentAmount = Math.floor(totalDue * 0.5);
      }

      if (paymentAmount > 0) {
        // Pick a random payment method from the typed array
        const method = randItem(PAYMENT_METHODS);
        const refCode = method === "MPESA_STK" ? generateMpesaCode() : `REF-${randInt(10000, 99999)}`;

        await db.insert(schema.tenantLedger).values({
          tenantId: tenant.id,
          buildingId: building.id,
          agencyId: agency.id,
          type: "CREDIT",
          category: "RENT",
          amount: String(paymentAmount),
          billingMonth: month,
          description: `${month} Payment — ${method}`,
          referenceCode: refCode,
          method: method,
          recordedBy: method === "CASH" || method === "BANK_RECEIPT" ? fieldAgent.clerkUserId : null,
        });
        ledgerCount++;

        // If M-Pesa, create pending transaction record
        if (method === "MPESA_STK") {
          await db.insert(schema.pendingTransactions).values({
            tenantId: tenant.id,
            buildingId: building.id,
            agencyId: agency.id,
            checkoutRequestId: generateCheckoutRequestId(),
            merchantRequestId: generateCheckoutRequestId(),
            amount: String(paymentAmount),
            phoneNumber: tenant.phone,
            billingMonth: month,
            status: "COMPLETED",
            mpesaReceiptNumber: refCode,
            resultCode: "0",
            resultDesc: "The service request has been processed successfully",
            completedAt: new Date(),
          });
        }
      }
    }
  }

  console.log(`   ✓ ${ledgerCount} ledger entries created`);

  // ── Pending Transactions ───────────────────────────────────────
  console.log("💳 Creating pending M-Pesa transactions...");

  const currentMonth = formatMonth(new Date());
  const pendingTenants = tenants.slice(0, 3);
  for (const tenant of pendingTenants) {
    const unit = allUnits.find((u) => u.id === tenant.unitId)!;
    const building = buildings.find((b) => b.id === tenant.buildingId)!;
    const rentAmount = parseFloat(String(unit.rentAmount));

    await db.insert(schema.pendingTransactions).values({
      tenantId: tenant.id,
      buildingId: building.id,
      agencyId: agency.id,
      checkoutRequestId: generateCheckoutRequestId(),
      merchantRequestId: generateCheckoutRequestId(),
      amount: String(rentAmount),
      phoneNumber: tenant.phone,
      billingMonth: currentMonth,
      status: "PENDING",
      mpesaReceiptNumber: null,
      resultCode: null,
      resultDesc: null,
      completedAt: null,
    });
  }

  const failedTenant = tenants[3];
  const failedUnit = allUnits.find((u) => u.id === failedTenant.unitId)!;
  const failedBuilding = buildings.find((b) => b.id === failedTenant.buildingId)!;

  await db.insert(schema.pendingTransactions).values({
    tenantId: failedTenant.id,
    buildingId: failedBuilding.id,
    agencyId: agency.id,
    checkoutRequestId: generateCheckoutRequestId(),
    merchantRequestId: generateCheckoutRequestId(),
    amount: String(parseFloat(String(failedUnit.rentAmount))),
    phoneNumber: failedTenant.phone,
    billingMonth: currentMonth,
    status: "FAILED",
    mpesaReceiptNumber: null,
    resultCode: "400",
    resultDesc: "Insufficient funds in M-Pesa account",
    completedAt: null,
  });

  console.log(`   ✓ 4 pending/failed transactions created`);

  // ── Complaints ─────────────────────────────────────────────────
  console.log("🎫 Creating 5 Complaints...");
  const complaintTitles = [
    { title: "Leaking kitchen faucet", desc: "Water dripping continuously from the kitchen sink tap. Wastage concern.", priority: "HIGH" as const },
    { title: "Power outage in Unit B2", desc: "No electricity since yesterday evening. Affected lighting and fridge.", priority: "URGENT" as const },
    { title: "Broken gate lock", desc: "Main gate lock is jammed. Security concern for residents.", priority: "HIGH" as const },
    { title: "Noise complaint from upstairs", desc: "Loud music and moving furniture past midnight. Disturbing sleep.", priority: "MEDIUM" as const },
    { title: "Garbage not collected for 3 days", desc: "Piling up near the back entrance. Bad smell and health hazard.", priority: "MEDIUM" as const },
  ];

  const complaintTenants = tenants.slice(0, 5);
  for (let i = 0; i < 5; i++) {
    const tenant = complaintTenants[i];
    const unit = allUnits.find((u) => u.id === tenant.unitId)!;
    const building = buildings.find((b) => b.id === tenant.buildingId)!;
    const complaintData = complaintTitles[i];

    const [complaint] = await db
      .insert(schema.complaints)
      .values({
        tenantId: tenant.id,
        buildingId: building.id,
        unitId: unit.id,
        agencyId: agency.id,
        title: complaintData.title,
        description: complaintData.desc,
        category: complaintData.priority,
        priority: complaintData.priority,
        imageUrl: i < 2 ? `https://picsum.photos/400/300?random=${i}` : null,
        status: i < 2 ? "OPEN" : i < 4 ? "IN_PROGRESS" : "RESOLVED",
        assignedTo: i < 2 ? null : fieldAgent.clerkUserId,
        resolvedAt: i === 4 ? new Date(Date.now() - 86400000 * 2) : null,
      })
      .returning();

    const updates = [
      { note: "Ticket created and logged.", statusChange: "OPEN" },
      { note: "Assigned to field agent for inspection.", statusChange: "IN_PROGRESS" },
      { note: "Issue resolved. Tenant confirmed satisfaction.", statusChange: "RESOLVED" },
    ];

    const numUpdates = i === 4 ? 3 : i >= 2 ? 2 : 1;
    for (let u = 0; u < numUpdates; u++) {
      await db.insert(schema.complaintUpdates).values({
        complaintId: complaint.id,
        agencyId: agency.id,
        note: updates[u].note,
        statusChange: updates[u].statusChange,
        updatedBy: u === 0 ? manager.clerkUserId : fieldAgent.clerkUserId,
      });
    }
  }

  console.log(`   ✓ 5 complaints with updates created`);

  // ── Summary ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("🎉 SEED COMPLETE — PropFlow Kenya Test Data");
  console.log("=".repeat(60));
  console.log(`Agency:        ${agency.name}`);
  console.log(`Buildings:     ${buildings.length}`);
  console.log(`Units:         ${allUnits.length} (20 total, 15 occupied)`);
  console.log(`Tenants:       ${tenants.length} active`);
  console.log(`Leases:        ${leases.length}`);
  console.log(`Staff:         2 (Manager + Field Agent)`);
  console.log(`Ledger:        ${ledgerCount} entries (3 months history)`);
  console.log(`Complaints:    5 (2 open, 2 in-progress, 1 resolved)`);
  console.log(`Transactions:  4 (3 pending + 1 failed)`);
  console.log("=".repeat(60));
  console.log("\n📋 QA Walkthrough Ready:");
  console.log("   • Super Admin: View agency, toggle kill switch");
  console.log("   • Agency Owner: Buildings, units, Daraja config");
  console.log("   • Manager: Tenant invites, complaints, lease view");
  console.log("   • Field Agent: Meter readings, manual receipts");
  console.log("   • Tenant: Balance, pay rent, sign lease, file complaint");
  console.log("\n💡 Next: Run 'npm run dev' and sign in with test Clerk IDs");
  console.log("   Manager:    clerk_manager_001");
  console.log("   Field Agent: clerk_agent_001");
  console.log("   Tenant 1:   clerk_tenant_1");
  console.log("   Tenant 2:   clerk_tenant_2");
  console.log("=".repeat(60));

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});