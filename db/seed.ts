import { getDb } from "@/api/queries/connection";
import * as schema from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding PropFlow database...");

  // Insert a sample agency
  const [agency] = await db
    .insert(schema.agencies)
    .values({
      name: "Nairobi Prime Properties",
      email: "info@nairobiprime.co.ke",
      phone: "+254712345678",
      isActive: true,
      subscriptionStatus: "TRIAL",
    })
    .returning();

  console.log("Created agency:", agency.id);

  // Insert a sample building
  const [building] = await db
    .insert(schema.buildings)
    .values({
      agencyId: agency.id,
      name: "Westview Apartments",
      location: "Westlands, Nairobi",
      locale: "Westlands",
      landlordName: "John Kamau",
      landlordPhone: "+254723456789",
    })
    .returning();

  console.log("Created building:", building.id);

  // Insert sample units
  const unitData = [
    { unitNumber: "A1", floor: "1", type: "1BR", rentAmount: "45000.00", depositAmount: "45000.00" },
    { unitNumber: "A2", floor: "1", type: "2BR", rentAmount: "65000.00", depositAmount: "65000.00" },
    { unitNumber: "B1", floor: "2", type: "STUDIO", rentAmount: "30000.00", depositAmount: "30000.00" },
  ];

  for (const u of unitData) {
    await db.insert(schema.units).values({
      buildingId: building.id,
      agencyId: agency.id,
      ...u,
    });
  }

  console.log("Created 3 units");
  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});