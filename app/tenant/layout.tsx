import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants } from "@/db/schema";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import Link from "next/link";
import Loading from "@/app/loading";
import SignOutCTA from "@/components/auth/SignOutCTA";

const navItems = [
  { href: "/tenant/dashboard", label: "Dashboard" },
  { href: "/tenant/pay", label: "Pay Rent" },
  { href: "/tenant/lease", label: "My Lease" },
  { href: "/tenant/complaints", label: "Complaints" },
];

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Suspense fallback={<Loading />}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    </div>
  );
}

async function LayoutContent({ children }: { children: React.ReactNode }) {
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
    <>
      <ResponsiveNavbar
        role="TENANT"
        navItems={navItems}
        userName={tenant.fullName}
      />

      <div className="pt-16">
        <div className="md:flex">
          {/* Desktop Sidebar */}
          <aside className="hidden w-56 flex-shrink-0 border-r border-white/10 bg-black px-4 py-6 md:flex md:flex-col md:justify-between">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <SidebarLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>

            {/* Account / Sign out */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <p className="px-4 text-xs text-white/40 truncate mb-3">
                {tenant.fullName}
              </p>
              <div className="px-4">
                
              </div>
            </div>
          </aside>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-sm px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </Link>
  );
}