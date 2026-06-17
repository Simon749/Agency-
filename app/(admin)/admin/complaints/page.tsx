import { getAgencyComplaints, getAgencyBuildings } from "@/lib/actions/complaints";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { PriorityBadge } from "@/components/complaints/PriorityBadge";
import Link from "next/link";

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string; status?: string; priority?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    buildingId: params.building,
    status: params.status,
    priority: params.priority,
  };

  const [rows, allBuildings] = await Promise.all([
    getAgencyComplaints(filters),
    getAgencyBuildings(),
  ]);

  const columns: { key: string; label: string }[] = [
    { key: "OPEN", label: "Open" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "RESOLVED", label: "Resolved" },
  ];

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

  return (
    <div>
      <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
        Support Management
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "48px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", color: "#ffffff", margin: 0 }}>
          Complaints
        </h1>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap" }}>
        <select name="building" defaultValue={params.building ?? ""} style={selectStyle}>
          <option value="">All Buildings</option>
          {allBuildings.map((b) => (
            <option key={b.id} value={b.id} style={{ backgroundColor: "#1a1a1a" }}>{b.name}</option>
          ))}
        </select>

        <select name="status" defaultValue={params.status ?? ""} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="OPEN" style={{ backgroundColor: "#1a1a1a" }}>Open</option>
          <option value="IN_PROGRESS" style={{ backgroundColor: "#1a1a1a" }}>In Progress</option>
          <option value="RESOLVED" style={{ backgroundColor: "#1a1a1a" }}>Resolved</option>
          <option value="CLOSED" style={{ backgroundColor: "#1a1a1a" }}>Closed</option>
        </select>

        <select name="priority" defaultValue={params.priority ?? ""} style={selectStyle}>
          <option value="">All Priorities</option>
          <option value="LOW" style={{ backgroundColor: "#1a1a1a" }}>Low</option>
          <option value="MEDIUM" style={{ backgroundColor: "#1a1a1a" }}>Medium</option>
          <option value="HIGH" style={{ backgroundColor: "#1a1a1a" }}>High</option>
          <option value="URGENT" style={{ backgroundColor: "#1a1a1a" }}>Urgent</option>
        </select>

        <button type="submit" style={filterBtnStyle}>Filter</button>
        <a href="/admin/complaints" style={{ ...filterBtnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Clear
        </a>
      </form>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        {columns.map((col) => {
          const colItems = rows.filter((r) => r.complaint.status === col.key);
          return (
            <div key={col.key}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "16px",
              }}>
                <span style={{ fontSize: "11px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.5)",
                  backgroundColor: "rgba(255,255,255,0.06)", padding: "2px 8px",
                }}>
                  {colItems.length}
                </span>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {colItems.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", padding: "20px 0" }}>
                    No {col.label.toLowerCase()} complaints
                  </p>
                ) : (
                  colItems.map((r) => (
                    <Link
                      key={r.complaint.id}
                      href={`/admin/complaints/${r.complaint.id}`}
                      style={{
                        display: "block",
                        padding: "16px",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#ffffff", lineHeight: 1.4 }}>
                          {r.complaint.title}
                        </span>
                        <PriorityBadge priority={r.complaint.priority} />
                      </div>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "12px", lineHeight: 1.5 }}>
                        {r.complaint.description.length > 80
                          ? r.complaint.description.slice(0, 80) + "..."
                          : r.complaint.description}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                          {r.buildingName} · Unit {r.unitNumber}
                        </span>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                          {new Date(r.complaint.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      {r.tenantName && (
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>
                          By: {r.tenantName}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}