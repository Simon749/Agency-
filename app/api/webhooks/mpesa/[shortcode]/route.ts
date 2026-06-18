// app/api/webhooks/mpesa/[shortcode]/route.ts
// Handles Daraja STK Push callback — updates pending_transactions + inserts ledger CREDIT + sends SMS

import { NextRequest, NextResponse } from "next/server";
import { getPendingTransaction, updatePendingTransaction, insertPaymentCredit } from "@/lib/ledger";
import { sendPaymentReceivedSms, sendPaymentFailedSms } from "@/lib/sms/triggers";
import type { StkCallbackBody } from "@/lib/daraja/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ shortcode: string }> }) {
    const { shortcode } = await params;

    try {
        const body = (await req.json()) as StkCallbackBody;
        const callback = body.stkCallback;

        if (!callback) {
            return NextResponse.json({ error: "Invalid callback body" }, { status: 400 });
        }

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

        // Find pending transaction
        const pendingTx = await getPendingTransaction(CheckoutRequestID);

        if (!pendingTx) {
            console.error(`No pending transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        }

        // ── Payment FAILED ─────────────────────────────────────────────────────
        if (ResultCode !== 0) {
            await updatePendingTransaction(CheckoutRequestID, {
                status: "FAILED",
                resultCode: ResultCode.toString(),
                resultDesc: ResultDesc,
            });

            // Send failure SMS
            await sendPaymentFailedSms(
                pendingTx.tenantId,
                pendingTx.amount,
                ResultDesc
            );

            return NextResponse.json({ result: "Failed recorded, SMS sent" });
        }

        // ── Payment SUCCEEDED ──────────────────────────────────────────────────
        const metadata = CallbackMetadata?.Item ?? [];
        const mpesaReceiptNumber = metadata.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string | undefined;
        const amount = metadata.find((i) => i.Name === "Amount")?.Value as number | undefined;
        const billingMonth = new Date().toISOString().slice(0, 7);

        // Idempotency: check if already completed
        if (pendingTx.status === "COMPLETED") {
            return NextResponse.json({ result: "Already processed" });
        }

        // Update pending transaction
        await updatePendingTransaction(CheckoutRequestID, {
            status: "COMPLETED",
            resultCode: ResultCode.toString(),
            resultDesc: ResultDesc,
            mpesaReceiptNumber,
        });

        // Insert CREDIT into tenant_ledger
        const ledgerResult = await insertPaymentCredit({
            tenantId: pendingTx.tenantId,
            buildingId: pendingTx.buildingId,
            agencyId: pendingTx.agencyId,
            category: 'RENT',
            amount: amount?.toString() ?? pendingTx.amount,
            billingMonth,
            description: `M-Pesa STK Push — ${mpesaReceiptNumber ?? 'N/A'}`,
            referenceCode: mpesaReceiptNumber ?? CheckoutRequestID,
            method: 'MPESA_STK',
            recordedBy: 'system',
        });

        // Send payment confirmation SMS
        await sendPaymentReceivedSms(
            pendingTx.tenantId,
            amount?.toString() ?? pendingTx.amount,
            mpesaReceiptNumber ?? CheckoutRequestID,
            billingMonth
        );

        return NextResponse.json({
            result: "Success",
            ledgerId: ledgerResult.ledgerId,
            alreadyExists: ledgerResult.alreadyExists,
            smsSent: true,
        });
    } catch (err) {
        console.error(`M-Pesa callback error for shortcode ${shortcode}:`, err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}