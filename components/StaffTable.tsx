// app/(admin)/admin/settings/staff/_components/StaffTable.tsx
// Client Component: staff list with deactivate/reactivate + building assignment.
// Calls deactivateStaffAction / reactivateStaffAction Server Actions.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deactivateStaffAction, reactivateStaffAction } from "@/lib/staff/actions";
import type { StaffListItem } from "@/lib/staff/queries";

interface Building {
  id: string;
  name: string;
}

export function StaffTable({ staffList, buildings }: { staffList: StaffListItem[]; buildings: Building[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({});

  const handleToggle = async (staffId: string, currentStatus: string) => {
    setPendingId(staffId);
    setStatusMsg((prev) => ({ ...prev, [staffId]: "" }));

    const action = currentStatus === "ACTIVE" ? deactivateStaffAction : reactivateStaffAction;
    const res = await action(staffId);

    setStatusMsg((prev) => ({ ...prev, [staffId]: res.message }));
    setPendingId(null);
    router.refresh();
  };

  if (staffList.length === 0) {
    return (
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", paddingTop: "12px" }}>
        No staff members yet. Invite your first manager or field agent above.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr 120px",
          gap: "16px",
          padding: "10px 20px",
          fontSize: "11px",
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
        }}
      >
        <span>Name</span>
        <span>Contact</span>
        <span>Role</span>
        <span>Buildings</span>
        <span>Status</span>
        <span>Action</span>
      </div>

      {staffList.map((s) => (
        <div
          key={s.id}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr 120px",
            gap: "16px",
            padding: "16px 20px",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            fontSize: "14px",
            color: "#ffffff",
          }}
        >
          <div>
            <p style={{ fontWeight: 500, marginBottom: "2px" }}>{s.fullName}</p>
            {s.nationalId && (
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>ID: {s.nationalId}</p>
            )}
          </div>

          <div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{s.email}</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{s.phone}</p>
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "4px 10px",
              backgroundColor: s.role === "MANAGER" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
              color: s.role === "MANAGER" ? "#60a5fa" : "#fbbf24",
              border: `1px solid ${s.role === "MANAGER" ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: "2px",
              whiteSpace: "nowrap",
              display: "inline-block",
              width: "fit-content",
            }}
          >
            {s.role.replace("_", " ")}
          </span>

          <div>
            {s.assignedBuildingIds && s.assignedBuildingIds.length > 0 ? (
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                {s.assignedBuildingIds
                  .map((id) => buildings.find((b) => b.id === id)?.name ?? id.slice(0, 6))
                  .join(", ")}
              </p>
            ) : (
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                All buildings
              </p>
            )}
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "4px 10px",
              backgroundColor: s.status === "ACTIVE" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              color: s.status === "ACTIVE" ? "#4ade80" : "#f87171",
              border: `1px solid ${s.status === "ACTIVE" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: "2px",
              whiteSpace: "nowrap",
              display: "inline-block",
              width: "fit-content",
            }}
          >
            {s.status}
          </span>

          <div>
            <button
              onClick={() => handleToggle(s.id, s.status)}
              disabled={pendingId === s.id}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.12em",
                color: s.status === "ACTIVE" ? "#f87171" : "#4ade80",
                backgroundColor: "transparent",
                border: `1px solid ${s.status === "ACTIVE" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
                cursor: pendingId === s.id ? "wait" : "pointer",
                textTransform: "uppercase",
                fontFamily: '"Helvetica Neue", sans-serif',
                opacity: pendingId === s.id ? 0.6 : 1,
              }}
            >
              {pendingId === s.id ? "Working…" : s.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
            </button>
            {statusMsg[s.id] && (
              <p style={{ fontSize: "10px", color: s.status === "ACTIVE" ? "#f87171" : "#4ade80", marginTop: "4px" }}>
                {statusMsg[s.id]}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}