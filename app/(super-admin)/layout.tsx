import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/getRole";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import Link from "next/link";
import Loading from "@/app/loading";

const superAdminNavItems = [
  { href: "/super-admin/dashboard", label: "Dashboard" },
  { href: "/super-admin/agencies", label: "Agencies" },
  { href: "/super-admin/subscriptions", label: "Subscription Payments" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Suspense fallback={<Loading />}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    </div>
  );
}

async function LayoutContent({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireRole(["SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    redirect("/sign-in");
  }

  return (
    <>
      <ResponsiveNavbar role="SUPER_ADMIN" navItems={superAdminNavItems} />

      <div className="pt-16">
        <div className="flex">
          {/* 
            DESKTOP SIDEBAR — STICKY
            - Stays fixed while scrolling
            - Full viewport height minus navbar
            - Scrollable if nav items overflow
          */}
          <aside className="hidden md:block md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-56 md:flex-shrink-0 md:overflow-y-auto md:border-r md:border-white/10 md:bg-slate-950/95 md:px-4 md:py-6">
            <div className="flex flex-col gap-1">
              {superAdminNavItems.map((item) => (
                <SidebarLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </aside>

          {/* 
            MAIN CONTENT
            - Responsive padding
            - min-w-0 prevents flex overflow issues
          */}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10 min-w-0">
            {children}
          </main>
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