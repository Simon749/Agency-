// app/(admin)/admin/settings/lease-template/page.tsx
// Admin — per-building lease template editor with placeholder reference.

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { buildings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { placeholderList, defaultLeaseTemplate } from "@/lib/lease";
import { revalidatePath } from "next/cache";

export default async function LeaseTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ buildingId?: string; saved?: string }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role } = session;

  if (!["AGENCY_OWNER", "MANAGER"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  // Load all buildings for this agency
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name, location: buildings.location, agreementTemplate: buildings.agreementTemplate })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  const selectedBuilding = params.buildingId
    ? buildingList.find((b) => b.id === params.buildingId)
    : null;

  return (
    <div style={{ maxWidth: "960px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Settings
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
        Lease Agreement Template
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "48px" }}>
        Customize the lease agreement template per building. Use placeholders to auto-fill tenant and property details.
      </p>

      {/* Saved Banner */}
      {params.saved === "1" && (
        <div
          style={{
            backgroundColor: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            padding: "16px 20px",
            marginBottom: "32px",
            color: "#4ade80",
            fontSize: "14px",
          }}
        >
          ✅ Template saved successfully.
        </div>
      )}

      {/* Building Selector */}
      <section style={{ marginBottom: "48px" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            marginBottom: "16px",
            paddingBottom: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Select Building
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
          {buildingList.map((b) => (
            <a
              key={b.id}
              href={`/admin/settings/lease-template?buildingId=${b.id}`}
              style={{
                padding: "16px 20px",
                backgroundColor: selectedBuilding?.id === b.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                border: selectedBuilding?.id === b.id ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
                color: "#ffffff",
                display: "block",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px 0" }}>{b.name}</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{b.location}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Template Editor */}
      {selectedBuilding && (
        <section>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Edit Template — {selectedBuilding.name}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: "32px",
            }}
          >
            {/* Editor */}
            <form action={saveTemplate}>
              <input type="hidden" name="buildingId" value={selectedBuilding.id} />

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Template (Markdown)
                </label>
                <textarea
                  name="template"
                  defaultValue={selectedBuilding.agreementTemplate ?? defaultLeaseTemplate}
                  rows={30}
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  style={{
                    padding: "13px 28px",
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    color: "#0b0b0b",
                    backgroundColor: "#ffffff",
                    border: "1px solid #ffffff",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    fontFamily: '"Helvetica Neue", sans-serif',
                  }}
                >
                  Save Template
                </button>
                <a
                  href={`/admin/settings/lease-template?buildingId=${selectedBuilding.id}`}
                  style={{
                    padding: "13px 28px",
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    color: "#ffffff",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(255,255,255,0.25)",
                    textDecoration: "none",
                    textTransform: "uppercase",
                    display: "inline-block",
                    fontFamily: '"Helvetica Neue", sans-serif',
                  }}
                >
                  Reset to Default
                </a>
              </div>
            </form>

            {/* Placeholder Reference */}
            <div>
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Available Placeholders
              </p>
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "20px",
                  maxHeight: "600px",
                  overflowY: "auto",
                }}
              >
                {placeholderList.map((ph) => (
                  <div
                    key={ph.key}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <code
                      style={{
                        fontSize: "12px",
                        color: "#4ade80",
                        fontFamily: '"SF Mono", monospace',
                        backgroundColor: "rgba(255,255,255,0.05)",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      {ph.key}
                    </code>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.4)",
                        margin: "4px 0 0 0",
                      }}
                    >
                      {ph.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Server Action ─────────────────────────────────────────────────────────

async function saveTemplate(formData: FormData) {
  "use server";

  const session = await getSessionMeta();
  if (!["AGENCY_OWNER", "MANAGER"].includes(session.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const buildingId = formData.get("buildingId") as string;
  const template = formData.get("template") as string;

  if (!buildingId || !template) {
    throw new Error("Missing required fields");
  }

  const db = getDb();
  await db
    .update(buildings)
    .set({ agreementTemplate: template.trim() })
    .where(and(eq(buildings.id, buildingId), eq(buildings.agencyId, session.agencyId!)));

  revalidatePath(`/admin/settings/lease-template?buildingId=${buildingId}`);
  redirect(`/admin/settings/lease-template?buildingId=${buildingId}&saved=1`);
}