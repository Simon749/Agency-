// app/(admin)/admin/agent/receipts/page.tsx
// Field Agent — log cash or bank receipt payments manually.
// PHASE 7 FIXES: Camera capture for bank receipts, accessible labels, htmlFor/id

import { redirect } from "next/navigation";
import { getSessionMeta } from "@/lib/auth/getRole";
import { getDb } from "@/lib/db";
import { buildings, tenants, units } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{
    buildingId?: string;
    tenantId?: string;
    step?: string;
    amount?: string;
    method?: string;
    referenceCode?: string;
    billingMonth?: string;
    description?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const session = await getSessionMeta();
  const { agencyId, role, userId } = session;

  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(role ?? "")) {
    redirect("/admin/dashboard");
  }

  if (!agencyId) redirect("/pending-setup");

  const db = getDb();
  const params = await searchParams;

  // Load all buildings for this agency
  const buildingList = await db
    .select({ id: buildings.id, name: buildings.name, location: buildings.location })
    .from(buildings)
    .where(eq(buildings.agencyId, agencyId));

  // Load tenants if building selected
  let tenantList: {
    id: string;
    fullName: string;
    unitNumber: string;
    phone: string;
    balance: number;
  }[] = [];

  if (params.buildingId) {
    const rawTenants = await db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phone: tenants.phone,
        unitId: tenants.unitId,
      })
      .from(tenants)
      .where(
        and(
          eq(tenants.buildingId, params.buildingId),
          eq(tenants.agencyId, agencyId),
          eq(tenants.status, "ACTIVE")
        )
      );

    for (const t of rawTenants) {
      const [unit] = await db
        .select({ unitNumber: units.unitNumber })
        .from(units)
        .where(eq(units.id, t.unitId))
        .limit(1);

      tenantList.push({
        id: t.id,
        fullName: t.fullName,
        unitNumber: unit?.unitNumber ?? "—",
        phone: t.phone,
        balance: 0,
      });
    }
  }

  let selectedTenant: (typeof tenantList)[0] | null = null;
  if (params.tenantId) {
    selectedTenant = tenantList.find((t) => t.id === params.tenantId) ?? null;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isConfirmStep = params.step === "confirm";
  const isSuccess = !!params.success;
  const isError = !!params.error;

  return (
    <div style={{ maxWidth: "720px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Field Operations
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
        Log Manual Payment
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "48px" }}>
        Record cash or bank payments for tenants. A confirmation step prevents double-entry.
      </p>

      {/* Success / Error Banners with aria-live */}
      {isSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            padding: "16px 20px",
            marginBottom: "32px",
            color: "#4ade80",
            fontSize: "14px",
          }}
        >
          ✅ Payment logged successfully. Ledger updated.
        </div>
      )}
      {isError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            padding: "16px 20px",
            marginBottom: "32px",
            color: "#f87171",
            fontSize: "14px",
          }}
        >
          ⚠️ {decodeURIComponent(params.error!)}
        </div>
      )}

      {/* Step 1: Select Building */}
      {!params.buildingId && (
        <section style={{ marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            1. Select Building
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {buildingList.map((b) => (
              <Link
                key={b.id}
                href={`/admin/agent/receipts?buildingId=${b.id}`}
                style={{
                  padding: "16px 20px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                  color: "#ffffff",
                  display: "block",
                }}
              >
                <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px 0" }}>{b.name}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>{b.location}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Select Tenant */}
      {params.buildingId && !params.tenantId && (
        <section style={{ marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            2. Select Tenant
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {tenantList.map((t) => (
              <Link
                key={t.id}
                href={`/admin/agent/receipts?buildingId=${params.buildingId}&tenantId=${t.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 1fr",
                  gap: "16px",
                  padding: "14px 16px",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  textDecoration: "none",
                  color: "#ffffff",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "14px" }}>{t.fullName}</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                  Unit {t.unitNumber}
                </span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", textAlign: "right" }}>
                  {t.phone}
                </span>
              </Link>
            ))}
          </div>
          {tenantList.length === 0 && (
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", padding: "20px 0" }}>
              No active tenants in this building.
            </p>
          )}
        </section>
      )}

      {/* Step 3: Payment Form or Confirmation */}
      {params.tenantId && selectedTenant && !isSuccess && (
        <section>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {isConfirmStep ? "3. Confirm Payment" : "3. Enter Payment Details"}
          </p>

          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "16px 20px",
              marginBottom: "24px",
            }}
          >
            <p style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 4px 0" }}>
              {selectedTenant.fullName} · Unit {selectedTenant.unitNumber}
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0 }}>
              {selectedTenant.phone}
            </p>
          </div>

          {!isConfirmStep ? (
            <form
              action={async (formData: FormData) => {
                "use server";
                const buildingId = formData.get("buildingId") as string;
                const tenantId = formData.get("tenantId") as string;
                const amount = formData.get("amount") as string;
                const method = formData.get("method") as string;
                const referenceCode = (formData.get("referenceCode") as string)?.trim() || null;
                const billingMonth = formData.get("billingMonth") as string;
                const description = formData.get("description") as string;

                const search = new URLSearchParams({
                  buildingId,
                  tenantId,
                  step: "confirm",
                  amount,
                  method,
                  ...(referenceCode ? { referenceCode } : {}),
                  billingMonth,
                  description,
                });
                redirect(`/admin/agent/receipts?${search.toString()}`);
              }}
            >
              <input type="hidden" name="buildingId" value={params.buildingId} />
              <input type="hidden" name="tenantId" value={params.tenantId} />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "20px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <label
                    htmlFor="method"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.55)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Payment Method *
                  </label>
                  <select
                    id="method"
                    name="method"
                    required
                    defaultValue="CASH"
                    style={{
                      width: "100%",
                      padding: "12px",
                      fontSize: "14px",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_RECEIPT">Bank Receipt</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="amount"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.55)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Amount (KES) *
                  </label>
                  <input
                    id="amount"
                    type="number"
                    name="amount"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 25000"
                    style={{
                      width: "100%",
                      padding: "12px",
                      fontSize: "16px",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="referenceCode"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.55)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Reference / Slip No.
                  </label>
                  <input
                    id="referenceCode"
                    type="text"
                    name="referenceCode"
                    placeholder="Leave blank for cash"
                    style={{
                      width: "100%",
                      padding: "12px",
                      fontSize: "14px",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontFamily: "inherit",
                    }}
                  />
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "6px" }}>
                    Required for bank receipts. Must be unique.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="billingMonth"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.55)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Billing Month *
                  </label>
                  <input
                    id="billingMonth"
                    type="month"
                    name="billingMonth"
                    defaultValue={currentMonth}
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      fontSize: "14px",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* PHASE 7: Camera capture for bank receipt photos */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  htmlFor="receiptPhoto"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Receipt Photo (Optional)
                </label>
                <input
                  id="receiptPhoto"
                  type="file"
                  name="receiptPhoto"
                  accept="image/*"
                  capture="environment"
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                />
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "6px" }}>
                  Tap to take a photo of the bank slip or receipt.
                </p>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  htmlFor="description"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Description
                </label>
                <input
                  id="description"
                  type="text"
                  name="description"
                  defaultValue={`Manual payment — ${currentMonth}`}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: "13px",
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
                Review Before Submit
              </button>
            </form>
          ) : (
            <div>
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "24px",
                  marginBottom: "24px",
                }}
              >
                <p
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    marginBottom: "20px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Payment Summary
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <ConfirmRow label="Tenant" value={selectedTenant.fullName} />
                  <ConfirmRow label="Unit" value={selectedTenant.unitNumber} />
                  <ConfirmRow label="Method" value={params.method === "BANK_RECEIPT" ? "Bank Receipt" : "Cash"} />
                  <ConfirmRow
                    label="Amount"
                    value={`KES ${Number(params.amount).toLocaleString("en-KE")}`}
                    highlight
                  />
                  <ConfirmRow
                    label="Reference"
                    value={params.referenceCode || "— (Cash payment)"}
                  />
                  <ConfirmRow label="Billing Month" value={formatMonthLabel(params.billingMonth!)} />
                  <ConfirmRow label="Description" value={params.description || "—"} />
                </div>
              </div>

              <form action={submitPayment}>
                <input type="hidden" name="buildingId" value={params.buildingId} />
                <input type="hidden" name="tenantId" value={params.tenantId} />
                <input type="hidden" name="amount" value={params.amount} />
                <input type="hidden" name="method" value={params.method} />
                <input type="hidden" name="referenceCode" value={params.referenceCode || ""} />
                <input type="hidden" name="billingMonth" value={params.billingMonth} />
                <input type="hidden" name="description" value={params.description || ""} />
                <input type="hidden" name="agentClerkId" value={userId} />

                <div style={{ display: "flex", gap: "12px" }}>
                  <Link
                    href={`/admin/agent/receipts?buildingId=${params.buildingId}&tenantId=${params.tenantId}`}
                    style={{
                      flex: 1,
                      padding: "16px 24px",
                      fontSize: "13px",
                      fontWeight: 500,
                      letterSpacing: "0.16em",
                      color: "#ffffff",
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,255,255,0.25)",
                      textDecoration: "none",
                      textTransform: "uppercase",
                      textAlign: "center",
                      display: "inline-block",
                      fontFamily: '"Helvetica Neue", sans-serif',
                    }}
                  >
                    Edit
                  </Link>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: "16px 24px",
                      fontSize: "13px",
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
                    Confirm & Log Payment
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

async function submitPayment(formData: FormData) {
  "use server";

  const session = await getSessionMeta();
  if (!["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"].includes(session.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const { logManualPayment } = await import("@/lib/ledger/manualPayments");

  const buildingId = formData.get("buildingId") as string;
  const tenantId = formData.get("tenantId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const method = formData.get("method") as "CASH" | "BANK_RECEIPT";
  const referenceCode = (formData.get("referenceCode") as string)?.trim() || null;
  const billingMonth = formData.get("billingMonth") as string;
  const description = formData.get("description") as string;
  const agentClerkId = formData.get("agentClerkId") as string;

  if (!buildingId || !tenantId || !amount || !method || !billingMonth || !agentClerkId) {
    const error = encodeURIComponent("Missing required fields");
    redirect(`/admin/agent/receipts?buildingId=${buildingId}&tenantId=${tenantId}&step=confirm&error=${error}`);
  }

  const result = await logManualPayment({
    tenantId,
    buildingId,
    agencyId: session.agencyId!,
    amount,
    method,
    referenceCode: referenceCode || null,
    description: description || `${method} payment — ${billingMonth}`,
    billingMonth,
    recordedBy: agentClerkId,
  });

  if (!result.success) {
    const error = encodeURIComponent(result.warning || "Failed to log payment");
    redirect(
      `/admin/agent/receipts?buildingId=${buildingId}&tenantId=${tenantId}&step=confirm&error=${error}`
    );
  }

  redirect(`/admin/agent/receipts?buildingId=${buildingId}&success=1`);
}

function ConfirmRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: highlight ? "18px" : "14px",
          fontWeight: highlight ? 500 : 400,
          color: highlight ? "#4ade80" : "#ffffff",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatMonthLabel(monthStr: string | undefined): string {
  if (!monthStr) return "—";
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}