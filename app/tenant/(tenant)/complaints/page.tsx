import { getTenantComplaints } from "@/lib/actions/complaints";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { PriorityBadge } from "@/components/complaints/PriorityBadge";
import Link from "next/link";

export default async function TenantComplaintsPage() {
  const complaints = await getTenantComplaints();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "48px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p style={{ fontSize: "11px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "12px" }}>
            Support
          </p>
          <h1 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", color: "#ffffff", margin: 0 }}>
            My Complaints
          </h1>
        </div>
        <Link
          href="/tenant/complaints/new"
          style={{
            fontSize: "12px", fontWeight: 500, letterSpacing: "0.16em", color: "#0b0b0b",
            backgroundColor: "#ffffff", border: "1px solid #ffffff", padding: "12px 24px",
            textDecoration: "none", textTransform: "uppercase", fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          + File New Complaint
        </Link>
      </div>

      {complaints.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "20px" }}>
            No complaints filed yet.
          </p>
          <Link
            href="/tenant/complaints/new"
            style={{
              fontSize: "12px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.6)",
              textDecoration: "none", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.2)",
              padding: "10px 20px", display: "inline-block",
            }}
          >
            File Your First Complaint
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "2px" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 100px", gap: "16px", padding: "10px 20px", fontSize: "11px", letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
            <span>Title</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Date</span>
            <span></span>
          </div>

          {complaints.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 120px 100px",
                gap: "16px",
                padding: "16px 20px",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                fontSize: "14px",
                color: "#ffffff",
              }}
            >
              <span style={{ fontWeight: 500 }}>{c.title}</span>
              <span><StatusBadge status={c.status} /></span>
              <span><PriorityBadge priority={c.priority} /></span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                {new Date(c.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span>
                <Link
                  href={`/tenant/complaints/${c.id}`}
                  style={{
                    fontSize: "11px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)",
                    textDecoration: "none", textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.2)", padding: "6px 12px", display: "inline-block",
                  }}
                >
                  View
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}