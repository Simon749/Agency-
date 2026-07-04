// app/(admin)/admin/agent/meter-readings/page.tsx
// Field Agent — mobile-optimised meter reading entry.
// PHASE 7 FIXES: useFormStatus loading state, sticky submit button, accessible labels

import { redirect } from "next/navigation";
import { getSessionMeta, requireRole } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { buildings, units, tenants, buildingUtilities } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { MeterReadingForm } from "./MeterReadingForm";

export default async function MeterReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ buildingId?: string; unitId?: string; utility?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  // Load all buildings for this agency
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name, location: buildings.location })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  // If building selected, load its units
  let unitList: { id: string; unitNumber: string; type: string | null; isOccupied: boolean }[] = [];
  if (params.buildingId) {
    unitList = await db
      .select({ id: units.id, unitNumber: units.unitNumber, type: units.type, isOccupied: units.isOccupied })
      .from(units)
      .where(and(eq(units.buildingId, params.buildingId), eq(units.agencyId, agencyId)));
  }

  // If unit + utility selected, load previous reading
  let previousReading: { currentReading: number; ratePerUnit: number } | null = null;
  let tenantName: string | null = null;
  let unitNumber: string | null = null;

  if (params.unitId && params.utility && (params.utility === "WATER" || params.utility === "ELECTRICITY")) {
    const { getLastReading } = await import("@/lib/ledger/utilityBilling");
    previousReading = await getLastReading(params.unitId, params.utility);

    const [tenant] = await db
      .select({ fullName: tenants.fullName })
      .from(tenants)
      .where(
        and(
          eq(tenants.unitId, params.unitId),
          eq(tenants.buildingId, params.buildingId ?? ""),
          eq(tenants.agencyId, agencyId),
          eq(tenants.status, "ACTIVE")
        )
      )
      .limit(1);

    tenantName = tenant?.fullName ?? null;

    const [unit] = await db
      .select({ unitNumber: units.unitNumber })
      .from(units)
      .where(eq(units.id, params.unitId))
      .limit(1);

    unitNumber = unit?.unitNumber ?? null;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div style={{ maxWidth: "720px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Field Operations
      </p>
      <h1
        style={{
          fontSize: "clamp(28px, 3.5vw, 44px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          marginBottom: "8px",
          color: "#ffffff",
        }}
      >
        Meter Readings
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "48px" }}>
        Log water or electricity readings. Charges are calculated and billed automatically.
      </p>

      {/* Step 1: Select Building */}
      <section style={{ marginBottom: "48px" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            marginBottom: "16px",
            paddingBottom: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          1. Select Building
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
          {buildingList.map((b) => (
            <Link
              key={b.id}
              href={`/admin/agent/meter-readings?buildingId=${b.id}`}
              style={{
                padding: "16px 20px",
                backgroundColor: params.buildingId === b.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                border: params.buildingId === b.id ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
                color: "#ffffff",
                display: "block",
                transition: "all 0.2s",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px 0" }}>{b.name}</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>{b.location}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Step 2: Select Unit */}
      {params.buildingId && (
        <section style={{ marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            2. Select Unit
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
            {unitList.map((u) => (
              <Link
                key={u.id}
                href={`/admin/agent/meter-readings?buildingId=${params.buildingId}&unitId=${u.id}`}
                style={{
                  padding: "14px 16px",
                  backgroundColor: params.unitId === u.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: params.unitId === u.id ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                  color: u.isOccupied ? "#ffffff" : "rgba(255,255,255,0.55)",
                  display: "block",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "16px", fontWeight: 500, margin: "0 0 4px 0" }}>{u.unitNumber}</p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {u.type ?? "Unit"} · {u.isOccupied ? "Occupied" : "Vacant"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: Select Utility + Enter Reading */}
      {params.unitId && params.buildingId && (
        <section style={{ marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            3. Log Reading
          </p>

          {/* Utility Type Selector */}
          {!params.utility && (
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
              <Link
                href={`/admin/agent/meter-readings?buildingId=${params.buildingId}&unitId=${params.unitId}&utility=WATER`}
                style={{
                  flex: 1,
                  padding: "20px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                  color: "#ffffff",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 8px 0" }}>💧 Water</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>Log water meter reading</p>
              </Link>
              <Link
                href={`/admin/agent/meter-readings?buildingId=${params.buildingId}&unitId=${params.unitId}&utility=ELECTRICITY`}
                style={{
                  flex: 1,
                  padding: "20px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                  color: "#ffffff",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 8px 0" }}>⚡ Electricity</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>Log electricity meter reading</p>
              </Link>
            </div>
          )}

          {/* Reading Form — now a client component for pending state */}
          {params.utility && (params.utility === "WATER" || params.utility === "ELECTRICITY") && (
            <MeterReadingForm
              buildingId={params.buildingId}
              unitId={params.unitId}
              utility={params.utility}
              tenantName={tenantName}
              unitNumber={unitNumber}
              previousReading={previousReading}
              currentMonth={currentMonth}
              agentClerkId={userId}
            />
          )}
        </section>
      )}

      {/* Reading History */}
      {params.unitId && params.utility && (params.utility === "WATER" || params.utility === "ELECTRICITY") && (
        <ReadingHistory unitId={params.unitId} utilityType={params.utility} />
      )}
    </div>
  );
}

// ── Reading History Component ─────────────────────────────────────────────

async function ReadingHistory({
  unitId,
  utilityType,
}: {
  unitId: string;
  utilityType: "WATER" | "ELECTRICITY";
}) {
  const { getReadingHistory } = await import("@/lib/ledger/utilityBilling");
  const history = await getReadingHistory(unitId, utilityType, 12);

  return (
    <section>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        Reading History
      </p>

      {history.length === 0 ? (
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", padding: "20px 0" }}>
          No previous readings for this unit.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {history.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 100px 100px 120px",
                gap: "16px",
                padding: "14px 16px",
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "#ffffff" }}>
                {formatMonthLabel(row.billingMonth)}
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", textAlign: "right" }}>
                {Number(row.previousReading).toFixed(2)} → {Number(row.currentReading).toFixed(2)}
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", textAlign: "right" }}>
                {Number(row.unitsConsumed).toFixed(2)} units
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", textAlign: "right" }}>
                @ KES {Number(row.ratePerUnit).toFixed(2)}
              </span>
              <span style={{ fontSize: "13px", color: "#f87171", textAlign: "right", fontWeight: 500 }}>
                KES {Number(row.totalCharge).toLocaleString("en-KE")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}