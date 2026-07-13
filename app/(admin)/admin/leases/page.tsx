// app/(admin)/admin/leases/page.tsx
// Admin — list all leases across buildings. Filter by status, building, search.
// FULLY RESPONSIVE — desktop table + mobile cards
// PURE SERVER COMPONENT — no event handlers, no client interactivity.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { leases, tenants, buildings, units } from "@/db/schema";
import { eq, and, desc, like, or, SQL, sql, count } from "drizzle-orm";
import Link from "next/link";
import { Pagination as PaginationComponent } from "@/components/ui/pagination";
import { Suspense, type ComponentType } from "react";

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

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  showPageSizeSelector?: boolean;
};

const Pagination = PaginationComponent as unknown as ComponentType<PaginationProps>;

const PAGE_SIZE = 25;

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    buildingId?: string;
    search?: string;
    page?: string;
    pageSize?: string;
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
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? String(PAGE_SIZE), 10)));
  const offset = (page - 1) * pageSize;

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
    .select({ count: count() })
    .from(leases)
    .innerJoin(tenants, eq(tenants.id, leases.tenantId))
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(buildings, eq(buildings.id, tenants.buildingId))
    .where(whereClause);

  const [leaseList, countResult]: [LeaseRow[], { count: number }[]] = await Promise.all([
    baseQuery.limit(pageSize).offset(offset),
    countQuery,
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);
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
    if (currentSearch) sp.set("search", encodeURIComponent(currentSearch));
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
          marginBottom: "24px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {totalCount} {totalCount === 1 ? "Lease" : "Leases"}
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </p>

      {leaseList.length === 0 ? (
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", paddingTop: "12px" }}>
          No leases found.
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
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Tenant", "Building / Unit", "Term", "Rent", "Deposit", "Status", "Signed"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "14px 16px",
                          fontSize: "10px",
                          letterSpacing: "0.18em",
                          color: "rgba(255,255,255,0.35)",
                          textTransform: "uppercase",
                          fontWeight: 400,
                          textAlign: h === "Tenant" ? "left" : "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaseList.map((lease) => {
                    const endDate = new Date(lease.endDate);
                    const now = new Date();
                    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;

                    return (
                      <tr
                        key={lease.leaseId}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <p style={{ fontSize: "13px", color: "#ffffff", fontWeight: 500, marginBottom: "2px" }}>
                            {lease.tenantName}
                          </p>
                          {isExpiringSoon && (
                            <p style={{ fontSize: "11px", color: "#f87171", margin: 0 }}>
                              Expires in {daysUntilExpiry} days
                            </p>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>
                          <p style={{ margin: 0 }}>{lease.buildingName}</p>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
                            Unit {lease.unitNumber}
                          </p>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                          {new Date(lease.startDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                          {" — "}
                          {new Date(lease.endDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "13px", color: "#ffffff" }}>
                          KES {Number(lease.rentAmount).toLocaleString("en-KE")}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "13px", color: lease.depositPaid ? "#4ade80" : "#f87171" }}>
                          {lease.depositPaid ? "Paid" : "Pending"}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <LeaseStatusBadge status={lease.status} />
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          {lease.signedAt ? (
                            <span style={{ fontSize: "11px", color: "#4ade80" }}>✓</span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS — shown only on mobile */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} className="md:hidden">
            {leaseList.map((lease) => {
              const endDate = new Date(lease.endDate);
              const now = new Date();
              const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;

              return (
                <LeaseCard
                  key={lease.leaseId}
                  lease={lease}
                  isExpiringSoon={isExpiringSoon}
                  daysUntilExpiry={daysUntilExpiry}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ marginTop: "32px" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", alignItems: "center" }} className="md:hidden">
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
              <div className="hidden md:block">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Mobile Lease Card ────────────────────────────────────────────────────

function LeaseCard({
  lease,
  isExpiringSoon,
  daysUntilExpiry,
}: {
  lease: LeaseRow;
  isExpiringSoon: boolean;
  daysUntilExpiry: number;
}) {
  const statusColors: Record<string, string> = {
    ACTIVE: "#22c55e",
    PENDING_RENEWAL: "rgba(255,200,0,0.85)",
    TERMINATED: "#f87171",
    VACATED: "rgba(255,255,255,0.35)",
  };
  const accentColor = statusColors[lease.status] ?? "rgba(255,255,255,0.5)";

  return (
    <Link
      href={`/admin/tenants/${lease.tenantId}/lease`}
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        textDecoration: "none",
        display: "block",
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
          backgroundColor: accentColor,
        }}
      />

      {/* Header: Tenant name + Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
          paddingLeft: "12px",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: "15px", color: "#ffffff", fontWeight: 500, marginBottom: "4px", wordBreak: "break-word" }}>
            {lease.tenantName}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {lease.buildingName} · Unit {lease.unitNumber}
          </p>
          {isExpiringSoon && (
            <p style={{ fontSize: "11px", color: "#f87171", margin: "4px 0 0 0" }}>
              Expires in {daysUntilExpiry} days
            </p>
          )}
        </div>
        <LeaseStatusBadge status={lease.status} />
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
        <MobileStat
          label="Term"
          value={`${new Date(lease.startDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })} — ${new Date(lease.endDate).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}`}
        />
        <MobileStat
          label="Rent"
          value={`KES ${Number(lease.rentAmount).toLocaleString("en-KE")}`}
        />
        <MobileStat
          label="Deposit"
          value={lease.depositPaid ? "Paid" : "Pending"}
          valueColor={lease.depositPaid ? "#4ade80" : "#f87171"}
        />
        <MobileStat
          label="Signed"
          value={lease.signedAt ? "Yes ✓" : "No —"}
          valueColor={lease.signedAt ? "#4ade80" : "rgba(255,255,255,0.3)"}
        />
      </div>

      {/* Action */}
      <div style={{ paddingLeft: "12px" }}>
        <span
          style={{
            fontSize: "11px",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)",
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
        </span>
      </div>
    </Link>
  );
}

function MobileStat({
  label,
  value,
  valueColor = "#ffffff",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
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
          color: valueColor,
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>
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
        whiteSpace: "nowrap",
        flexShrink: 0,
        marginLeft: "8px",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}