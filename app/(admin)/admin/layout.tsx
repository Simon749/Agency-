import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/getRole";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import Link from "next/link";
import Loading from "@/app/loading";
import { OfflineBanner } from "@/components/OfflineBanner";

const allNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/buildings", label: "Buildings", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/tenants", label: "Tenants", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/leases", label: "Leases", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/complaints", label: "Complaints", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/arrears", label: "Arrears", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/agent/arrears", label: "Arrears", roles: ["FIELD_AGENT"] },
  { href: "/admin/agent/meter-readings", label: "Meter Readings", roles: ["FIELD_AGENT", "MANAGER", "AGENCY_OWNER"] },
  { href: "/admin/agent/receipts", label: "Receipts", roles: ["FIELD_AGENT", "MANAGER", "AGENCY_OWNER"] },
  { href: "/admin/settings", label: "Settings", roles: ["AGENCY_OWNER"] },
];

export default async function AdminLayout({
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
    session = await requireRole(["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    redirect("/sign-in");
  }

  const { role } = session;
  const navItems = allNavItems
    .filter((item) => item.roles.includes(role!))
    .map(({ href, label }) => ({ href, label }));

  return (
    <>
      <ResponsiveNavbar role={role!} navItems={navItems} />

      <div className="pt-16">
        <div className="flex">
          {/* 
            DESKTOP SIDEBAR — STICKY
            - Fixed position on desktop (md and up)
            - Stays visible while scrolling
            - Full viewport height with scrollable overflow
          */}
          <aside 
            className="hidden md:block md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-56 md:flex-shrink-0 md:overflow-y-auto md:border-r md:border-white/10 md:bg-slate-950/95 md:px-4 md:py-6"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <SidebarLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </aside>

          {/* 
            MAIN CONTENT
            - Responsive padding: px-4 on mobile, md:px-8 on desktop
            - py-6 on mobile, md:py-10 on desktop
            - flex-1 to fill remaining space
          */}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10 min-w-0">
            {children}
          </main>

          <OfflineBanner />
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