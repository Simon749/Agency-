// app/(admin)/admin/leases/page.tsx
// Admin — list all leases across buildings. Filter by status, building, search.
// PURE SERVER COMPONENT — no event handlers, no client interactivity.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { leases, tenants, buildings, units } from "@/db/schema";
import { eq, and, desc, like, or, SQL, sql } from "drizzle-orm";
import Link from "next/link";

interface LeaseRow {
  leaseId: string;
  tenantName: string;
  tenantId: string;
  buildingName: string;
  unitNumber: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  depositPaid: boolean | null;
  status: string;
  signedAt: Date | null;
}

const PAGE_SIZE = 25;

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    buildingId?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  // Load buildings for filter
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  // Build WHERE clause dynamically
  let whereClause: SQL = eq(leases.agencyId, agencyId);

  if (params.status && params.status !== "ALL") {
    whereClause = and(whereClause, eq(leases.status, params.status as any))!;
  }

  if (params.buildingId) {
    whereClause = and(whereClause, eq(buildings.id, params.buildingId))!;
  }

  if (params.search) {
    const searchTerm = `%${params.search}%`;
    whereClause = and(
      whereClause,
      or(
        like(tenants.fullName, searchTerm),
        like(units.unitNumber, searchTerm)
      )
    )!;
  }

  // Execute query — count + paginated rows in parallel
  const baseQuery = db
    .select({
      leaseId: leases.id,
      tenantName: tenants.fullName,
      tenantId: tenants.id,
      buildingName: buildings.name,
      unitNumber: units.unitNumber,
      startDate: leases.startDate,
      endDate: leases.endDate,
      rentAmount: leases.rentAmount,
      depositPaid: leases.depositPaid,
      status: leases.status,
      signedAt: leases.signedAt,
    })
    .from(leases)
    .innerJoin(tenants, eq(tenants.id, leases.tenantId))
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(buildings, eq(buildings.id, tenants.buildingId))
    .where(whereClause)
    .orderBy(desc(leases.createdAt));

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(leases)
    .innerJoin(tenants, eq(tenants.id, leases.tenantId))
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(buildings, eq(buildings.id, tenants.buildingId))
    .where(whereClause);

  const [leaseList, countResult]: [LeaseRow[], { count: number }[]] = await Promise.all([
    baseQuery.limit(PAGE_SIZE).offset(offset),
    countQuery,
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const statusFilters = [
    { key: "ALL", label: "All" },
    { key: "ACTIVE", label: "Active" },
    { key: "PENDING_RENEWAL", label: "Pending Renewal" },
    { key: "TERMINATED", label: "Terminated" },
  ];

  const currentStatus = params.status ?? "ALL";
  const currentBuildingId = params.buildingId ?? "";
  const currentSearch = params.search ?? "";

  // Build query string helper for pagination links — preserves current filters
  const buildPageLink = (newPage: number) => {
    const sp = new URLSearchParams();
    sp.set("status", currentStatus);
    if (currentBuildingId) sp.set("buildingId", currentBuildingId);
    if (currentSearch) sp.set("search", currentSearch);
    sp.set("page", String(newPage));
    return `/admin/leases?${sp.toString()}`;
  };

  return (
    <div>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Lease Management
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
        Leases
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "48px" }}>
        Manage all lease agreements, track signing status, and handle renewals.
      </p>

      {/* Filters */}
      <div style={{ marginBottom: "32px" }}>
        {/* Status Tabs */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "16px", flexWrap: "wrap" }}>
          {statusFilters.map((s) => {
            const isActive = currentStatus === s.key || (!params.status && s.key === "ALL");
            const queryParts: string[] = [`status=${s.key}`];
            if (currentBuildingId) queryParts.push(`buildingId=${currentBuildingId}`);
            if (currentSearch) queryParts.push(`search=${encodeURIComponent(currentSearch)}`);
            const href = `/admin/leases?${queryParts.join("&")}`;

            return (
              <Link
                key={s.key}
                href={href}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: isActive ? "#0b0b0b" : "rgba(255,255,255,0.5)",
                  backgroundColor: isActive ? "#ffffff" : "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                }}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Building + Search Filters — pure form, no JS */}
        <form style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={currentStatus} />

          <select
            name="buildingId"
            defaultValue={currentBuildingId}
            style={{
              padding: "10px 14px",
              fontSize: "13px",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "inherit",
              minWidth: "180px",
            }}
          >
            <option value="">All Buildings</option>
            {buildingList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="search"
            defaultValue={currentSearch}
            placeholder="Search tenant or unit..."
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "10px 14px",
              fontSize: "13px",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#0b0b0b",
              backgroundColor: "#ffffff",
              border: "1px solid #ffffff",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Results count */}
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        {totalCount} {totalCount === 1 ? "Lease" : "Leases"}
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </p>

      {/* Lease Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 120px 120px 100px 100px",
            gap: "16px",
            padding: "12px 16px",
            fontSize: "11px",
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}
        >
          <span>Tenant</span>
          <span>Building / Unit</span>
          <span>Term</span>
          <span style={{ textAlign: "right" }}>Rent</span>
          <span style={{ textAlign: "right" }}>Deposit</span>
          <span style={{ textAlign: "center" }}>Status</span>
          <span style={{ textAlign: "center" }}>Signed</span>
        </div>

        {leaseList.length === 0 ? (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", padding: "40px 16px", textAlign: "center" }}>
            No leases found.
          </p>
        ) : (
          leaseList.map((lease) => {
            const endDate = new Date(lease.endDate);
            const now = new Date();
            const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;

            return (
              <Link
                key={lease.leaseId}
                href={`/admin/tenants/${lease.tenantId}/lease`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 120px 120px 100px 100px",
                  gap: "16px",
                  padding: "16px",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  textDecoration: "none",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 2px 0" }}>
                    {lease.tenantName}
                  </p>
                  {isExpiringSoon && (
                    <p style={{ fontSize: "11px", color: "#f87171", margin: 0 }}>
                      Expires in {daysUntilExpiry} days
                    </p>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                    {lease.buildingName}
                  </p>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
                    Unit {lease.unitNumber}
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                    {new Date(lease.startDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                    {" — "}
                    {new Date(lease.endDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                  </p>
                </div>

                <p style={{ fontSize: "13px", color: "#ffffff", textAlign: "right", margin: 0 }}>
                  KES {Number(lease.rentAmount).toLocaleString("en-KE")}
                </p>

                <p style={{ fontSize: "13px", color: lease.depositPaid ? "#4ade80" : "#f87171", textAlign: "right", margin: 0 }}>
                  {lease.depositPaid ? "Paid" : "Pending"}
                </p>

                <div style={{ textAlign: "center" }}>
                  <LeaseStatusBadge status={lease.status} />
                </div>

                <div style={{ textAlign: "center" }}>
                  {lease.signedAt ? (
                    <span style={{ fontSize: "11px", color: "#4ade80" }}>✓</span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>—</span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px", alignItems: "center" }}>
          <Link
            href={hasPrev ? buildPageLink(page - 1) : "#"}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: hasPrev ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.2)",
              textDecoration: "none",
              textTransform: "uppercase",
              pointerEvents: hasPrev ? "auto" : "none",
            }}
          >
            ← Prev
          </Link>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", padding: "0 16px" }}>
            Page {page} of {totalPages}
          </span>
          <Link
            href={hasNext ? buildPageLink(page + 1) : "#"}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: hasNext ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.2)",
              textDecoration: "none",
              textTransform: "uppercase",
              pointerEvents: hasNext ? "auto" : "none",
            }}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}

function LeaseStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "#4ade80",
    PENDING_RENEWAL: "rgba(255,200,0,0.85)",
    TERMINATED: "#f87171",
    VACATED: "rgba(255,255,255,0.35)",
  };

  const color = colors[status] ?? "rgba(255,255,255,0.5)";

  return (
    <span
      style={{
        fontSize: "10px",
        letterSpacing: "0.1em",
        color,
        textTransform: "uppercase",
        border: `1px solid ${color}`,
        padding: "3px 8px",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}