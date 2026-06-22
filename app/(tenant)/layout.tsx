import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants } from "@/db/schema";
import Link from "next/link";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome to PropFlow</h1>
          <p className="text-gray-400 mb-6">
            Your account is being set up. Please check your email for the invite link.
          </p>
        </div>
      </div>
    );
  }

  if (tenant.status !== "ACTIVE") {
    redirect("/deactivated");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href="/tenant/dashboard" className="text-lg font-medium tracking-tight">
            PropFlow
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/tenant/dashboard" className="text-white/60 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/tenant/pay" className="text-white/60 hover:text-white transition">
              Pay Rent
            </Link>
            <Link href="/tenant/lease" className="text-white/60 hover:text-white transition">
              My Lease
            </Link>
            <Link href="/tenant/complaints" className="text-white/60 hover:text-white transition">
              Complaints
            </Link>
            <span className="text-white/40 text-xs truncate max-w-[180px]">
              {tenant.fullName}
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
