"use client";

import { useState, useTransition, useEffect } from "react";
import { getComplaintDetail, updateComplaint } from "@/lib/actions/complaints";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { PriorityBadge } from "@/components/complaints/PriorityBadge";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getComplaintDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    params.then(async ({ id }) => {
      try {
        const data = await getComplaintDetail(id);
        setDetail(data);
        setSelectedStatus(data.complaint.status);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
        Loading complaint details...
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: "40px 0", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
        Complaint not found or access denied.
      </div>
    );
  }

  const { complaint, tenantName, tenantPhone, tenantEmail, buildingName, unitNumber, updates } = detail;
  const photos: string[] = complaint.photoUrls || [];

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && selectedStatus === complaint.status) return;

    startTransition(async () => {
      try {
        await updateComplaint(complaint.id, {
          status: selectedStatus as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
          note: note.trim() || undefined,
        });
        setNote("");
        const refreshed = await getComplaintDetail(complaint.id);
        setDetail(refreshed);
        setSelectedStatus(refreshed.complaint.status);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontSize: "14px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#ffffff",
    outline: "none",
    fontFamily: '"Helvetica Neue", sans-serif',
  };

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/admin/complaints"
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "48px" }}>
        {/* Left */}
        <div>
          <div style={{ marginBottom: "40px", padding: "24px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "16px" }}>
              Description
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.7, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap" }}>
              {complaint.description}
            </p>
          </div>

          {photos.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
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

          <div>
            <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "24px" }}>
              Update History ({updates.length})
            </p>
            {updates.length === 0 ? (
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
                No updates yet.
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
                      {u.message? (
                        <span style={{ marginLeft: "12px", color: "rgba(255,255,255,0.5)" }}>
                          Status → {u.message.replace("_", " ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tenant + Actions */}
        <div>
          <div style={{ padding: "24px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "24px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "16px" }}>
              Tenant
            </p>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "#ffffff", marginBottom: "6px" }}>{tenantName}</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>{tenantPhone}</p>
            {tenantEmail && <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{tenantEmail}</p>}
          </div>

          <div style={{ padding: "24px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "20px" }}>
              Update Ticket
            </p>

            <form onSubmit={handleUpdate} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Change Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="OPEN" style={{ backgroundColor: "#1a1a1a" }}>Open</option>
                  <option value="IN_PROGRESS" style={{ backgroundColor: "#1a1a1a" }}>In Progress</option>
                  <option value="RESOLVED" style={{ backgroundColor: "#1a1a1a" }}>Resolved</option>
                  <option value="CLOSED" style={{ backgroundColor: "#1a1a1a" }}>Closed</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Add Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="What action was taken?"
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              <button
                type="submit"
                disabled={isPending || (!note.trim() && selectedStatus === complaint.status)}
                style={{
                  fontSize: "12px", fontWeight: 500, letterSpacing: "0.16em", color: "#0b0b0b",
                  backgroundColor: "#ffffff", border: "1px solid #ffffff", padding: "14px 24px",
                  textTransform: "uppercase", fontFamily: '"Helvetica Neue", sans-serif',
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending || (!note.trim() && selectedStatus === complaint.status) ? 0.5 : 1,
                }}
              >
                {isPending ? "Updating..." : "Update Ticket"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}