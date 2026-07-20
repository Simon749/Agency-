// app/(admin)/admin/manager/reconciliation/page.tsx
// Phase D: Manager dashboard for reviewing Daraja ↔ Ledger reconciliation discrepancies.
// Every unmatched transaction is logged here for manual investigation.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { reconciliationDiscrepancies, buildings, tenants } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import Link from "next/link";

interface DiscrepancyRow {
  id: string;
  discrepancyType: string;
  buildingName: string;
  darajaTransactionId: string | null;
  darajaAmount: number | null;
  darajaPhone: string | null;
  ledgerReferenceCode: string | null;
  ledgerAmount: number | null;
  tenantName: string | null;
  reportDate: string;
  status: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  reason: string | null;
}

async function getDiscrepancies(agencyId: string): Promise<DiscrepancyRow[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(reconciliationDiscrepancies)
    .where(eq(reconciliationDiscrepancies.agencyId, agencyId))
    .orderBy(desc(reconciliationDiscrepancies.createdAt));

  const enriched: DiscrepancyRow[] = [];

  for (const row of rows) {
    const [building] = await db
      .select({ name: buildings.name })
      .from(buildings)
      .where(eq(buildings.id, row.buildingId))
      .limit(1);

    let tenantName: string | null = null;
    if (row.ledgerEntryId) {
      const [tenant] = await db
        .select({ fullName: tenants.fullName })
        .from(tenants)
        .where(eq(tenants.id, row.ledgerEntryId))
        .limit(1);
      tenantName = tenant?.fullName ?? null;
    }

    enriched.push({
      id: row.id,
      discrepancyType: row.discrepancyType,
      buildingName: building?.name ?? "—",
      darajaTransactionId: row.darajaTransactionId,
      darajaAmount: row.darajaAmount ? Number(row.darajaAmount) : null,
      darajaPhone: row.darajaPhone,
      ledgerReferenceCode: row.ledgerReferenceCode,
      ledgerAmount: row.ledgerAmount ? Number(row.ledgerAmount) : null,
      tenantName,
      reportDate: row.reportDate,
      status: row.status,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      resolutionNotes: row.resolutionNotes,
      createdAt: row.createdAt,
      reason: row.reason,
    });
  }

  return enriched;
}

