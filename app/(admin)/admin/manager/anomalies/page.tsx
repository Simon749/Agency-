// app/(admin)/admin/manager/anomalies/page.tsx
// Phase D: Manager dashboard for reviewing anomalous utility readings.
// Flags readings that deviate >50% from the tenant's trailing 3-month average.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { utilityReadings, units, tenants, buildings } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import Link from "next/link";

interface AnomalyRow {
  readingId: string;
  unitId: string;
  unitNumber: string;
  tenantName: string;
  tenantId: string;
  buildingName: string;
  utilityType: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  totalCharge: number;
  trailingAverage: number;
  deviationPercent: number;
  recordedBy: string;
  createdAt: Date;
  readingImageUrl: string | null;
  billingMonth: string;
}

async function getAnomalousReadings(agencyId: string): Promise<AnomalyRow[]> {
  const db = getDb();

  // Get all utility readings for this agency
  const readings = await db
    .select()
    .from(utilityReadings)
    .where(eq(utilityReadings.agencyId, agencyId))
    .orderBy(desc(utilityReadings.createdAt));

  const anomalies: AnomalyRow[] = [];

  for (const reading of readings) {
    // Get trailing 3-month average for this unit + utility type
    const history = await db
      .select({ unitsConsumed: utilityReadings.unitsConsumed })
      .from(utilityReadings)
      .where(
        and(
          eq(utilityReadings.unitId, reading.unitId),
          eq(utilityReadings.utilityType, reading.utilityType),
          sql`${utilityReadings.createdAt} < ${reading.createdAt}`
        )
      )
      .orderBy(desc(utilityReadings.createdAt))
      .limit(3);

    if (history.length < 2) continue; // Need at least 2 prior readings

    const avgConsumption =
      history.reduce((sum, h) => sum + Number(h.unitsConsumed), 0) / history.length;

    if (avgConsumption === 0) continue;

    const currentConsumed = Number(reading.unitsConsumed);
    const deviationPercent = ((currentConsumed - avgConsumption) / avgConsumption) * 100;

    // Flag if >50% above average
    if (deviationPercent > 50) {
      const [unit] = await db
        .select({ unitNumber: units.unitNumber, buildingId: units.buildingId })
        .from(units)
        .where(eq(units.id, reading.unitId))
        .limit(1);

      const [tenant] = await db
        .select({ fullName: tenants.fullName, id: tenants.id })
        .from(tenants)
        .where(eq(tenants.unitId, reading.unitId))
        .limit(1);

      const [building] = await db
        .select({ name: buildings.name })
        .from(buildings)
        .where(eq(buildings.id, unit?.buildingId ?? ""))
        .limit(1);

      anomalies.push({
        readingId: reading.id,
        unitId: reading.unitId,
        unitNumber: unit?.unitNumber ?? "—",
        tenantName: tenant?.fullName ?? "Vacant",
        tenantId: tenant?.id ?? "",
        buildingName: building?.name ?? "—",
        utilityType: reading.utilityType,
        previousReading: Number(reading.previousReading),
        currentReading: Number(reading.currentReading),
        unitsConsumed: currentConsumed,
        ratePerUnit: Number(reading.ratePerUnit),
        totalCharge: Number(reading.totalCharge),
        trailingAverage: avgConsumption,
        deviationPercent,
        recordedBy: reading.agentClerkId ?? "",
        createdAt: reading.createdAt,
        readingImageUrl: (reading as any).readingImageUrl ?? null,
        billingMonth: reading.billingMonth,
      });
    }
  }

  return anomalies;
}

export default async function AnomaliesPage() {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const anomalies = await getAnomalousReadings(agencyId);

  return (
    <div style={{ maxWidth: "1200px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Fraud Controls
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
        Anomalous Readings
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "48px" }}>
        Utility readings that exceed the tenant's trailing 3-month average by more than 50%.
        Review before billing to prevent errors or fraud.
      </p>

      {anomalies.length === 0 ? (
        <div
          style={{
            backgroundColor: "rgba(74, 222, 128, 0.05)",
            border: "1px solid rgba(74, 222, 128, 0.15)",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#4ade80", margin: 0 }}>
            ✅ No anomalous readings detected. All readings within normal range.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 100px",
              gap: "12px",
              padding: "12px 16px",
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span>Tenant / Unit</span>
            <span>Building</span>
            <span>Type</span>
            <span style={{ textAlign: "right" }}>Consumed</span>
            <span style={{ textAlign: "right" }}>Average</span>
            <span style={{ textAlign: "right" }}>Deviation</span>
            <span></span>
          </div>

          {anomalies.map((a) => (
            <AnomalyCard key={a.readingId} anomaly={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyRow }) {
  const deviationColor =
    anomaly.deviationPercent > 100
      ? "#ef4444" // red for >100%
      : anomaly.deviationPercent > 75
      ? "#f97316" // orange for 75-100%
      : "#eab308"; // yellow for 50-75%

  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 20px",
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 100px",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <div>
        <p style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 2px 0" }}>
          {anomaly.tenantName}
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
          Unit {anomaly.unitNumber} · {anomaly.billingMonth}
        </p>
      </div>

      <div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", margin: 0 }}>
          {anomaly.buildingName}
        </p>
      </div>

      <div>
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color:
              anomaly.utilityType === "WATER"
                ? "#60a5fa"
                : anomaly.utilityType === "ELECTRICITY"
                ? "#fbbf24"
                : "rgba(255,255,255,0.6)",
          }}
        >
          {anomaly.utilityType}
        </span>
      </div>

      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "14px", color: "#ffffff", margin: 0, fontWeight: 500 }}>
          {anomaly.unitsConsumed.toFixed(2)}
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
          @{anomaly.ratePerUnit}/unit
        </p>
      </div>

      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
          {anomaly.trailingAverage.toFixed(2)}
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
          3-mo avg
        </p>
      </div>

      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "16px", color: deviationColor, margin: 0, fontWeight: 600 }}>
          +{anomaly.deviationPercent.toFixed(0)}%
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
          KES {anomaly.totalCharge.toLocaleString("en-KE")}
        </p>
      </div>

      <div style={{ textAlign: "right" }}>
        <Link
          href={`/admin/tenants/${anomaly.tenantId}/ledger`}
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            paddingBottom: "2px",
          }}
        >
          View Ledger
        </Link>
      </div>

      {/* Expanded detail row */}
      <div
        style={{
          gridColumn: "1 / -1",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
        }}
      >
        <DetailItem label="Previous Reading" value={anomaly.previousReading.toFixed(2)} />
        <DetailItem label="Current Reading" value={anomaly.currentReading.toFixed(2)} />
        <DetailItem label="Recorded By" value={anomaly.recordedBy.slice(0, 8) + "…"} />
        <DetailItem
          label="Date"
          value={anomaly.createdAt.toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
      </div>

      {anomaly.readingImageUrl && (
        <div style={{ gridColumn: "1 / -1", marginTop: "12px" }}>
          <p
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            Reading Photo
          </p>
          <img
            src={anomaly.readingImageUrl}
            alt="Meter reading"
            style={{
              maxWidth: "320px",
              maxHeight: "200px",
              border: "1px solid rgba(255,255,255,0.1)",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: "10px",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          margin: "0 0 4px 0",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", margin: 0 }}>{value}</p>
    </div>
  );
}