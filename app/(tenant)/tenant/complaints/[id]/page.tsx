import { getComplaintDetail } from "@/lib/actions/complaints";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { PriorityBadge } from "@/components/complaints/PriorityBadge";
import Link from "next/link";

export default async function TenantComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getComplaintDetail(id);
  const { complaint, tenantName, buildingName, unitNumber, updates } = detail;

  const photos = complaint.photoUrls ?? [];

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/tenant/complaints"
          style={{
            fontSize: "12px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)",
            textDecoration: "none", textTransform: "uppercase",
          }}
        >
          ← Back to Complaints
        </Link>
      </div>

      <div style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
        </div>
        <h1 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 400, letterSpacing: "-0.02em", color: "#ffffff", margin: "0 0 16px 0" }}>
          {complaint.title}
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
          {buildingName} — Unit {unitNumber} · Filed on{" "}
          {new Date(complaint.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Description */}
      <div style={{ marginBottom: "48px", padding: "24px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "16px" }}>
          Description
        </p>
        <p style={{ fontSize: "15px", lineHeight: 1.7, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap" }}>
          {complaint.description}
        </p>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div style={{ marginBottom: "48px" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "16px" }}>
            Photos
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {photos.map((url: string, i: number) => (
              <img
                key={i}
                src={url.trim()}
                alt={`Complaint photo ${i + 1}`}
                style={{ width: "200px", height: "150px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Updates Timeline */}
      <div>
        <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "24px" }}>
          Updates ({updates.length})
        </p>
        {updates.length === 0 ? (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            No updates yet. You will be notified when the manager responds.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {updates.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: "20px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderLeft: "3px solid rgba(255,255,255,0.15)",
                }}
              >
                <p style={{ fontSize: "14px", lineHeight: 1.6, color: "rgba(255,255,255,0.75)", marginBottom: "10px" }}>
                  {u.message}
                </p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
                  {new Date(u.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}