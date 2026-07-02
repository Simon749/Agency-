// app/(admin)/admin/tenants/page.tsx
// PHASE 2 OPTIMIZED: Server-side pagination + search. No more loading ALL tenants.
// Handles 1000+ tenants gracefully with indexed queries.

import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { eq, and, desc, sql, count, like, or } from "drizzle-orm";
import { getSessionMeta } from "@/lib/auth/getRole";
import { redirect } from "next/navigation";
import Link from "next/link";

const PAGE_SIZE = 25;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    building?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const session = await getSessionMeta();
  const { agencyId } = session;
  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

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
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ id: buildings.id, name: buildings.name })
      .from(buildings)
      .where(eq(buildings.agencyId, agencyId))
      .orderBy(buildings.name),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Build query string helpers for pagination links
  const buildLink = (newPage: number) => {
    const sp = new URLSearchParams();
    if (params.building) sp.set("building", params.building);
    if (params.status) sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(newPage));
    return `/admin/tenants?${sp.toString()}`;
  };

  return (
    <div>
      <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
        Tenant Management
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "48px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", color: "#ffffff", margin: 0 }}>
          Tenants
        </h1>
        <Link
          href="/admin/tenants/new"
          style={{
            fontSize: "12px", fontWeight: 500, letterSpacing: "0.16em", color: "#0b0b0b",
            backgroundColor: "#ffffff", border: "1px solid #ffffff", padding: "12px 24px",
            textDecoration: "none", textTransform: "uppercase", fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          + Add Tenant
        </Link>
      </div>

      {/* Search + Filters */}
      <form method="GET" style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name, phone, email..."
            style={{
              padding: "10px 14px", fontSize: "13px", backgroundColor: "rgba(255,255,255,0.05)",
              color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)", outline: "none",
              fontFamily: '"Helvetica Neue", sans-serif', minWidth: "240px",
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

      {/* Table */}
      {rows.length === 0 ? (
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", paddingTop: "12px" }}>
          No tenants found. Add your first tenant above.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gap: "2px" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.5fr 1fr 1fr 100px", gap: "16px", padding: "10px 20px", fontSize: "11px", letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              <span>Name</span>
              <span>Building · Unit</span>
              <span>Phone</span>
              <span>Invite</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {rows.map((tenant) => (
              <div
                key={tenant.id}
                style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.5fr 1fr 1fr 100px", gap: "16px", padding: "16px 20px", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "14px", color: "#ffffff" }}
              >
                <span style={{ fontWeight: 500 }}>{tenant.fullName}</span>
                <span style={{ color: "rgba(255,255,255,0.65)" }}>
                  {tenant.buildingName ?? "—"}
                  {tenant.unitNumber && ` · ${tenant.unitNumber}`}
                </span>
                <span style={{ color: "rgba(255,255,255,0.65)" }}>{tenant.phone}</span>
                <span><InviteBadge status={tenant.inviteStatus ?? "PENDING"} /></span>
                <span><StatusBadge status={tenant.status} /></span>
                <span>
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    style={{ fontSize: "11px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)", textDecoration: "none", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 12px", display: "inline-block" }}
                  >
                    View
                  </Link>
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px", alignItems: "center" }}>
              <Link
                href={hasPrev ? buildLink(page - 1) : "#"}
                style={{
                  padding: "8px 16px", fontSize: "12px", letterSpacing: "0.12em",
                  color: hasPrev ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.2)", textDecoration: "none", textTransform: "uppercase",
                  pointerEvents: hasPrev ? "auto" : "none",
                }}
              >
                ← Prev
              </Link>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", padding: "0 16px" }}>
                Page {page} of {totalPages}
              </span>
              <Link
                href={hasNext ? buildLink(page + 1) : "#"}
                style={{
                  padding: "8px 16px", fontSize: "12px", letterSpacing: "0.12em",
                  color: hasNext ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.2)", textDecoration: "none", textTransform: "uppercase",
                  pointerEvents: hasNext ? "auto" : "none",
                }}
              >
                Next →
              </Link>
            </div>
          )}
        </>
      )}
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
};