// app/(admin)/admin/settings/staff/_components/StaffInviteForm.tsx
// Client Component: invite form with role selector + building assignment.
// Calls inviteStaff Server Action.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteStaff } from "@/lib/staff/actions";

interface Building {
  id: string;
  name: string;
}

export function StaffInviteForm({ buildings }: { buildings: Building[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; inviteUrl?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setResult(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const assignedBuildingIds = Array.from(formData.getAll("assignedBuildings") as string[]).filter(Boolean);

    const res = await inviteStaff({
      email: formData.get("email") as string,
      fullName: formData.get("fullName") as string,
      phone: formData.get("phone") as string,
      role: formData.get("role") as "MANAGER" | "FIELD_AGENT",
      nationalId: (formData.get("nationalId") as string) || undefined,
      assignedBuildingIds: assignedBuildingIds.length > 0 ? assignedBuildingIds : undefined,
    });

    setResult(res);
    setPending(false);

    if (res.success) {
      form.reset();
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", maxWidth: "1100px" }}>
      <FormField name="fullName" label="Full Name" placeholder="John Kamau" required />
      <FormField name="email" label="Email Address" placeholder="john@agency.co.ke" type="email" required />
      <FormField name="phone" label="Phone Number" placeholder="+254 700 000 000" type="tel" required />
      <FormField name="nationalId" label="National ID (Optional)" placeholder="12345678" />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Role</span>
        <select
          name="role"
          required
          style={{
            padding: "12px 0",
            fontSize: "14px",
            backgroundColor: "transparent",
            color: "#ffffff",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.25)",
            outline: "none",
            fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          <option value="" style={{ backgroundColor: "#0b0b0b" }}>Select role…</option>
          <option value="MANAGER" style={{ backgroundColor: "#0b0b0b" }}>Manager</option>
          <option value="FIELD_AGENT" style={{ backgroundColor: "#0b0b0b" }}>Field Agent</option>
        </select>
      </div>

      {/* Building assignment for field agents */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", gridColumn: "1 / -1" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
          Assigned Buildings (Field Agents only)
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 0" }}>
          {buildings.map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="assignedBuildings"
                value={b.id}
                style={{ accentColor: "#ffffff" }}
              />
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{b.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gridColumn: "1 / -1" }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "13px 32px",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.16em",
            color: "#0b0b0b",
            backgroundColor: "#ffffff",
            border: "1px solid #ffffff",
            cursor: pending ? "wait" : "pointer",
            textTransform: "uppercase",
            fontFamily: '"Helvetica Neue", sans-serif',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Sending Invite…" : "Send Invite"}
        </button>
      </div>

      {result && (
        <div style={{ gridColumn: "1 / -1", padding: "12px 0" }}>
          <p style={{ fontSize: "13px", color: result.success ? "#4ade80" : "#f87171" }}>
            {result.message}
          </p>
          {result.inviteUrl && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
              Invite link (share via WhatsApp if email fails): {result.inviteUrl}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function FormField({ name, label, placeholder, type = "text", required = false }: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        style={{
          padding: "12px 0",
          fontSize: "14px",
          backgroundColor: "transparent",
          color: "#ffffff",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.25)",
          outline: "none",
          fontFamily: '"Helvetica Neue", sans-serif',
          letterSpacing: "0.01em",
        }}
      />
    </label>
  );
}