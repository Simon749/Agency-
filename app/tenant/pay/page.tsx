// app/(tenant)/pay/page.tsx
// Tenant portal — view balance and trigger STK Push

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, buildings, units } from "@/db/schema";
import { getTenantBalance } from "@/lib/ledger";
import { PayRentButton } from "./PayRentButton";

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
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Account Not Linked</h1>
        <p className="mt-2 text-gray-600">
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

  const balance = await getTenantBalance(tenant.id);

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Pay Rent</h1>

      <div className="bg-white rounded-lg border p-6 space-y-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Building</span>
          <span className="font-medium text-gray-900">{building?.name}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Unit</span>
          <span className="font-medium text-gray-900">{unit?.unitNumber}</span>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600">Outstanding Balance</p>
          <p
            className={`text-3xl font-bold ${
              balance.balance > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            KES {balance.balance.toLocaleString("en-KE")}
          </p>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Total Charged: KES {balance.totalCharged.toLocaleString("en-KE")}</p>
          <p>Total Paid: KES {balance.totalPaid.toLocaleString("en-KE")}</p>
        </div>
      </div>

      {balance.balance > 0 ? (
        <PayRentButton
          tenantId={tenant.id}
          buildingId={tenant.buildingId}
          phone={tenant.phone}
          amount={balance.balance}
          unitNumber={unit?.unitNumber ?? ""}
        />
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-medium">You're all paid up! 🎉</p>
        </div>
      )}
    </div>
  );
}