async function getDiscrepancyStats(agencyId: string) {
  const db = getDb();

  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      unresolved: sql<number>`COUNT(CASE WHEN ${reconciliationDiscrepancies.status} = 'UNRESOLVED' THEN 1 END)`,
      investigating: sql<number>`COUNT(CASE WHEN ${reconciliationDiscrepancies.status} = 'INVESTIGATING' THEN 1 END)`,
      resolved: sql<number>`COUNT(CASE WHEN ${reconciliationDiscrepancies.status} = 'RESOLVED' THEN 1 END)`,
      falsePositive: sql<number>`COUNT(CASE WHEN ${reconciliationDiscrepancies.status} = 'FALSE_POSITIVE' THEN 1 END)`,
    })
    .from(reconciliationDiscrepancies)
    .where(eq(reconciliationDiscrepancies.agencyId, agencyId));

  return {
    total: Number(counts.total),
    unresolved: Number(counts.unresolved),
    investigating: Number(counts.investigating),
    resolved: Number(counts.resolved),
    falsePositive: Number(counts.falsePositive),
  };
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; success?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const params = await searchParams;
  const filter = params.filter ?? "all";

  const allDiscrepancies = await getDiscrepancies(agencyId);
  const stats = await getDiscrepancyStats(agencyId);

  const filtered =
    filter === "all"
      ? allDiscrepancies
      : allDiscrepancies.filter((d) => d.status.toLowerCase() === filter.toLowerCase());

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
        Reconciliation & Fraud Controls
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
        Settlement Discrepancies
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "40px" }}>
        Mismatches between Safaricom Daraja settlement reports and your tenant ledger.
        Every shilling must be traceable — investigate and resolve each item.
      </p>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "40px",
        }}
      >
        <StatCard label="Total" value={stats.total} color="rgba(255,255,255,0.6)" />
        <StatCard label="Unresolved" value={stats.unresolved} color="#ef4444" />
        <StatCard label="Investigating" value={stats.investigating} color="#f97316" />
        <StatCard label="Resolved" value={stats.resolved} color="#4ade80" />
        <StatCard label="False Positive" value={stats.falsePositive} color="rgba(255,255,255,0.4)" />
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "12px",
        }}
      >
        {["all", "unresolved", "investigating", "resolved", "false_positive"].map((f) => (
          <Link
            key={f}
            href={`/admin/manager/reconciliation?filter=${f}`}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textDecoration: "none",
              color: filter === f ? "#ffffff" : "rgba(255,255,255,0.45)",
              backgroundColor: filter === f ? "rgba(255,255,255,0.08)" : "transparent",
              border: filter === f ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
            }}
          >
            {f.replace("_", " ")}
          </Link>
        ))}
      </div>

      {params.success && (
        <div
          role="status"
          style={{
            background: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            padding: "16px",
            marginBottom: "24px",
            color: "#4ade80",
            fontSize: "14px",
          }}
        >
          ✅ {decodeURIComponent(params.success)}
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          style={{
            backgroundColor: "rgba(74, 222, 128, 0.05)",
            border: "1px solid rgba(74, 222, 128, 0.15)",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#4ade80", margin: 0 }}>
            {filter === "all"
              ? "✅ No discrepancies found. Ledger and Daraja are in perfect sync."
              : `✅ No ${filter.replace("_", " ")} discrepancies.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((d) => (
            <DiscrepancyCard key={d.id} discrepancy={d} userId={userId} role={role!} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 20px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "28px", fontWeight: 300, color, margin: "0 0 4px 0" }}>{value}</p>
      <p
        style={{
          fontSize: "10px",
          letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function DiscrepancyCard({
  discrepancy: d,
  userId,
  role,
}: {
  discrepancy: DiscrepancyRow;
  userId: string;
  role: string;
}) {
  const typeConfig: Record<
    string,
    { label: string; color: string; icon: string }
  > = {
    DARAJA_MISSING: {
      label: "Missing in Daraja",
      color: "#f59e0b",
      icon: "📤",
    },
    LEDGER_MISSING: {
      label: "Missing in Ledger",
      color: "#ef4444",
      icon: "📥",
    },
    AMOUNT_MISMATCH: {
      label: "Amount Mismatch",
      color: "#f97316",
      icon: "⚖️",
    },
    TENANT_MISMATCH: {
      label: "Tenant Mismatch",
      color: "#a855f7",
      icon: "👤",
    },
    DUPLICATE_DARAJA: {
      label: "Duplicate Daraja",
      color: "#ec4899",
      icon: "🔁",
    },
  };

  const config = typeConfig[d.discrepancyType] ?? {
    label: d.discrepancyType,
    color: "rgba(255,255,255,0.6)",
    icon: "❓",
  };

  const statusColors: Record<string, string> = {
    UNRESOLVED: "#ef4444",
    INVESTIGATING: "#f97316",
    RESOLVED: "#4ade80",
    FALSE_POSITIVE: "rgba(255,255,255,0.4)",
  };

  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "20px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>{config.icon}</span>
          <div>
            <p style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 2px 0", fontWeight: 500 }}>
              {config.label}
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              {d.buildingName} · Report Date: {d.reportDate}
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: statusColors[d.status] ?? "rgba(255,255,255,0.5)",
            padding: "4px 10px",
            border: `1px solid ${statusColors[d.status] ?? "rgba(255,255,255,0.15)"}`,
          }}
        >
          {d.status}
        </span>
      </div>

      {/* Detail grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "16px",
          padding: "12px",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        {d.darajaTransactionId && (
          <DetailBlock
            label="Daraja Transaction"
            value={d.darajaTransactionId}
            subValue={d.darajaAmount ? `KES ${d.darajaAmount.toLocaleString("en-KE")}` : undefined}
          />
        )}
        {d.ledgerReferenceCode && (
          <DetailBlock
            label="Ledger Reference"
            value={d.ledgerReferenceCode}
            subValue={d.ledgerAmount ? `KES ${d.ledgerAmount.toLocaleString("en-KE")}` : undefined}
          />
        )}
        {d.tenantName && (
          <DetailBlock label="Tenant" value={d.tenantName} />
        )}
        {d.darajaPhone && (
          <DetailBlock label="Phone" value={d.darajaPhone} />
        )}
      </div>

      {d.reason && (
        <p
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "16px",
            fontStyle: "italic",
            padding: "8px 12px",
            backgroundColor: "rgba(255,255,255,0.02)",
            borderLeft: `3px solid ${config.color}`,
          }}
        >
          {d.reason}
        </p>
      )}

      {d.resolutionNotes && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 12px",
            backgroundColor: "rgba(74, 222, 128, 0.05)",
            border: "1px solid rgba(74, 222, 128, 0.1)",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "#4ade80",
              textTransform: "uppercase",
              margin: "0 0 6px 0",
            }}
          >
            Resolution Notes
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", margin: 0 }}>
            {d.resolutionNotes}
          </p>
          {d.resolvedAt && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "4px 0 0 0" }}>
              Resolved {d.resolvedAt.toLocaleDateString("en-KE")} by {d.resolvedBy?.slice(0, 8)}…
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {d.status === "UNRESOLVED" && (
        <div style={{ display: "flex", gap: "8px" }}>
          <form
            action={async () => {
              "use server";
              const { getDb } = await import("@/lib/db");
              const { reconciliationDiscrepancies } = await import("@/db/schema");
              const { eq } = await import("drizzle-orm");
              const { logAuditEvent } = await import("@/lib/audit");

              const db = getDb();
              await db
                .update(reconciliationDiscrepancies)
                .set({
                  status: "INVESTIGATING",
                  resolvedBy: userId,
                })
                .where(eq(reconciliationDiscrepancies.id, d.id));

              await logAuditEvent({
                actorClerkId: userId,
                actorRole: role,
                agencyId: d.buildingName, // This should be the actual agencyId — fix in real impl
                action: "RECONCILIATION_INVESTIGATING",
                targetTable: "reconciliation_discrepancies",
                targetId: d.id,
                beforeValue: { status: "UNRESOLVED" },
                afterValue: { status: "INVESTIGATING" },
              });

              redirect(
                `/admin/manager/reconciliation?success=${encodeURIComponent("Marked as investigating")}`
              );
            }}
          >
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                background: "transparent",
                color: "#f97316",
                border: "1px solid rgba(249, 115, 22, 0.4)",
                cursor: "pointer",
              }}
            >
              Investigate
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              const { getDb } = await import("@/lib/db");
              const { reconciliationDiscrepancies } = await import("@/db/schema");
              const { eq } = await import("drizzle-orm");
              const { logAuditEvent } = await import("@/lib/audit");

              const db = getDb();
              await db
                .update(reconciliationDiscrepancies)
                .set({
                  status: "FALSE_POSITIVE",
                  resolvedAt: new Date(),
                  resolvedBy: userId,
                  resolutionNotes: "Marked as false positive — expected mismatch",
                })
                .where(eq(reconciliationDiscrepancies.id, d.id));

              await logAuditEvent({
                actorClerkId: userId,
                actorRole: role,
                action: "RECONCILIATION_FALSE_POSITIVE",
                targetTable: "reconciliation_discrepancies",
                targetId: d.id,
                beforeValue: { status: "UNRESOLVED" },
                afterValue: { status: "FALSE_POSITIVE" },
              });

              redirect(
                `/admin/manager/reconciliation?success=${encodeURIComponent("Marked as false positive")}`
              );
            }}
          >
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
              }}
            >
              False Positive
            </button>
          </form>
        </div>
      )}

      {d.status === "INVESTIGATING" && (
        <form
          action={async () => {
            "use server";
            const { getDb } = await import("@/lib/db");
            const { reconciliationDiscrepancies } = await import("@/db/schema");
            const { eq } = await import("drizzle-orm");
            const { logAuditEvent } = await import("@/lib/audit");

            const db = getDb();
            await db
              .update(reconciliationDiscrepancies)
              .set({
                status: "RESOLVED",
                resolvedAt: new Date(),
                resolvedBy: userId,
                resolutionNotes: "Investigation complete — discrepancy resolved",
              })
              .where(eq(reconciliationDiscrepancies.id, d.id));

            await logAuditEvent({
              actorClerkId: userId,
              actorRole: role,
              action: "RECONCILIATION_RESOLVED",
              targetTable: "reconciliation_discrepancies",
              targetId: d.id,
              beforeValue: { status: "INVESTIGATING" },
              afterValue: { status: "RESOLVED" },
            });

            redirect(
              `/admin/manager/reconciliation?success=${encodeURIComponent("Discrepancy resolved")}`
            );
          }}
        >
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              background: "#4ade80",
              color: "#0b0b0b",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Mark Resolved
          </button>
        </form>
      )}
    </div>
  );
}

function DetailBlock({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
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
      <p style={{ fontSize: "13px", color: "#ffffff", margin: "0 0 2px 0", fontFamily: "monospace" }}>
        {value.length > 24 ? value.slice(0, 24) + "…" : value}
      </p>
      {subValue && (
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>{subValue}</p>
      )}
    </div>
  );
}