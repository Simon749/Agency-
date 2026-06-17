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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome to PropFlow</h1>
          <p className="text-gray-400 mb-6">
            Your account is being set up. Please check your email for the invite link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/tenant/dashboard" className="text-lg font-medium tracking-tight">
            PropFlow
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/tenant/dashboard"
              className="text-white/60 hover:text-white transition"
            >
              Dashboard
            </Link>
            <Link
              href="/tenant/pay"
              className="text-white/60 hover:text-white transition"
            >
              Pay Rent
            </Link>
            <Link
              href="/tenant/lease"
              className="text-white/60 hover:text-white transition"
            >
              My Lease
            </Link>
            <Link
              href="/tenant/complaints"
              className="text-white/60 hover:text-white transition"
            >
              Complaints
            </Link>
            <span className="text-white/40 text-xs">
              {tenant.fullName}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}