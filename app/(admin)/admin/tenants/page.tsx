// app/(admin)/admin/tenants/page.tsx
// PHASE 2 OPTIMIZED: Server-side pagination + search. No more loading ALL tenants.
// FULLY RESPONSIVE — desktop table + mobile cards

import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { eq, and, desc, count, like, or } from "drizzle-orm";
import { getSessionMeta } from "@/lib/auth/getRole";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pagination as PaginationComponent } from "@/components/ui/pagination";
import { Suspense, type ComponentType } from "react";

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  showPageSizeSelector?: boolean;
};

const Pagination = PaginationComponent as unknown as ComponentType<PaginationProps>;

const PAGE_SIZE = 25;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    building?: string;
    status?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? String(PAGE_SIZE), 10)));
  const offset = (page - 1) * pageSize;

  // ── Build WHERE conditions dynamically ──────────────────────────────────
  const conditions = [eq(tenants.agencyId, agencyId)];

  if (params.building) {
    conditions.push(eq(tenants.buildingId, params.building));
  }

  if (params.status) {
    if (params.status === "PENDING") {
      conditions.push(eq(tenants.inviteStatus, "PENDING"));
    } else if (params.status === "ACTIVE") {
      conditions.push(eq(tenants.status, "ACTIVE"));
      conditions.push(eq(tenants.inviteStatus, "ACCEPTED"));
    } else if (params.status === "VACATED") {
      conditions.push(eq(tenants.status, "VACATED"));
    }
  }

  if (params.q) {
    const searchTerm = `%${params.q}%`;
    conditions.push(
      or(
        like(tenants.fullName, searchTerm),
        like(tenants.phone, searchTerm),
        like(tenants.email, searchTerm),
      )!,
    );
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)!;

  // ── Parallel: count + paginated data + buildings for filter ────────────
  const [countResult, rows, allBuildings] = await Promise.all([
    db.select({ count: count() }).from(tenants).where(whereClause),
    db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phone: tenants.phone,
        email: tenants.email,
        inviteStatus: tenants.inviteStatus,
        status: tenants.status,
        buildingId: tenants.buildingId,
        buildingName: buildings.name,
        unitId: tenants.unitId,
        unitNumber: units.unitNumber,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .leftJoin(buildings, eq(tenants.buildingId, buildings.id))
      .leftJoin(units, eq(tenants.unitId, units.id))
      .where(whereClause)
      .orderBy(desc(tenants.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ id: buildings.id, name: buildings.name })
      .from(buildings)
      .where(eq(buildings.agencyId, agencyId))
      .orderBy(buildings.name),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
        Tenant Management
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "48px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
          Tenants
        </h1>
        <Link
          href="/admin/tenants/new"
          style={{
            fontSize: "12px", fontWeight: 500, letterSpacing: "0.16em", color: "#0b0b0b",
            backgroundColor: "#ffffff", border: "1px solid #ffffff", padding: "12px 24px",
            textDecoration: "none", textTransform: "uppercase", fontFamily: '"Helvetica Neue", sans-serif',
            minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          + Add Tenant
        </Link>
      </div>

      {/* Search + Filters */}
      <form method="GET" style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: "200px", maxWidth: "320px" }}>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name, phone, email..."
            style={{
              width: "100%",
              padding: "10px 14px", fontSize: "13px", backgroundColor: "rgba(255,255,255,0.05)",
              color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)", outline: "none",
              fontFamily: '"Helvetica Neue", sans-serif',
            }}
          />
        </div>

        <select name="building" defaultValue={params.building ?? ""} style={selectStyle}>
          <option value="">All Buildings</option>
          {allBuildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select name="status" defaultValue={params.status ?? ""} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending Invite</option>
          <option value="ACTIVE">Active</option>
          <option value="VACATED">Vacated</option>
        </select>

        <button type="submit" style={filterBtnStyle}>Filter</button>
        <Link href="/admin/tenants" style={{ ...filterBtnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Clear
        </Link>
      </form>

      {/* Results count */}
      <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "24px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        {totalCount} {totalCount === 1 ? "Tenant" : "Tenants"}
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </p>

      {rows.length === 0 ? (
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", paddingTop: "12px" }}>
          No tenants found. Add your first tenant above.
        </p>
      ) : (
        <>
          {/* DESKTOP TABLE — hidden on mobile */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
              display: "none",
            }}
            className="md:block"
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Name", "Building · Unit", "Phone", "Invite", "Status", "Action"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "14px 16px",
                          fontSize: "10px",
                          letterSpacing: "0.18em",
                          color: "rgba(255,255,255,0.35)",
                          textTransform: "uppercase",
                          fontWeight: 400,
                          textAlign: h === "Name" ? "left" : "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tenant) => (
                    <tr
                      key={tenant.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <p style={{ fontSize: "13px", color: "#ffffff", fontWeight: 500, marginBottom: "2px" }}>
                          {tenant.fullName}
                        </p>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>
                        {tenant.buildingName ?? "—"}
                        {tenant.unitNumber && ` · ${tenant.unitNumber}`}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>
                        {tenant.phone}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <InviteBadge status={tenant.inviteStatus ?? "PENDING"} />
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          style={{
                            fontSize: "11px",
                            letterSpacing: "0.12em",
                            color: "rgba(255,255,255,0.6)",
                            textDecoration: "none",
                            textTransform: "uppercase",
                            border: "1px solid rgba(255,255,255,0.2)",
                            padding: "8px 14px",
                            display: "inline-block",
                            minHeight: "36px",
                            minWidth: "44px",
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS — shown only on mobile */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} className="md:hidden">
            {rows.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ marginTop: "32px" }}>
              <Suspense fallback={<div style={{ height: "40px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "4px" }} />}>
                <Pagination
                  totalPages={totalPages}
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={totalCount}
                  showPageSizeSelector
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Mobile Tenant Card ────────────────────────────────────────────────────

function TenantCard({
  tenant,
}: {
  tenant: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    inviteStatus: string | null;
    status: string;
    buildingName: string | null;
    unitNumber: string | null;
  };
}) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "3px",
          height: "100%",
          backgroundColor: tenant.status === "VACATED" ? "#f87171" : tenant.status === "ACTIVE" ? "#22c55e" : "#3b82f6",
        }}
      />

      {/* Header: Name + Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
          paddingLeft: "12px",
        }}
      >
        <div>
          <p style={{ fontSize: "15px", color: "#ffffff", fontWeight: 500, marginBottom: "4px" }}>
            {tenant.fullName}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            {tenant.buildingName ?? "—"}
            {tenant.unitNumber && ` · ${tenant.unitNumber}`}
          </p>
        </div>
        <StatusBadge status={tenant.status} />
      </div>

      {/* Details grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "16px",
          padding: "12px",
          backgroundColor: "rgba(255,255,255,0.02)",
          marginLeft: "12px",
        }}
      >
        <MobileStat label="Phone" value={tenant.phone} />
        <MobileStat label="Invite" value={tenant.inviteStatus === "ACCEPTED" ? "Accepted" : "Pending"} />
      </div>

      {/* Action */}
      <div style={{ paddingLeft: "12px" }}>
        <Link
          href={`/admin/tenants/${tenant.id}`}
          style={{
            fontSize: "11px",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            textTransform: "uppercase",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "10px 16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "44px",
            minWidth: "80px",
          }}
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: "10px",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "14px",
          color: "#ffffff",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function InviteBadge({ status }: { status: string }) {
  const color = status === "ACCEPTED" ? "#4ade80" : "rgba(255,200,0,0.9)";
  return (
    <span style={{ fontSize: "11px", letterSpacing: "0.1em", color, textTransform: "uppercase" }}>
      {status === "ACCEPTED" ? "Accepted" : "Pending"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "ACTIVE" ? "#4ade80" : status === "VACATED" ? "rgba(255,255,255,0.35)" : "rgba(255,200,0,0.9)";
  return (
    <span style={{ fontSize: "11px", letterSpacing: "0.1em", color, textTransform: "uppercase" }}>
      {status}
    </span>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: "13px", backgroundColor: "rgba(255,255,255,0.05)",
  color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)", outline: "none",
  fontFamily: '"Helvetica Neue", sans-serif', cursor: "pointer", minWidth: "160px",
};

const filterBtnStyle: React.CSSProperties = {
  padding: "10px 20px", fontSize: "12px", fontWeight: 500, letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.7)", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)",
  cursor: "pointer", textTransform: "uppercase", fontFamily: '"Helvetica Neue", sans-serif',
  minHeight: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center",
};