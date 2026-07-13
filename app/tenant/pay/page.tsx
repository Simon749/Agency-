// app/(tenant)/pay/page.tsx
// Tenant portal — view balance and trigger STK Push
// FULLY RESPONSIVE with dark theme consistent with admin pages

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { getTenantBalance } from "@/lib/ledger";
import { PayRentButton } from "./PayRentButton";

export const metadata = {
  title: 'Pay Rent — PropFlow',
};

export default async function TenantPayPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();

  // Find tenant by clerkUserId
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 400, color: '#f87171', marginBottom: '12px' }}>
          Account Not Linked
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          Your account is not linked to a tenant profile. Contact your property manager.
        </p>
      </div>
    );
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, tenant.buildingId))
    .limit(1);

  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, tenant.unitId))
    .limit(1);

  const balance = await getTenantBalance(tenant.id, tenant.agencyId);
  const hasBalance = balance.balance > 0;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        Payments
      </p>
      <h1
        style={{
          fontSize: 'clamp(28px, 3.5vw, 44px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '48px',
          color: '#ffffff',
        }}
      >
        Pay Rent
      </h1>

      {/* Balance Card */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '28px 24px',
          marginBottom: '24px',
        }}
      >
        {/* Building / Unit row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Building
            </p>
            <p style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>
              {building?.name || '—'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Unit
            </p>
            <p style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>
              {unit?.unitNumber || '—'}
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Outstanding Balance
          </p>
          <p
            style={{
              fontSize: '36px',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              color: hasBalance ? '#f87171' : '#4ade80',
              lineHeight: 1,
            }}
          >
            KES {balance.balance.toLocaleString("en-KE")}
          </p>
        </div>

        {/* Totals */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            padding: '16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Charged
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              KES {balance.totalCharged.toLocaleString("en-KE")}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Paid
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              KES {balance.totalPaid.toLocaleString("en-KE")}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Action */}
      {hasBalance ? (
        <PayRentButton
          tenantId={tenant.id}
          buildingId={tenant.buildingId}
          phone={tenant.phone}
          amount={balance.balance}
          unitNumber={unit?.unitNumber ?? ""}
        />
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.15)',
            padding: '20px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#4ade80', fontWeight: 500 }}>
            You&apos;re all paid up! 
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            No outstanding balance on your account.
          </p>
        </div>
      )}
    </div>
  );
}