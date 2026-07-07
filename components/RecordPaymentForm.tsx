"use client";

// components/admin/RecordPaymentForm.tsx
// PHASE 7: Replaced custom inline modal with accessible Radix Dialog

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { recordPayment } from "@/lib/ledger/actions";

interface Props {
  agencyId: string;
  agencyName: string;
  plan: string;
  expectedAmount: number;
}

export function RecordPaymentForm({
  agencyId,
  agencyName,
  plan,
  expectedAmount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await recordPayment({
        tenantId: agencyId,
        buildingId: agencyId,
        amount: parseFloat(formData.get("amount") as string),
        method: formData.get("method") as "CASH" | "BANK_RECEIPT" | "MPESA_STK",
        referenceCode: (formData.get("referenceCode") as string) || undefined,
        description: (formData.get("description") as string) || undefined,
      });

      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to record payment");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="text-xs tracking-widest uppercase"
      >
        Record Payment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-light tracking-tight">
              Record Payment
            </DialogTitle>
            <DialogDescription className="text-white/55">
              {agencyName} · Plan: {plan} · Expected Amount: KES{" "}
              {expectedAmount.toLocaleString("en-KE")}
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4 mt-4">
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs tracking-widest text-white/55 uppercase">
                Amount (KES) *
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="1"
                max={expectedAmount}
                required
                placeholder="e.g. 25000"
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method" className="text-xs tracking-widest text-white/55 uppercase">
                Payment Method *
              </Label>
              <select
                id="method"
                name="method"
                required
                defaultValue="CASH"
                className="w-full px-3 py-2 bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-white/40"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_RECEIPT">Bank Receipt</option>
                <option value="MPESA_STK">M-Pesa STK Push</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceCode" className="text-xs tracking-widest text-white/55 uppercase">
                Reference / Slip No.
              </Label>
              <Input
                id="referenceCode"
                name="referenceCode"
                type="text"
                placeholder="Leave blank for cash"
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs tracking-widest text-white/55 uppercase">
                Description
              </Label>
              <Input
                id="description"
                name="description"
                type="text"
                placeholder="e.g. January 2026 rent partial payment"
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1 text-xs tracking-widest uppercase border-white/25 text-white/55 hover:text-white hover:border-white/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 text-xs tracking-widest uppercase bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                {isSubmitting ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}