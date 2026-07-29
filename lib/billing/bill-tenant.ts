// lib/billing/bill-tenant.ts
import { getDb } from "@/lib/db";
import { tenants, tenantLedger, buildings, buildingUtilities, units, leases } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendSms } from "@/lib/sms/sendSms"; // Your existing AT wrapper

export interface BillTenantResult {
    tenantId: string;
    success: boolean;
    debitsCreated: number;
    error?: string;
}

export async function billSingleTenant(
    tenantId: string,
    billingMonth: string,
    billingRunId: string
): Promise<BillTenantResult> {

    const db = getDb();
    return await db.transaction(async (tx) => {
        // ─── 1. IDEMPOTENCY CHECK ───
        // If this tenant already has a RENT debit for this month, skip entirely
        const existingRentDebit = await tx
            .select({ id: tenantLedger.id })
            .from(tenantLedger)
            .where(
                and(
                    eq(tenantLedger.tenantId, tenantId),
                    eq(tenantLedger.category, "RENT"),
                    eq(tenantLedger.billingMonth, billingMonth)
                )
            )
            .limit(1);

        if (existingRentDebit.length > 0) {
            return { tenantId, success: true, debitsCreated: 0 };
        }

        // ─── 2. FETCH TENANT + BUILDING DATA ───
        const [tenant] = await tx
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

        if (!tenant) throw new Error("Tenant not found");
        if (tenant.status !== "ACTIVE") {
            return { tenantId, success: true, debitsCreated: 0 };
        }

        const [unit] = await tx
            .select()
            .from(units)
            .where(eq(units.id, tenant.unitId))
            .limit(1);

        const [building] = await tx
            .select()
            .from(buildings)
            .where(eq(buildings.id, tenant.buildingId))
            .limit(1);

        const [lease] = await tx
            .select()
            .from(leases)
            .where(
                and(
                    eq(leases.tenantId, tenantId),
                    eq(leases.status, "ACTIVE")
                )
            )
            .limit(1);

        if (!unit || !building || !lease) {
            throw new Error("Missing unit/building/lease data");
        }

        let debitsCreated = 0;

        // ─── 3. PREVIOUS BALANCE ───
        const ledgerRows = await tx
            .select({ type: tenantLedger.type, amount: tenantLedger.amount })
            .from(tenantLedger)
            .where(eq(tenantLedger.tenantId, tenantId));

        const debits = ledgerRows
            .filter((r) => r.type === "DEBIT")
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);
        const credits = ledgerRows
            .filter((r) => r.type === "CREDIT")
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);
        const previousBalance = debits - credits;

        if (previousBalance > 0) {
            await tx.insert(tenantLedger).values({
                tenantId,
                buildingId: tenant.buildingId,
                agencyId: tenant.agencyId,
                type: "DEBIT",
                category: "PREVIOUS_BALANCE",
                amount: previousBalance.toFixed(2),
                description: `Outstanding balance brought forward — ${billingMonth}`,
                billingMonth,
                recordedBy: "SYSTEM",
            });
            debitsCreated++;
        }

        // ─── 4. CURRENT MONTH RENT ───
        await tx.insert(tenantLedger).values({
            tenantId,
            buildingId: tenant.buildingId,
            agencyId: tenant.agencyId,
            type: "DEBIT",
            category: "RENT",
            amount: lease.rentAmount,
            description: `Rent for ${billingMonth}`,
            billingMonth,
            recordedBy: "SYSTEM",
        });
        debitsCreated++;

        // ─── 5. FIXED UTILITIES ───
        const fixedUtilities = await tx
            .select()
            .from(buildingUtilities)
            .where(
                and(
                    eq(buildingUtilities.buildingId, tenant.buildingId),
                    eq(buildingUtilities.isEnabled, true),
                    eq(buildingUtilities.rateType, "FIXED")
                )
            );

        for (const util of fixedUtilities) {
            await tx.insert(tenantLedger).values({
                tenantId,
                buildingId: tenant.buildingId,
                agencyId: tenant.agencyId,
                type: "DEBIT",
                category: util.name, // WATER, GARBAGE, etc.
                amount: util.defaultAmount ?? "0.00",
                description: `${util.name} charge for ${billingMonth}`,
                billingMonth,
                recordedBy: "SYSTEM",
            });
            debitsCreated++;
        }

        // ─── 6. SMS NOTIFICATION ───
        // Fire-and-forget; don't fail the transaction if SMS fails
        const totalNewCharges = parseFloat(lease.rentAmount) +
            // line 154
            fixedUtilities.reduce((s, u) => s + parseFloat(u.defaultAmount ?? "0"), 0) +
            (previousBalance > 0 ? previousBalance : 0);


        const smsMessage =
            `PropFlow: Your ${billingMonth} rent bill is ready. ` +
            `Total charges: KES ${totalNewCharges.toLocaleString("en-KE")}. ` +
            `Prev balance: KES ${previousBalance.toLocaleString("en-KE")}. ` +
            `Pay via your tenant portal: ${process.env.NEXT_PUBLIC_APP_URL}/tenant/pay`;

        sendSms(tenant.phone, smsMessage).catch((err) =>
            console.error("SMS failed for tenant", tenantId, err)
        );

        return { tenantId, success: true, debitsCreated };
    });
}